#!/usr/bin/env bash
set -e

REPO="lqhunter/my_nas"
GIT_URL="${GIT_URL:-https://github.com/lqhunter/my_nas.git}"
GHCR_MIRROR="${GHCR_MIRROR:-ghcr.io}"
CODE_DIR="${CODE_DIR:-/opt/my_nas}"
MEDIA_DIR="${MEDIA_DIR:-/mnt/disk/nas}"
PORT="${PORT:-8080}"
QUARKDRIVE_PORT="${QUARKDRIVE_PORT:-$((PORT + 1))}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${BLUE}>>> Media Server + QuarkDrive Installer${NC}"

if ! command -v docker &>/dev/null; then
    echo -e "${RED}>>> Docker not found. Install first: curl -fsSL https://get.docker.com | sh${NC}"
    exit 1
fi

if ! command -v git &>/dev/null; then
    echo -e "${RED}>>> git not found. Install first: apt-get install -y git${NC}"
    exit 1
fi

# 1. Clone / update source code
if [ ! -d "$CODE_DIR/.git" ]; then
    echo -e "${BLUE}>>> Cloning source code to $CODE_DIR ...${NC}"
    mkdir -p "$CODE_DIR"
    git clone "$GIT_URL" "$CODE_DIR"
else
    echo -e "${BLUE}>>> Updating source code ...${NC}"
    git -C "$CODE_DIR" pull --ff-only || echo -e "${RED}>>> git pull failed, continue with existing code${NC}"
fi

mkdir -p "$MEDIA_DIR"

# Compute version from git commit count
COMMIT_COUNT=$(git -C "$CODE_DIR" rev-list --count HEAD 2>/dev/null || echo "0")
VERSION="1.0.$COMMIT_COUNT"
echo -e "${BLUE}>>> App version: $VERSION${NC}"

# 2. Pull base image (only deps, code is mounted). Skip if already pulled.
PULL_TARGET="ghcr.io/$REPO"
if [ "$GHCR_MIRROR" != "ghcr.io" ]; then
    PULL_TARGET="$GHCR_MIRROR/$REPO"
fi

if ! docker image inspect ghcr.io/$REPO:latest &>/dev/null; then
    echo -e "${BLUE}>>> Pulling base image (source: $PULL_TARGET)...${NC}"
    docker pull $PULL_TARGET:latest
    if [ "$GHCR_MIRROR" != "ghcr.io" ]; then
        docker tag $PULL_TARGET:latest ghcr.io/$REPO:latest
    fi
fi
if ! docker image inspect ghcr.io/$REPO:quarkdrive &>/dev/null; then
    docker pull $PULL_TARGET:quarkdrive
    if [ "$GHCR_MIRROR" != "ghcr.io" ]; then
        docker tag $PULL_TARGET:quarkdrive ghcr.io/$REPO:quarkdrive
    fi
fi

# 3. Run / restart containers (code mounted from disk -> no rebuild needed)
echo -e "${BLUE}>>> Starting media-server on port $PORT, media: $MEDIA_DIR${NC}"
docker rm -f media-server 2>/dev/null || true
docker run -d \
    --name media-server \
    --restart unless-stopped \
    -p $PORT:8000 \
    -v "$CODE_DIR/backend":/app/backend \
    -v "$CODE_DIR/frontend":/app/frontend \
    -v "$MEDIA_DIR":/media \
    -v media_config:/app/config \
    -e APP_VERSION="$VERSION" \
    ghcr.io/$REPO:latest

echo -e "${BLUE}>>> Starting quarkdrive on port $QUARKDRIVE_PORT${NC}"
docker rm -f quarkdrive 2>/dev/null || true
docker run -d \
    --name quarkdrive \
    --restart unless-stopped \
    -p $QUARKDRIVE_PORT:8080 \
    -v "$CODE_DIR/quarkdrive":/app \
    -v quarkdrive_data:/data \
    ghcr.io/$REPO:quarkdrive

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Media Server:  http://localhost:$PORT${NC}"
echo -e "${GREEN}  QuarkDrive:    http://localhost:$QUARKDRIVE_PORT${NC}"
echo -e "${GREEN}  Media: $MEDIA_DIR${NC}"
echo -e "${GREEN}  Code:  $CODE_DIR${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next update after code changes:${NC}"
echo -e "  bash $CODE_DIR/install.sh"
echo -e "  (git pull + container restart, no image download)"
