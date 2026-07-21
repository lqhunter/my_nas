#!/usr/bin/env bash
set -e

REPO="lqhunter/my_nas"
BRANCH="master"
MEDIA_DIR="${MEDIA_DIR:-$HOME/media}"
PORT="${PORT:-8080}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${BLUE}>>> Media Server Installer${NC}"

if ! command -v docker &>/dev/null; then
    echo -e "${BLUE}>>> Installing Docker...${NC}"
    apt-get update -qq 2>/dev/null || true
    apt-get install -y -qq docker.io 2>/dev/null || {
        echo -e "${BLUE}>>> Trying official script...${NC}"
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sh /tmp/get-docker.sh || {
            echo -e "${RED}>>> Install Docker manually: https://docs.docker.com/engine/install/${NC}"
            exit 1
        }
    }
    hash -r
    DOCKER=$(command -v docker || which docker || echo "/usr/bin/docker")
    if [ ! -f "$DOCKER" ]; then
        DOCKER=$(find /usr/bin /usr/local/bin -name docker -type f 2>/dev/null | head -1)
    fi
    if [ -f "$DOCKER" ]; then
        ln -sf "$DOCKER" /usr/local/bin/docker 2>/dev/null || true
        hash -r
    fi
fi

if ! docker compose version &>/dev/null && ! command -v docker-compose &>/dev/null; then
    echo -e "${BLUE}>>> Installing Docker Compose...${NC}"
    apt-get install -y -qq docker-compose-plugin 2>/dev/null || true
fi

mkdir -p "$MEDIA_DIR"

# Use current directory if already cloned, otherwise download here
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${BLUE}>>> Downloading Media Server...${NC}"
    curl -sSL "https://github.com/$REPO/archive/$BRANCH.tar.gz" | tar -xz --strip=1
fi

echo -e "${BLUE}>>> Starting Media Server on port $PORT...${NC}"
echo -e "${BLUE}>>> Media directory: $MEDIA_DIR${NC}"

MEDIA_ROOT="$MEDIA_DIR" PORT="$PORT" docker compose -p media-server up -d --build

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  http://localhost:$PORT${NC}"
echo -e "${GREEN}  Media: $MEDIA_DIR${NC}"
echo -e "${GREEN}========================================${NC}"
