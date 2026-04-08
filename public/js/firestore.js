import { db } from './firebase-init.js';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- users ---
export async function getUser(uid) {
    const docSnap = await getDoc(doc(db, 'users', uid));
    return docSnap.exists() ? docSnap.data() : null;
}

export async function getAllUsers() {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateUser(uid, data) {
    await updateDoc(doc(db, 'users', uid), data);
}

// --- announcements ---
export async function getAnnouncements() {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createAnnouncement(data) {
    const newDocRef = doc(collection(db, 'announcements'));
    await setDoc(newDocRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

export async function updateAnnouncement(id, data) {
    await updateDoc(doc(db, 'announcements', id), {
        ...data,
        updatedAt: serverTimestamp()
    });
}

export async function deleteAnnouncement(id) {
    await deleteDoc(doc(db, 'announcements', id));
}

// --- timesheetRequests / timesheets ---
export async function getTimesheet(uid, yearMonth) {
    const docSnap = await getDoc(doc(db, 'timesheets', `${uid}_${yearMonth}`));
    return docSnap.exists() ? docSnap.data() : null;
}

export async function getAllTimesheets(yearMonth) {
    const q = query(collection(db, 'timesheets'), where('yearMonth', '==', yearMonth));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
}

export async function createTimesheetRequest(data) {
    // 重複チェック
    const q = query(collection(db, 'timesheetRequests'), 
        where('uid', '==', data.uid),
        where('yearMonth', '==', data.yearMonth),
        where('status', 'in', ['pending', 'approved'])
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
        throw new Error('該当月は既に申請中または承認済みです');
    }
    
    const newDocRef = doc(collection(db, 'timesheetRequests'));
    await setDoc(newDocRef, {
        ...data,
        status: 'pending',
        createdAt: serverTimestamp()
    });
}

export async function getTimesheetRequests(uid = null) {
    let q;
    if (uid) {
        q = query(collection(db, 'timesheetRequests'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'timesheetRequests'), orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function approveTimesheetRequest(id, adminUid) {
    const reqRef = doc(db, 'timesheetRequests', id);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error('Request not found');
    const reqData = reqSnap.data();

    // Copy to timesheets (setDoc with overwrite for the whole month array)
    const tsRef = doc(db, 'timesheets', `${reqData.uid}_${reqData.yearMonth}`);
    await setDoc(tsRef, {
        uid: reqData.uid,
        yearMonth: reqData.yearMonth,
        attendances: reqData.attendances,
        approvedAt: serverTimestamp(),
        approvedBy: adminUid
    });

    // Update request status
    await updateDoc(reqRef, {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid
    });
}

export async function rejectTimesheetRequest(id, comment, adminUid) {
    await updateDoc(doc(db, 'timesheetRequests', id), {
        status: 'rejected',
        rejectionComment: comment,
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid
    });
}

// --- attendanceChangeRequests ---
export async function createAttendanceChangeRequest(data) {
    const newDocRef = doc(collection(db, 'attendanceChangeRequests'));
    await setDoc(newDocRef, {
        ...data,
        status: 'pending',
        createdAt: serverTimestamp()
    });
}

export async function getAttendanceChangeRequests(uid = null) {
    let q;
    if (uid) {
        q = query(collection(db, 'attendanceChangeRequests'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'attendanceChangeRequests'), orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function approveAttendanceChangeRequest(id, adminUid) {
    const reqRef = doc(db, 'attendanceChangeRequests', id);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error('Request not found');
    const data = reqSnap.data();

    const dateObj = new Date(data.date);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${y}-${m}`;
    const timesheetId = `${data.uid}_${yearMonth}`;
    
    const tsRef = doc(db, 'timesheets', timesheetId);
    const tsSnap = await getDoc(tsRef);
    if (!tsSnap.exists()) throw new Error('該当月のタイムシートが存在しません');
    
    let attendances = tsSnap.data().attendances || [];
    
    switch (data.requestType) {
        case 'create':
            attendances.push({
                date: data.newDate || data.date,
                startTime: data.newStartTime,
                endTime: data.newEndTime
            });
            break;
        case 'cancel':
            attendances = attendances.filter(a => a.date !== data.date);
            break;
        case 'update':
            attendances = attendances.filter(a => a.date !== data.date);
            attendances.push({
                date: data.newDate || data.date,
                startTime: data.newStartTime,
                endTime: data.newEndTime
            });
            break;
    }
    
    await updateDoc(tsRef, { attendances });

    await updateDoc(reqRef, {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid
    });
}

export async function rejectAttendanceChangeRequest(id, comment, adminUid) {
    await updateDoc(doc(db, 'attendanceChangeRequests', id), {
        status: 'rejected',
        rejectionComment: comment,
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid
    });
}

// --- interviewRequests / interviews ---
export async function createInterviewRequest(data) {
    const newDocRef = doc(collection(db, 'interviewRequests'));
    await setDoc(newDocRef, {
        ...data,
        status: 'pending',
        createdAt: serverTimestamp()
    });
}

export async function getInterviewRequests(uid = null) {
    let q;
    if (uid) {
        q = query(collection(db, 'interviewRequests'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'interviewRequests'), orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function cancelInterviewRequest(id) {
    await updateDoc(doc(db, 'interviewRequests', id), {
        status: 'cancelled',
        reviewedAt: serverTimestamp()
    });
}

export async function rejectInterviewRequest(id, comment, adminUid) {
    await updateDoc(doc(db, 'interviewRequests', id), {
        status: 'rejected',
        rejectionComment: comment,
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid
    });
}

export async function createInterview(data) {
    // data = { requestId, uid, date, startTime, endTime, staffId, adminUid }
    const newInterviewRef = doc(collection(db, 'interviews'));
    
    await setDoc(newInterviewRef, {
        uid: data.uid,
        interviewRequestId: data.requestId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        staffId: data.staffId,
        status: 'scheduled',
        createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'interviewRequests', data.requestId), {
        status: 'scheduled',
        interviewId: newInterviewRef.id,
        reviewedAt: serverTimestamp(),
        reviewedBy: data.adminUid
    });
}

export async function getInterviews(uid = null) {
    let q;
    if (uid) {
        q = query(collection(db, 'interviews'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'interviews'), orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function cancelInterview(id) {
    const interviewSnap = await getDoc(doc(db, 'interviews', id));
    if (!interviewSnap.exists()) return;
    const interviewData = interviewSnap.data();

    // 面談をキャンセル状態に
    await updateDoc(doc(db, 'interviews', id), {
        status: 'cancelled',
        cancelledAt: serverTimestamp()
    });

    // 元の申請をpendingに戻す
    if (interviewData.interviewRequestId) {
        await updateDoc(doc(db, 'interviewRequests', interviewData.interviewRequestId), {
            status: 'pending',
            interviewId: null
        });
    }
}
