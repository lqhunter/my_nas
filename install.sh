#!/usr/bin/env bash
set -e

REPO="${REPO:-anomalyco/media-server}"
BRANCH="${BRANCH:-master}"
MEDIA_DIR="${MEDIA_DIR:-$HOME/media}"
PORT="${PORT:-8080}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}>>> Media Server Installer${NC}"

if ! command -v docker &>/dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi

mkdir -p "$MEDIA_DIR"

echo -e "${BLUE}>>> Starting Media Server on port $PORT...${NC}"
echo -e "${BLUE}>>> Media directory: $MEDIA_DIR${NC}"

echo -e "${BLUE}>>> Pulling latest image...${NC}"
sudo docker pull "ghcr.io/$REPO:latest" 2>/dev/null || {
    echo -e "${BLUE}>>> Building image locally...${NC}"
    TMP_DIR=$(mktemp -d)
    git clone --depth 1 -b "$BRANCH" "https://github.com/$REPO.git" "$TMP_DIR"
    cd "$TMP_DIR"
    sudo docker build -t "ghcr.io/$REPO:latest" .
    rm -rf "$TMP_DIR"
}

sudo docker rm -f media-server 2>/dev/null || true
sudo docker run -d \
    --name media-server \
    --restart unless-stopped \
    -p $PORT:8000 \
    -v "$MEDIA_DIR":/media \
    "ghcr.io/$REPO:latest"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Media Server is running!${NC}"
echo -e "${GREEN}  Open: http://$(curl -s ifconfig.me):$PORT${NC}"
echo -e "${GREEN}  Or:   http://localhost:$PORT${NC}"
echo -e "${GREEN}  Media: $MEDIA_DIR${NC}"
echo -e "${GREEN}========================================${NC}"
