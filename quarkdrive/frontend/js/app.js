class QuarkDriveApp {
  constructor() {
    this.currentFolder = "0";
    this.currentPage = 1;
    this.pageSize = 100;
    this.currentSort = "file_name";
    this.currentOrder = "asc";
    this.items = [];
    this.isLoggedIn = false;
    this.qrToken = "";
    this.breadcrumbs = [];
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkAuth();
  }

  bindEvents() {
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });
    document.getElementById("btn-login-cookie").addEventListener("click", () => this.loginWithCookie());
    document.getElementById("btn-get-qr").addEventListener("click", () => this.getQRCode());
    document.getElementById("btn-logout").addEventListener("click", () => this.logout());
    document.getElementById("btn-refresh").addEventListener("click", () => this.loadFiles());
    document.getElementById("btn-nav-up").addEventListener("click", () => this.goUp());
    document.getElementById("btn-new-folder").addEventListener("click", () => this.showNewFolderModal());
    document.getElementById("btn-search").addEventListener("click", () => this.search());
    document.getElementById("search-input").addEventListener("keyup", (e) => { if (e.key === "Enter") this.search(); });
    document.getElementById("btn-prev").addEventListener("click", () => this.prevPage());
    document.getElementById("btn-next").addEventListener("click", () => this.nextPage());
    document.getElementById("btn-close-player").addEventListener("click", () => this.closePlayer());
    document.getElementById("btn-close-modal").addEventListener("click", () => this.closeModal());
    document.querySelectorAll("[data-sort]").forEach(el => {
      el.addEventListener("click", () => this.changeSort(el.dataset.sort));
    });
    document.addEventListener("click", () => this.closeContextMenu());
  }

  async checkAuth() {
    try {
      const resp = await fetch("/api/auth/status");
      const data = await resp.json();
      if (data.logged_in) {
        this.isLoggedIn = true;
        this.showMain();
      } else {
        this.showLogin();
      }
    } catch {
      this.showLogin();
    }
  }

  showLogin() {
    document.getElementById("login-page").classList.remove("hidden");
    document.getElementById("main-page").classList.add("hidden");
  }

  showMain() {
    document.getElementById("login-page").classList.add("hidden");
    document.getElementById("main-page").classList.remove("hidden");
    this.loadStorageInfo();
    this.loadFiles();
  }

  switchTab(tab) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add("active");
    document.getElementById(`login-${tab}`).classList.add("active");
  }

  async loginWithCookie() {
    const cookie = document.getElementById("cookie-input").value.trim();
    if (!cookie) return this.toast("请输入 Cookie");
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({cookie})
      });
      if (resp.ok) {
        this.toast("登录成功");
        this.isLoggedIn = true;
        this.showMain();
      } else {
        const err = await resp.json();
        this.toast(err.detail || "登录失败");
      }
    } catch (e) {
      this.toast("登录失败: " + e.message);
    }
  }

  async getQRCode() {
    document.getElementById("qr-status").textContent = "获取二维码中...";
    try {
      const resp = await fetch("/api/auth/qrcode");
      const data = await resp.json();
      this.qrToken = data.token;

      const display = document.getElementById("qr-display");
      display.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qr_url)}" alt="QR Code">`;

      document.getElementById("qr-status").textContent = "请使用夸克 APP 扫码登录";
      this.pollQR();
    } catch (e) {
      document.getElementById("qr-status").textContent = "获取二维码失败: " + e.message;
    }
  }

  async pollQR() {
    const poll = async () => {
      try {
        const resp = await fetch("/api/auth/qr_poll", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({token: this.qrToken})
        });
        const data = await resp.json();
        if (data.status === "ok") {
          document.getElementById("qr-status").textContent = "登录成功！";
          this.isLoggedIn = true;
          this.showMain();
          return;
        } else if (data.status === "error") {
          document.getElementById("qr-status").textContent = "登录失败: " + data.message;
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        setTimeout(poll, 2000);
      }
    };
    setTimeout(poll, 2000);
  }

  async logout() {
    await fetch("/api/auth/logout", {method: "POST"});
    this.isLoggedIn = false;
    this.showLogin();
    this.toast("已退出");
  }

  async loadStorageInfo() {
    try {
      const resp = await fetch("/api/storage");
      const data = await resp.json();
      if (data && data.total_size !== undefined) {
        const used = this.formatSize(data.used_size || 0);
        const total = this.formatSize(data.total_size || 0);
        document.getElementById("storage-info").textContent = `已用: ${used} / 总计: ${total}`;
      }
    } catch {}
  }

  async loadFiles() {
    document.getElementById("file-list").innerHTML = '<div class="loading">加载中...</div>';
    try {
      const resp = await fetch(`/api/files?folder_id=${this.currentFolder}&page=${this.currentPage}&size=${this.pageSize}&sort=${this.currentSort}&order=${this.currentOrder}`);
      const data = await resp.json();
      const fileList = document.getElementById("file-list");
      fileList.innerHTML = "";

      if (!data || !data.list || data.list.length === 0) {
        fileList.innerHTML = '<div class="empty-state">此文件夹为空</div>';
        this.items = [];
        this.updateBreadcrumbs(data);
        return;
      }

      this.items = data.list;
      this.updateBreadcrumbs(data);

      data.list.forEach(item => {
        const div = document.createElement("div");
        div.className = "file-item" + (item.file_type === 1 ? " folder" : "");

        const isFolder = item.file_type === 1;
        const icon = isFolder ? "📁" : this.getFileIcon(item.file_name);

        div.innerHTML = `
          <span class="file-icon">${icon}</span>
          <span class="file-name">${this.escapeHtml(item.file_name)}</span>
          <span class="file-size">${isFolder ? "-" : this.formatSize(item.size || 0)}</span>
          <span class="file-date">${item.updated_at ? this.formatDate(item.updated_at) : ""}</span>
          <span class="file-actions">
            ${isFolder ? "" : `<button class="btn-download" data-id="${item.fid}">下载</button>`}
            ${isFolder ? "" : `<button class="btn-play" data-id="${item.fid}" data-name="${this.escapeHtml(item.file_name)}">播放</button>`}
            <button class="btn-rename" data-id="${item.fid}" data-name="${this.escapeHtml(item.file_name)}">重命名</button>
            <button class="btn-delete" data-id="${item.fid}">删除</button>
          </span>
        `;

        if (isFolder) {
          div.addEventListener("click", (e) => {
            if (!e.target.closest(".file-actions")) {
              this.openFolder(item.fid, item.file_name);
            }
          });
        }

        div.querySelector(".btn-download")?.addEventListener("click", (e) => {
          e.stopPropagation();
          this.downloadFile(item.fid, item.file_name);
        });
        div.querySelector(".btn-play")?.addEventListener("click", (e) => {
          e.stopPropagation();
          this.playFile(item.fid, item.file_name);
        });
        div.querySelector(".btn-rename")?.addEventListener("click", (e) => {
          e.stopPropagation();
          this.showRenameModal(item.fid, item.file_name);
        });
        div.querySelector(".btn-delete")?.addEventListener("click", (e) => {
          e.stopPropagation();
          this.deleteFile(item.fid, item.file_name);
        });

        fileList.appendChild(div);
      });

      this.updatePagination(data);
    } catch (e) {
      document.getElementById("file-list").innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`;
    }
  }

  updateBreadcrumbs(data) {
    const pathEl = document.getElementById("current-path");
    if (data && data.path) {
      pathEl.textContent = data.path;
    } else if (this.currentFolder === "0") {
      pathEl.textContent = "/";
    } else {
      pathEl.textContent = `/${this.currentFolder}`;
    }
  }

  updatePagination(data) {
    const total = data && data._count ? data._count : 0;
    const totalPages = Math.ceil(total / this.pageSize) || 1;
    document.getElementById("page-info").textContent = `第 ${this.currentPage} 页 / 共 ${totalPages} 页`;
    document.getElementById("btn-prev").disabled = this.currentPage <= 1;
    document.getElementById("btn-next").disabled = this.currentPage >= totalPages;
  }

  openFolder(fid, name) {
    this.breadcrumbs.push({id: this.currentFolder, name: ""});
    this.currentFolder = fid;
    this.currentPage = 1;
    this.loadFiles();
  }

  goUp() {
    if (this.currentFolder === "0") return;
    this.loadFolderTree();
  }

  async loadFolderTree() {
    try {
      const resp = await fetch(`/api/files/tree?folder_id=0&max_depth=5`);
      const data = await resp.json();
      if (data && data.list) {
        const findParent = (items, targetId, parentId) => {
          for (const item of items) {
            if (item.fid === targetId) return parentId;
            if (item.children) {
              const found = findParent(item.children, targetId, item.fid);
              if (found) return found;
            }
          }
          return null;
        };
        const parent = findParent(data.list, this.currentFolder, "0");
        if (parent) {
          this.currentFolder = parent;
          this.currentPage = 1;
          this.loadFiles();
        }
      }
    } catch {}
  }

  changeSort(field) {
    if (this.currentSort === field) {
      this.currentOrder = this.currentOrder === "asc" ? "desc" : "asc";
    } else {
      this.currentSort = field;
      this.currentOrder = "asc";
    }
    this.currentPage = 1;
    this.loadFiles();
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadFiles();
    }
  }

  nextPage() {
    this.currentPage++;
    this.loadFiles();
  }

  async search() {
    const q = document.getElementById("search-input").value.trim();
    if (!q) return this.loadFiles();
    document.getElementById("file-list").innerHTML = '<div class="loading">搜索中...</div>';
    try {
      const resp = await fetch(`/api/files/search?q=${encodeURIComponent(q)}&folder_id=${this.currentFolder}&page=1&size=50`);
      const data = await resp.json();
      const fileList = document.getElementById("file-list");
      fileList.innerHTML = "";

      if (!data || !data.list || data.list.length === 0) {
        fileList.innerHTML = '<div class="empty-state">未找到匹配的文件</div>';
        return;
      }

      data.list.forEach(item => {
        const div = document.createElement("div");
        div.className = "file-item";
        const isFolder = item.file_type === 1;
        const icon = isFolder ? "📁" : this.getFileIcon(item.file_name);
        div.innerHTML = `
          <span class="file-icon">${icon}</span>
          <span class="file-name">${this.escapeHtml(item.file_name)}</span>
          <span class="file-size">${isFolder ? "-" : this.formatSize(item.size || 0)}</span>
          <span class="file-date">${item.updated_at ? this.formatDate(item.updated_at) : ""}</span>
          <span class="file-actions">
            ${isFolder ? "" : `<button class="btn-play" data-id="${item.fid}" data-name="${this.escapeHtml(item.file_name)}">播放</button>`}
            <button class="btn-download" data-id="${item.fid}">下载</button>
          </span>
        `;
        if (isFolder) {
          div.addEventListener("click", () => this.openFolder(item.fid, item.file_name));
        }
        div.querySelector(".btn-play")?.addEventListener("click", (e) => {
          e.stopPropagation();
          this.playFile(item.fid, item.file_name);
        });
        div.querySelector(".btn-download")?.addEventListener("click", (e) => {
          e.stopPropagation();
          this.downloadFile(item.fid, item.file_name);
        });
        fileList.appendChild(div);
      });
    } catch (e) {
      document.getElementById("file-list").innerHTML = `<div class="empty-state">搜索失败: ${e.message}</div>`;
    }
  }

  async downloadFile(fid, name) {
    try {
      const resp = await fetch(`/api/files/download?file_id=${fid}`);
      const data = await resp.json();
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      }
    } catch (e) {
      this.toast("获取下载链接失败: " + e.message);
    }
  }

  async playFile(fid, name) {
    try {
      const resp = await fetch(`/api/files/download?file_id=${fid}`);
      const data = await resp.json();
      if (!data.download_url) {
        this.toast("无法获取播放链接");
        return;
      }

      const videoEl = document.getElementById("video-player");
      const audioEl = document.getElementById("audio-player");
      const ext = name.split(".").pop().toLowerCase();
      const videoExts = ["mp4", "webm", "mkv", "avi", "mov", "wmv", "flv", "m4v", "ts"];
      const audioExts = ["mp3", "wav", "flac", "ogg", "aac", "m4a", "wma", "opus"];

      const isVideo = videoExts.includes(ext);
      const isAudio = audioExts.includes(ext);

      if (isVideo) {
        videoEl.style.display = "block";
        audioEl.style.display = "none";
        videoEl.src = data.download_url;
        videoEl.load();
      } else if (isAudio) {
        videoEl.style.display = "none";
        audioEl.style.display = "block";
        audioEl.src = data.download_url;
        audioEl.load();
      } else {
        this.toast("不支持的文件格式");
        return;
      }

      document.getElementById("player-title").textContent = name;
      document.getElementById("player-overlay").classList.remove("hidden");
    } catch (e) {
      this.toast("播放失败: " + e.message);
    }
  }

  closePlayer() {
    const videoEl = document.getElementById("video-player");
    const audioEl = document.getElementById("audio-player");
    videoEl.pause();
    audioEl.pause();
    videoEl.src = "";
    audioEl.src = "";
    document.getElementById("player-overlay").classList.add("hidden");
  }

  async deleteFile(fid, name) {
    if (!confirm(`确认删除 "${name}"？`)) return;
    try {
      const resp = await fetch("/api/files/delete", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({file_ids: [fid]})
      });
      if (resp.ok) {
        this.toast("删除成功");
        this.loadFiles();
      }
    } catch (e) {
      this.toast("删除失败: " + e.message);
    }
  }

  showNewFolderModal() {
    this.showModal("新建文件夹", `
      <input id="modal-input" type="text" placeholder="文件夹名称">
      <button id="modal-confirm" class="btn-primary">创建</button>
    `);
    document.getElementById("modal-confirm").addEventListener("click", async () => {
      const name = document.getElementById("modal-input").value.trim();
      if (!name) return this.toast("请输入名称");
      try {
        const resp = await fetch("/api/files/folder", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({name, parent_id: this.currentFolder})
        });
        if (resp.ok) {
          this.toast("创建成功");
          this.closeModal();
          this.loadFiles();
        }
      } catch (e) {
        this.toast("创建失败: " + e.message);
      }
    });
  }

  showRenameModal(fid, currentName) {
    this.showModal("重命名", `
      <input id="modal-input" type="text" value="${this.escapeHtml(currentName)}">
      <button id="modal-confirm" class="btn-primary">保存</button>
    `);
    document.getElementById("modal-confirm").addEventListener("click", async () => {
      const name = document.getElementById("modal-input").value.trim();
      if (!name) return this.toast("请输入名称");
      try {
        const resp = await fetch("/api/files/rename", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({file_id: fid, new_name: name})
        });
        if (resp.ok) {
          this.toast("重命名成功");
          this.closeModal();
          this.loadFiles();
        }
      } catch (e) {
        this.toast("重命名失败: " + e.message);
      }
    });
  }

  showModal(title, body) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = body;
    document.getElementById("modal-overlay").classList.remove("hidden");
    setTimeout(() => document.getElementById("modal-input")?.focus(), 100);
  }

  closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
  }

  closeContextMenu() {
    document.querySelectorAll(".context-menu").forEach(el => el.remove());
  }

  getFileIcon(name) {
    const ext = name.split(".").pop().toLowerCase();
    const map = {
      mp4: "🎬", webm: "🎬", mkv: "🎬", avi: "🎬", mov: "🎬",
      mp3: "🎵", wav: "🎵", flac: "🎵", ogg: "🎵", aac: "🎵",
      jpg: "🖼", jpeg: "🖼", png: "🖼", gif: "🖼", webp: "🖼",
      pdf: "📄", zip: "📦", rar: "📦", "7z": "📦", tar: "📦", gz: "📦",
      txt: "📝", md: "📝", json: "📝", xml: "📝",
    };
    return map[ext] || "📄";
  }

  formatSize(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(1) + " " + units[i];
  }

  formatDate(ts) {
    if (!ts) return "";
    const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
    return d.toLocaleString("zh-CN", {month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"});
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add("hidden"), 3000);
  }
}

new QuarkDriveApp();
