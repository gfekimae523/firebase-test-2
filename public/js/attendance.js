import { auth, db, doc, getDoc, signOut, onAuthStateChanged, collection, getDocs, query, orderBy, where, addDoc, serverTimestamp } from './firebase-config.js';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed (0:1月, 1:2月...)
let selectedDate = null;
let currentUid = null;

const usernameEl = document.getElementById('username');
const logoutBtn = document.getElementById('logout-btn');
const currentMonthEl = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const calendarGrid = document.getElementById('calendar-grid');

const btnCreateTimesheet = document.getElementById('btn-create-timesheet');
const timesheetModal = document.getElementById('timesheet-modal');
const cancelTimesheetBtn = document.getElementById('cancel-timesheet');
const submitTimesheetBtn = document.getElementById('submit-timesheet');
const targetMonthInput = document.getElementById('target-month');
const fillWeekdaysBtn = document.getElementById('fill-weekdays-btn');

const attendanceChangeModal = document.getElementById('attendance-change-modal');
const cancelChangeBtn = document.getElementById('cancel-change-request');
const submitChangeBtn = document.getElementById('submit-change-request');
const originalDateSpan = document.getElementById('original-date');
const requestTypeSelect = document.getElementById('request-type');

/**
 * ページ初期化
 */
async function initAttendancePage(user) {
    currentUid = user.uid;
    
    // ユーザー名表示
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            if (usernameEl) usernameEl.textContent = `${userSnap.data().username} さん`;
        }
    } catch (e) {
        console.error("ユーザー取得失敗:", e);
    }

    // カレンダー描画
    updateCalendarDisplay();

    // 申請一覧ロード
    loadTimesheetRequests();
    loadAttendanceChangeRequests();

    // イベントリスナー
    prevMonthBtn?.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        updateCalendarDisplay();
    });

    nextMonthBtn?.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        updateCalendarDisplay();
    });

    btnCreateTimesheet?.addEventListener('click', openTimesheetModal);
    cancelTimesheetBtn?.addEventListener('click', () => timesheetModal.classList.add('hidden'));
    cancelChangeBtn?.addEventListener('click', () => attendanceChangeModal.classList.add('hidden'));
    
    fillWeekdaysBtn?.addEventListener('click', fillWeekdays);
    submitTimesheetBtn?.addEventListener('click', submitTimesheetRequest);
    submitChangeBtn?.addEventListener('click', submitAttendanceChangeRequest);
}

/**
 * カレンダー表示更新
 */
function updateCalendarDisplay() {
    if (currentMonthEl) {
        currentMonthEl.textContent = `${currentYear}年${currentMonth + 1}月`;
    }
    renderCalendar(currentYear, currentMonth);
}

/**
 * カレンダー描画
 */
async function renderCalendar(year, month) {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    // 曜日ヘッダー
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    days.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day-header';
        dayEl.textContent = day;
        calendarGrid.appendChild(dayEl);
    });

    // 空白埋め
    for (let i = 0; i < firstDay; i++) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyEl);
    }

    // 日付セル
    for (let d = 1; d <= lastDate; d++) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(d).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;
        
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<span class="date-num">${d}</span>`;
        dayEl.dataset.date = dateStr;
        dayEl.addEventListener('click', () => openAttendanceChangeModal(dateStr));
        calendarGrid.appendChild(dayEl);
    }

    // 承認済みデータの反映
    loadAttendanceData(year, month);
}

/**
 * 承認済みデータの読み込み
 */
async function loadAttendanceData(year, month) {
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const timesheetId = `${currentUid}_${yearMonth}`;
    
    try {
        const attendancesRef = collection(db, 'timesheets', timesheetId, 'attendances');
        const snap = await getDocs(attendancesRef);
        
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const cell = calendarGrid.querySelector(`[data-date="${data.date}"]`);
            if (cell) {
                cell.classList.add('has-attendance');
                const info = document.createElement('div');
                info.className = 'attendance-info';
                info.textContent = `${data.startTime}-${data.endTime}`;
                cell.appendChild(info);
            }
        });
    } catch (e) {
        console.warn("承認済みデータがまだありません:", e);
    }
}

/**
 * 変更申請モーダルを開く
 */
function openAttendanceChangeModal(date) {
    selectedDate = date;
    if (originalDateSpan) originalDateSpan.textContent = date;
    const newDateInput = document.getElementById('new-date');
    if (newDateInput) newDateInput.value = date;
    attendanceChangeModal?.classList.remove('hidden');
}

/**
 * 変更申請送信
 */
async function submitAttendanceChangeRequest() {
    const type = requestTypeSelect?.value;
    const reasonValue = document.getElementById('change-reason')?.value;
    const newDateValue = document.getElementById('new-date')?.value;
    const startTimeValue = document.getElementById('new-start-time')?.value;
    const endTimeValue = document.getElementById('new-end-time')?.value;

    if (!reasonValue) {
        alert("理由を入力してください。");
        return;
    }

    try {
        await addDoc(collection(db, 'attendanceChangeRequests'), {
            uid: currentUid,
            requestType: type,
            originalDate: selectedDate,
            newDate: type === 'cancel' ? null : newDateValue,
            newStartTime: type === 'cancel' ? null : startTimeValue,
            newEndTime: type === 'cancel' ? null : endTimeValue,
            reason: reasonValue,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        alert("申請を送信しました。");
        attendanceChangeModal?.classList.add('hidden');
        loadAttendanceChangeRequests();
    } catch (e) {
        console.error(e);
        alert("エラーが発生しました。");
    }
}

/**
 * タイムシートモーダルを開く
 */
function openTimesheetModal() {
    const now = new Date();
    if (targetMonthInput) {
        targetMonthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    timesheetModal?.classList.remove('hidden');
}

/**
 * 平日一括入力
 */
function fillWeekdays() {
    alert("一括選択機能：選択した月の平日にデフォルト時間をセットします。");
}

/**
 * タイムシート申請送信
 */
async function submitTimesheetRequest() {
    const month = targetMonthInput?.value;
    if (!month) return;

    try {
        await addDoc(collection(db, 'timesheetRequests'), {
            uid: currentUid,
            yearMonth: month,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        alert("タイムシート申請を送信しました。");
        timesheetModal?.classList.add('hidden');
        loadTimesheetRequests();
    } catch (e) {
        console.error(e);
        alert("送信失敗");
    }
}

/**
 * タイムシート申請一覧表示
 */
async function loadTimesheetRequests() {
    const list = document.getElementById('timesheet-request-list');
    if (!list) return;

    try {
        const q = query(collection(db, 'timesheetRequests'), where('uid', '==', currentUid), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        list.innerHTML = '';
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement('li');
            li.textContent = `${d.yearMonth} 分 - 状態: ${d.status}`;
            list.appendChild(li);
        });
    } catch (e) {
        console.error("タイムシート申請取得失敗:", e);
    }
}

/**
 * 変更申請一覧表示
 */
async function loadAttendanceChangeRequests() {
    const list = document.getElementById('attendance-change-request-list');
    if (!list) return;

    try {
        const q = query(collection(db, 'attendanceChangeRequests'), where('uid', '==', currentUid), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        list.innerHTML = '';
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement('li');
            li.textContent = `${d.originalDate || d.newDate} [${d.requestType}] - 状態: ${d.status}`;
            list.appendChild(li);
        });
    } catch (e) {
        console.error("変更申請取得失敗:", e);
    }
}

// 認証監視
onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        initAttendancePage(user);
    }
});

// ログアウト
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (e) {
            console.error("ログアウト失敗:", e);
        }
    });
}
