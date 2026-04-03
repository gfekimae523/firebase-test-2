import { auth, db, doc, getDoc, signOut, onAuthStateChanged, collection, addDoc, getDocs, query, where, orderBy } from './firebase-config.js';

const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
let currentUser = null;

// ==========================================
// 初期表示
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;

    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userNameEl) userNameEl.textContent = `${userData.username} さん`;
        }
        
        // ログイン確認後、データ取得
        fetchTimesheetRequests();
        fetchChangeRequests();
        renderCalendar(currentYear, currentMonth);
    } catch (error) {
        console.error("データ取得エラー:", error);
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}

// ==========================================
// データ読み込み処理
// ==========================================
async function fetchTimesheetRequests() {
    const listEl = document.getElementById('pending-timesheets');
    if (!listEl) return;
    listEl.innerHTML = '<li class="empty-state" style="padding:12px;">読み込み中...</li>';

    try {
        const q = query(collection(db, 'timesheetRequests'), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            listEl.innerHTML = '<li class="empty-state" style="padding:12px;">現在承認待ちのタイムシートはありません。</li>';
            return;
        }

        listEl.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items:center;">
                    <div style="font-weight: 500;">${data.yearMonth} タイムシート</div>
                    <span class="badge" style="background:#FEF3C7; color:#D97706; padding: 4px 8px; border-radius:12px; font-size:12px;">${data.status === 'pending' ? '承認待ち' : data.status}</span>
                </div>
                <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">申請日: ${new Date(data.createdAt).toLocaleDateString()}</div>
            `;
            listEl.appendChild(li);
        });
    } catch (error) {
        console.error("タイムシート取得エラー:", error);
        listEl.innerHTML = '<li class="empty-state" style="padding:12px; color:red;">エラーが発生しました</li>';
    }
}

async function fetchChangeRequests() {
    const listEl = document.getElementById('change-requests');
    if (!listEl) return;
    listEl.innerHTML = '<li class="empty-state" style="padding:12px;">読み込み中...</li>';

    try {
        const q = query(collection(db, 'attendanceChangeRequests'), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            listEl.innerHTML = '<li class="empty-state" style="padding:12px;">変更申請履歴はありません。</li>';
            return;
        }

        listEl.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const li = document.createElement('li');
            let typeLabel = "変更";
            if(data.requestType === "create") typeLabel = "追加";
            if(data.requestType === "cancel") typeLabel = "欠席";

            let statusLabel = "";
            let statusColor = "";
            if (data.status === 'pending') { statusLabel = '承認待ち'; statusColor = 'background:#FEF3C7; color:#D97706;'; }
            else if (data.status === 'approved') { statusLabel = '承認済'; statusColor = 'background:#D1FAE5; color:#059669;'; }
            else { statusLabel = '却下'; statusColor = 'background:#FEE2E2; color:#DC2626;'; }

            li.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items:center;">
                    <div style="font-weight: 500;">対象日: ${data.originalDate || data.newDate} (${typeLabel})</div>
                    <span style="padding: 4px 8px; border-radius:12px; font-size:12px; font-weight:600; ${statusColor}">${statusLabel}</span>
                </div>
                <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">理由: ${data.reason}</div>
            `;
            listEl.appendChild(li);
        });
    } catch (error) {
        // インデックス作成が必要な場合のエラー対策
        if (error.message.includes('index')) {
            listEl.innerHTML = `<li style="padding:12px; color:red; font-size:12px;">Firestoreの複合インデックスの作成が必要です。コンソールのURLから作成してください。<br>${error.message}</li>`;
        } else {
            listEl.innerHTML = '<li class="empty-state" style="padding:12px; color:red;">エラーが発生しました</li>';
        }
        console.error("変更申請取得エラー:", error);
    }
}

// ==========================================
// モーダル・申請送信
// ==========================================
const tsModal = document.getElementById('timesheet-modal');
const chModal = document.getElementById('change-modal');
let selectedTimesheetDates = new Set(); // 選択された日付のセット

document.getElementById('open-timesheet-modal')?.addEventListener('click', () => tsModal.classList.remove('hidden'));
document.getElementById('open-change-modal')?.addEventListener('click', () => chModal.classList.remove('hidden'));
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => document.getElementById(e.target.getAttribute('data-target')).classList.add('hidden'));
});

// モーダル用カレンダー描画
const tsMonthInput = document.getElementById('timesheet-month');
const modalCalGrid = document.getElementById('modal-calendar-grid');

function renderModalCalendar(year, month) {
    if (!modalCalGrid) return;
    modalCalGrid.innerHTML = '';
    selectedTimesheetDates.clear();

    ['日', '月', '火', '水', '木', '金', '土'].forEach(d => {
        const el = document.createElement('div');
        el.textContent = d;
        el.style.textAlign = 'center';
        el.style.fontSize = '11px';
        el.style.color = '#6B7280';
        modalCalGrid.appendChild(el);
    });

    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        modalCalGrid.appendChild(document.createElement('div'));
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const el = document.createElement('div');
        el.className = 'modal-cal-cell';
        el.dataset.day = i;
        el.style.padding = '8px';
        el.style.border = '1px solid #E5E7EB';
        el.style.borderRadius = '6px';
        el.style.textAlign = 'center';
        el.style.cursor = 'pointer';
        el.style.fontSize = '14px';
        el.style.transition = 'all 0.2s';
        el.innerHTML = i;
        
        el.addEventListener('click', () => {
            if (selectedTimesheetDates.has(i)) {
                selectedTimesheetDates.delete(i);
                el.style.backgroundColor = 'white';
                el.style.color = 'var(--text-main)';
                el.style.borderColor = '#E5E7EB';
            } else {
                selectedTimesheetDates.add(i);
                el.style.backgroundColor = 'var(--primary-color)';
                el.style.color = 'white';
                el.style.borderColor = 'var(--primary-color)';
            }
        });
        modalCalGrid.appendChild(el);
    }
}

tsMonthInput?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m] = val.split('-');
    renderModalCalendar(parseInt(y), parseInt(m));
});

document.getElementById('fill-weekdays-btn')?.addEventListener('click', () => {
    const val = tsMonthInput.value;
    if (!val) return alert('先に対象月を選択してください。');
    const [y, m] = val.split('-');
    const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
    
    document.querySelectorAll('.modal-cal-cell').forEach(el => {
        const i = parseInt(el.dataset.day);
        const dayOfWeek = new Date(parseInt(y), parseInt(m) - 1, i).getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            selectedTimesheetDates.add(i);
            el.style.backgroundColor = 'var(--primary-color)';
            el.style.color = 'white';
            el.style.borderColor = 'var(--primary-color)';
        } else {
            selectedTimesheetDates.delete(i);
            el.style.backgroundColor = 'white';
            el.style.color = 'var(--text-main)';
            el.style.borderColor = '#E5E7EB';
        }
    });
});

// タイムシート送信
document.getElementById('submit-timesheet')?.addEventListener('click', async () => {
    const month = tsMonthInput.value; 
    if (!month) return alert('対象月を選択してください。');
    if (selectedTimesheetDates.size === 0) return alert('通所予定日を少なくとも1日以上選択してください。');

    const btn = document.getElementById('submit-timesheet');
    btn.disabled = true;
    btn.textContent = "送信中...";

    try {
        const datesArr = Array.from(selectedTimesheetDates).sort((a,b)=>a-b);
        const attendances = datesArr.map(d => ({
            date: `${month}-${String(d).padStart(2, '0')}`,
            startTime: "10:00",
            endTime: "15:00"
        }));

        await addDoc(collection(db, 'timesheetRequests'), {
            uid: currentUser.uid,
            yearMonth: month,
            status: "pending",
            attendances: attendances,
            createdAt: new Date().toISOString()
        });
        alert('タイムシートの申請を送信しました！');
        tsModal.classList.add('hidden');
        selectedTimesheetDates.clear();
        tsMonthInput.value = '';
        if(modalCalGrid) modalCalGrid.innerHTML = '<p class="empty-state" style="grid-column: span 7;">対象月を選択してください。</p>';
        fetchTimesheetRequests();
    } catch (error) {
        console.error(error);
        alert('送信に失敗しました。');
    } finally {
        btn.disabled = false;
        btn.textContent = "申請する";
    }
});

// 変更申請送信
document.getElementById('submit-change')?.addEventListener('click', async () => {
    const date = document.getElementById('change-date').value;
    const type = document.getElementById('change-type').value;
    const reason = document.getElementById('change-reason').value;

    if (!date) return alert('対象日を選択してください。');
    if (!reason) return alert('理由を入力してください。');

    const btn = document.getElementById('submit-change');
    btn.disabled = true;
    btn.textContent = "送信中...";

    try {
        await addDoc(collection(db, 'attendanceChangeRequests'), {
            uid: currentUser.uid,
            requestType: type,
            originalDate: date, // 簡易実装
            newDate: date,
            reason: reason,
            status: "pending",
            createdAt: new Date().toISOString()
        });
        alert('変更申請を送信しました！');
        chModal.classList.add('hidden');
        fetchChangeRequests();
    } catch (error) {
        console.error(error);
        alert('送信に失敗しました。');
    } finally {
        btn.disabled = false;
        btn.textContent = "申請する";
    }
});

// ==========================================
// カレンダー機能
// ==========================================
const now = new Date();
let currentYear = now.getFullYear();
let currentMonth = now.getMonth() + 1;

async function renderCalendar(year, month) {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthDisplay = document.getElementById('current-month-display');
    if (!calendarGrid || !monthDisplay) return;

    calendarGrid.style.display = 'grid';
    calendarGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
    calendarGrid.style.gap = '8px';
    
    monthDisplay.textContent = `${year}年${month}月`;
    calendarGrid.innerHTML = '';
    
    // ヘッダー行
    ['日', '月', '火', '水', '木', '金', '土'].forEach(d => {
        const el = document.createElement('div');
        el.textContent = d;
        el.style.textAlign = 'center';
        el.style.fontWeight = '600';
        el.style.fontSize = '12px';
        el.style.color = '#6B7280';
        calendarGrid.appendChild(el);
    });

    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    // 月初めの空白セル
    for (let i = 0; i < firstDay; i++) {
        calendarGrid.appendChild(document.createElement('div'));
    }

    // Firestoreから当月の承認済みタイムシートデータを取得する想定の処理
    // ※今回はベースとして曜日判定で仮データを出しますが、本来はここに取得した予定をマッピングします
    const yearMonthStr = `${year}-${String(month).padStart(2, '0')}`;

    // 日付セル描画
    for (let i = 1; i <= daysInMonth; i++) {
        const el = document.createElement('div');
        el.style.padding = '12px';
        el.style.border = '1px solid #E5E7EB';
        el.style.borderRadius = '8px';
        el.style.minHeight = '80px';
        el.style.backgroundColor = 'white';
        el.innerHTML = `<span style="font-weight: 500">${i}</span>`;
        
        // 平日のモック予定（将来用プレースホルダー）
        const dayOfWeek = new Date(year, month - 1, i).getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            el.innerHTML += `<div style="margin-top: 8px; font-size: 11px; background: #EEF2FF; color: #4F46E5; padding: 4px; border-radius: 4px;">通所予定<br>10:00-15:00</div>`;
        }
        
        calendarGrid.appendChild(el);
    }
}

document.getElementById('prev-month')?.addEventListener('click', () => {
    currentMonth--;
    if(currentMonth < 1) { currentMonth = 12; currentYear--; }
    renderCalendar(currentYear, currentMonth);
});
document.getElementById('next-month')?.addEventListener('click', () => {
    currentMonth++;
    if(currentMonth > 12) { currentMonth = 1; currentYear++; }
    renderCalendar(currentYear, currentMonth);
});
