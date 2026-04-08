import { checkAuth, logout } from './auth.js';
import { getAllUsers, updateUser as dbUpdateUser } from './firestore.js';
import { setupCommonUI, refreshAdminBadges, showLoading, hideLoading, showModal, hideModal, showToast } from './ui.js';
import { formatDate } from './utils.js';

let allUsers = [];
let editingUid = null;
let currentUserData;

document.addEventListener('DOMContentLoaded', () => {
    initUsersPage();
});

export async function initUsersPage() {
    try {
        showLoading();
        currentUserData = await checkAuth('admin');
        setupCommonUI(currentUserData, logout);
        refreshAdminBadges();
        
        // 検索・フィルタリングのイベント設定
        document.getElementById('search-user')?.addEventListener('input', filterUsers);
        document.getElementById('role-filter')?.addEventListener('change', filterUsers);
        document.getElementById('status-filter')?.addEventListener('change', filterUsers);
        
        // ボタンイベント
        document.getElementById('save-user-btn')?.addEventListener('click', handleSaveUser);
        document.getElementById('cancel-edit-btn')?.addEventListener('click', () => hideModal('user-edit-modal'));

        await loadUsers();
        
    } catch (e) {
        console.error("Admin Users init error:", e);
    } finally {
        hideLoading();
    }
}

export async function loadUsers() {
    try {
        allUsers = await getAllUsers();
        renderUserTable(allUsers);
        
        window.adminUsersModule = window.adminUsersModule || {};
        window.adminUsersModule.openUserEditModal = openUserEditModal;
        
    } catch (e) { console.error(e); }
}

function renderUserTable(users) {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    users.forEach(user => {
        tbody.appendChild(renderUserRow(user));
    });
}

export function filterUsers() {
    const searchVal = document.getElementById('search-user').value.toLowerCase();
    const roleVal = document.getElementById('role-filter').value;
    const statusVal = document.getElementById('status-filter').value;
    
    const filtered = allUsers.filter(u => {
        const matchesSearch = !searchVal || 
            (u.username && u.username.toLowerCase().includes(searchVal)) || 
            (u.email && u.email.toLowerCase().includes(searchVal));
        
        const matchesRole = !roleVal || u.role === roleVal;
        const matchesStatus = !statusVal || u.status === statusVal;
        
        return matchesSearch && matchesRole && matchesStatus;
    });
    
    renderUserTable(filtered);
}

export function renderUserRow(userData) {
    const tr = document.createElement('tr');
    const createdStr = userData.createdAt ? formatDate(new Date(userData.createdAt.toMillis())) : '';
    
    tr.innerHTML = `
        <td>${userData.username || ''}</td>
        <td>${userData.email || ''}</td>
        <td>${userData.role === 'admin' ? '管理者' : '利用者'}</td>
        <td class="status-${userData.status}">${userData.status === 'active' ? '有効' : '無効'}</td>
        <td>${createdStr}</td>
        <td>
            <button onclick="window.adminUsersModule.openUserEditModal('${userData.uid}')">編集</button>
        </td>
    `;
    return tr;
}

export function openUserEditModal(uid) {
    const user = allUsers.find(u => u.uid === uid);
    if (!user) return;
    
    editingUid = uid;
    const nameInput = document.getElementById('edit-username-input');
    if (nameInput) nameInput.value = user.username || '';
    
    document.getElementById('edit-role').value = user.role;
    document.getElementById('edit-status').value = user.status;
    
    showModal('user-edit-modal');
}

async function handleSaveUser() {
    if (!editingUid) return;
    
    const username = document.getElementById('edit-username-input').value;
    const role = document.getElementById('edit-role').value;
    const status = document.getElementById('edit-status').value;
    
    if (!username.trim()) {
        showToast('ユーザー名を入力してください', 'error');
        return;
    }
    
    try {
        showLoading();
        await dbUpdateUser(editingUid, {
            username: username.trim(),
            role: role,
            status: status
        });
        showToast('ユーザー情報を更新しました', 'success');
        hideModal('user-edit-modal');
        await loadUsers();
    } catch (e) {
        console.error(e);
        showToast('更新に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// 設計書にある各個関数のエクスポート。内部的には handleSaveUser 等から呼ぶ。
export async function updateUserRole(uid, role) {
    // initUsersPage での個別のボタンなどのイベントで使用する際に。
}

export async function updateUserStatus(uid, status) {
    // 個別に active/inactive 切り替えボタンを配置する際に使用。
}
