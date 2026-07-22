from typing import Any, Dict, List, Optional

from .client import QuarkAPIClient
from .config import Config


class FileService:
    def __init__(self, client: QuarkAPIClient):
        self.client = client

    def list_files(
        self,
        folder_id: str = "0",
        page: int = 1,
        size: int = 100,
        sort_field: str = "file_name",
        sort_order: str = "asc"
    ) -> Dict[str, Any]:
        params = {
            'pdir_fid': folder_id,
            '_page': page,
            '_size': size,
            '_sort': f"{sort_field}:{sort_order}"
        }
        return self.client.get('file/sort', params=params)

    def get_file_info(self, file_id: str) -> Dict[str, Any]:
        params = {'fids': file_id}
        response = self.client.get('file', params=params)
        if isinstance(response, dict) and 'data' in response:
            data = response['data']
            if isinstance(data, dict) and 'list' in data:
                for fi in data['list']:
                    if fi.get('fid') == file_id:
                        return fi
                if data['list']:
                    return data['list'][0]
        raise Exception(f"文件不存在: {file_id}")

    def create_folder(self, folder_name: str, parent_id: str = "0") -> Dict[str, Any]:
        return self.client.post('file', json_data={
            'pdir_fid': parent_id,
            'file_name': folder_name,
            'dir_init_lock': False,
            'dir_path': '',
        })

    def delete_files(self, file_ids: List[str]) -> Dict[str, Any]:
        return self.client.post('file/delete', json_data={
            'action_type': 2,
            'filelist': file_ids,
            'exclude_fids': [],
        })

    def rename_file(self, file_id: str, new_name: str) -> Dict[str, Any]:
        return self.client.post('file/rename', json_data={
            'fid': file_id,
            'file_name': new_name,
        })

    def move_files(self, file_ids: List[str], target_folder_id: str) -> Dict[str, Any]:
        return self.client.post('file/move', json_data={
            'action_type': 1,
            'to_pdir_fid': target_folder_id,
            'filelist': file_ids,
            'exclude_fids': [],
        })

    def search_files(
        self,
        keyword: str,
        folder_id: str = "",
        page: int = 1,
        size: int = 50
    ) -> Dict[str, Any]:
        params = {
            'q': keyword,
            '_page': page,
            '_size': size,
            '_fetch_total': 1,
            '_sort': 'file_name:asc',
            '_is_hl': 1,
        }
        if folder_id:
            params['pdir_fid'] = folder_id
        return self.client.get('file/search', params=params)

    def get_storage_info(self) -> Dict[str, Any]:
        return self.client.get('capacity')

    def get_folder_tree(self, folder_id: str = "0", max_depth: int = 3) -> Dict[str, Any]:
        return self.client.get('file/tree', params={'pdir_fid': folder_id, 'max_depth': max_depth})

    def get_download_url(self, file_id: str) -> str:
        params = {
            'pr': 'ucpro',
            'fr': 'pc',
            'sys': 'win32',
            've': '2.5.56',
            'ut': '',
            'guid': '',
        }
        response = self.client.post(
            'file/download',
            json_data={'fids': [file_id]},
            params=params,
            base_url='https://drive-pc.quark.cn/1/clouddrive'
        )
        if isinstance(response, dict) and 'data' in response:
            data_list = response['data']
            if data_list and len(data_list) > 0:
                return data_list[0].get('download_url', '')
        raise Exception("无法获取下载链接")

    def resolve_path(self, path: str, current_dir_id: str = "0") -> tuple:
        parts = [p for p in path.strip('/').split('/') if p]
        if not parts:
            return current_dir_id, "folder"
        parent_id = current_dir_id
        is_file = False
        for i, part in enumerate(parts):
            resp = self.list_files(parent_id, size=100)
            items = resp.get('data', {}).get('list', []) if isinstance(resp.get('data'), dict) else resp.get('data', [])
            found = None
            for item in items:
                if item.get('file_name') == part:
                    found = item
                    break
            if not found:
                raise Exception(f"路径不存在: {part}")
            if i == len(parts) - 1:
                is_file = found.get('file_type') == 0
                return found.get('fid', ''), "file" if is_file else "folder"
            parent_id = found.get('fid', '')
        return parent_id, "folder"
