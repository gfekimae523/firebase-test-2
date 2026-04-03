import { auth, provider, signInWithPopup, onAuthStateChanged, db, doc, getDoc, setDoc, serverTimestamp } from './firebase-config.js';

const googleLoginBtn = document.getElementById('google-login-btn');
const errorMessage = document.getElementById('error-message');

/**
 * ページ初期化、認証状態チェック
 */
function initLoginPage() {
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
    }

    onAuthStateChanged(auth, async (user) => {
        // index.html または ルート にいる場合のみリダイレクトを確認
        if (user && (window.location.pathname.endsWith('index.html') || window.location.pathname === '/')) {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                redirectAfterLogin(userData.role);
            }
        }
    });
}

/**
 * Googleログイン実行
 */
async function handleGoogleLogin() {
    try {
        if (errorMessage) errorMessage.classList.add('hidden');
        
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            // 初回ログイン時のユーザー登録
            await setDoc(userRef, {
                email: user.email,
                username: user.displayName || '名無し',
                role: 'user', 
                status: 'active',
                createdAt: serverTimestamp()
            });
            redirectAfterLogin('user');
        } else {
            // 既存ユーザー
            const userData = userSnap.data();
            redirectAfterLogin(userData.role);
        }
    } catch (error) {
        console.error("ログインエラー:", error);
        if (errorMessage) {
            errorMessage.textContent = "ログインに失敗しました。もう一度お試しください。";
            errorMessage.classList.remove('hidden');
        }
    }
}

/**
 * ロール別リダイレクト処理
 * @param {string} role ユーザーの権限
 */
function redirectAfterLogin(role) {
    if (role === 'admin') {
        window.location.href = 'admin-dashboard.html';
    } else {
        window.location.href = 'dashboard.html';
    }
}

// 実行
initLoginPage();

