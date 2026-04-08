import { getTimesheetRequests, getAttendanceChangeRequests, getInterviewRequests } from './firestore.js';

export function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.hidden = false;
        // モーダルが画面全体を覆うようなクラスを付与
        modal.classList.add('active');
    }
}

export function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.hidden = true;
        modal.classList.remove('active');
    }
}

export function showLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.hidden = false;
}

export function hideLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.hidden = true;
}

/**
 * トースト通知を表示する
 * @param {string} message メッセージ内容
 * @param {string} type 'success' | 'error' | 'info'
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // 3秒後に消える
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * 確認ダイアログを表示する
 * @param {string} message 
 * @param {Function} onConfirm OKボタン押下時のコールバック
 */
export function showConfirm(message, onConfirm) {
    const dialog = document.getElementById('confirm-dialog');
    if (!dialog) return;
    
    dialog.innerHTML = `
        <div class="confirm-content">
            <p>${message}</p>
            <div class="confirm-actions">
                <button id="confirm-yes-btn">OK</button>
                <button id="confirm-cancel-btn">キャンセル</button>
            </div>
        </div>
    `;
    
    dialog.hidden = false;
    
    document.getElementById('confirm-yes-btn').onclick = () => {
        dialog.hidden = true;
        if (onConfirm) onConfirm();
    };
    
    document.getElementById('confirm-cancel-btn').onclick = () => {
        dialog.hidden = true;
    };
}

/**
 * 共通のヘッダー・サイドバーを設定する
 * @param {Object} userData ユーザーデータ (userData.role, userData.username)
 * @param {Function} logoutHandler ログアウト処理の関数
 */
export function setupCommonUI(userData, logoutHandler) {
    const header = document.querySelector('header');
    const sidebar = document.querySelector('aside#sidebar');
    
    if (header) {
        const dashboardUrl = userData.role === 'admin' ? 'admin-dashboard.html' : 'dashboard.html';
        header.innerHTML = `
            <h1><a href="${dashboardUrl}">就労移行支援ポータル ${userData.role === 'admin' ? '(管理)' : ''}</a></h1>
            <div class="header-user">
                <span>${userData.username} 様</span>
                <button id="logout-btn">ログアウト</button>
            </div>
        `;
        document.getElementById('logout-btn').onclick = logoutHandler;
    }

    if (sidebar) {
        if (userData.role === 'admin') {
            sidebar.innerHTML = `
                <a id="nav-admin-users" href="admin-users.html">ユーザー管理</a>
                <a id="nav-admin-attendance" href="admin-attendance.html">通所管理<span class="badge"></span></a>
                <a id="nav-admin-interview" href="admin-interview.html">面談管理<span class="badge"></span></a>
            `;
        } else {
            sidebar.innerHTML = `
                <a href="attendance.html">通所予定</a>
                <a href="interview.html">面談</a>
            `;
        }
        
        // 現在のページに対応するリンクをアクティブにする
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        sidebar.querySelectorAll('a').forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });
    }
}

/**
 * サイドバーのバッジを更新する
 * @param {string} navId AタグのID
 * @param {number} count 件数
 */
export function updateBadge(navId, count) {
    const navItem = document.getElementById(navId);
    if (!navItem) return;
    const badge = navItem.querySelector('.badge');
    if (badge) {
        badge.textContent = count > 0 ? count : '';
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

/**
 * 管理者用：未確認申請の件数を取得してサイドバーのバッジを更新する
 */
export async function refreshAdminBadges() {
    try {
        const [timesheets, changes, interviews] = await Promise.all([
            getTimesheetRequests(),
            getAttendanceChangeRequests(),
            getInterviewRequests()
        ]);
        
        const tsPendingCount = timesheets.filter(r => r.status === 'pending').length;
        const changePendingCount = changes.filter(r => r.status === 'pending').length;
        const interviewPendingCount = interviews.filter(r => r.status === 'pending').length;
        
        updateBadge('nav-admin-attendance', tsPendingCount + changePendingCount);
        updateBadge('nav-admin-interview', interviewPendingCount);
    } catch (e) {
        console.error("Failed to refresh badges:", e);
    }
}
