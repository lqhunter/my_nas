import json
import os
import time
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from quark_client import FileService, QuarkAPIClient, QuarkAuth

app = FastAPI(title="QuarkDrive")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

DATA_DIR = os.environ.get("QUARK_DATA_DIR", "/data")
PORT = int(os.environ.get("PORT", "8081"))
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

os.makedirs(DATA_DIR, exist_ok=True)

auth = QuarkAuth(data_dir=DATA_DIR)
api_client = QuarkAPIClient()
file_service = FileService(api_client)


def ensure_auth():
    cs = auth.load_cookies()
    if not cs:
        raise HTTPException(401, "未登录")
    api_client.set_cookies(cs)


def quark_response(resp: dict):
    data = resp.get('data', {})
    if isinstance(data, dict):
        return data
    return resp


# --- Auth ---

@app.get("/api/auth/status")
def auth_status():
    return {"logged_in": auth.is_logged_in()}


@app.post("/api/auth/login")
def login_with_cookie(data: dict):
    cookie_string = data.get("cookie", "")
    if not cookie_string:
        raise HTTPException(400, "Cookie 不能为空")
    try:
        auth.save_cookie_string(cookie_string)
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/auth/qr_login")
def qr_login():
    try:
        cs = auth.qr_login(timeout=300)
        return {"status": "ok", "cookie": cs}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/auth/logout")
def logout():
    auth.clear_cookies()
    return {"status": "ok"}


@app.get("/api/auth/qrcode")
def get_qrcode():
    import httpx, uuid
    client = httpx.Client(timeout=30.0, follow_redirects=True)
    client.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://pan.quark.cn/',
    })
    try:
        rid = str(uuid.uuid4())
        resp = client.get(
            'https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin',
            params={'client_id': '532', 'v': '1.2', 'request_id': rid}
        )
        data = resp.json()
        if data.get('status') != 2000000:
            raise Exception(data.get('message', ''))
        token = data['data']['members']['token']
        qr_url = f"https://su.quark.cn/4_eMHBJ?token={token}&client_id=532&ssb=weblogin"
        return {"token": token, "qr_url": qr_url}
    except Exception as e:
        raise HTTPException(400, f"获取二维码失败: {e}")
    finally:
        client.close()


@app.post("/api/auth/qr_poll")
def qr_poll(data: dict):
    token = data.get("token", "")
    if not token:
        raise HTTPException(400, "缺少 token")
    import httpx, uuid
    client = httpx.Client(timeout=30.0, follow_redirects=True)
    client.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://pan.quark.cn/',
    })
    try:
        rid = str(uuid.uuid4())
        resp = client.get(
            'https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken',
            params={'client_id': '532', 'v': '1.2', 'token': token, 'request_id': rid}
        )
        data = resp.json()
        if data.get('status') == 2000000 and data.get('data', {}).get('members', {}).get('service_ticket'):
            st = data['data']['members']['service_ticket']
            client.get('https://pan.quark.cn/account/info', params={'st': st, 'lw': 'scan'})
            parts = []
            for c in client.cookies.jar:
                if c.domain and 'quark.cn' in c.domain:
                    parts.append(f"{c.name}={c.value}")
            cookie_string = "; ".join(parts)
            auth.save_cookie_string(cookie_string)
            api_client.set_cookies(cookie_string)
            return {"status": "ok", "cookie": cookie_string}
        return {"status": "waiting"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        client.close()


# --- Storage ---

@app.get("/api/storage")
def get_storage():
    ensure_auth()
    resp = file_service.get_storage_info()
    return quark_response(resp)


# --- Files ---

@app.get("/api/files")
def list_files(folder_id: str = "0", page: int = 1, size: int = 100, sort: str = "file_name", order: str = "asc"):
    ensure_auth()
    resp = file_service.list_files(folder_id=folder_id, page=page, size=size, sort_field=sort, sort_order=order)
    return quark_response(resp)


@app.get("/api/files/info")
def file_info(file_id: str):
    ensure_auth()
    resp = file_service.get_file_info(file_id)
    return resp


@app.post("/api/files/folder")
def create_folder(data: dict):
    ensure_auth()
    name = data.get("name", "")
    parent_id = data.get("parent_id", "0")
    if not name:
        raise HTTPException(400, "文件夹名不能为空")
    resp = file_service.create_folder(name, parent_id)
    return quark_response(resp)


@app.post("/api/files/delete")
def delete_files(data: dict):
    ensure_auth()
    file_ids = data.get("file_ids", [])
    if not file_ids:
        raise HTTPException(400, "文件ID列表不能为空")
    resp = file_service.delete_files(file_ids)
    return {"status": "ok"}


@app.post("/api/files/rename")
def rename_file(data: dict):
    ensure_auth()
    file_id = data.get("file_id", "")
    new_name = data.get("new_name", "")
    if not file_id or not new_name:
        raise HTTPException(400, "参数不完整")
    resp = file_service.rename_file(file_id, new_name)
    return {"status": "ok"}


@app.post("/api/files/move")
def move_files(data: dict):
    ensure_auth()
    file_ids = data.get("file_ids", [])
    target_id = data.get("target_id", "")
    if not file_ids or not target_id:
        raise HTTPException(400, "参数不完整")
    resp = file_service.move_files(file_ids, target_id)
    return {"status": "ok"}


@app.get("/api/files/search")
def search_files(q: str = "", folder_id: str = "", page: int = 1, size: int = 50):
    ensure_auth()
    resp = file_service.search_files(q, folder_id, page, size)
    return quark_response(resp)


@app.get("/api/files/download")
def get_download_url(file_id: str):
    ensure_auth()
    try:
        url = file_service.get_download_url(file_id)
        return {"download_url": url}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get("/api/files/tree")
def get_tree(folder_id: str = "0", max_depth: int = 3):
    ensure_auth()
    resp = file_service.get_folder_tree(folder_id, max_depth)
    return quark_response(resp)


# --- File streaming via quark ---

CHUNK_SIZE = 1024 * 1024

@app.get("/api/stream/video")
async def stream_video(file_id: str = "", request: Request = None):
    ensure_auth()
    try:
        url = file_service.get_download_url(file_id)
    except Exception as e:
        raise HTTPException(400, str(e))
    if not url:
        raise HTTPException(404, "无法获取下载链接")

    import httpx as hx
    async with hx.AsyncClient(timeout=300.0) as cl:
        range_header = request.headers.get("range", "")
        headers = {}
        if range_header:
            headers["Range"] = range_header

        async with cl.stream("GET", url, headers=headers) as resp:
            status = resp.status_code
            ctype = resp.headers.get("content-type", "application/octet-stream")
            resp_headers = {}
            for k in ("content-range", "content-length", "accept-ranges"):
                v = resp.headers.get(k)
                if v:
                    resp_headers[k] = v

            async def gen():
                async for chunk in resp.aiter_bytes(CHUNK_SIZE):
                    yield chunk

            return Response(
                content=gen() if not hasattr(gen(), '__aiter__') else None,
                headers=resp_headers,
                media_type=ctype,
                status_code=status,
            )


# --- Serve frontend ---

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
