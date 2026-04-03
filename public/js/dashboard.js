import { auth, db, doc, getDoc, signOut, onAuthStateChanged, collection, getDocs, query, orderBy, limit, where } from './firebase-config.js';

const usernameEl = document.getElementById('username');
const logoutBtn = document.getElementById('logout-btn');

/**
 * ページ初期化
 */
async function initDashboard(user) {
    try {
        // ユーザー情報をFirestoreから取得
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // adminなら管理者ダッシュボードへリダイレクト
            if (userData.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
                return;
            }

            // ユーザー名を表示
            if (usernameEl) {
                usernameEl.textContent = `${userData.username} さん`;
            }

            // 各種データのロード
            loadAnnouncements();
            loadPendingRequests(user.uid);
            loadNotifications(user.uid);
        } else {
            console.error("ユーザーデータが見つかりません。");
            if (usernameEl) usernameEl.textContent = "ゲスト さん";
        }
    } catch (error) {
        console.error("初期化エラー:", error);
    }
}

/**
 * お知らせをFirestoreから取得・表示
 */
async function loadAnnouncements() {
    const listEl = document.getElementById('announcement-list');
    if (!listEl) return;

    try {
        const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(5));
        const querySnapshot = await getDocs(q);
        
        listEl.innerHTML = '';
        if (querySnapshot.empty) {
            listEl.innerHTML = '<li>お知らせはありません。</li>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '不明';
            const li = document.createElement('li');
            li.innerHTML = `<span class="date">${date}</span> ${data.title}`;
            listEl.appendChild(li);
        });
    } catch (error) {
        console.error("お知らせ読み込みエラー:", error);
        listEl.innerHTML = '<li>お知らせの読み込みに失敗しました。</li>';
    }
}

/**
 * 申請状況の取得・表示（期限が近いものなど）
 */
async function loadPendingRequests(uid) {
    const container = document.getElementById('pending-requests-list');
    if (!container) return;

    // TODO: timesheetRequests や attendanceChangeRequests から status='pending' を取得するロジック
    // 現時点ではプレースホルダーを表示
    container.innerHTML = '現在、確認が必要な申請はありません。';
}

/**
 * 承認・却下通知の取得・表示
 */
async function loadNotifications(uid) {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    // TODO: 審査済み(approved/rejected)の申請を取得し、未確認のものを優先表示するロジック
    // 現時点ではプレースホルダーを表示
    container.innerHTML = '新着の通知はありません。';
}

// 認証状態の監視
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        initDashboard(user);
    }
});

// ログアウト処理
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error("ログアウトエラー:", error);
            alert("ログアウトに失敗しました。");
        }
    });
}
