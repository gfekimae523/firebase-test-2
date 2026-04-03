import { auth, db, doc, getDoc, signOut, onAuthStateChanged } from './firebase-config.js';

const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // admin権限チェック
            if (userData.role !== 'admin') {
                alert("管理者権限がありません。利用者ページに移動します。");
                window.location.href = 'dashboard.html';
                return;
            }

            if (userNameEl) {
                userNameEl.textContent = `${userData.username} 管理者`;
            }
        } else {
            console.error("ユーザーデータが見つかりません。");
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("データ取得エラー:", error);
    }
});

// ログアウト処理
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}
