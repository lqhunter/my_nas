#!/usr/bin/env bash
set -e

REPO="lqhunter/my_nas"
MEDIA_DIR="${MEDIA_DIR:-/mnt/usb}"
PORT="${PORT:-8080}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${BLUE}>>> Media Server Installer${NC}"

if ! command -v docker &>/dev/null; then
    echo -e "${RED}>>> Docker not found. Install first: curl -fsSL https://get.docker.com | sh${NC}"
    exit 1
fi

mkdir -p "$MEDIA_DIR"

echo -e "${BLUE}>>> Pulling image...${NC}"
docker pull ghcr.io/$REPO:latest

echo -e "${BLUE}>>> Starting on port $PORT, media: $MEDIA_DIR${NC}"
docker rm -f media-server 2>/dev/null || true
docker run -d \
    --name media-server \
    --restart unless-stopped \
    -p $PORT:8000 \
    -v "$MEDIA_DIR":/media \
    ghcr.io/$REPO:latest

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  http://localhost:$PORT${NC}"
echo -e "${GREEN}  Media: $MEDIA_DIR${NC}"
echo -e "${GREEN}========================================${NC}"
