import { auth, db, doc, getDoc, signOut, onAuthStateChanged, collection, getDocs, query, where, orderBy, updateDoc } from './firebase-config.js';

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
                alert("管理者権限がありません。");
                window.location.href = 'dashboard.html';
                return;
            }

            if (userNameEl) userNameEl.textContent = `${userData.username} 管理者`;

            // ページに応じたデータ読み込み処理をトリガー
            loadAdminData();
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("権限チェックエラー:", error);
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    });
}

function loadAdminData() {
    // admin-users.html 用
    const usersTbody = document.getElementById('users-tbody');
    if (usersTbody) {
        fetchUsers(usersTbody);
    }

    // admin-attendance.html 用
    const pendingAttTbody = document.getElementById('pending-attendance-tbody');
    if (pendingAttTbody) {
        fetchPendingAttendance(pendingAttTbody);
    }

    // admin-interview.html 用
    const scheduledIntTbody = document.getElementById('scheduled-interviews-tbody');
    const pendingIntTbody = document.getElementById('pending-interviews-tbody');
    if (scheduledIntTbody) fetchInterviews(scheduledIntTbody);
    if (pendingIntTbody) fetchPendingInterviews(pendingIntTbody);
}

// ユーザー管理
async function fetchUsers(tbody) {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const roleBadge = data.role === 'admin' 
                ? '<span class="badge badge-admin">Admin</span>' 
                : '<span class="badge badge-user">User</span>';
                
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: 500;">${data.username}</td>
                    <td style="color: var(--text-muted);">${data.email}</td>
                    <td>${roleBadge}</td>
                    <td>${data.status}</td>
                    <td><button class="btn btn-outline btn-sm">詳細</button></td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">エラーが発生しました</td></tr>';
    }
}

// 通所予定管理 (承認待ちのみ)
async function fetchPendingAttendance(tbody) {
    try {
        tbody.innerHTML = '';
        
        // 1. タイムシート申請 (pending)
        const timesheetQ = query(collection(db, 'timesheetRequests'), where("status", "==", "pending"));
        const tsSnap = await getDocs(timesheetQ);
        
        // 2. 変更申請 (pending)
        const changeQ = query(collection(db, 'attendanceChangeRequests'), where("status", "==", "pending"));
        const chSnap = await getDocs(changeQ);

        if (tsSnap.empty && chSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state" style="text-align: center;">未確認の申請はありません</td></tr>';
            return;
        }

        tsSnap.forEach(docSnap => {
            const data = docSnap.data();
            tbody.innerHTML += `
                <tr>
                    <td>ユーザー ${data.uid.slice(0,4)}...</td>
                    <td>タイムシート申請</td>
                    <td>${data.yearMonth} 分</td>
                    <td>
                        <button class="btn btn-sm btn-outline" style="color: green; border-color: green;" onclick="approveRequest('timesheetRequests', '${docSnap.id}')">承認</button>
                        <button class="btn btn-sm btn-outline" style="color: red; border-color: red;" onclick="rejectRequest('timesheetRequests', '${docSnap.id}')">却下</button>
                    </td>
                </tr>
            `;
        });

        chSnap.forEach(docSnap => {
            const data = docSnap.data();
            tbody.innerHTML += `
                <tr>
                    <td>ユーザー ${data.uid.slice(0,4)}...</td>
                    <td>予定変更 (${data.requestType})</td>
                    <td>対象日: ${data.originalDate || data.newDate}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" style="color: green; border-color: green;" onclick="approveRequest('attendanceChangeRequests', '${docSnap.id}')">承認</button>
                        <button class="btn btn-sm btn-outline" style="color: red; border-color: red;" onclick="rejectRequest('attendanceChangeRequests', '${docSnap.id}')">却下</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
        if (error.message.includes('index')) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="color:red;">インデックスを作成してください: ${error.message}</td></tr>`;
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">エラーが発生しました</td></tr>';
        }
    }
}

// 面談管理
async function fetchInterviews(tbody) {
    // 本来は確定済みのみなど絞り込む
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state" style="text-align:center;">確定済みの面談はありません</td></tr>';
}

async function fetchPendingInterviews(tbody) {
    try {
        const q = query(collection(db, 'interviewRequests'), where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state" style="text-align:center;">未確定の面談申請はありません</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            tbody.innerHTML += `
                <tr>
                    <td>ユーザー ${data.uid.slice(0,4)}...</td>
                    <td>${data.targetWeekStart}〜</td>
                    <td>
                        <button class="btn btn-sm btn-outline" style="color: green; border-color: green;" onclick="approveRequest('interviewRequests', '${docSnap.id}')">承認</button>
                        <button class="btn btn-sm btn-outline" style="color: red; border-color: red;" onclick="rejectRequest('interviewRequests', '${docSnap.id}')">却下</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">エラーが発生しました</td></tr>';
    }
}

window.approveRequest = async (colName, docId) => {
    if(!confirm("この申請を承認しますか？")) return;
    try {
        await updateDoc(doc(db, colName, docId), { status: "approved" });
        alert("承認しました。");
        loadAdminData();
    } catch (e) {
        console.error(e);
        alert("エラーが発生しました。");
    }
};

window.rejectRequest = async (colName, docId) => {
    if(!confirm("この申請を却下しますか？")) return;
    try {
        await updateDoc(doc(db, colName, docId), { status: "rejected" });
        alert("却下しました。");
        loadAdminData();
    } catch (e) {
        console.error(e);
        alert("エラーが発生しました。");
    }
};
