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
    apt-get install -y -qq docker.io docker-compose-v2 2>/dev/null || {
        echo -e "${BLUE}>>> Trying official script...${NC}"
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sh /tmp/get-docker.sh || {
            echo -e "${RED}>>> Install Docker manually: https://docs.docker.com/engine/install/${NC}"
            exit 1
        }
    }
    hash -r
fi

mkdir -p "$MEDIA_DIR"

echo -e "${BLUE}>>> Downloading...${NC}"
curl -sSL "https://github.com/$REPO/archive/$BRANCH.tar.gz" | tar -xz --strip=1 -C /tmp/my_nas
cd /tmp/my_nas

echo -e "${BLUE}>>> Starting on port $PORT, media: $MEDIA_DIR${NC}"
MEDIA_ROOT="$MEDIA_DIR" PORT="$PORT" docker compose -p media-server up -d --build

cd / && rm -rf /tmp/my_nas

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  http://localhost:$PORT${NC}"
echo -e "${GREEN}  Media: $MEDIA_DIR${NC}"
echo -e "${GREEN}========================================${NC}"
