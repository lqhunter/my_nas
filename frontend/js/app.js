const API_BASE = "";
let currentPath = "";
let currentView = "grid";
let currentSort = "name";
let currentOrder = "asc";
let selectedItems = new Set();
let contextTarget = null;

const FILE_ICONS = {
  folder: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  video: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  image: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  text: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  pdf: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  unknown: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
};

const LIST_ICONS = {
  folder: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  video: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  image: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  text: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
};

const TAG_CLASSES = {
  video: "tag-video", audio: "tag-audio", image: "tag-image",
  folder: "tag-folder", text: "tag-text",
};

// --- API ---
async function api(method, endpoint, body, isFormData) {
  const opts = { method, headers: {} };
  if (body && !isFormData) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body;
  }
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res;
}

async function loadDirectory(path) {
  showLoading(true);
  currentPath = path;
  try {
    const res = await api("GET", `/api/files?path=${encodeURIComponent(path)}&sort=${currentSort}&order=${currentOrder}`);
    const data = await res.json();
    renderBreadcrumbs(data.breadcrumbs || []);
    renderFiles(data);
    updateSidebarActive(path);
    showLoading(false);
  } catch (e) {
    showLoading(false);
    showToast(e.message, "error");
  }
}

function getThumbnailUrl(path) {
  return `${API_BASE}/api/thumbnail?path=${encodeURIComponent(path)}&size=300`;
}

function getMediaUrl(type, path) {
  return `${API_BASE}/api/media/${type}?path=${encodeURIComponent(path)}`;
}

function getDownloadUrl(path) {
  return `${API_BASE}/api/download?path=${encodeURIComponent(path)}`;
}

// --- Render ---
function renderBreadcrumbs(breadcrumbs) {
  const el = document.getElementById("breadcrumb");
  if (!breadcrumbs || breadcrumbs.length === 0) {
    el.innerHTML = `<span class="breadcrumb-item">Home</span>`;
    return;
  }
  el.innerHTML =
    `<span class="breadcrumb-item" data-path="">Home</span><span class="breadcrumb-sep">/</span>` +
    breadcrumbs
      .map(
        (b, i) =>
          `<span class="breadcrumb-item" data-path="${b.path}">${b.name}</span>` +
          (i < breadcrumbs.length - 1 ? `<span class="breadcrumb-sep">/</span>` : "")
      )
      .join("");
  el.querySelectorAll(".breadcrumb-item").forEach((item) => {
    item.addEventListener("click", () => loadDirectory(item.dataset.path));
  });
}

function renderFiles(data) {
  const grid = document.getElementById("file-grid");
  const list = document.getElementById("list-items");
  const empty = document.getElementById("empty-state");
  const gridView = document.getElementById("file-grid");
  const listView = document.getElementById("file-list");

  if (data.type === "file") {
    openFile(data);
    return;
  }

  if (!data.items || data.items.length === 0) {
    gridView.classList.add("hidden");
    listView.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  gridView.classList.remove("hidden");
  listView.classList.remove("hidden");

  renderGrid(data.items);
  renderList(data.items);
}

function renderGrid(items) {
  const grid = document.getElementById("file-grid");
  grid.innerHTML = items
    .map((item) => {
      const isDir = item.is_directory;
      const ft = isDir ? "folder" : item.file_type;
      const thumbHtml = isDir
        ? `<div class="file-icon">${FILE_ICONS[ft] || FILE_ICONS.unknown}</div>`
        : ft === "video"
        ? `<div class="file-icon">${FILE_ICONS.video}</div><div class="play-badge"><svg viewBox="0 0 24 24" width="48" height="48" fill="#fff" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>`
        : ft === "audio"
        ? `<div class="file-icon">${FILE_ICONS.audio}</div>`
        : ft === "image"
        ? `<img src="${getThumbnailUrl(item.path)}" alt="${item.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'file-icon\\'>${FILE_ICONS.image}</div>'"/>`
        : `<div class="file-icon">${FILE_ICONS[ft] || FILE_ICONS.unknown}</div>`;

      return `<div class="file-card file-type-${ft}" data-path="${item.path}" data-type="${ft}" data-is-dir="${isDir}">
        <div class="file-card-thumb">${thumbHtml}</div>
        <div class="file-card-info">
          <div class="file-card-name" title="${item.name}">${item.name}</div>
          <div class="file-card-meta">
            <span>${isDir ? "Folder" : item.size_formatted}</span>
            <span class="file-type-tag ${TAG_CLASSES[ft] || ""}">${ft}</span>
          </div>
        </div>
      </div>`;
    })
    .join("");

  grid.querySelectorAll(".file-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        toggleSelect(card.dataset.path);
        return;
      }
      const path = card.dataset.path;
      if (card.dataset.isDir === "true") {
        loadDirectory(path);
      } else {
        openFile(path);
      }
    });
    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, card.dataset.path, card.dataset.type === "folder");
    });
  });
}

function renderList(items) {
  const list = document.getElementById("list-items");
  list.innerHTML = items
    .map((item) => {
      const isDir = item.is_directory;
      const ft = isDir ? "folder" : item.file_type;
      const icon = LIST_ICONS[ft] || LIST_ICONS.unknown;
      return `<div class="list-item ${isDir ? "folder" : ""}" data-path="${item.path}" data-type="${ft}" data-is-dir="${isDir}">
        <div class="list-item-name"><span class="list-item-icon">${icon}</span>${item.name}</div>
        <div class="list-item-size">${isDir ? "—" : item.size_formatted}</div>
        <div class="list-item-date">${item.mtime_formatted}</div>
        <div class="list-item-type"><span class="file-type-tag ${TAG_CLASSES[ft] || ""}">${ft}</span></div>
        <div class="list-item-actions">
          ${isDir ? "" : `<button class="icon-btn" data-action="download" title="Download"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>`}
          <button class="icon-btn" data-action="delete" title="Delete" style="color:var(--red)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll(".list-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".list-item-actions")) return;
      const path = item.dataset.path;
      if (item.dataset.isDir === "true") {
        loadDirectory(path);
      } else {
        openFile(path);
      }
    });
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, item.dataset.path, item.dataset.type === "folder");
    });
    item.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === "download") downloadFile(item.dataset.path);
        if (action === "delete") deleteFile(item.dataset.path);
      });
    });
  });
}

// --- Open File ---
function openFile(path) {
  if (typeof path === "object") path = path.path;
  const ft = path.split(".").pop().toLowerCase();
  const videoExts = ["mp4", "webm", "mkv", "avi", "mov", "wmv", "flv", "m4v"];
  const audioExts = ["mp3", "wav", "flac", "ogg", "aac", "m4a", "wma", "opus"];

  if (videoExts.includes(ft)) {
    playVideo(path);
  } else if (audioExts.includes(ft)) {
    playAudio(path);
  } else if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ft)) {
    window.open(getMediaUrl("video", path), "_blank");
  } else {
    downloadFile(path);
  }
}

function playVideo(path) {
  const overlay = document.getElementById("player-overlay");
  const video = document.getElementById("video-player");
  const audioWrap = document.getElementById("audio-player-wrapper");
  const title = document.getElementById("player-title");

  audioWrap.classList.add("hidden");
  video.classList.remove("hidden");
  overlay.classList.remove("hidden");
  title.textContent = path.split("/").pop();
  video.src = getMediaUrl("video", path);
  video.load();
  video.play().catch(() => {});
}

function playAudio(path) {
  const overlay = document.getElementById("player-overlay");
  const video = document.getElementById("video-player");
  const audioWrap = document.getElementById("audio-player-wrapper");
  const audio = document.getElementById("audio-player");
  const title = document.getElementById("player-title");
  const audioName = document.getElementById("audio-name");

  video.classList.add("hidden");
  audioWrap.classList.remove("hidden");
  overlay.classList.remove("hidden");
  title.textContent = "Now Playing";
  audioName.textContent = path.split("/").pop();
  audio.src = getMediaUrl("audio", path);
  audio.load();
  audio.play().catch(() => {});
}

function closePlayer() {
  const overlay = document.getElementById("player-overlay");
  const video = document.getElementById("video-player");
  const audio = document.getElementById("audio-player");
  video.pause();
  audio.pause();
  video.src = "";
  audio.src = "";
  overlay.classList.add("hidden");
}

// --- File Operations ---
function downloadFile(path) {
  window.open(getDownloadUrl(path), "_blank");
}

async function deleteFile(path) {
  if (!confirm(`Delete "${path.split("/").pop()}"?`)) return;
  try {
    await api("DELETE", `/api/files?path=${encodeURIComponent(path)}`);
    showToast("Deleted successfully", "success");
    loadDirectory(currentPath);
  } catch (e) {
    showToast(e.message, "error");
  }
}

function showNewFolderModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">
    <h3>New Folder</h3>
    <input type="text" class="modal-input" id="new-folder-input" placeholder="Folder name" autofocus>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm">Create</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#new-folder-input");
  overlay.querySelector("#modal-cancel").onclick = () => overlay.remove();
  overlay.querySelector("#modal-confirm").onclick = async () => {
    const name = input.value.trim();
    if (!name) return;
    const folderPath = currentPath ? `${currentPath}/${name}` : name;
    try {
      await api("POST", `/api/files/directory?path=${encodeURIComponent(folderPath)}`);
      showToast("Folder created", "success");
      overlay.remove();
      loadDirectory(currentPath);
    } catch (e) {
      showToast(e.message, "error");
    }
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") overlay.querySelector("#modal-confirm").click();
    if (e.key === "Escape") overlay.remove();
  });
  setTimeout(() => input.focus(), 100);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function showRenameModal(path) {
  const name = path.split("/").pop();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">
    <h3>Rename</h3>
    <input type="text" class="modal-input" id="rename-input" value="${name}" autofocus>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm">Rename</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#rename-input");
  overlay.querySelector("#modal-cancel").onclick = () => overlay.remove();
  overlay.querySelector("#modal-confirm").onclick = async () => {
    const newName = input.value.trim();
    if (!newName || newName === name) { overlay.remove(); return; }
    try {
      await api("PUT", "/api/files/rename", { path, new_name: newName });
      showToast("Renamed successfully", "success");
      overlay.remove();
      loadDirectory(currentPath);
    } catch (e) {
      showToast(e.message, "error");
    }
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") overlay.querySelector("#modal-confirm").click();
    if (e.key === "Escape") overlay.remove();
  });
  setTimeout(() => { input.focus(); input.select(); }, 100);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// --- Upload ---
function setupUpload() {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.addEventListener("change", () => {
    if (input.files.length) uploadFiles(input.files);
    input.value = "";
  });
  document.getElementById("btn-upload").addEventListener("click", () => input.click());
  document.getElementById("btn-empty-upload").addEventListener("click", () => input.click());
  return input;
}

async function uploadFiles(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const progressEl = document.createElement("div");
  progressEl.className = "upload-progress";
  progressEl.innerHTML = `<div class="upload-progress-title">Uploading ${files.length} file(s)...</div>
    <div class="upload-progress-bar"><div class="upload-progress-fill" style="width:0%"></div></div>
    <div class="upload-progress-text">0%</div>`;
  document.body.appendChild(progressEl);

  try {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressEl.querySelector(".upload-progress-fill").style.width = pct + "%";
        progressEl.querySelector(".upload-progress-text").textContent = pct + "%";
      }
    });

    await new Promise((resolve, reject) => {
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error("Upload failed"));
      });
      xhr.addEventListener("error", () => reject(new Error("Upload failed")));
      xhr.open("POST", `${API_BASE}/api/files/upload?path=${encodeURIComponent(currentPath)}`);
      xhr.send(formData);
    });

    progressEl.querySelector(".upload-progress-title").textContent = "Upload complete!";
    progressEl.querySelector(".upload-progress-fill").style.width = "100%";
    progressEl.querySelector(".upload-progress-text").textContent = "100%";
    setTimeout(() => progressEl.remove(), 2000);
    showToast("Upload successful", "success");
    loadDirectory(currentPath);
  } catch (e) {
    progressEl.remove();
    showToast(e.message, "error");
  }
}

// --- Drag & Drop ---
function setupDragDrop() {
  const dropOverlay = document.getElementById("drop-overlay");
  let dragCounter = 0;

  document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) dropOverlay.classList.remove("hidden");
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  document.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) dropOverlay.classList.add("hidden");
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.add("hidden");
    if (e.dataTransfer.files.length) {
      uploadFiles(e.dataTransfer.files);
    }
  });
}

// --- Context Menu ---
function showContextMenu(x, y, path, isDir) {
  const menu = document.getElementById("context-menu");
  contextTarget = path;

  menu.querySelectorAll("[data-action]").forEach((item) => {
    const action = item.dataset.action;
    item.style.display = action === "play" ? (isDir ? "none" : "") : "";
  });

  menu.style.left = x + "px";
  menu.style.top = y + "px";
  menu.classList.remove("hidden");

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + "px";
  if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + "px";
}

function hideContextMenu() {
  document.getElementById("context-menu").classList.add("hidden");
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".context-menu")) hideContextMenu();
});

document.getElementById("context-menu").querySelectorAll("[data-action]").forEach((item) => {
  item.addEventListener("click", () => {
    if (!contextTarget) return;
    const action = item.dataset.action;
    if (action === "play") openFile(contextTarget);
    if (action === "download") downloadFile(contextTarget);
    if (action === "rename") showRenameModal(contextTarget);
    if (action === "delete") deleteFile(contextTarget);
    hideContextMenu();
  });
});

// --- Toast ---
function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Loading ---
function showLoading(show) {
  document.getElementById("loading-spinner").classList.toggle("hidden", !show);
}

// --- Select ---
function toggleSelect(path) {
  if (selectedItems.has(path)) selectedItems.delete(path);
  else selectedItems.add(path);
}

// --- Sidebar ---
function updateSidebarActive(path) {
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  const navItems = document.querySelectorAll("#sidebar-nav .nav-item, #quick-access .nav-item");
  navItems.forEach((el) => {
    if (el.dataset.path === "" && path === "") el.classList.add("active");
    else if (el.dataset.path && path && (path === el.dataset.path || path.startsWith(el.dataset.path + "/"))) {
      el.classList.add("active");
    }
  });
}

// --- Storage Info ---
async function loadStorageInfo() {
  try {
    const res = await api("GET", "/api/files?path=");
    const data = await res.json();
    const el = document.getElementById("storage-info");
    if (data.total) {
      el.querySelector(".storage-label").textContent = `${data.total} items`;
    }
  } catch (e) {}
}

// --- Settings ---
async function loadSettings() {
  try {
    const res = await api("GET", "/api/settings");
    const s = await res.json();
    document.getElementById("setting-media-root").value = s.mediaRoot || "/media";
    document.getElementById("setting-port").value = s.port || "8080";
    document.getElementById("setting-default-view").value = s.defaultView || "grid";
    document.getElementById("setting-default-sort").value = s.defaultSort || "name";
    document.getElementById("setting-thumbnail-size").value = s.thumbnailSize || "300";
    currentView = s.defaultView || "grid";
    currentSort = s.defaultSort || "name";
    document.querySelectorAll(".view-toggle .icon-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.view === currentView)
    );
    document.getElementById("sort-select").value = currentSort;
    return s;
  } catch (e) {
    return {};
  }
}

function openSettings() {
  document.getElementById("settings-modal").classList.remove("hidden");
  loadSettings();
}

function closeSettings() {
  document.getElementById("settings-modal").classList.add("hidden");
}

async function saveSettings() {
  const data = {
    mediaRoot: document.getElementById("setting-media-root").value,
    port: parseInt(document.getElementById("setting-port").value) || 8080,
    defaultView: document.getElementById("setting-default-view").value,
    defaultSort: document.getElementById("setting-default-sort").value,
    thumbnailSize: parseInt(document.getElementById("setting-thumbnail-size").value),
  };
  try {
    await api("PUT", "/api/settings", data);
    currentView = data.defaultView;
    currentSort = data.defaultSort;
    showToast("Settings saved", "success");
    closeSettings();
    loadDirectory(currentPath);
  } catch (e) {
    showToast(e.message, "error");
  }
}

// --- Init ---
function init() {
  loadSettings().then(() => loadDirectory(""));

  const upload = setupUpload();
  setupDragDrop();

  document.getElementById("btn-empty-folder").addEventListener("click", showNewFolderModal);
  document.getElementById("btn-create-folder").addEventListener("click", showNewFolderModal);
  document.getElementById("btn-settings").addEventListener("click", openSettings);
  document.getElementById("settings-close").addEventListener("click", closeSettings);
  document.getElementById("settings-cancel").addEventListener("click", closeSettings);
  document.getElementById("settings-save").addEventListener("click", saveSettings);
  document.getElementById("settings-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  document.getElementById("player-close").addEventListener("click", closePlayer);
  document.getElementById("player-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closePlayer();
  });
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.querySelectorAll(".view-toggle .icon-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-toggle .icon-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentView = btn.dataset.view;
      const grid = document.getElementById("file-grid");
      const list = document.getElementById("file-list");
      if (currentView === "grid") { grid.classList.remove("hidden"); list.classList.add("hidden"); }
      else { grid.classList.add("hidden"); list.classList.remove("hidden"); }
    });
  });

  document.getElementById("sort-select").addEventListener("change", (e) => {
    currentSort = e.target.value;
    loadDirectory(currentPath);
  });

  document.getElementById("btn-sort-order").addEventListener("click", () => {
    currentOrder = currentOrder === "asc" ? "desc" : "asc";
    loadDirectory(currentPath);
  });

  document.querySelectorAll("#quick-access .nav-item").forEach((item) => {
    item.addEventListener("click", () => loadDirectory(item.dataset.path));
  });

  document.querySelectorAll("#sidebar-nav .nav-item").forEach((item) => {
    if (item.dataset.path !== undefined) {
      item.addEventListener("click", () => loadDirectory(item.dataset.path));
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closePlayer(); hideContextMenu(); }
  });

  loadStorageInfo();
}

document.addEventListener("DOMContentLoaded", init);
