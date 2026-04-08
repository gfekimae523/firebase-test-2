import { checkAuth, logout } from './auth.js';
import { getAnnouncements, getTimesheetRequests, getAttendanceChangeRequests, getInterviewRequests, getInterviews } from './firestore.js';
import { setupCommonUI, showLoading, hideLoading, showToast } from './ui.js';
import { formatDate } from './utils.js';

// DOM Elements
let usernameEl;
let logoutBtn;
let currentUserData;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

export async function initDashboard() {
    try {
        showLoading();
        // checkAuth内で古いlastLoginAtを取得してから更新されるので、直前のログイン時刻として使える
        currentUserData = await checkAuth('user');
        setupCommonUI(currentUserData, logout);
        
        await Promise.all([
            loadAnnouncements(),
            loadPendingRequests(),
            loadNotifications()
        ]);
    } catch (e) {
        console.error("Dashboard init error:", e);
    } finally {
        hideLoading();
    }
}

export async function loadAnnouncements() {
    const listEl = document.querySelector('#announcements');
    if (!listEl) return;
    
    try {
        const announcements = await getAnnouncements();
        const items = announcements.slice(0, 5).map(a => {
            const dateStr = a.createdAt ? formatDate(new Date(a.createdAt.toMillis())) : '';
            return `<li><strong>${dateStr}</strong>: ${a.title}</li>`;
        });
        
        let ul = listEl.querySelector('ul');
        if (!ul) {
            ul = document.createElement('ul');
            listEl.appendChild(ul);
        }
        ul.innerHTML = items.length > 0 ? items.join('') : '<li>お知らせはありません</li>';
    } catch (e) {
        console.error(e);
        showToast('お知らせの取得に失敗しました', 'error');
    }
}

export async function loadPendingRequests() {
    const listEl = document.querySelector('#pending-requests');
    if (!listEl || !currentUserData) return;
    
    try {
        const [timesheets, changes, interviews] = await Promise.all([
            getTimesheetRequests(currentUserData.uid),
            getAttendanceChangeRequests(currentUserData.uid),
            getInterviewRequests(currentUserData.uid)
        ]);
        
        let html = '<ul>';
        let count = 0;
        
        timesheets.filter(t => t.status === 'pending').forEach(t => {
            html += `<li>[タイムシート] ${t.yearMonth} の申請が承認待ちです</li>`;
            count++;
        });
        changes.filter(c => c.status === 'pending').forEach(c => {
            html += `<li>[通所変更] ${c.date} の変更申請が承認待ちです</li>`;
            count++;
        });
        interviews.filter(i => i.status === 'pending').forEach(i => {
            html += `<li>[面談] ${i.targetWeekStart} の週の申請が承認待ちです</li>`;
            count++;
        });
        
        html += '</ul>';
        
        let ulBox = listEl.querySelector('.content-box');
        if (!ulBox) {
            ulBox = document.createElement('div');
            ulBox.className = 'content-box';
            listEl.appendChild(ulBox);
        }
        ulBox.innerHTML = count > 0 ? html : '<p>承認待ちの申請はありません</p>';
    } catch (e) {
        console.error(e);
    }
}

export async function loadNotifications() {
    const listEl = document.querySelector('#notifications');
    if (!listEl || !currentUserData) return;
    
    try {
        const lastLoginTimeMillis = currentUserData.lastLoginAt ? currentUserData.lastLoginAt.toMillis() : 0;
        
        const [timesheets, changes, interviewReqs, interviewsConf] = await Promise.all([
            getTimesheetRequests(currentUserData.uid),
            getAttendanceChangeRequests(currentUserData.uid),
            getInterviewRequests(currentUserData.uid),
            getInterviews(currentUserData.uid)
        ]);
        
        let notifications = [];
        
        timesheets.forEach(t => {
            if ((t.status === 'approved' || t.status === 'rejected') && t.reviewedAt) {
                if (t.reviewedAt.toMillis() > lastLoginTimeMillis) {
                    const statusStr = t.status === 'approved' ? '承認' : '却下';
                    notifications.push({
                        time: t.reviewedAt.toMillis(),
                        text: `[タイムシート] ${t.yearMonth} の申請が${statusStr}されました`
                    });
                }
            }
        });
        
        changes.forEach(c => {
            if ((c.status === 'approved' || c.status === 'rejected') && c.reviewedAt) {
                if (c.reviewedAt.toMillis() > lastLoginTimeMillis) {
                    const statusStr = c.status === 'approved' ? '承認' : '却下';
                    notifications.push({
                        time: c.reviewedAt.toMillis(),
                        text: `[通所変更] ${c.date} の変更申請が${statusStr}されました`
                    });
                }
            }
        });
        
        interviewReqs.forEach(req => {
            if (req.status === 'rejected' && req.reviewedAt) {
                if (req.reviewedAt.toMillis() > lastLoginTimeMillis) {
                    notifications.push({
                        time: req.reviewedAt.toMillis(),
                        text: `[面談] ${req.targetWeekStart} 週の申請が却下されました`
                    });
                }
            }
        });
        
        interviewsConf.forEach(inv => {
             if (inv.createdAt && inv.createdAt.toMillis() > lastLoginTimeMillis) {
                 if (inv.status === 'scheduled') {
                     notifications.push({
                         time: inv.createdAt.toMillis(),
                         text: `[面談] ${inv.date} に面談が確定しました`
                     });
                 }
             }
             if (inv.cancelledAt && inv.cancelledAt.toMillis() > lastLoginTimeMillis) {
                 if (inv.status === 'cancelled') {
                     notifications.push({
                         time: inv.cancelledAt.toMillis(),
                         text: `[面談] ${inv.date} の面談がキャンセルされました`
                     });
                 }
             }
        });
        
        notifications.sort((a, b) => b.time - a.time);
        
        let html = '<ul>';
        if (notifications.length > 0) {
            notifications.forEach(n => {
                html += `<li>${n.text}</li>`;
            });
        } else {
            html += '<li>新着の通知はありません</li>';
        }
        html += '</ul>';
        
        let ulBox = listEl.querySelector('.content-box');
        if (!ulBox) {
            ulBox = document.createElement('div');
            ulBox.className = 'content-box';
            listEl.appendChild(ulBox);
        }
        ulBox.innerHTML = html;
        
    } catch (e) {
        console.error(e);
    }
}
