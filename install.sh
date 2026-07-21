#!/usr/bin/env bash
set -e

REPO="lqhunter/my_nas"
BRANCH="master"
MEDIA_DIR="${MEDIA_DIR:-$HOME/media}"
PORT="${PORT:-8080}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${BLUE}>>> Media Server Installer${NC}"

# Locate docker binary
DOCKER=""
for p in /usr/bin/docker /usr/local/bin/docker /snap/bin/docker; do
    [ -x "$p" ] && DOCKER="$p" && break
done

if [ -z "$DOCKER" ]; then
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
    for p in /usr/bin/docker /usr/local/bin/docker; do
        [ -x "$p" ] && DOCKER="$p" && break
    done
    # Search wider if still not found
    if [ -z "$DOCKER" ]; then
        DOCKER=$(find / -name docker -type f 2>/dev/null | head -1)
    fi
    if [ -z "$DOCKER" ]; then
        echo -e "${RED}>>> Docker binary not found after install${NC}"
        exit 1
    fi
fi

mkdir -p "$MEDIA_DIR"

# Download if needed
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${BLUE}>>> Downloading Media Server...${NC}"
    curl -sSL "https://github.com/$REPO/archive/$BRANCH.tar.gz" | tar -xz --strip=1
fi

echo -e "${BLUE}>>> Starting Media Server on port $PORT...${NC}"
echo -e "${BLUE}>>> Media directory: $MEDIA_DIR${NC}"

# Resolve compose command
COMPOSE=""
if $DOCKER compose version &>/dev/null; then
    COMPOSE="$DOCKER compose"
elif command -v docker-compose &>/dev/null; then
    COMPOSE="docker-compose"
else
    echo -e "${BLUE}>>> Installing Docker Compose plugin...${NC}"
    apt-get install -y -qq docker-compose-v2 2>/dev/null && COMPOSE="$DOCKER compose" || true
    if [ -z "$COMPOSE" ]; then
        echo -e "${BLUE}>>> Downloading docker-compose binary...${NC}"
        curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose && COMPOSE="docker-compose"
    fi
fi

if [ -z "$COMPOSE" ]; then
    echo -e "${RED}>>> Docker Compose unavailable. Run manually: apt install docker-compose-plugin${NC}"
    exit 1
fi

MEDIA_ROOT="$MEDIA_DIR" PORT="$PORT" $COMPOSE -p media-server up -d --build

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  http://localhost:$PORT${NC}"
echo -e "${GREEN}  Media: $MEDIA_DIR${NC}"
echo -e "${GREEN}========================================${NC}"
