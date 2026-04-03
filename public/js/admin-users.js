import { auth, db, doc, getDoc, signOut, onAuthStateChanged, collection, getDocs, query, orderBy, where, updateDoc } from './firebase-config.js';

let currentUsers = [];
let editingUid = null;

const adminNameEl = document.getElementById('admin-name');
const logoutBtn = document.getElementById('logout-btn');
const usersTbody = document.getElementById('users-tbody');

const searchUser = document.getElementById('search-user');
const roleFilter = document.getElementById('role-filter');
const statusFilter = document.getElementById('status-filter');

const userEditModal = document.getElementById('user-edit-modal');
const editUsernameSpan = document.getElementById('edit-username');
const editRoleSelect = document.getElementById('edit-role');
const editStatusSelect = document.getElementById('edit-status');
const saveUserBtn = document.getElementById('save-user-btn');
const cancelUserEditBtn = document.getElementById('cancel-user-edit');

/**
 * ページ初期化
 */
async function initUsersPage(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            if (adminNameEl) adminNameEl.textContent = `${userSnap.data().username} 管理者`;
        } else {
            window.location.href = 'dashboard.html';
            return;
        }
    } catch (e) {
        console.error(e);
    }

    loadUsers();

    // イベントリスナー
    searchUser?.addEventListener('input', filterUsers);
    roleFilter?.addEventListener('change', filterUsers);
    statusFilter?.addEventListener('change', filterUsers);
    
    cancelUserEditBtn?.addEventListener('click', () => userEditModal?.classList.add('hidden'));
    saveUserBtn?.addEventListener('click', saveUserChanges);
}

/**
 * 全ユーザーを取得・表示
 */
async function loadUsers() {
    if (!usersTbody) return;
    usersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">読み込み中...</td></tr>';
    
    try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        currentUsers = [];
        
        snap.forEach(docSnap => {
            currentUsers.push({ uid: docSnap.id, ...docSnap.data() });
        });
        
        displayUsers(currentUsers);
    } catch (e) {
        console.error("ユーザー取得失敗:", e);
        usersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">エラーが発生しました</td></tr>';
    }
}

/**
 * ユーザー一覧を画面に描画
 */
function displayUsers(users) {
    if (!usersTbody) return;
    usersTbody.innerHTML = '';
    
    if (users.length === 0) {
        usersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">該当するユーザーはいません。</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        const createdAt = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : (user.createdAt || '不明');
        
        tr.innerHTML = `
            <td style="font-weight:600;">${user.username}</td>
            <td style="color:var(--text-muted);">${user.email}</td>
            <td><span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">${user.role}</span></td>
            <td><span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}">${user.status}</span></td>
            <td>${createdAt}</td>
            <td><button class="btn btn-sm btn-outline" onclick="openUserEditModal('${user.uid}')">編集</button></td>
        `;
        usersTbody.appendChild(tr);
    });
}

/**
 * 検索・フィルター処理
 */
function filterUsers() {
    const searchTerm = searchUser.value.toLowerCase();
    const roleVal = roleFilter.value;
    const statusVal = statusFilter.value;

    const filtered = currentUsers.filter(user => {
        const matchesSearch = (user.username?.toLowerCase().includes(searchTerm) || user.email?.toLowerCase().includes(searchTerm));
        const matchesRole = (roleVal === 'all' || user.role === roleVal);
        const matchesStatus = (statusVal === 'all' || user.status === statusVal);
        return matchesSearch && matchesRole && matchesStatus;
    });

    displayUsers(filtered);
}

/**
 * 編集モーダルを開く
 */
window.openUserEditModal = function(uid) {
    const user = currentUsers.find(u => u.uid === uid);
    if (!user) return;

    editingUid = uid;
    editUsernameSpan.textContent = user.username;
    editRoleSelect.value = user.role;
    editStatusSelect.value = user.status;
    userEditModal?.classList.remove('hidden');
};

/**
 * ユーザー情報の保存
 */
async function saveUserChanges() {
    if (!editingUid) return;

    const newRole = editRoleSelect.value;
    const newStatus = editStatusSelect.value;

    saveUserBtn.disabled = true;
    try {
        const userRef = doc(db, 'users', editingUid);
        await updateDoc(userRef, {
            role: newRole,
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        alert("ユーザー情報を更新しました。");
        userEditModal?.classList.add('hidden');
        loadUsers();
    } catch (e) {
        console.error(e);
        alert("更新に失敗しました。");
    } finally {
        saveUserBtn.disabled = false;
    }
}

// 認証監視
onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        initUsersPage(user);
    }
});

// ログアウト
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}
