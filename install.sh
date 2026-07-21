#!/usr/bin/env bash
set -e

REPO="lqhunter/my_nas"
BRANCH="master"
MEDIA_DIR="${MEDIA_DIR:-$HOME/media}"
PORT="${PORT:-8080}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${BLUE}>>> Media Server Installer${NC}"

DOCKER=$(command -v docker)
if [ -z "$DOCKER" ]; then
    echo -e "${RED}>>> Docker not found. Install first: curl -fsSL https://get.docker.com | sh${NC}"
    exit 1
fi

# Fix broken Docker registry mirror (common issue in China)
CURRENT_MIRROR=$(docker info 2>/dev/null | grep -i "registry-mirror" -A1 | tail -1 | tr -d '[:space:]')
if echo "$CURRENT_MIRROR" | grep -q "baidubce.com"; then
    echo -e "${BLUE}>>> Fixing Docker mirror...${NC}"
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://docker.nju.edu.cn"]
}
EOF
    systemctl daemon-reload 2>/dev/null || true
    systemctl restart docker 2>/dev/null || service docker restart 2>/dev/null || {
        echo -e "${RED}>>> Restart Docker failed, do it manually: systemctl restart docker${NC}"
        exit 1
    }
    sleep 3
fi

mkdir -p "$MEDIA_DIR"

if [ ! -f "docker-compose.yml" ]; then
    echo -e "${BLUE}>>> Downloading Media Server...${NC}"
    curl -sSL "https://github.com/$REPO/archive/$BRANCH.tar.gz" | tar -xz --strip=1
fi

echo -e "${BLUE}>>> Starting on port $PORT, media: $MEDIA_DIR${NC}"
MEDIA_ROOT="$MEDIA_DIR" PORT="$PORT" docker compose -p media-server up -d --build

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  http://localhost:$PORT${NC}"
echo -e "${GREEN}  Media: $MEDIA_DIR${NC}"
echo -e "${GREEN}========================================${NC}"
