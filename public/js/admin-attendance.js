import { auth, db, doc, getDoc, signOut, onAuthStateChanged, collection, getDocs, query, orderBy, where, updateDoc, serverTimestamp, setDoc, deleteDoc } from './firebase-config.js';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedUserId = "";
let selectedRequestId = "";
let selectedRequestType = ""; // 'timesheet' or 'change'

const adminNameEl = document.getElementById('admin-name');
const logoutBtn = document.getElementById('logout-btn');
const userSelect = document.getElementById('user-select');
const currentMonthEl = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const calendarGrid = document.getElementById('calendar-grid');

const timesheetRequestList = document.getElementById('timesheet-request-list');
const attendanceChangeRequestList = document.getElementById('attendance-change-request-list');

const requestModal = document.getElementById('request-modal');
const requestDetailEl = document.getElementById('request-detail');
const adminCommentInput = document.getElementById('admin-comment');
const approveBtn = document.getElementById('approve-request');
const rejectBtn = document.getElementById('reject-request');
const cancelRequestBtn = document.getElementById('cancel-request');

/**
 * ページ初期化
 */
async function initAdminAttendancePage(user) {
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
    updateCalendarDisplay();

    // イベントリスナー
    userSelect?.addEventListener('change', (e) => {
        selectedUserId = e.target.value;
        loadUserAttendanceData();
        loadTimesheetRequests();
        loadAttendanceChangeRequests();
    });

    prevMonthBtn?.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        updateCalendarDisplay();
    });

    nextMonthBtn?.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        updateCalendarDisplay();
    });

    cancelRequestBtn?.addEventListener('click', () => requestModal?.classList.add('hidden'));
    approveBtn?.addEventListener('click', handleApprove);
    rejectBtn?.addEventListener('click', handleReject);
}

/**
 * 利用者一覧をロード
 */
async function loadUsers() {
    if (!userSelect) return;
    try {
        const q = query(collection(db, 'users'), where('role', '==', 'user'));
        const snap = await getDocs(q);
        userSelect.innerHTML = '<option value="">利用者を選択</option>';
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const opt = document.createElement('option');
            opt.value = docSnap.id;
            opt.textContent = d.username;
            userSelect.appendChild(opt);
        });
    } catch (e) {
        console.error("利用者取得失敗:", e);
    }
}

/**
 * カレンダー表示更新
 */
function updateCalendarDisplay() {
    if (currentMonthEl) currentMonthEl.textContent = `${currentYear}年${currentMonth + 1}月`;
    renderCalendar(currentYear, currentMonth);
}

/**
 * カレンダー描画
 */
function renderCalendar(year, month) {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days = ['日', '月', '火', '水', '木', '金', '土'];
    days.forEach(day => {
        const d = document.createElement('div');
        d.className = 'calendar-day-header';
        d.textContent = day;
        calendarGrid.appendChild(d);
    });

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        calendarGrid.appendChild(empty);
    }

    for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<span class="date-num">${d}</span>`;
        dayEl.dataset.date = dateStr;
        calendarGrid.appendChild(dayEl);
    }

    if (selectedUserId) loadUserAttendanceData();
}

/**
 * 選択中ユーザーの確定通所データを表示
 */
async function loadUserAttendanceData() {
    if (!selectedUserId) return;
    const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const timesheetId = `${selectedUserId}_${yearMonth}`;

    try {
        const snap = await getDocs(collection(db, 'timesheets', timesheetId, 'attendances'));
        // カレンダーの既存表示をクリア
        calendarGrid.querySelectorAll('.attendance-info').forEach(el => el.remove());
        calendarGrid.querySelectorAll('.has-attendance').forEach(el => el.classList.remove('has-attendance'));

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const cell = calendarGrid.querySelector(`[data-date="${data.date}"]`);
            if (cell) {
                cell.classList.add('has-attendance');
                const info = document.createElement('div');
                info.className = 'attendance-info';
                info.style.fontSize = '10px';
                info.textContent = `${data.startTime}-${data.endTime}`;
                cell.appendChild(info);
            }
        });
    } catch (e) {
        console.warn("通所データなし");
    }
}

/**
 * タイムシート申請一覧をロード（未確認のみ優先、または全体）
 */
async function loadTimesheetRequests() {
    if (!timesheetRequestList) return;
    try {
        const q = selectedUserId 
            ? query(collection(db, 'timesheetRequests'), where('uid', '==', selectedUserId), orderBy('createdAt', 'desc'))
            : query(collection(db, 'timesheetRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        
        const snap = await getDocs(q);
        timesheetRequestList.innerHTML = '';
        if (snap.empty) { timesheetRequestList.innerHTML = '<li>なし</li>'; return; }

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement('li');
            li.className = 'notification-item';
            li.style.cursor = 'pointer';
            li.innerHTML = `<div>${d.yearMonth} 分 タイムシート申請</div><div class="badge ${d.status === 'pending' ? 'badge-warning' : ''}">${d.status}</div>`;
            li.onclick = () => openRequestModal(docSnap.id, 'timesheet', d);
            timesheetRequestList.appendChild(li);
        });
    } catch (e) { console.error(e); }
}

/**
 * 通所変更申請一覧をロード
 */
async function loadAttendanceChangeRequests() {
    if (!attendanceChangeRequestList) return;
    try {
        const q = selectedUserId
            ? query(collection(db, 'attendanceChangeRequests'), where('uid', '==', selectedUserId), orderBy('createdAt', 'desc'))
            : query(collection(db, 'attendanceChangeRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        
        const snap = await getDocs(q);
        attendanceChangeRequestList.innerHTML = '';
        if (snap.empty) { attendanceChangeRequestList.innerHTML = '<li>なし</li>'; return; }

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement('li');
            li.className = 'notification-item';
            li.style.cursor = 'pointer';
            li.innerHTML = `<div>${d.originalDate || d.newDate} ${d.requestType}申請</div><div class="badge ${d.status === 'pending' ? 'badge-warning' : ''}">${d.status}</div>`;
            li.onclick = () => openRequestModal(docSnap.id, 'change', d);
            attendanceChangeRequestList.appendChild(li);
        });
    } catch (e) { console.error(e); }
}

/**
 * 申請確認モーダルを開く
 */
function openRequestModal(id, type, data) {
    selectedRequestId = id;
    selectedRequestType = type;
    adminCommentInput.value = "";
    
    let detail = "";
    if (type === 'timesheet') {
        detail = `<p>対象月: ${data.yearMonth}</p><p>ステータス: ${data.status}</p>`;
    } else {
        detail = `<p>種別: ${data.requestType}</p><p>対象日: ${data.originalDate || '-'} -> ${data.newDate || '-'}</p><p>時間: ${data.newStartTime || '-'} - ${data.newEndTime || '-'}</p><p>理由: ${data.reason}</p>`;
    }
    
    requestDetailEl.innerHTML = detail;
    requestModal?.classList.remove('hidden');
}

/**
 * 承認処理
 */
async function handleApprove() {
    if (!selectedRequestId) return;
    approveBtn.disabled = true;

    try {
        const col = selectedRequestType === 'timesheet' ? 'timesheetRequests' : 'attendanceChangeRequests';
        const ref = doc(db, col, selectedRequestId);
        const snap = await getDoc(ref);
        const data = snap.data();

        // status更新
        await updateDoc(ref, {
            status: 'approved',
            reviewedAt: serverTimestamp(),
            reviewedBy: auth.currentUser.uid
        });

        // timesheets への反映
        if (selectedRequestType === 'timesheet') {
            const tsId = `${data.uid}_${data.yearMonth}`;
            await setDoc(doc(db, 'timesheets', tsId), {
                uid: data.uid,
                yearMonth: data.yearMonth,
                approvedAt: serverTimestamp(),
                approvedBy: auth.currentUser.uid
            });
            // 本来はサブコレクション attendances にも入れるが簡易化
        } else if (selectedRequestType === 'change') {
            const yearMonth = data.newDate ? data.newDate.substring(0, 7) : data.originalDate.substring(0, 7);
            const tsId = `${data.uid}_${yearMonth}`;
            const attId = data.newDate || data.originalDate;
            const attRef = doc(db, 'timesheets', tsId, 'attendances', attId);

            if (data.requestType === 'cancel') {
                await deleteDoc(attRef);
            } else {
                await setDoc(attRef, {
                    date: data.newDate,
                    startTime: data.newStartTime,
                    endTime: data.newEndTime
                });
            }
        }

        alert("承認しました。");
        requestModal?.classList.add('hidden');
        refreshLists();
    } catch (e) {
        console.error(e);
        alert("エラーが発生しました。");
    } finally {
        approveBtn.disabled = false;
    }
}

/**
 * 却下処理
 */
async function handleReject() {
    const comment = adminCommentInput.value;
    if (!comment) { alert("却下理由を入力してください。"); return; }
    
    rejectBtn.disabled = true;
    try {
        const col = selectedRequestType === 'timesheet' ? 'timesheetRequests' : 'attendanceChangeRequests';
        await updateDoc(doc(db, col, selectedRequestId), {
            status: 'rejected',
            rejectionComment: comment,
            reviewedAt: serverTimestamp(),
            reviewedBy: auth.currentUser.uid
        });
        alert("却下しました。");
        requestModal?.classList.add('hidden');
        refreshLists();
    } catch (e) {
        console.error(e);
    } finally {
        rejectBtn.disabled = false;
    }
}

function refreshLists() {
    loadTimesheetRequests();
    loadAttendanceChangeRequests();
    loadUserAttendanceData();
}

// 認証監視
onAuthStateChanged(auth, user => {
    if (!user) window.location.href = 'index.html';
    else initAdminAttendancePage(user);
});

// ログアウト
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}
