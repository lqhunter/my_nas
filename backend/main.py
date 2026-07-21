import os
import mimetypes
import json
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import Response, FileResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="Media Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/media")
THUMBNAIL_DIR = os.environ.get("THUMBNAIL_DIR", "/tmp/thumbnails")
CONFIG_DIR = os.environ.get("CONFIG_DIR", "/app/config")
SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.json")

os.makedirs(THUMBNAIL_DIR, exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)

DEFAULT_SETTINGS = {
    "mediaRoot": MEDIA_ROOT,
    "port": 8000,
    "defaultSort": "name",
    "defaultView": "grid",
    "thumbnailSize": 300,
}

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                return {**DEFAULT_SETTINGS, **json.load(f)}
        except Exception:
            pass
    return dict(DEFAULT_SETTINGS)

def save_settings(settings):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)

def get_media_root():
    return load_settings().get("mediaRoot", MEDIA_ROOT)

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

mimetypes.init()

def safe_path(user_path: str) -> Path:
    user_path = user_path.lstrip("/")
    root = Path(get_media_root())
    resolved = (root / user_path).resolve()
    if not str(resolved).startswith(os.path.realpath(root)):
        raise HTTPException(403, "Access denied")
    return resolved

def get_file_type(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext in {"mp4", "webm", "mkv", "avi", "mov", "wmv", "flv", "m4v", "ts", "m3u8"}:
        return "video"
    if ext in {"mp3", "wav", "flac", "ogg", "aac", "m4a", "wma", "opus"}:
        return "audio"
    if ext in {"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico"}:
        return "image"
    if ext in {"pdf"}:
        return "pdf"
    if ext in {"zip", "rar", "7z", "tar", "gz", "bz2"}:
        return "archive"
    if ext in {"txt", "md", "json", "xml", "yaml", "yml", "csv", "log", "conf", "ini", "cfg"}:
        return "text"
    return "unknown"

def format_size(size_bytes: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"

def format_mtime(timestamp: float) -> str:
    return time.strftime("%Y-%m-%d %H:%M", time.localtime(timestamp))

# --- File Listing ---

@app.get("/api/files")
async def list_files(path: str = "", sort: str = "name", order: str = "asc"):
    target = safe_path(path)
    if not target.exists():
        raise HTTPException(404, "Path not found")
    if target.is_file():
        stat = target.stat()
        return {
            "type": "file",
            "name": target.name,
            "path": str(target.relative_to(get_media_root())).replace("\\", "/"),
            "size": stat.st_size,
            "size_formatted": format_size(stat.st_size),
            "mtime": stat.st_mtime,
            "mtime_formatted": format_mtime(stat.st_mtime),
            "file_type": get_file_type(target.name),
            "is_directory": False,
        }

    items = []
    for entry in target.iterdir():
        try:
            stat = entry.stat()
            rel_path = str(entry.relative_to(get_media_root())).replace("\\", "/")
            items.append({
                "name": entry.name,
                "path": rel_path,
                "size": stat.st_size if entry.is_file() else 0,
                "size_formatted": format_size(stat.st_size) if entry.is_file() else "-",
                "mtime": stat.st_mtime,
                "mtime_formatted": format_mtime(stat.st_mtime),
                "file_type": get_file_type(entry.name) if entry.is_file() else "folder",
                "is_directory": entry.is_dir(),
            })
        except (PermissionError, OSError):
            pass

    reverse = order.lower() == "desc"
    if sort == "name":
        items.sort(key=lambda x: (not x["is_directory"], x["name"].lower()), reverse=reverse)
    elif sort == "size":
        items.sort(key=lambda x: (not x["is_directory"], x["size"]), reverse=reverse)
    elif sort == "mtime":
        items.sort(key=lambda x: (not x["is_directory"], x["mtime"]), reverse=reverse)
    elif sort == "type":
        items.sort(key=lambda x: (not x["is_directory"], x["file_type"], x["name"].lower()), reverse=reverse)

    root_path = Path(get_media_root())
    current_path = str(target.relative_to(root_path)).replace("\\", "/") if target != root_path else ""
    breadcrumbs = []
    if current_path:
        parts = current_path.replace("\\", "/").split("/")
        for i in range(len(parts)):
            breadcrumbs.append({
                "name": parts[i],
                "path": "/".join(parts[: i + 1]),
            })

    return {
        "type": "directory",
        "name": target.name,
        "path": current_path,
        "breadcrumbs": breadcrumbs,
        "items": items,
        "total": len(items),
    }

# --- File Info ---

@app.get("/api/files/info")
async def file_info(path: str = ""):
    target = safe_path(path)
    if not target.exists():
        raise HTTPException(404, "Path not found")
    stat = target.stat()
    return {
        "name": target.name,
        "path": str(target.relative_to(get_media_root())).replace("\\", "/"),
        "size": stat.st_size,
        "size_formatted": format_size(stat.st_size),
        "mtime": stat.st_mtime,
        "mtime_formatted": format_mtime(stat.st_mtime),
        "is_directory": target.is_dir(),
        "file_type": get_file_type(target.name) if target.is_file() else "folder",
    }

# --- Create Directory ---

@app.post("/api/files/directory")
async def create_directory(path: str = ""):
    target = safe_path(path)
    if target.exists():
        raise HTTPException(400, "Path already exists")
    target.mkdir(parents=True, exist_ok=True)
    return {"status": "ok", "path": str(target.relative_to(get_media_root())).replace("\\", "/")}

# --- Upload ---

@app.post("/api/files/upload")
async def upload_file(path: str = "", files: list[UploadFile] = File(...)):
    target_dir = safe_path(path)
    if not target_dir.exists() or not target_dir.is_dir():
        raise HTTPException(400, "Target directory does not exist")
    results = []
    for file in files:
        file_path = target_dir / file.filename
        try:
            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            results.append({"name": file.filename, "status": "ok", "size": len(content)})
        except Exception as e:
            results.append({"name": file.filename, "status": "error", "error": str(e)})
    return {"status": "ok", "results": results}

# --- Rename ---

@app.put("/api/files/rename")
async def rename_file(data: dict):
    path = data.get("path", "")
    new_name = data.get("new_name", "")
    if not new_name:
        raise HTTPException(400, "new_name is required")
    target = safe_path(path)
    if not target.exists():
        raise HTTPException(404, "Path not found")
    new_path = target.parent / new_name
    if new_path.exists():
        raise HTTPException(400, "Target name already exists")
    target.rename(new_path)
    return {
        "status": "ok",
"path": str(new_path.relative_to(get_media_root())).replace("\\", "/"),
            "old_path": path,
        }

# --- Delete ---

@app.delete("/api/files")
async def delete_file(path: str = ""):
    target = safe_path(path)
    if not target.exists():
        raise HTTPException(404, "Path not found")
    if target.is_dir():
        shutil.rmtree(str(target))
    else:
        target.unlink()
    return {"status": "ok", "path": path}

# --- Thumbnail ---

@app.get("/api/thumbnail")
async def get_thumbnail(path: str = "", size: int = 300):
    target = safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "File not found")

    cache_key = f"{target.name}_{size}_{target.stat().st_mtime}"
    cache_path = Path(THUMBNAIL_DIR) / f"{hash(cache_key)}.jpg"
    if cache_path.exists():
        return FileResponse(str(cache_path), media_type="image/jpeg")

    ext = target.name.lower().rsplit(".", 1)[-1] if "." in target.name else ""
    image_exts = {"jpg", "jpeg", "png", "gif", "bmp", "webp"}
    video_exts = {"mp4", "webm", "mkv", "avi", "mov", "wmv", "flv", "m4v", "ts"}

    try:
        if ext in image_exts:
            from PIL import Image
            with Image.open(target) as img:
                img.thumbnail((size, size), Image.LANCZOS)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                img.save(str(cache_path), "JPEG", quality=85)
            return FileResponse(str(cache_path), media_type="image/jpeg")

        elif ext in video_exts:
            thumb_temp = cache_path.with_suffix(".jpg")
            result = subprocess.run(
                ["ffmpeg", "-i", str(target), "-ss", "00:00:05", "-vframes", "1",
                 "-vf", f"scale={size}:-1", str(thumb_temp), "-y"],
                capture_output=True, timeout=30
            )
            if result.returncode == 0 and thumb_temp.exists():
                thumb_temp.rename(cache_path)
                return FileResponse(str(cache_path), media_type="image/jpeg")
            return Response(status_code=204)

        else:
            return Response(status_code=204)

    except Exception:
        return Response(status_code=204)

# --- Media Streaming ---

CHUNK_SIZE = 1024 * 1024

@app.get("/api/media/video")
async def stream_video(path: str = "", request: Request = None):
    target = safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "File not found")

    file_size = os.path.getsize(target)
    mime_type, _ = mimetypes.guess_type(str(target))
    if not mime_type:
        mime_type = "application/octet-stream"

    range_header = request.headers.get("range", "")
    if range_header:
        try:
            range_val = range_header.replace("bytes=", "").split("-")
            start = int(range_val[0])
            end = int(range_val[1]) if range_val[1] else file_size - 1
        except (ValueError, IndexError):
            start = 0
            end = file_size - 1

        if start >= file_size:
            return HTTPException(416, "Range not satisfiable")

        content_length = end - start + 1

        async def stream_range():
            with open(target, "rb") as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(CHUNK_SIZE, remaining)
                    data = f.read(chunk_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return Response(
            status_code=206,
            content=stream_range(),
            media_type=mime_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(content_length),
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-cache",
            },
        )

    async def stream_full():
        with open(target, "rb") as f:
            while True:
                data = f.read(CHUNK_SIZE)
                if not data:
                    break
                yield data

    return Response(
        status_code=200,
        content=stream_full(),
        media_type=mime_type,
        headers={
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
            "Content-Disposition": f'inline; filename="{target.name}"',
        },
    )

@app.get("/api/media/audio")
async def stream_audio(path: str = "", request: Request = None):
    target = safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "File not found")

    file_size = os.path.getsize(target)
    mime_type, _ = mimetypes.guess_type(str(target))
    if not mime_type:
        mime_type = "audio/mpeg"

    range_header = request.headers.get("range", "")
    if range_header:
        try:
            range_val = range_header.replace("bytes=", "").split("-")
            start = int(range_val[0])
            end = int(range_val[1]) if range_val[1] else file_size - 1
        except (ValueError, IndexError):
            start = 0
            end = file_size - 1

        if start >= file_size:
            return HTTPException(416, "Range not satisfiable")

        content_length = end - start + 1

        async def stream_range():
            with open(target, "rb") as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(CHUNK_SIZE, remaining)
                    data = f.read(chunk_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return Response(
            status_code=206,
            content=stream_range(),
            media_type=mime_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(content_length),
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-cache",
            },
        )

    async def stream_full():
        with open(target, "rb") as f:
            while True:
                data = f.read(CHUNK_SIZE)
                if not data:
                    break
                yield data

    return Response(
        status_code=200,
        content=stream_full(),
        media_type=mime_type,
        headers={
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
        },
    )

# --- Download ---

@app.get("/api/download")
async def download_file(path: str = ""):
    target = safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "File not found")
    mime_type, _ = mimetypes.guess_type(str(target))
    return FileResponse(
        str(target),
        media_type=mime_type or "application/octet-stream",
        filename=target.name,
        headers={
            "Content-Disposition": f'attachment; filename="{target.name}"',
        },
    )

# --- Settings ---

@app.get("/api/settings")
async def get_settings():
    settings = load_settings()
    settings["_mediaRootEnv"] = MEDIA_ROOT
    settings["_portEnv"] = int(os.environ.get("PORT", "8000"))
    return settings

@app.put("/api/settings")
async def update_settings(data: dict):
    allowed = {"mediaRoot", "port", "defaultSort", "defaultView", "thumbnailSize"}
    current = load_settings()
    for k, v in data.items():
        if k in allowed:
            current[k] = v
    save_settings(current)
    return {"status": "ok", "settings": current}

# --- Serve Frontend ---

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
