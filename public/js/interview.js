import { auth, db, doc, getDoc, signOut, onAuthStateChanged, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, updateDoc } from './firebase-config.js';

let currentUid = null;

const usernameEl = document.getElementById('username');
const logoutBtn = document.getElementById('logout-btn');

const confirmedInterviewList = document.getElementById('confirmed-interviews');
const pendingInterviewList = document.getElementById('pending-interviews');

const btnCreateInterviewRequest = document.getElementById('create-interview-request');
const interviewRequestModal = document.getElementById('interview-request-modal');
const cancelInterviewRequestBtn = document.getElementById('cancel-interview-request');
const submitInterviewRequestBtn = document.getElementById('submit-interview-request');

/**
 * ページ初期化
 */
async function initInterviewPage(user) {
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

    // データロード
    loadInterviews();
    loadInterviewRequests();

    // イベントリスナー
    btnCreateInterviewRequest?.addEventListener('click', openInterviewRequestModal);
    cancelInterviewRequestBtn?.addEventListener('click', () => interviewRequestModal.classList.add('hidden'));
    submitInterviewRequestBtn?.addEventListener('click', submitInterviewRequest);
}

/**
 * 確定面談をFirestoreから取得・表示
 */
async function loadInterviews() {
    if (!confirmedInterviewList) return;
    confirmedInterviewList.innerHTML = '<li>読み込み中...</li>';

    try {
        const q = query(
            collection(db, 'interviews'),
            where('uid', '==', currentUid),
            orderBy('date', 'asc')
        );
        const snap = await getDocs(q);
        confirmedInterviewList.innerHTML = '';

        if (snap.empty) {
            confirmedInterviewList.innerHTML = '<li>確定した面談予定はありません。</li>';
            return;
        }

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement('li');
            li.className = 'notification-item';
            li.innerHTML = `
                <div style="font-weight: 600; color: var(--primary-color);">📅 ${d.date}</div>
                <div style="font-size: 0.9rem; color: var(--text-muted);">担当: ${d.staffName || 'スタッフ'}</div>
            `;
            confirmedInterviewList.appendChild(li);
        });
    } catch (e) {
        console.error("確定面談取得失敗:", e);
        confirmedInterviewList.innerHTML = '<li>読み込みに失敗しました。</li>';
    }
}

/**
 * 申請中面談を取得・表示
 */
async function loadInterviewRequests() {
    if (!pendingInterviewList) return;
    pendingInterviewList.innerHTML = '<li>読み込み中...</li>';

    try {
        const q = query(
            collection(db, 'interviewRequests'),
            where('uid', '==', currentUid),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        pendingInterviewList.innerHTML = '';

        if (snap.empty) {
            pendingInterviewList.innerHTML = '<li>申請中の面談はありません。</li>';
            return;
        }

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement('li');
            li.className = 'notification-item';
            
            let statusBadge = '';
            if (d.status === 'pending') statusBadge = '<span class="badge badge-warning">承認待ち</span>';
            else if (d.status === 'approved') statusBadge = '<span class="badge badge-success">確定済</span>';
            else if (d.status === 'rejected') statusBadge = '<span class="badge badge-danger">却下</span>';
            else if (d.status === 'cancelled') statusBadge = '<span class="badge badge-secondary">取り下げ済</span>';

            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 500;">希望週: ${d.targetWeek}〜</div>
                    ${statusBadge}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">理由・内容: ${d.content}</div>
                ${d.status === 'pending' ? `<button class="btn btn-sm btn-outline-danger" style="margin-top: 8px;" onclick="cancelInterviewRequest('${docSnap.id}')">取り下げる</button>` : ''}
            `;
            pendingInterviewList.appendChild(li);
        });
    } catch (e) {
        console.error("面談申請取得失敗:", e);
        pendingInterviewList.innerHTML = '<li>読み込みに失敗しました。</li>';
    }
}

/**
 * 申請モーダルを開く
 */
function openInterviewRequestModal() {
    interviewRequestModal?.classList.remove('hidden');
}

/**
 * 面談申請を送信
 */
async function submitInterviewRequest() {
    const week = document.getElementById('target-week')?.value;
    const content = document.getElementById('interview-content')?.value;

    if (!week || !content) {
        alert("週と相談内容を入力してください。");
        return;
    }

    try {
        await addDoc(collection(db, 'interviewRequests'), {
            uid: currentUid,
            targetWeek: week,
            content: content,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        alert("面談申請を送信しました。");
        interviewRequestModal?.classList.add('hidden');
        loadInterviewRequests();
    } catch (e) {
        console.error(e);
        alert("送信失敗");
    }
}

/**
 * 申請を取り下げ
 */
window.cancelInterviewRequest = async function(id) {
    if (!confirm("この申請を取り下げますか？")) return;

    try {
        const ref = doc(db, 'interviewRequests', id);
        await updateDoc(ref, {
            status: 'cancelled',
            updatedAt: serverTimestamp()
        });
        alert("取り下げました。");
        loadInterviewRequests();
    } catch (e) {
        console.error(e);
        alert("失敗しました。");
    }
};

// 認証監視
onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        initInterviewPage(user);
    }
});

// ログアウト
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}
