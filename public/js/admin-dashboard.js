import { auth, db, doc, getDoc, signOut, onAuthStateChanged, collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, limit } from './firebase-config.js';

let adminName = "";
let adminUid = "";

const adminNameEl = document.getElementById('admin-name');
const logoutBtn = document.getElementById('logout-btn');
const announcementList = document.getElementById('announcement-list');
const pendingRequestList = document.getElementById('pending-request-list');

const createAnnouncementBtn = document.getElementById('create-announcement-btn');
const announcementModal = document.getElementById('announcement-modal');
const cancelAnnouncementBtn = document.getElementById('cancel-announcement');
const submitAnnouncementBtn = document.getElementById('submit-announcement');

const badgeAttendance = document.getElementById('badge-attendance');
const badgeInterview = document.getElementById('badge-interview');

/**
 * ページ初期化
 */
async function initAdminDashboard(user) {
    adminUid = user.uid;

    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.role !== 'admin') {
                window.location.href = 'dashboard.html';
                return;
            }
            adminName = userData.username;
            if (adminNameEl) adminNameEl.textContent = `${adminName} 管理者`;
        }
    } catch (e) {
        console.error("管理者情報取得失敗:", e);
    }

    // データロード
    loadAnnouncements();
    loadPendingRequests();

    // イベントリスナー
    createAnnouncementBtn?.addEventListener('click', () => announcementModal?.classList.remove('hidden'));
    cancelAnnouncementBtn?.addEventListener('click', () => announcementModal?.classList.add('hidden'));
    submitAnnouncementBtn?.addEventListener('click', createAnnouncement);
}

/**
 * お知らせ一覧を取得・表示
 */
async function loadAnnouncements() {
    if (!announcementList) return;
    try {
        const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(10));
        const snap = await getDocs(q);
        announcementList.innerHTML = '';
        
        if (snap.empty) {
            announcementList.innerHTML = '<li>お知らせはまだありません。</li>';
            return;
        }

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement('li');
            li.className = 'notification-item';
            const date = d.createdAt?.toDate().toLocaleDateString() || '不明';
            li.innerHTML = `
                <div style="font-weight: 600;">${d.title}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${date} - ${d.body.substring(0, 50)}...</div>
            `;
            announcementList.appendChild(li);
        });
    } catch (e) {
        console.error("お知らせ読み込み失敗:", e);
    }
}

/**
 * お知らせを投稿
 */
async function createAnnouncement() {
    const title = document.getElementById('announcement-title')?.value;
    const body = document.getElementById('announcement-body')?.value;

    if (!title || !body) {
        alert("タイトルと本文を入力してください。");
        return;
    }

    submitAnnouncementBtn.disabled = true;
    try {
        await addDoc(collection(db, 'announcements'), {
            title: title,
            body: body,
            createdBy: adminUid,
            createdAt: serverTimestamp()
        });
        alert("お知らせを投稿しました。");
        announcementModal?.classList.add('hidden');
        // フォームクリア
        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-body').value = '';
        loadAnnouncements();
    } catch (e) {
        console.error("投稿失敗:", e);
        alert("投稿に失敗しました。");
    } finally {
        submitAnnouncementBtn.disabled = false;
    }
}

/**
 * 未確認申請をすべての種別から取得・表示
 */
async function loadPendingRequests() {
    if (!pendingRequestList) return;
    pendingRequestList.innerHTML = '<li>読み込み中...</li>';

    try {
        let totalAttendance = 0;
        let totalInterview = 0;
        const allPending = [];

        // 1. タイムシート申請
        const qTs = query(collection(db, 'timesheetRequests'), where('status', '==', 'pending'));
        const snapTs = await getDocs(qTs);
        totalAttendance += snapTs.size;
        snapTs.forEach(docSnap => {
            allPending.push({ id: docSnap.id, type: 'タイムシート', ...docSnap.data() });
        });

        // 2. 通所変更申請
        const qCh = query(collection(db, 'attendanceChangeRequests'), where('status', '==', 'pending'));
        const snapCh = await getDocs(qCh);
        totalAttendance += snapCh.size;
        snapCh.forEach(docSnap => {
            allPending.push({ id: docSnap.id, type: '通所変更', ...docSnap.data() });
        });

        // 3. 面談申請
        const qInt = query(collection(db, 'interviewRequests'), where('status', '==', 'pending'));
        const snapInt = await getDocs(qInt);
        totalInterview += snapInt.size;
        snapInt.forEach(docSnap => {
            allPending.push({ id: docSnap.id, type: '面談申請', ...docSnap.data() });
        });

        // バッジ更新
        updateBadges(totalAttendance, totalInterview);

        // 表示
        pendingRequestList.innerHTML = '';
        if (allPending.length === 0) {
            pendingRequestList.innerHTML = '<li>未確認の申請はありません。</li>';
            return;
        }

        // 作成日順にソート（createdAtがない場合は考慮が必要だがここでは簡易化）
        allPending.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        allPending.forEach(req => {
            const li = document.createElement('li');
            li.className = 'notification-item';
            const date = req.createdAt?.toDate().toLocaleString() || '不明';
            li.innerHTML = `
                <div style="font-weight: 600;">[${req.type}] 申請がありました</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${date} - ユーザーID: ${req.uid.substring(0, 5)}...</div>
            `;
            pendingRequestList.appendChild(li);
        });

    } catch (e) {
        console.error("未確認申請取得失敗:", e);
        pendingRequestList.innerHTML = '<li>読み込みに失敗しました。</li>';
    }
}

/**
 * バッジを更新
 */
function updateBadges(attendanceCount, interviewCount) {
    if (badgeAttendance) {
        if (attendanceCount > 0) {
            badgeAttendance.textContent = attendanceCount;
            badgeAttendance.classList.remove('hidden');
        } else {
            badgeAttendance.classList.add('hidden');
        }
    }
    if (badgeInterview) {
        if (interviewCount > 0) {
            badgeInterview.textContent = interviewCount;
            badgeInterview.classList.remove('hidden');
        } else {
            badgeInterview.classList.add('hidden');
        }
    }
}

// 認証監視
onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        initAdminDashboard(user);
    }
});

// ログアウト
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}
