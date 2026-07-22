import json
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional

import httpx

from .config import Config, get_config_dir


class QuarkAuth:
    def __init__(self, data_dir: str = ""):
        self.data_dir = Path(data_dir) if data_dir else get_config_dir()
        self.cookies_file = self.data_dir / "quark_cookies.json"
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _save_cookies(self, cookie_string: str):
        cookie_data = {
            'cookie_string': cookie_string,
            'timestamp': int(time.time()),
        }
        with open(self.cookies_file, 'w', encoding='utf-8') as f:
            json.dump(cookie_data, f, ensure_ascii=False)

    def load_cookies(self) -> Optional[str]:
        try:
            if not self.cookies_file.exists():
                return None
            with open(self.cookies_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            ts = data.get('timestamp', 0)
            if time.time() - ts > 7 * 24 * 3600:
                return None
            cs = data.get('cookie_string', '')
            if self._validate_cookie_string(cs):
                return cs
            return None
        except Exception:
            return None

    def _validate_cookie_string(self, cookie_string: str) -> bool:
        if not cookie_string:
            return False
        required = ['__kps', '__uid']
        return all(r in cookie_string for r in required)

    def clear_cookies(self):
        if self.cookies_file.exists():
            self.cookies_file.unlink()

    def is_logged_in(self) -> bool:
        return self.load_cookies() is not None

    def qr_login(self, timeout: int = 300) -> str:
        client = httpx.Client(timeout=30.0, follow_redirects=True)
        client.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn',
        })

        request_id = str(uuid.uuid4())
        resp = client.get(
            'https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin',
            params={'client_id': '532', 'v': '1.2', 'request_id': request_id}
        )
        data = resp.json()
        if data.get('status') != 2000000:
            raise Exception(f"获取二维码失败: {data.get('message', '')}")

        token = data['data']['members']['token']
        qr_url = f"https://su.quark.cn/4_eMHBJ?token={token}&client_id=532&ssb=weblogin"

        start = time.time()
        cookie_string = ""
        while time.time() - start < timeout:
            try:
                rid = str(uuid.uuid4())
                cr = client.get(
                    'https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken',
                    params={'client_id': '532', 'v': '1.2', 'token': token, 'request_id': rid}
                )
                cd = cr.json()
                if cd.get('status') == 2000000 and cd.get('data', {}).get('members', {}).get('service_ticket'):
                    st = cd['data']['members']['service_ticket']
                    client.get('https://pan.quark.cn/account/info', params={'st': st, 'lw': 'scan'})
                    parts = []
                    for c in client.cookies.jar:
                        if c.domain and 'quark.cn' in c.domain:
                            parts.append(f"{c.name}={c.value}")
                    cookie_string = "; ".join(parts)
                    break
            except Exception:
                pass
            time.sleep(2)

        client.close()
        if not cookie_string:
            raise Exception("登录超时或失败")

        self._save_cookies(cookie_string)
        return cookie_string

    def save_cookie_string(self, cookie_string: str):
        if not self._validate_cookie_string(cookie_string):
            raise ValueError("Cookie 缺少必要字段 (__kps, __uid)")
        self._save_cookies(cookie_string)

    def get_cookie_string(self) -> str:
        cs = self.load_cookies()
        if not cs:
            raise Exception("未登录")
        return cs
