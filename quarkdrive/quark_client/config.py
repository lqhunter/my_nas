import os
from pathlib import Path


def get_config_dir() -> Path:
    config_dir = os.getenv('QUARK_CONFIG_DIR')
    if config_dir:
        return Path(config_dir)
    return Path('/app/config')


def get_default_headers() -> dict:
    return {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36',
        'origin': 'https://pan.quark.cn',
        'referer': 'https://pan.quark.cn/',
        'accept-language': 'zh-CN,zh;q=0.9',
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
    }


class Config:
    BASE_URL = 'https://drive-pc.quark.cn/1/clouddrive'
    SHARE_BASE_URL = 'https://drive.quark.cn/1/clouddrive'
    ACCOUNT_URL = 'https://pan.quark.cn/account'

    DEFAULT_PARAMS = {
        'pr': 'ucpro',
        'fr': 'pc',
        'uc_param_str': '',
    }

    REQUEST_TIMEOUT = 60.0
    MAX_RETRIES = 3
    RETRY_DELAY = 1.0
    DEFAULT_PAGE_SIZE = 50
    MAX_PAGE_SIZE = 100
