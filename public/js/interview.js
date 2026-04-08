import { checkAuth, logout } from './auth.js';
import { getInterviews, getInterviewRequests, createInterviewRequest, cancelInterviewRequest as dbCancelRequest } from './firestore.js';
import { setupCommonUI, showLoading, hideLoading, showModal, hideModal, showToast, showConfirm } from './ui.js';
import { formatDate, getWeekStart } from './utils.js';

let currentUserData;

document.addEventListener('DOMContentLoaded', () => {
    initInterviewPage();
});

export async function initInterviewPage() {
    try {
        showLoading();
        currentUserData = await checkAuth('user');
        setupCommonUI(currentUserData, logout);
        
        // イベントリスナー設定
        document.getElementById('create-interview-request')?.addEventListener('click', openInterviewRequestModal);
        document.getElementById('submit-interview-request')?.addEventListener('click', submitInterviewRequest);
        document.getElementById('cancel-interview-request')?.addEventListener('click', () => hideModal('interview-request-modal'));
        
        document.getElementById('target-week')?.addEventListener('change', (e) => {
             renderAvailableDatePicker(e.target.value);
        });

        await Promise.all([
            loadInterviews(),
            loadInterviewRequests()
        ]);
        
    } catch (e) {
        console.error(e);
    } finally {
        hideLoading();
    }
}

export async function loadInterviews() {
    const listEl = document.getElementById('confirmed-interviews');
    if (!listEl) return;
    try {
        const interviews = await getInterviews(currentUserData.uid);
        let html = '';
        interviews.filter(i => i.status === 'scheduled').forEach(inv => {
            html += `<tr>
                <td><strong>${inv.date} ${inv.startTime} - ${inv.endTime}</strong></td>
                <td>${inv.staffId || '担当未設定'}</td>
            </tr>`;
        });
        listEl.innerHTML = html || '<tr><td colspan="2" class="empty-state">確定した面談予定はありません</td></tr>';
    } catch (e) {
        console.error(e);
    }
}

export async function loadInterviewRequests() {
    const listEl = document.getElementById('pending-interviews');
    if (!listEl) return;
    try {
        const reqs = await getInterviewRequests(currentUserData.uid);
        let html = '';
        reqs.forEach(req => {
            const statusStr = req.status === 'pending' ? '承認待ち' : (req.status === 'scheduled' ? '面談確定済' : (req.status === 'rejected' ? '却下' : '取り下げ済'));
            const created = req.createdAt ? formatDate(new Date(req.createdAt.toMillis()), true) : '';

            let actionBtn = '';
            if (req.status === 'pending') {
                actionBtn = `<button class="btn-small" onclick="window.interviewModule.cancelInterviewRequest('${req.id}')">取り下げ</button>`;
            }
            
            const rejectComment = req.status === 'rejected' && req.rejectionComment ? 
                `<div class="rejection-box"><strong>却下理由:</strong> ${req.rejectionComment}</div>` : '';

            html += `<tr>
                <td>${req.targetWeekStart}の週</td>
                <td>
                    <span class="status-tag status-${req.status}">${statusStr}</span>
                    ${rejectComment}
                    ${actionBtn}
                </td>
                <td>${created}</td>
            </tr>`;
        });
        listEl.innerHTML = html || '<tr><td colspan="3" class="empty-state">申請履歴はありません</td></tr>';
        
        window.interviewModule = { cancelInterviewRequest };
    } catch (e) {
        console.error(e);
    }
}

export function openInterviewRequestModal() {
    const d = getWeekStart(new Date());
    const weekInput = document.getElementById('target-week');
    if (weekInput) {
        weekInput.value = formatDate(d);
        renderAvailableDatePicker(formatDate(d));
    }
    
    const contentText = document.getElementById('interview-content');
    if (contentText) contentText.value = '';
    
    showModal('interview-request-modal');
}

function renderAvailableDatePicker(weekStartStr) {
    const container = document.getElementById('available-date-picker');
    if (!container) return;
    container.innerHTML = '';
    
    if (!weekStartStr) return;
    
    const weekStart = getWeekStart(new Date(weekStartStr));
    
    // 2週間分（月曜〜次週土曜）の希望入力欄を生成（日曜は除く）
    for (let i = 0; i < 13; i++) { 
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        if (d.getDay() === 0) continue; // 日曜はスキップ
        
        const dStr = formatDate(d);
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const dayLabel = `${dStr} (${dayNames[d.getDay()]})`;
        
        const row = document.createElement('div');
        row.className = 'date-picker-row';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.padding = '8px';
        row.style.borderBottom = '1px solid #eee';
        row.style.background = '#fff';
        
        row.innerHTML = `
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
                <input type="checkbox" class="avail-cb" value="${dStr}" style="width: 18px; height: 18px; cursor: pointer;">
                <span>${dayLabel}</span>
            </label>
        `;
        container.appendChild(row);
    }
}

export async function submitInterviewRequest() {
    const weekStartInput = document.getElementById('target-week').value;
    const content = document.getElementById('interview-content').value;
    
    if (!weekStartInput || !content.trim()) {
        showToast('対象週と相談内容は必須です', 'error');
        return;
    }
    
    const availableDates = []; 
    const rows = document.querySelectorAll('.date-picker-row');
    
    rows.forEach(row => {
        const cb = row.querySelector('.avail-cb');
        if (cb.checked) {
            availableDates.push(cb.value);
        }
    });
    
    if (availableDates.length === 0) {
        showToast('希望日時を1つ以上選択してください', 'error');
        return;
    }
    
    try {
        showLoading();
        await createInterviewRequest({
            uid: currentUserData.uid,
            targetWeekStart: formatDate(getWeekStart(new Date(weekStartInput))),
            availableDates: availableDates,
            content: content.trim()
        });
        showToast('面談申請を送信しました', 'success');
        hideModal('interview-request-modal');
        await loadInterviewRequests();
    } catch (e) {
        console.error(e);
        showToast('送信に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

export function cancelInterviewRequest(id) {
    showConfirm('この申請を取り下げますか？', async () => {
        try {
            showLoading();
            await dbCancelRequest(id);
            showToast('申請を取り下げました', 'success');
            await loadInterviewRequests();
        } catch (e) {
            console.error(e);
            showToast('取り下げに失敗しました', 'error');
        } finally {
            hideLoading();
        }
    });
}
