#!/usr/bin/env bash
set -e

REPO="${REPO:-lqhunter/my_nas}"
BRANCH="${BRANCH:-master}"
MEDIA_DIR="${MEDIA_DIR:-$HOME/media}"
PORT="${PORT:-8080}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}>>> Media Server Installer${NC}"

if ! command -v docker &>/dev/null; then
    echo -e "${BLUE}>>> Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
fi

mkdir -p "$MEDIA_DIR"

TMP_DIR=$(mktemp -d)
echo -e "${BLUE}>>> Downloading Media Server...${NC}"
git clone --depth 1 -b "$BRANCH" "https://github.com/$REPO.git" "$TMP_DIR"

cd "$TMP_DIR"
echo -e "${BLUE}>>> Starting Media Server on port $PORT...${NC}"
echo -e "${BLUE}>>> Media directory: $MEDIA_DIR${NC}"

MEDIA_ROOT="$MEDIA_DIR" docker compose -p media-server up -d

rm -rf "$TMP_DIR"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Media Server is running!${NC}"
echo -e "${GREEN}  http://localhost:$PORT${NC}"
echo -e "${GREEN}  Media: $MEDIA_DIR${NC}"
echo -e "${GREEN}========================================${NC}"
