import { checkAuth, logout } from './auth.js';
import { getAllUsers, getInterviewRequests, getInterviews, createInterview as dbCreateInterview, rejectInterviewRequest as dbRejectRequest, cancelInterview as dbCancelInterview } from './firestore.js';
import { formatDate } from './utils.js';
import { setupCommonUI, refreshAdminBadges, showLoading, hideLoading, showModal, hideModal, showToast, showConfirm } from './ui.js';

let currentUserData;
let pendingRequests = [];
let allUsers = [];
let allAdmins = [];

document.addEventListener('DOMContentLoaded', () => {
    initAdminInterviewPage();
});

export async function initAdminInterviewPage() {
    try {
        showLoading();
        currentUserData = await checkAuth('admin');
        setupCommonUI(currentUserData, logout);
        refreshAdminBadges();
        
        await loadStaffList();
        
        document.getElementById('create-interview')?.addEventListener('click', () => {
            handleCreateInterview();
        });
        document.getElementById('reject-interview')?.addEventListener('click', () => {
            handleRejectRequest();
        });
        document.getElementById('cancel-interview')?.addEventListener('click', () => {
            handleCancelInterview();
        });

        await Promise.all([
            loadInterviewRequests(),
            loadInterviews()
        ]);
        
    } catch (e) {
        console.error(e);
    } finally {
        hideLoading();
    }
}

async function loadStaffList() {
    allUsers = await getAllUsers();
    allAdmins = allUsers.filter(u => u.role === 'admin');
    
    const select = document.getElementById('staff-select');
    if (select) {
        select.innerHTML = '<option value="">担当スタッフを選択</option>';
        allAdmins.forEach(adm => {
            const opt = document.createElement('option');
            opt.value = adm.uid;
            opt.textContent = adm.username;
            select.appendChild(opt);
        });
    }
}

export async function loadInterviewRequests() {
    const listEl = document.getElementById('pending-interview-requests');
    if (!listEl) return;
    try {
        pendingRequests = (await getInterviewRequests()).filter(r => r.status === 'pending');
        let html = '';
        pendingRequests.forEach(r => {
            const user = allUsers.find(u => u.uid === r.uid);
            const userName = user ? user.username : r.uid;
            const created = r.createdAt ? formatDate(new Date(r.createdAt.toMillis()), true) : '';
            html += `<tr>
                <td>${r.targetWeekStart}の週</td>
                <td><strong>${userName}</strong></td>
                <td>${created}</td>
                <td><button class="btn-small" onclick="window.adminInvModule.openInterviewRequestModal('${r.id}')">確定または却下</button></td>
            </tr>`;
        });
        listEl.innerHTML = html || '<tr><td colspan="4" class="empty-state">未確認の面談申請はありません</td></tr>';
        
        window.adminInvModule = window.adminInvModule || {};
        window.adminInvModule.openInterviewRequestModal = openInterviewRequestModal;
    } catch (e) { console.error(e); }
}

export async function loadInterviews() {
    const listEl = document.getElementById('confirmed-interview-list');
    if (!listEl) return;
    try {
        const interviews = (await getInterviews()).filter(i => i.status === 'scheduled');
        let html = '';
        interviews.forEach(inv => {
            const user = allUsers.find(u => u.uid === inv.uid);
            const userName = user ? user.username : inv.uid;
            const staff = allAdmins.find(a => a.uid === inv.staffId);
            const staffName = staff ? staff.username : inv.staffId;

            html += `<tr>
                <td>${inv.date} ${inv.startTime}-${inv.endTime}</td>
                <td><strong>${userName}</strong></td>
                <td>${staffName}</td>
                <td><button class="btn-small" onclick="window.adminInvModule.openInterviewDetailModal('${inv.id}')">詳細/キャンセル</button></td>
            </tr>`;
        });
        listEl.innerHTML = html || '<tr><td colspan="4" class="empty-state">確定済み面談はありません</td></tr>';
        
        window.adminInvModule.openInterviewDetailModal = openInterviewDetailModal;
        window.confirmedInterviews = interviews;
    } catch (e) { console.error(e); }
}

let currentRequestId = null;

export function openInterviewRequestModal(requestId) {
    currentRequestId = requestId;
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;
    
    const infoEl = document.getElementById('interview-request-info');
    let datesHtml = '<ul>';
    req.availableDates.forEach(d => {
        datesHtml += `<li>${d}</li>`;
    });
    datesHtml += '</ul>';
    
    infoEl.innerHTML = `利用者ID: ${req.uid}<br>希望日:<br>${datesHtml}<br>面談内容: ${req.content}`;
    
    document.getElementById('interview-date').value = req.availableDates[0];
    document.getElementById('interview-start-time').value = '10:00';
    document.getElementById('interview-end-time').value = '11:00';
    document.getElementById('reject-comment').value = '';
    
    showModal('interview-confirm-modal');
}

async function handleCreateInterview() {
    const date = document.getElementById('interview-date').value;
    const start = document.getElementById('interview-start-time').value;
    const end = document.getElementById('interview-end-time').value;
    const staffId = document.getElementById('staff-select').value;
    
    if (!date || !start || !end || !staffId) {
        showToast('日時と担当スタッフをすべて入力してください', 'error');
        return;
    }
    
    try {
        showLoading();
        const req = pendingRequests.find(r => r.id === currentRequestId);
        await dbCreateInterview({
            requestId: currentRequestId,
            uid: req.uid,
            date: date,
            startTime: start,
            endTime: end,
            staffId: staffId,
            adminUid: currentUserData.uid
        });
        showToast('面談を確定しました', 'success');
        hideModal('interview-confirm-modal');
        await Promise.all([loadInterviewRequests(), loadInterviews()]);
        refreshAdminBadges();
    } catch (e) {
        console.error(e);
        showToast('面談確定に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

async function handleRejectRequest() {
    const comment = document.getElementById('reject-comment').value;
    if (!comment.trim()) {
        showToast('却下理由を入力してください', 'error');
        return;
    }
    try {
        showLoading();
        await dbRejectRequest(currentRequestId, comment.trim(), currentUserData.uid);
        showToast('申請を却下しました', 'success');
        hideModal('interview-confirm-modal');
        await loadInterviewRequests();
        refreshAdminBadges();
    } catch (e) {
        console.error(e);
        showToast('エラーが発生しました', 'error');
    } finally {
        hideLoading();
    }
}

let currentInterviewId = null;

export function openInterviewDetailModal(interviewId) {
    currentInterviewId = interviewId;
    const inv = window.confirmedInterviews.find(i => i.id === interviewId);
    if (!inv) return;
    
    const infoEl = document.getElementById('interview-info');
    infoEl.innerHTML = `日時: ${inv.date} ${inv.startTime}〜${inv.endTime}<br>対象利用者: ${inv.uid}<br>担当スタッフ: ${inv.staffId}`;
    
    showModal('interview-detail-modal');
}

async function handleCancelInterview() {
    showConfirm('この面談予定をキャンセルしますか？', async () => {
        try {
            showLoading();
            await dbCancelInterview(currentInterviewId);
            showToast('キャンセルしました', 'success');
            hideModal('interview-detail-modal');
            await Promise.all([loadInterviewRequests(), loadInterviews()]);
            refreshAdminBadges();
        } catch (e) {
            console.error(e);
            showToast('キャンセルに失敗しました', 'error');
        } finally {
            hideLoading();
        }
    });
}
