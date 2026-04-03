import { auth, db, doc, getDoc, signOut, onAuthStateChanged } from './firebase-config.js';

const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

// 認証状態の監視
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // 未ログインの場合はログイン画面へ
        window.location.href = 'index.html';
        return;
    }

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
            if (userNameEl) {
                userNameEl.textContent = `${userData.username} さん`;
            }
        } else {
            console.error("ユーザーデータが見つかりません。");
            userNameEl.textContent = "ゲスト さん";
        }
    } catch (error) {
        console.error("データ取得エラー:", error);
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
