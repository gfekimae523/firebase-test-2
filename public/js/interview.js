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

        // 面談データの取得
        fetchInterviews();
        fetchInterviewRequests();
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
// データ取得表示
// ==========================================
async function fetchInterviews() {
    const listEl = document.getElementById('scheduled-interviews');
    if (!listEl) return;
    listEl.innerHTML = '<li style="padding:12px; font-size:14px; color:#6b7280;">読み込み中...</li>';

    try {
        const q = query(collection(db, 'interviews'), where("uid", "==", currentUser.uid), orderBy("date", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listEl.innerHTML = '<li class="empty-state">現在確定している面談予定はありません。</li>';
            return;
        }

        listEl.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="font-weight: 500; color: var(--primary-color);">📅 ${data.date}</div>
                <div style="font-size: 13px; color: var(--text-muted); margin-top:4px;">担当: ${data.staffId || '未定'} / 作成日: ${new Date(data.createdAt).toLocaleDateString()}</div>
            `;
            listEl.appendChild(li);
        });
    } catch (error) {
        console.error("確定面談の取得エラー:", error);
        listEl.innerHTML = '<li class="empty-state" style="color:red;">エラーが発生しました</li>';
    }
}

async function fetchInterviewRequests() {
    const listEl = document.getElementById('pending-interviews');
    if (!listEl) return;
    listEl.innerHTML = '<li style="padding:12px; font-size:14px; color:#6b7280;">読み込み中...</li>';

    try {
        const q = query(collection(db, 'interviewRequests'), where("uid", "==", currentUser.uid), orderBy("targetWeekStart", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listEl.innerHTML = '<li class="empty-state">申請中の面談はありません。</li>';
            return;
        }

        listEl.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const li = document.createElement('li');
            
            let statusLabel = "";
            let statusColor = "";
            if (data.status === 'pending') { statusLabel = '調整中'; statusColor = 'background:#FEF3C7; color:#D97706;'; }
            else if (data.status === 'scheduled') { statusLabel = '面談確定済'; statusColor = 'background:#D1FAE5; color:#059669;'; }
            else { statusLabel = '却下'; statusColor = 'background:#FEE2E2; color:#DC2626;'; }

            li.innerHTML = `
                <div style="display:flex; justify-content: space-between;">
                    <div style="font-weight: 500;">希望週: ${data.targetWeekStart}から</div>
                    <span style="padding: 4px 8px; border-radius:12px; font-size:12px; font-weight:600; ${statusColor}">${statusLabel}</span>
                </div>
                <div style="font-size: 13px; color: var(--text-muted); margin-top:4px;">希望日時: ${data.availableDates}</div>
                <div style="font-size: 13px; color: var(--text-muted); margin-top:2px;">内容: ${data.content}</div>
            `;
            listEl.appendChild(li);
        });
    } catch (error) {
        if (error.message.includes('index')) {
            listEl.innerHTML = `<li style="padding:12px; color:red; font-size:12px;">Firestoreの複合インデックスの作成が必要です。<br>${error.message}</li>`;
        } else {
            console.error("申請中面談の取得エラー:", error);
            listEl.innerHTML = '<li class="empty-state" style="color:red;">エラーが発生しました</li>';
        }
    }
}

// ==========================================
// モーダル・申請送信
// ==========================================
const modal = document.getElementById('interview-modal');
document.getElementById('open-interview-modal')?.addEventListener('click', () => modal.classList.remove('hidden'));
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => document.getElementById(e.target.getAttribute('data-target')).classList.add('hidden'));
});

document.getElementById('submit-interview')?.addEventListener('click', async () => {
    const week = document.getElementById('interview-week').value;
    const dates = document.getElementById('interview-dates').value;
    const content = document.getElementById('interview-content').value;

    if (!week) return alert('対象週の開始日を選択してください。');
    if (!dates) return alert('希望日時を入力してください。');
    if (!content) return alert('相談内容を入力してください。');

    const btn = document.getElementById('submit-interview');
    btn.disabled = true;
    btn.textContent = "送信中...";

    try {
        await addDoc(collection(db, 'interviewRequests'), {
            uid: currentUser.uid,
            targetWeekStart: week,
            availableDates: dates,
            content: content,
            status: "pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        alert('面談の希望を送信しました！');
        modal.classList.add('hidden');
        fetchInterviewRequests(); // 再取得して表示
    } catch (error) {
        console.error(error);
        alert('送信に失敗しました。');
    } finally {
        btn.disabled = false;
        btn.textContent = "申請送信";
    }
});
