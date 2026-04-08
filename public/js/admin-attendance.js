import { checkAuth, logout } from './auth.js';
import { getAllUsers, getTimesheet, getAllTimesheets, getTimesheetRequests, getAttendanceChangeRequests, approveTimesheetRequest, rejectTimesheetRequest, approveAttendanceChangeRequest, rejectAttendanceChangeRequest } from './firestore.js';
import { setupCommonUI, refreshAdminBadges, showLoading, hideLoading, showModal, hideModal, showToast, showConfirm } from './ui.js';
import { formatDate, generateCalendar } from './utils.js';

let currentYear;
let currentMonth;
let selectedUserId = null;
let currentTimesheetData = null;
let allUsers = [];
let currentUserData;

// グローバルで使うリクエスト保存用
let currentPendingRequestId = null;
let currentPendingRequestType = null; // 'timesheet' or 'change'

document.addEventListener('DOMContentLoaded', () => {
    initAdminAttendancePage();
});

export async function initAdminAttendancePage() {
    try {
        showLoading();
        currentUserData = await checkAuth('admin');
        setupCommonUI(currentUserData, logout);
        refreshAdminBadges();
        
        const now = new Date();
        currentYear = now.getFullYear();
        currentMonth = now.getMonth() + 1;
        
        // ユーザー一覧ロード
        await loadUsers();
        
        // イベント
        document.getElementById('user-select')?.addEventListener('change', (e) => {
            selectedUserId = e.target.value;
            refreshView();
        });
        
        document.getElementById('prev-month')?.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 1) { currentMonth = 12; currentYear--; }
            refreshView();
        });
        document.getElementById('next-month')?.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 12) { currentMonth = 1; currentYear++; }
            refreshView();
        });

        // タイムシート用イベント
        document.getElementById('ts-approve-btn')?.addEventListener('click', () => {
            handleApproveRequest(currentPendingRequestId, 'timesheet');
        });
        document.getElementById('ts-reject-btn')?.addEventListener('click', () => {
            const comment = document.getElementById('ts-admin-comment').value;
            handleRejectRequest(currentPendingRequestId, 'timesheet', comment);
        });

        // 変更申請用イベント
        document.getElementById('change-approve-btn')?.addEventListener('click', () => {
            handleApproveRequest(currentPendingRequestId, 'change');
        });
        document.getElementById('change-reject-btn')?.addEventListener('click', () => {
            const comment = document.getElementById('change-admin-comment').value;
            handleRejectRequest(currentPendingRequestId, 'change', comment);
        });

        document.getElementById('print-timesheet')?.addEventListener('click', () => {
            if (selectedUserId) printTimesheet(selectedUserId, `${currentYear}-${String(currentMonth).padStart(2,'0')}`);
        });

        await refreshView();

    } catch (e) {
        console.error(e);
    } finally {
        hideLoading();
    }
}

let allTimesheetsData = [];

async function refreshView() {
    const monthLabel = document.getElementById('current-month');
    if (monthLabel) monthLabel.textContent = `${currentYear}年${currentMonth}月`;
    
    const ym = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    if (selectedUserId) {
        await loadUserTimesheet(selectedUserId, currentYear, currentMonth);
        renderCalendar(currentYear, currentMonth);
        await Promise.all([
            loadTimesheetRequests(selectedUserId),
            loadAttendanceChangeRequests(selectedUserId)
        ]);
        const printBtn = document.getElementById('print-timesheet');
        if (printBtn) printBtn.disabled = false;
    } else {
        // 全ユーザーの概要を表示
        allTimesheetsData = await getAllTimesheets(ym);
        renderCalendar(currentYear, currentMonth);
        await Promise.all([
            loadTimesheetRequests(null),
            loadAttendanceChangeRequests(null)
        ]);
        const printBtn = document.getElementById('print-timesheet');
        if (printBtn) printBtn.disabled = true;
    }
}

export async function loadUsers() {
    allUsers = await getAllUsers();
    const select = document.getElementById('user-select');
    if (!select) return;
    
    // 初期状態を「全体表示」にする
    select.innerHTML = '<option value="">(全体表示)</option>';
    
    allUsers.filter(u => u.role === 'user').forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.uid;
        opt.textContent = u.username;
        select.appendChild(opt);
    });
}

export async function loadUserTimesheet(uid, year, month) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    currentTimesheetData = await getTimesheet(uid, ym);
}

function renderCalendar(year, month) {
    const calData = generateCalendar(year, month);
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-row header-row';
    weekdays.forEach(wd => {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell header-cell';
        cell.textContent = wd;
        headerRow.appendChild(cell);
    });
    grid.appendChild(headerRow);
    
    calData.forEach(week => {
        const row = document.createElement('div');
        row.className = 'calendar-row';
        week.forEach(date => {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            if (date) {
                cell.textContent = date.getDate();
                const dStr = formatDate(date);
                
                if (selectedUserId) {
                    // 個別表示
                    if (currentTimesheetData && currentTimesheetData.attendances) {
                        const att = currentTimesheetData.attendances.find(a => a.date === dStr);
                        if (att) {
                            const evt = document.createElement('div');
                            evt.className = 'attendance-event';
                            evt.textContent = `${att.startTime} - ${att.endTime}`;
                            cell.appendChild(evt);
                            cell.classList.add('has-attendance');
                        }
                    }
                } else {
                    // 全体表示
                    const attendingCount = allTimesheetsData.filter(ts => 
                        ts.attendances && ts.attendances.some(a => a.date === dStr)
                    ).length;
                    
                    if (attendingCount > 0) {
                        const evt = document.createElement('div');
                        evt.className = 'attendance-summary';
                        evt.textContent = `${attendingCount}名 通所`;
                        cell.appendChild(evt);
                        cell.classList.add('has-attendance');
                    }
                }
            }
            row.appendChild(cell);
        });
        grid.appendChild(row);
    });
}

export async function loadTimesheetRequests(uid) {
    const listEl = document.getElementById('timesheet-request-list');
    if (!listEl) return;
    try {
        const reqs = (await getTimesheetRequests(uid)).filter(r => r.status === 'pending');
        let html = '';
        reqs.forEach(r => {
            const user = allUsers.find(u => u.uid === r.uid);
            const userName = user ? user.username : r.uid;
            const created = r.createdAt ? formatDate(new Date(r.createdAt.toMillis()), true) : '';
            html += `<tr>
                <td>${r.yearMonth}</td>
                <td><strong>${userName}</strong></td>
                <td>${created}</td>
                <td><button class="btn-small" onclick="window.adminAttModule.openRequestModal('${r.id}', 'timesheet')">確認</button></td>
            </tr>`;
        });
        listEl.innerHTML = html || '<tr><td colspan="4" class="empty-state">未確認の申請はありません</td></tr>';
        
        window.adminAttModule = window.adminAttModule || {};
        window.adminAttModule.openRequestModal = openRequestModal;
        window.adminAttRequests = reqs; 
    } catch (e) { console.error(e); }
}

export async function loadAttendanceChangeRequests(uid) {
    const listEl = document.getElementById('attendance-change-request-list');
    if (!listEl) return;
    try {
        const reqs = (await getAttendanceChangeRequests(uid)).filter(r => r.status === 'pending');
        let html = '';
        reqs.forEach(r => {
            const user = allUsers.find(u => u.uid === r.uid);
            const userName = user ? user.username : r.uid;
            const created = r.createdAt ? formatDate(new Date(r.createdAt.toMillis()), true) : '';
            const typeStr = r.requestType === 'create' ? '新規追加' : (r.requestType === 'cancel' ? '削除' : '日時変更');
            const afterStr = `${r.newDate || r.date} ${r.newStartTime || ''}〜${r.newEndTime || ''}`;
            
            html += `<tr>
                <td>${r.date}</td>
                <td><strong>${userName}</strong></td>
                <td><span class="type-tag type-${r.requestType}">${typeStr}</span></td>
                <td>${afterStr}</td>
                <td class="cell-reason">${r.reason}</td>
                <td>${created}</td>
                <td><button class="btn-small" onclick="window.adminAttModule.openRequestModal('${r.id}', 'change')">確認</button></td>
            </tr>`;
        });
        listEl.innerHTML = html || '<tr><td colspan="7" class="empty-state">未確認の変更申請はありません</td></tr>';
        
        window.adminAttModule = window.adminAttModule || {};
        window.adminAttChangeRequests = reqs;
    } catch (e) { console.error(e); }
}

export function openRequestModal(requestId, type) {
    currentPendingRequestId = requestId;
    currentPendingRequestType = type;
    
    if (type === 'timesheet') {
        const req = window.adminAttRequests.find(r => r.id === requestId);
        const infoEl = document.getElementById('ts-request-info');
        const listEl = document.getElementById('ts-attendance-list');
        document.getElementById('ts-admin-comment').value = '';

        const user = allUsers.find(u => u.uid === req.uid);
        infoEl.innerHTML = `利用者: <strong>${user ? user.username : req.uid}</strong><br>対象月: <strong>${req.yearMonth}</strong>`;
        
        let listHtml = '<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">';
        listHtml += '<tr style="background: #eee;"><th>日付</th><th>時刻</th></tr>';
        req.attendances.forEach(a => {
            listHtml += `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 4px;">${a.date}</td>
                <td style="padding: 4px;">${a.startTime} 〜 ${a.endTime}</td>
            </tr>`;
        });
        listHtml += '</table>';
        listEl.innerHTML = listHtml;
        
        showModal('timesheet-confirm-modal');
    } else {
        const req = window.adminAttChangeRequests.find(r => r.id === requestId);
        const detailEl = document.getElementById('change-request-detail');
        document.getElementById('change-admin-comment').value = '';
        
        const user = allUsers.find(u => u.uid === req.uid);
        const typeStr = req.requestType === 'create' ? '新規追加' : (req.requestType === 'cancel' ? '削除' : '日時変更');
        
        detailEl.innerHTML = `
            利用者: <strong>${user ? user.username : req.uid}</strong><br>
            対象日: <strong>${req.date}</strong><br>
            種別: <strong>${typeStr}</strong><br>
            変更後: <strong>${req.newDate || req.date} ${req.newStartTime}〜${req.newEndTime}</strong><br>
            理由: <strong>${req.reason}</strong>
        `;
        showModal('change-confirm-modal');
    }
}

async function handleApproveRequest(requestId, type) {
    try {
        showLoading();
        const adminUid = (await checkAuth('admin')).uid;
        if (type === 'timesheet') {
            await approveTimesheetRequest(requestId, adminUid);
        } else {
            await approveAttendanceChangeRequest(requestId, adminUid);
        }
        showToast('承認しました', 'success');
        if (type === 'timesheet') hideModal('timesheet-confirm-modal');
        else hideModal('change-confirm-modal');
        await refreshView();
        refreshAdminBadges();
    } catch (e) {
        console.error(e);
        showToast(e.message || '承認に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

async function handleRejectRequest(requestId, type, comment) {
    if (!comment.trim()) {
        showToast('却下理由を入力してください', 'error');
        return;
    }
    try {
        showLoading();
        const adminUid = (await checkAuth('admin')).uid;
        if (type === 'timesheet') {
            await rejectTimesheetRequest(requestId, comment, adminUid);
        } else {
            await rejectAttendanceChangeRequest(requestId, comment, adminUid);
        }
        showToast('却下しました', 'success');
        if (type === 'timesheet') hideModal('timesheet-confirm-modal');
        else hideModal('change-confirm-modal');
        await refreshView();
        refreshAdminBadges();
    } catch (e) {
        console.error(e);
        showToast('エラーが発生しました', 'error');
    } finally {
        hideLoading();
    }
}

export function printTimesheet(uid, yearMonth) {
    // 設計書10-3: 実装方針 window.print() + @media print で実現
    // 実際の実装では、印刷専用のレイアウトを表示するページへ遷移させるか、
    // 現在の画面に印刷用スタイルを適用して window.print() を実行させる。
    window.print();
}
