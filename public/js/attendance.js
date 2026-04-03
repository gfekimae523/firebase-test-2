import { auth, db, doc, getDoc, signOut, onAuthStateChanged, setDoc } from './firebase-config.js';
// 注：本来は collection, addDoc なども firebase-config 経由でエクスポートして使いますが、
// 今回は動的なUIのモックとしての動きを中心に実装します。
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

let currentUser = null;

// ==========================================
// 認証・初期表示処理
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
    } catch (error) {
        console.error("データ取得エラー:", error);
    }
});

// ログアウト
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}

// ==========================================
// モーダル制御
// ==========================================
const openTimesheetBtn = document.getElementById('open-timesheet-modal');
const openChangeBtn = document.getElementById('open-change-modal');
const timesheetModal = document.getElementById('timesheet-modal');
const changeModal = document.getElementById('change-modal');
const closeBtns = document.querySelectorAll('.close-modal');

if (openTimesheetBtn) {
    openTimesheetBtn.addEventListener('click', () => timesheetModal.classList.remove('hidden'));
}

if (openChangeBtn) {
    openChangeBtn.addEventListener('click', () => changeModal.classList.remove('hidden'));
}

closeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.add('hidden');
    });
});

// モーダル外クリックで閉じる処理
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
    }
});

// ==========================================
// カレンダーのモック表示
// ==========================================
const calendarGrid = document.getElementById('calendar-grid');
if (calendarGrid) {
    // 開発用のダミー描画
    calendarGrid.style.display = 'grid';
    calendarGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
    calendarGrid.style.gap = '8px';
    calendarGrid.innerHTML = '';
    
    // 曜日ヘッダー
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    days.forEach(d => {
        const el = document.createElement('div');
        el.textContent = d;
        el.style.textAlign = 'center';
        el.style.fontWeight = '600';
        el.style.fontSize = '12px';
        el.style.color = '#6B7280';
        calendarGrid.appendChild(el);
    });

    // 日付セル（適当なダミー月）
    for (let i = 1; i <= 30; i++) {
        const el = document.createElement('div');
        el.style.padding = '12px';
        el.style.border = '1px solid #E5E7EB';
        el.style.borderRadius = '8px';
        el.style.minHeight = '80px';
        el.style.backgroundColor = 'white';
        el.innerHTML = `<span style="font-weight: 500">${i}</span>`;
        
        // 平日は通所予定のダミーを入れる
        const dayOfWeek = (i % 7); // 簡易計算
        if (dayOfWeek !== 1 && dayOfWeek !== 0) {
            el.innerHTML += `<div style="margin-top: 8px; font-size: 11px; background: #EEF2FF; color: #4F46E5; padding: 4px; border-radius: 4px;">通所予定<br>10:00-15:00</div>`;
        }
        
        calendarGrid.appendChild(el);
    }
}

// ==========================================
// 申請ボタンのアクション（モック）
// ==========================================
document.getElementById('submit-timesheet')?.addEventListener('click', async () => {
    const month = document.getElementById('timesheet-month').value;
    if (!month) return alert('対象月を選択してください。');
    
    alert(`【モック】${month}のタイムシート申請を送信しました！`);
    timesheetModal.classList.add('hidden');
});

document.getElementById('submit-change')?.addEventListener('click', async () => {
    const date = document.getElementById('change-date').value;
    const type = document.getElementById('change-type').value;
    if (!date) return alert('対象日を選択してください。');
    
    alert(`【モック】${date}の変更申請（${type}）を送信しました！`);
    changeModal.classList.add('hidden');
});
