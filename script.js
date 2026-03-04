const API_URL = 'https://script.google.com/macros/s/AKfycbzb7gcnu4p5Tl1itdrYZnk262sYrxfv2OaofK8GnFvTqGhfH00dHxMk97P4sTM0qBmf/exec';
let notes = [];
let currentNoteId = null;
let autoSaveTimer = null;
let noteAuthTypingTimer = null;
let currentGlobalAuthStatus = true; 

// Elements
const pinInput = document.getElementById('pin-input');
const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');
const noteListEl = document.getElementById('note-list');
const editor = document.getElementById('editor');
const titleInput = document.getElementById('note-title');
const saveStatus = document.getElementById('save-status');
const lockedOverlay = document.getElementById('locked-overlay');
const notePassInput = document.getElementById('note-pass-input');

// Toolbar Elements
const mainToolbarRight = document.getElementById('main-toolbar');
const formatToolbar = document.getElementById('format-toolbar');
const globalSettingsBtn = document.getElementById('global-settings-btn');
const themeIcon = document.getElementById('theme-icon');

// Mobile Elements
const sidebar = document.getElementById('main-sidebar');
const mobileOverlay = document.getElementById('mobile-sidebar-overlay');

// --- HÀM GỌI API ĐÃ ĐƯỢC CẬP NHẬT CHO APPS SCRIPT ---
async function fetchNoCache(url, options = {}) {
    const separator = url.includes('?') ? '&' : '?';
    const uniqueUrl = `${url}${separator}_t=${Date.now()}`;
    
    // Đảm bảo không bị lỗi CORS khi gọi Google Apps Script
    if (options.method === 'POST') {
        if (!options.headers) options.headers = {};
        // Sử dụng text/plain để vượt qua preflight CORS của trình duyệt
        options.headers['Content-Type'] = 'text/plain;charset=utf-8';
    }
    
    return fetch(uniqueUrl, options);
}
// Mobile Elements
const sidebar = document.getElementById('main-sidebar');
const mobileOverlay = document.getElementById('mobile-sidebar-overlay');

// --- HÀM GỌI API CHỐNG CACHE ---
async function fetchNoCache(url, options = {}) {
    const separator = url.includes('?') ? '&' : '?';
    const uniqueUrl = `${url}${separator}_t=${Date.now()}`;
    
    // Xử lý riêng cho method POST để Apps Script không chặn CORS
    if (options.method === 'POST') {
        options.headers = {
            'Content-Type': 'text/plain;charset=utf-8',
        };
    }
    
    return fetch(uniqueUrl, options);
}

// --- INIT ---
window.onload = async () => {
    // 1. Load Theme
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }

    // 2. Check Auth
    try {
        const res = await fetchNoCache(API_URL + '?action=check_auth_status');
        const data = await res.json();
        currentGlobalAuthStatus = data.enabled;
        
        if (data.enabled) {
            loginScreen.style.display = 'flex';
            pinInput.focus();
        } else {
            showAppDirectly();
        }
        updateShieldIcon(data.enabled);
    } catch (err) {
        console.error("Lỗi API Init", err);
        loginScreen.style.display = 'flex';
        pinInput.focus();
    }
    const urlParams = new URLSearchParams(window.location.search);
    window.sharedNoteId = urlParams.get('note');

    // 3. Init Toolbar Listeners
    initToolbarStateListeners();
};

function hideLogin() {
    loginScreen.style.opacity = '0';
    setTimeout(() => {
        loginScreen.style.display = 'none';
        app.style.opacity = '1';
        app.style.pointerEvents = 'auto';
        initApp();
    }, 500);
}

function showAppDirectly() {
    loginScreen.style.display = 'none';
    app.style.opacity = '1';
    app.style.pointerEvents = 'auto';
    initApp();
}

// --- TOOLBAR STATE SYNC ---
function initToolbarStateListeners() {
    editor.addEventListener('keyup', updateToolbarState);
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('click', updateToolbarState);
}

function updateToolbarState() {
    const commands = ['bold', 'italic', 'underline', 'strikeThrough'];
    commands.forEach(cmd => {
        const state = document.queryCommandState(cmd);
        const btn = document.querySelector(`button[onclick="formatDoc('${cmd}')"]`);
        if (btn) {
            if (state) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });

    const fontSize = document.queryCommandValue('fontSize');
    const fontSelect = document.querySelector('.font-select');
    if (fontSelect && fontSize) {
        fontSelect.value = fontSize;
    }
}

// --- THEME TOGGLE ---
function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    
    if (isLight) {
        themeIcon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('app_theme', 'light');
    } else {
        themeIcon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('app_theme', 'dark');
    }
}

// --- MOBILE SIDEBAR TOGGLE ---
function toggleMobileSidebar() {
    sidebar.classList.toggle('mobile-open');
    mobileOverlay.classList.toggle('show');
}

// --- GLOBAL LOGIN ---
pinInput.addEventListener('input', async (e) => {
    if (e.target.value.length === 4) {
        // Bắt đầu loading
        pinInput.disabled = true;
        pinInput.style.opacity = '0.5';
        
        try {
            const res = await fetchNoCache(API_URL + '?action=login_global', {
                method: 'POST', body: JSON.stringify({ password: e.target.value })
            });
            const data = await res.json();
            if (data.status === 'success') {
                hideLogin();
            } else {
                pinInput.value = '';
                pinInput.style.borderBottomColor = '#ef4444';
                setTimeout(() => pinInput.style.borderBottomColor = 'var(--text-muted)', 500);
            }
        } catch (err) { alert("Lỗi kết nối API!"); }
        
        // Kết thúc loading
        pinInput.disabled = false;
        pinInput.style.opacity = '1';
        pinInput.focus();
    }
});

// --- GLOBAL SETTINGS ---
const globalModal = document.getElementById('global-settings-modal');
const globalAuthToggle = document.getElementById('global-auth-toggle');

function openGlobalSettingsModal() {
    globalAuthToggle.checked = currentGlobalAuthStatus;
    document.getElementById('current-global-pass').value = '';
    document.getElementById('new-global-pass').value = '';
    globalModal.classList.add('show');
}

function closeGlobalSettingsModal() {
    globalModal.classList.remove('show');
}

function handleGlobalAuthToggleLocal() { }

async function saveGlobalChanges() {
    if (globalAuthToggle.checked !== currentGlobalAuthStatus) {
        const res = await fetchNoCache(API_URL + '?action=toggle_global_auth', { method: 'POST' });
        const data = await res.json();
        currentGlobalAuthStatus = data.enabled;
        updateShieldIcon(data.enabled);
    }

    const currentP = document.getElementById('current-global-pass').value;
    const newP = document.getElementById('new-global-pass').value;
    
    if (currentP || newP) {
        if(newP.length !== 4) {
            alert("Mật khẩu mới phải có 4 số");
            return; 
        }
        const resPass = await fetchNoCache(API_URL + '?action=change_global_password', {
            method: 'POST', body: JSON.stringify({ current_password: currentP, new_password: newP })
        });
        const dataPass = await resPass.json();
        if(dataPass.status !== 'success') {
            alert(dataPass.message);
            return; 
        } else {
            alert("Đổi mật khẩu thành công!");
        }
    }
    
    closeGlobalSettingsModal();
}

function updateShieldIcon(enabled) {
    if(enabled) {
        globalSettingsBtn.classList.add('active-shield');
        globalSettingsBtn.style.color = '#34d399';
    } else {
        globalSettingsBtn.classList.remove('active-shield');
        globalSettingsBtn.style.color = 'var(--text-muted)';
    }
}

// --- APP LOGIC ---
async function initApp() {
    await loadNoteList();
    if (notes.length > 0) {
        const targetId = window.sharedNoteId && notes.find(n => n.id === window.sharedNoteId) ? window.sharedNoteId : notes[0].id;
        loadNote(targetId);
    }
}

async function loadNoteList() {
    // 1. Load ngay lập tức từ LocalStorage (nếu có) để giao diện hiện lên luôn
    const cachedNotes = localStorage.getItem('kagerz_notes_cache');
    if (cachedNotes) {
        notes = JSON.parse(cachedNotes);
        renderNoteList();
    }

    // 2. Chạy ngầm gọi API để lấy dữ liệu mới nhất
    try {
        const res = await fetchNoCache(API_URL + '?action=get_list');
        const data = await res.json();
        if (data.status === 'success') { 
            notes = data.data; 
            localStorage.setItem('kagerz_notes_cache', JSON.stringify(notes)); // Cập nhật cache
            renderNoteList(); 
        }
    } catch (error) {
        console.warn("Chưa đồng bộ được danh sách mới nhất", error);
    }
}

function renderNoteList() {
    noteListEl.innerHTML = '';
    notes.forEach(note => {
        const div = document.createElement('div');
        div.className = `note-item ${note.id === currentNoteId ? 'active' : ''}`;
        div.draggable = true;
        div.dataset.id = note.id;
        div.innerHTML = `
            <div class="note-drag-handle"><i class="fa-solid fa-grip-vertical"></i></div>
            <div class="note-info">
                <div class="note-title-text">${note.title || 'Không tiêu đề'}</div>
                <div class="note-time">${new Date(note.updated_at * 1000).toLocaleTimeString()}</div>
            </div>
            ${note.is_locked ? '<i class="fa-solid fa-lock note-lock-icon"></i>' : ''}
        `;
        div.onclick = (e) => { 
            if (!e.target.closest('.note-drag-handle')) {
                loadNote(note.id);
                if(window.innerWidth <= 768) {
                    sidebar.classList.remove('mobile-open');
                    mobileOverlay.classList.remove('show');
                }
            }
        };
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('drop', handleDrop);
        div.addEventListener('dragend', handleDragEnd);
        noteListEl.appendChild(div);
    });
}

async function loadNote(id) {
    currentNoteId = id;
    renderNoteList();
    
    const noteBasic = notes.find(n => n.id === id);
    titleInput.value = noteBasic.title;
    
    document.getElementById('lock-indicator').classList.toggle('hidden', !noteBasic.is_locked);
    
    if (noteBasic.is_locked) {
        lockedOverlay.classList.remove('hidden');
        editor.innerHTML = '';
        notePassInput.value = '';
        notePassInput.focus();
        setToolbarLocked(true); 
    } else {
        lockedOverlay.classList.add('hidden');
        setToolbarLocked(false);
        editor.innerHTML = ''; 
        fetchNoteContent(id);
    }
}

function setToolbarLocked(locked) {
    if (locked) {
        mainToolbarRight.classList.add('disabled-area');
        titleInput.classList.add('disabled-area');
        titleInput.disabled = true;
        formatToolbar.classList.add('disabled-area');
    } else {
        mainToolbarRight.classList.remove('disabled-area');
        titleInput.classList.remove('disabled-area');
        titleInput.disabled = false;
        formatToolbar.classList.remove('disabled-area');
    }
}

async function fetchNoteContent(id, password = '', silent = false) {
    const res = await fetchNoCache(API_URL + '?action=get_note', {
        method: 'POST', body: JSON.stringify({ id: id, password: password })
    });
    const data = await res.json();
    if (data.status === 'success') {
        lockedOverlay.classList.add('hidden');
        editor.innerHTML = data.data.content;
        updateTimeUI(data.data.updated_at);
        setToolbarLocked(false);
        setTimeout(updateToolbarState, 100);
    } else if (data.status === 'locked' && !silent) {
        if (password) {
            notePassInput.value = '';
            notePassInput.style.borderBottomColor = '#ef4444';
            setTimeout(() => notePassInput.style.borderBottomColor = 'var(--text-muted)', 500);
        } else lockedOverlay.classList.remove('hidden');
    }
}

// Tự động unlock note
notePassInput.addEventListener('input', () => {
    clearTimeout(noteAuthTypingTimer);
    noteAuthTypingTimer = setTimeout(() => unlockNote(true), 300);
});

async function unlockNote(silent = false) {
    fetchNoteContent(currentNoteId, notePassInput.value, silent);
}

// Editor & Saving
function formatDoc(cmd, val = null) { 
    document.execCommand(cmd, false, val); 
    editor.focus(); 
    updateToolbarState();
}

const handleInput = () => {
    // Chỉ ẩn biểu tượng "đã lưu" (dấu tích xanh) khi người dùng bắt đầu gõ
    // Không còn kích hoạt autoSaveTimer nữa
    saveStatus.classList.add('hidden');
};
editor.addEventListener('input', handleInput);
titleInput.addEventListener('input', handleInput);

async function saveNote() {
    if (!currentNoteId) return;
    const res = await fetchNoCache(API_URL + '?action=save_note', {
        method: 'POST', body: JSON.stringify({ id: currentNoteId, content: editor.innerHTML, title: titleInput.value })
    });
    const data = await res.json();
    if (data.status === 'success') {
        saveStatus.classList.remove('hidden');
        updateTimeUI(data.updated_at);
        const n = notes.find(x => x.id === currentNoteId);
        if(n) { n.title = titleInput.value; n.updated_at = data.updated_at; }
        renderNoteList();
    }
}
function saveNoteManual() {
    clearTimeout(autoSaveTimer); saveNote();
    const icon = document.getElementById('save-icon');
    icon.className = "fa-solid fa-check"; icon.style.color = "#34d399";
    setTimeout(() => { icon.className = "fa-solid fa-floppy-disk"; icon.style.color = ""; }, 1500);
}
// --- BẮT SỰ KIỆN LƯU BẰNG CTRL+S / CMD+S ---
document.addEventListener('keydown', function(e) {
    // Kiểm tra nếu phím Ctrl (Windows) hoặc Cmd (Mac) đang được giữ và phím 's' được nhấn
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); // Chặn hành vi mặc định (lưu trang web HTML của trình duyệt)
        
        // Chỉ thực hiện lưu nếu đang mở một ghi chú (có currentNoteId)
        if (currentNoteId) {
            saveNoteManual(); 
        }
    }
});
function updateTimeUI(ts) {
    const d = new Date(ts * 1000);
    document.getElementById('last-saved').innerText = 
        `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

// CRUD
async function addNewNote() {
    // 1. Tạo ID tạm thời và hiển thị ngay lập tức (Tốc độ 0s)
    const tempId = 'temp_' + Date.now();
    const timestamp = Math.floor(Date.now() / 1000);
    const newNote = {
        id: tempId, title: 'Đang tạo...', content: '', 
        is_locked: false, password: '', updated_at: timestamp
    };
    
    notes.unshift(newNote);
    loadNote(tempId);
    if(window.innerWidth <= 768) {
        sidebar.classList.remove('mobile-open');
        mobileOverlay.classList.remove('show');
    }

    // 2. Gọi API ngầm để tạo thật trên Server
    try {
        const res = await fetchNoCache(API_URL + '?action=add_note', { method: 'POST', body: JSON.stringify({}) });
        const data = await res.json();
        if(data.status === 'success') { 
            // 3. Thay thế ID tạm bằng ID thật từ server
            const index = notes.findIndex(n => n.id === tempId);
            if (index !== -1) {
                notes[index] = data.data;
                currentNoteId = data.data.id;
                renderNoteList(); // Render lại danh sách để lấy ID thật
                titleInput.value = data.data.title;
            }
        }
    } catch (err) {
        // Xử lý lỗi nếu việc gọi API thất bại
        notes = notes.filter(n => n.id !== tempId);
        renderNoteList();
        alert("Có lỗi khi tạo ghi chú mới. Vui lòng thử lại!");
    }
}
async function deleteNote() {
    if(!confirm("Xóa ghi chú này?")) return;
    const res = await fetchNoCache(API_URL + '?action=delete_note', { method: 'POST', body: JSON.stringify({ id: currentNoteId }) });
    const data = await res.json();
    if(data.status === 'success') { notes = notes.filter(n => n.id !== currentNoteId); loadNote(notes[0].id); }
    else alert(data.message);
}

// Copy Link
function copyLink() {
    const url = window.location.origin + window.location.pathname + '?note=' + currentNoteId;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(showCopySuccess).catch(() => fallbackCopy(url));
    } else fallbackCopy(url);
}

function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showCopySuccess(); } catch (err) {}
    document.body.removeChild(ta);
}
function showCopySuccess() {
    const icon = document.getElementById('copy-icon');
    icon.className = "fa-solid fa-check"; icon.style.color = "#34d399";
    setTimeout(() => { icon.className = "fa-solid fa-link"; icon.style.color = ""; }, 2000);
}

// Settings Modal
const modal = document.getElementById('settings-modal');
const setLock = document.getElementById('setting-is-locked');
const setPass = document.getElementById('setting-password');
const passGroup = document.getElementById('pass-setting-group');

function openSettings() {
    const note = notes.find(n => n.id === currentNoteId);
    setLock.checked = note.is_locked;
    setPass.value = "";
    togglePassGroup();
    modal.classList.add('show');
}
function closeSettings() { modal.classList.remove('show'); }
function togglePassGroup() {
    passGroup.style.opacity = setLock.checked ? '1' : '0.5';
    passGroup.style.pointerEvents = setLock.checked ? 'auto' : 'none';
}
async function saveSettings() {
    const note = notes.find(n => n.id === currentNoteId);
    note.is_locked = setLock.checked;
    await fetchNoCache(API_URL + '?action=update_settings', {
        method: 'POST', body: JSON.stringify({ id: currentNoteId, is_locked: setLock.checked, password: setPass.value })
    });
    closeSettings(); loadNote(currentNoteId);
}

// Drag Drop Logic Fixed
let dragSrcEl = null;
function handleDragStart(e) { dragSrcEl = this; e.dataTransfer.effectAllowed = 'move'; this.classList.add('dragging'); }
function handleDragOver(e) { e.preventDefault(); return false; }
function handleDrop(e) {
    e.stopPropagation();
    if (dragSrcEl !== this) {
        const list = document.getElementById('note-list');
        const items = [...list.children];
        const srcIdx = items.indexOf(dragSrcEl);
        const targetIdx = items.indexOf(this);
        if (srcIdx < targetIdx) this.after(dragSrcEl); else this.before(dragSrcEl);
        const newIds = [...list.children].map(el => el.dataset.id);
        const reorderedNotes = [];
        newIds.forEach(id => {
            const note = notes.find(n => n.id === id);
            if (note) reorderedNotes.push(note);
        });
        notes = reorderedNotes;
        fetchNoCache(API_URL + '?action=reorder_notes', { method: 'POST', body: JSON.stringify({ order: newIds }) });
    } return false;
}
function handleDragEnd() { this.classList.remove('dragging'); }

// Expose functions
window.toggleTheme = toggleTheme;
window.openGlobalSettingsModal = openGlobalSettingsModal;
window.closeGlobalSettingsModal = closeGlobalSettingsModal;
window.handleGlobalAuthToggleLocal = handleGlobalAuthToggleLocal;
window.saveGlobalChanges = saveGlobalChanges;
window.copyLink = copyLink;
window.saveNoteManual = saveNoteManual;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.deleteNote = deleteNote;
window.addNewNote = addNewNote;
window.formatDoc = formatDoc;
window.togglePassGroup = togglePassGroup;
window.unlockNote = unlockNote;
window.toggleMobileSidebar = toggleMobileSidebar;
