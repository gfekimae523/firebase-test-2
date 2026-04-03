import { auth, db, doc, getDoc, signOut, onAuthStateChanged, collection, getDocs, query, where, orderBy, updateDoc, serverTimestamp, addDoc, deleteDoc } from './firebase-config.js';

let selectedRequestId = "";
let selectedInterviewId = "";
let allAdmins = [];

const adminNameEl = document.getElementById('admin-name');
const logoutBtn = document.getElementById('logout-btn');

const pendingRequestsList = document.getElementById('pending-interview-requests');
const confirmedInterviewsList = document.getElementById('confirmed-interview-list');

const confirmModal = document.getElementById('interview-confirm-modal');
const requestInfoEl = document.getElementById('interview-request-info');
const staffSelect = document.getElementById('staff-select');
const interviewDateInput = document.getElementById('interview-date');
const rejectCommentInput = document.getElementById('reject-comment');

const detailModal = document.getElementById('interview-detail-modal');
const interviewInfoEl = document.getElementById('interview-info');

/**
 * ページ初期化
 */
async function initAdminInterviewPage(user) {
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

    loadStaffs();
    loadInterviewRequests();
    loadInterviews();

    // イベントリスナー
    confirmModal?.querySelector('#cancel-confirm')?.addEventListener('click', () => confirmModal.classList.add('hidden'));
    confirmModal?.querySelector('#create-interview')?.addEventListener('click', handleCreateInterview);
    confirmModal?.querySelector('#reject-interview')?.addEventListener('click', handleRejectInterview);

    detailModal?.querySelector('#close-detail')?.addEventListener('click', () => detailModal.classList.add('hidden'));
    detailModal?.querySelector('#cancel-interview')?.addEventListener('click', handleCancelInterview);
}

/**
 * スタッフ（admin）一覧を取得
 */
async function loadStaffs() {
    try {
        const q = query(collection(db, 'users'), where('role', '==', 'admin'));
        const snap = await getDocs(q);
        staffSelect.innerHTML = '<option value="">スタッフを選択</option>';
        allAdmins = [];
        snap.forEach(docSnap => {
            const d = docSnap.data();
            allAdmins.push({ id: docSnap.id, ...d });
            const opt = document.createElement('option');
            opt.value = docSnap.id;
            opt.textContent = d.username;
            staffSelect.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

/**
 * 申請中の面談申請を取得・表示
 */
async function loadInterviewRequests() {
    if (!pendingRequestsList) return;
    try {
        const q = query(collection(db, 'interviewRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        pendingRequestsList.innerHTML = '';
        if (snap.empty) { pendingRequestsList.innerHTML = '<li>未対応の申請はありません。</li>'; return; }

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement('li');
            li.className = 'notification-item';
            li.style.cursor = 'pointer';
            li.innerHTML = `<div>希望週: ${d.targetWeek}〜 / 内容: ${d.content.substring(0, 20)}...</div><div class="badge badge-warning">申請中</div>`;
            li.onclick = () => openConfirmModal(docSnap.id, d);
            pendingRequestsList.appendChild(li);
        });
    } catch (e) { console.error(e); }
}

/**
 * 確定済み面談を取得・表示
 */
async function loadInterviews() {
    if (!confirmedInterviewsList) return;
    try {
        const q = query(collection(db, 'interviews'), orderBy('date', 'asc'));
        const snap = await getDocs(q);
        confirmedInterviewsList.innerHTML = '';
        if (snap.empty) { confirmedInterviewsList.innerHTML = '<li>確定済みの面談はありません。</li>'; return; }

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement('li');
            li.className = 'notification-item';
            li.style.cursor = 'pointer';
            li.innerHTML = `<div>📅 ${d.date} / 担当: ${d.staffName} / 利用者: ${d.uid.substring(0, 5)}...</div>`;
            li.onclick = () => openDetailModal(docSnap.id, d);
            confirmedInterviewsList.appendChild(li);
        });
    } catch (e) { console.error(e); }
}

/**
 * 確定用モーダル
 */
function openConfirmModal(id, data) {
    selectedRequestId = id;
    requestInfoEl.innerHTML = `<p><strong>希望週:</strong> ${data.targetWeek}〜</p><p><strong>内容:</strong> ${data.content}</p>`;
    confirmModal?.classList.remove('hidden');
}

/**
 * 詳細用モーダル
 */
function openDetailModal(id, data) {
    selectedInterviewId = id;
    interviewInfoEl.innerHTML = `<p><strong>日時:</strong> ${data.date}</p><p><strong>担当スタッフ:</strong> ${data.staffName}</p><p><strong>利用者ID:</strong> ${data.uid}</p>`;
    detailModal?.classList.remove('hidden');
}

/**
 * 面談を確定
 */
async function handleCreateInterview() {
    const date = interviewDateInput.value;
    const staffId = staffSelect.value;
    if (!date || !staffId) { alert("日時とスタッフを選択してください。"); return; }

    const staff = allAdmins.find(a => a.id === staffId);

    try {
        // 1. 申請をapprovedに
        const requestRef = doc(db, 'interviewRequests', selectedRequestId);
        const requestSnap = await getDoc(requestRef);
        const requestData = requestSnap.data();

        await updateDoc(requestRef, {
            status: 'approved',
            updatedAt: serverTimestamp()
        });

        // 2. interviewsに新規作成
        await addDoc(collection(db, 'interviews'), {
            uid: requestData.uid,
            requestId: selectedRequestId,
            date: date.replace('T', ' '),
            staffId: staffId,
            staffName: staff.username,
            createdAt: serverTimestamp()
        });

        alert("面談を確定しました。");
        confirmModal?.classList.add('hidden');
        loadInterviewRequests();
        loadInterviews();
    } catch (e) { console.error(e); }
}

/**
 * 申請却下
 */
async function handleRejectInterview() {
    const comment = rejectCommentInput.value;
    if (!comment) { alert("却下理由を入力してください。"); return; }

    try {
        await updateDoc(doc(db, 'interviewRequests', selectedRequestId), {
            status: 'rejected',
            rejectComment: comment,
            updatedAt: serverTimestamp()
        });
        alert("却下しました。");
        confirmModal?.classList.add('hidden');
        loadInterviewRequests();
    } catch (e) { console.error(e); }
}

/**
 * 確定面談キャンセル
 */
async function handleCancelInterview() {
    if (!confirm("この面談予定をキャンセルしますか？")) return;

    try {
        await deleteDoc(doc(db, 'interviews', selectedInterviewId));
        alert("キャンセルしました。");
        detailModal?.classList.add('hidden');
        loadInterviews();
    } catch (e) { console.error(e); }
}

// 認証監視
onAuthStateChanged(auth, user => {
    if (!user) window.location.href = 'index.html';
    else initAdminInterviewPage(user);
});

// ログアウト
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}
