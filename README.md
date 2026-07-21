# Media Server

基于 FastAPI 的媒体服务器，支持在浏览器中管理文件、在线观看视频和听音乐。

## 前置要求

安装 Docker：

```bash
curl -fsSL https://get.docker.com | sh
```

国内服务器需要配置 Docker 镜像源加速，否则拉取镜像会失败：

```bash
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://docker.1panel.live"]
}
EOF
systemctl restart docker
```

如果 `1panel.live` 不可用，替换为 `docker.1ms.run`。

## 一键安装

```bash
bash <(curl -sSL https://raw.githubusercontent.com/lqhunter/my_nas/master/install.sh)
```

默认挂载 `~/media` 目录，访问 `http://设备IP:8080`。

## 功能

- 文件管理：浏览、上传、下载、重命名、删除、新建文件夹
- 视频串流：在线播放，支持拖拽进度（HTTP Range）
- 音频播放：在线听歌
- 拖拽上传：支持进度条
- 网格/列表双视图，多种排序
- 自动生成视频缩略图（需 ffmpeg）
- 深色主题，响应式适配

## 手动运行

```bash
docker run -d --name media-server --restart unless-stopped \
  -p 8080:8000 \
  -v /path/to/media:/media \
  ghcr.io/lqhunter/my_nas:latest
```

## 开发

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

## 技术栈

- **后端**: Python FastAPI
- **前端**: Vanilla JS, CSS3
- **容器**: Docker, 支持 amd64/arm64
