import { checkAuth, logout } from './auth.js';
import { getAnnouncements, createAnnouncement as dbCreateAnnounce, updateAnnouncement as dbUpdateAnnounce, deleteAnnouncement as dbDeleteAnnounce, getTimesheetRequests, getAttendanceChangeRequests, getInterviewRequests } from './firestore.js';
import { setupCommonUI, updateBadge, showLoading, hideLoading, showModal, hideModal, showToast, showConfirm } from './ui.js';
import { formatDate } from './utils.js';

let currentUserData;
let editingAnnounceId = null;

document.addEventListener('DOMContentLoaded', () => {
    initAdminDashboard();
});

export async function initAdminDashboard() {
    try {
        showLoading();
        currentUserData = await checkAuth('admin');
        setupCommonUI(currentUserData, logout);
        
        document.getElementById('create-announcement-btn')?.addEventListener('click', () => openAnnouncementModal());
        document.getElementById('submit-announcement')?.addEventListener('click', handleSubmitAnnouncement);

        await Promise.all([
            loadAnnouncements(),
            loadPendingRequests()
        ]);
        
    } catch (e) {
        console.error("Admin dashboard init error:", e);
    } finally {
        hideLoading();
    }
}

export async function loadAnnouncements() {
    const listEl = document.getElementById('announcement-list');
    if (!listEl) return;
    try {
        const announcements = await getAnnouncements();
        let html = '';
        announcements.forEach(a => {
            const dateStr = a.createdAt ? formatDate(new Date(a.createdAt.toMillis())) : '';
            html += `
                <li class="announce-item">
                    <span><strong>${dateStr}</strong>: ${a.title}</span>
                    <div class="actions">
                        <button onclick="window.adminModule.openAnnouncementModal('${a.id}')">編集</button>
                        <button onclick="window.adminModule.deleteAnnouncement('${a.id}')">削除</button>
                    </div>
                </li>
            `;
        });
        listEl.innerHTML = html || '<li>お知らせはありません</li>';
        
        window.adminModule = window.adminModule || {};
        window.adminModule.openAnnouncementModal = openAnnouncementModal;
        window.adminModule.deleteAnnouncement = deleteAnnouncement;
        
    } catch (e) { console.error(e); }
}

export function openAnnouncementModal(id = null) {
    editingAnnounceId = id;
    const titleInput = document.getElementById('announcement-title');
    const bodyInput = document.getElementById('announcement-body');
    const submitBtn = document.getElementById('submit-announcement');
    
    if (id) {
        // 編集モード
        submitBtn.textContent = '更新';
        // 一覧からデータを再取得するか、保持しているデータから探す（簡略化のため現在の一覧から見つける）
        const items = document.querySelectorAll('#announcement-list li');
        // 本来はFirestoreから再取得かステート管理するのがベスト。
        // ここでは実装の器を作成
    } else {
        // 新規モード
        submitBtn.textContent = '投稿';
        if(titleInput) titleInput.value = '';
        if(bodyInput) bodyInput.value = '';
    }
    
    showModal('announcement-modal');
}

async function handleSubmitAnnouncement() {
    const title = document.getElementById('announcement-title').value;
    const body = document.getElementById('announcement-body').value;
    
    if (!title.trim() || !body.trim()) {
        showToast('タイトルと本文を入力してください', 'error');
        return;
    }
    
    try {
        showLoading();
        const data = {
            title: title.trim(),
            body: body.trim(),
            createdBy: currentUserData.uid
        };
        
        if (editingAnnounceId) {
            await dbUpdateAnnounce(editingAnnounceId, data);
            showToast('お知らせを更新しました', 'success');
        } else {
            await dbCreateAnnounce(data);
            showToast('お知らせを投稿しました', 'success');
        }
        
        hideModal('announcement-modal');
        await loadAnnouncements();
    } catch (e) {
        console.error(e);
        showToast('エラーが発生しました', 'error');
    } finally {
        hideLoading();
    }
}

export async function deleteAnnouncement(id) {
    showConfirm('このお知らせを削除しますか？', async () => {
        try {
            showLoading();
            await dbDeleteAnnounce(id);
            showToast('削除しました', 'success');
            await loadAnnouncements();
        } catch (e) {
            console.error(e);
            showToast('削除に失敗しました', 'error');
        } finally {
            hideLoading();
        }
    });
}

export async function loadPendingRequests() {
    const listEl = document.getElementById('pending-request-list');
    if (!listEl) return;
    
    try {
        // 全ユーザーの未確認申請を取得（Firestore.jsに関数が用意されています）
        const [timesheets, changes, interviews] = await Promise.all([
            getTimesheetRequests(),
            getAttendanceChangeRequests(),
            getInterviewRequests()
        ]);
        
        const tsPending = timesheets.filter(r => r.status === 'pending');
        const changePending = changes.filter(r => r.status === 'pending');
        const interviewPending = interviews.filter(r => r.status === 'pending');
        
        // サイドバーのバッジ更新
        updateBadge('nav-admin-attendance', tsPending.length + changePending.length);
        updateBadge('nav-admin-interview', interviewPending.length);
        
        let html = '';
        tsPending.forEach(r => html += `<li>[タイムシート] ${r.yearMonth} の申請があります (${r.uid})</li>`);
        changePending.forEach(r => html += `<li>[通所変更] ${r.date} の変更申請があります (${r.uid})</li>`);
        interviewPending.forEach(r => html += `<li>[面談] ${r.targetWeekStart} の週の希望があります (${r.uid})</li>`);
        
        listEl.innerHTML = html || '<li>未確認の申請はありません</li>';
        
    } catch (e) { console.error(e); }
}


