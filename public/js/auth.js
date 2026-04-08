import { auth, db } from './firebase-init.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

export async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await createUserIfFirstLogin(result.user);
        const userData = await getCurrentUserData();
        redirectByRole(userData.role);
    } catch (error) {
        console.error("Login failed", error);
        throw error;
    }
}

export async function logout() {
    await signOut(auth);
    window.location.href = 'index.html';
}

export async function getCurrentUserData() {
    if (!auth.currentUser) return null;
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    return userDoc.exists() ? userDoc.data() : null;
}

export async function createUserIfFirstLogin(user) {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            username: user.displayName || 'ユーザー',
            role: 'user', // デフォルトは user
            status: 'active',
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp()
        });
    }
}

export async function checkAuth(requiredRole) {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';

            if (!user) {
                if (!isLoginPage) window.location.href = 'index.html';
                reject('Not authenticated');
                return;
            }
            
            const userData = await getCurrentUserData();
            if (!userData) {
                if (!isLoginPage) window.location.href = 'index.html';
                reject('User data not found');
                return;
            }
            
            if (userData.status === 'inactive') {
                await logout(); // index.html へリダイレクト
                reject('Account inactive');
                return;
            }
            
            if (requiredRole && userData.role !== requiredRole) {
                redirectByRole(userData.role);
                reject('Insufficient permissions');
                return;
            }
            
            // lastLoginAt を更新
            await updateDoc(doc(db, 'users', user.uid), {
                lastLoginAt: serverTimestamp()
            });
            
            resolve(userData);
        });
    });
}

export function redirectByRole(role) {
    if (role === 'admin') {
        window.location.href = 'admin-dashboard.html';
    } else {
        window.location.href = 'dashboard.html';
    }
}
