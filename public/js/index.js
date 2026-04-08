import { loginWithGoogle, checkAuth, redirectByRole } from './auth.js';
import { showLoading, hideLoading } from './ui.js';

// DOM Elements
let googleLoginBtn;
let errorMessageEl;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initLoginPage();
});

export async function initLoginPage() {
    googleLoginBtn = document.getElementById('google-login-btn');
    errorMessageEl = document.getElementById('error-message');

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
    }

    // 既にログイン済みかチェック
    try {
        const userData = await checkAuth();
        if (userData && userData.status === 'active') {
            redirectAfterLogin(userData.role);
        }
    } catch (e) {
        // 未ログイン時、またはエラー時はそのままログイン画面を表示するため握りつぶす
    }
}

export async function handleGoogleLogin() {
    showLoading();
    if (errorMessageEl) errorMessageEl.textContent = '';
    
    try {
        await loginWithGoogle(); // auth.jsの内部で自動的にリダイレクトされる
    } catch (error) {
        console.error("Login Error:", error);
        if (errorMessageEl) {
            errorMessageEl.textContent = 'ログインに失敗しました。もう一度お試しください。';
        }
    } finally {
        hideLoading();
    }
}

export function redirectAfterLogin(role) {
    redirectByRole(role);
}
