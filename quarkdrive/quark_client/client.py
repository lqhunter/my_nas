import time
from typing import Any, Dict, Optional

import httpx

from .config import Config, get_default_headers


class QuarkAPIClient:
    def __init__(self, cookie_string: str = ""):
        self.cookie_string = cookie_string
        self._client = httpx.Client(
            timeout=Config.REQUEST_TIMEOUT,
            headers=get_default_headers(),
            follow_redirects=True
        )

    def set_cookies(self, cookie_string: str):
        self.cookie_string = cookie_string

    def _get_timestamp(self) -> int:
        return int(time.time() * 1000)

    def _build_params(self, **kwargs) -> Dict[str, Any]:
        params: Dict[str, Any] = Config.DEFAULT_PARAMS.copy()
        params.update({'__t': self._get_timestamp(), '__dt': 1000})
        params.update(kwargs)
        return params

    def _build_headers(self) -> Dict[str, str]:
        headers = get_default_headers().copy()
        if self.cookie_string:
            headers['cookie'] = self.cookie_string
        return headers

    def request(
        self,
        method: str,
        url: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        if base_url is None:
            base_url = Config.BASE_URL
        full_url = f"{base_url.rstrip('/')}/{url.lstrip('/')}"
        req_params = self._build_params(**(params or {}))
        req_headers = self._build_headers()

        try:
            if method.upper() == 'GET':
                response = self._client.get(full_url, params=req_params, headers=req_headers)
            elif method.upper() == 'POST':
                response = self._client.post(full_url, params=req_params, json=json_data or {}, headers=req_headers)
            else:
                raise Exception(f"Unsupported method: {method}")

            if response.status_code in (401, 403):
                raise Exception("认证失败，请重新登录")

            if response.status_code >= 400:
                raise Exception(f"HTTP {response.status_code}: {response.text[:200]}")

            result = response.json()
            if isinstance(result, dict):
                status = result.get('status')
                code = result.get('code')
                msg = result.get('message', '')
                if status == 'error' or (code and code != 0):
                    raise Exception(f"API错误: {msg}")
            return result
        except httpx.TimeoutException:
            raise Exception("请求超时")
        except httpx.RequestError as e:
            raise Exception(f"网络错误: {e}")

    def get(self, url: str, params: Optional[Dict] = None, **kwargs) -> Dict[str, Any]:
        return self.request('GET', url, params=params, **kwargs)

    def post(self, url: str, json_data: Optional[Dict] = None, **kwargs) -> Dict[str, Any]:
        return self.request('POST', url, json_data=json_data, **kwargs)

    def close(self):
        if self._client:
            self._client.close()
