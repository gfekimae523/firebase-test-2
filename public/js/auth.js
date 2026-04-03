import { auth, provider, signInWithPopup, onAuthStateChanged, db, doc, getDoc, setDoc } from './firebase-config.js';

const loginBtn = document.getElementById('google-login-btn');
const errorText = document.getElementById('login-error');

if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        try {
            errorText.classList.add('hidden');
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Firestoreでユーザー権限を確認・作成
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                // 初回ログイン時のユーザー登録（デフォルトは一般ユーザー）
                await setDoc(userRef, {
                    email: user.email,
                    username: user.displayName || '名無し',
                    role: 'user', // admin権限を付与する場合はFirestore上で手動で書き換える想定
                    status: 'active',
                    createdAt: new Date().toISOString()
                });
                window.location.href = 'dashboard.html';
            } else {
                // 既存ユーザーの権限による振り分け
                const userData = userSnap.data();
                if (userData.role === 'admin') {
                    window.location.href = 'admin-dashboard.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }
        } catch (error) {
            console.error("ログインエラー:", error);
            errorText.textContent = "ログインに失敗しました。もう一度お試しください。";
            errorText.classList.remove('hidden');
        }
    });
}

// すでにログイン済みの場合は自動リダイレクトする処理
onAuthStateChanged(auth, async (user) => {
    // index.htmlにいる場合のみリダイレクトを実行
    if (user && window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }
    }
});
