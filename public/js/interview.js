import { auth, db, doc, getDoc, signOut, onAuthStateChanged } from './firebase-config.js';

const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'index.html';

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userNameEl) userNameEl.textContent = `${userData.username} さん`;
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}

// モーダル処理
const openBtn = document.getElementById('open-interview-modal');
const modal = document.getElementById('interview-modal');

if (openBtn) openBtn.addEventListener('click', () => modal.classList.remove('hidden'));

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.getElementById(e.target.getAttribute('data-target')).classList.add('hidden');
    });
});

document.getElementById('submit-interview')?.addEventListener('click', () => {
    alert("面談の希望を送信しました！");
    modal.classList.add('hidden');
});
