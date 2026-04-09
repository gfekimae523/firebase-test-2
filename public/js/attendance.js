import { checkAuth, logout } from './auth.js';
import { getTimesheet, createTimesheetRequest, getTimesheetRequests, createAttendanceChangeRequest, getAttendanceChangeRequests } from './firestore.js';
import { setupCommonUI, showLoading, hideLoading, showModal, hideModal, showToast } from './ui.js';
import { formatDate, generateCalendar, isWeekday } from './utils.js';

let currentYear;
let currentMonth;
let selectedDate;
let currentUserData;
let currentTimesheetData = null; // 現在表示中の月の確定タイムシート

document.addEventListener('DOMContentLoaded', () => {
    initAttendancePage();
});

export async function initAttendancePage() {
    try {
        showLoading();
        currentUserData = await checkAuth('user');
        setupCommonUI(currentUserData, logout);

        const now = new Date();
        currentYear = now.getFullYear();
        currentMonth = now.getMonth() + 1;

        // カレンダーの月移動ボタン
        document.getElementById('prev-month-btn')?.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 1) { currentMonth = 12; currentYear--; }
            refreshCalendar();
        });
        document.getElementById('next-month-btn')?.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 12) { currentMonth = 1; currentYear++; }
            refreshCalendar();
        });

        // モーダルオープン
        document.getElementById('btn-create-timesheet')?.addEventListener('click', () => openTimesheetModal());

        // モーダル1（通所変更）のイベント
        const reqTypeSelect = document.getElementById('request-type');
        if (reqTypeSelect) {
            reqTypeSelect.addEventListener('change', (e) => {
                const type = e.target.value;
                const newDateRow = document.getElementById('new-date').closest('.modal-row');
                const timeRow = document.getElementById('new-start-time').closest('.modal-row');

                if (type === 'create') {
                    if (newDateRow) newDateRow.style.display = 'none'; // 新規はクリックした日で固定なら隠す
                    if (timeRow) timeRow.style.display = 'flex';
                } else if (type === 'update') {
                    if (newDateRow) newDateRow.style.display = 'flex';
                    if (timeRow) timeRow.style.display = 'flex';
                } else if (type === 'cancel') {
                    if (newDateRow) newDateRow.style.display = 'none';
                    if (timeRow) timeRow.style.display = 'none';
                }
            });
        }
        document.getElementById('submit-change-request')?.addEventListener('click', submitAttendanceChangeRequest);
        document.getElementById('cancel-change-request')?.addEventListener('click', () => hideModal('attendance-change-modal'));

        // モーダル2（タイムシート作成）のイベント
        document.getElementById('target-month')?.addEventListener('change', (e) => {
            renderTimesheetModalCalendar(e.target.value);
        });
        document.getElementById('fill-weekdays-btn')?.addEventListener('click', fillWeekdays);
        document.getElementById('submit-timesheet')?.addEventListener('click', submitTimesheetRequest);
        document.getElementById('cancel-timesheet')?.addEventListener('click', () => {
            hideModal('timesheet-modal');
            resubmitData = null; // リセット
        });

        // データの初期ロード
        await refreshCalendar();
        await Promise.all([loadTimesheetRequests(), loadAttendanceChangeRequests()]);

    } catch (e) {
        console.error(e);
    } finally {
        hideLoading();
    }
}

async function refreshCalendar() {
    const monthLabel = document.getElementById('current-month');
    if (monthLabel) monthLabel.textContent = `${currentYear}年${currentMonth}月`;

    await loadAttendanceData();
    renderCalendar(currentYear, currentMonth);
}

export async function loadAttendanceData() {
    const ym = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    // 確定済みのタイムシートを取得
    currentTimesheetData = await getTimesheet(currentUserData.uid, ym);
}

export function renderCalendar(year, month) {
    const calData = generateCalendar(year, month);
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-row header-row';
    weekdays.forEach(wd => {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell header-cell';
        cell.textContent = wd;
        headerRow.appendChild(cell);
    });
    grid.appendChild(headerRow);

    calData.forEach(week => {
        const row = document.createElement('div');
        row.className = 'calendar-row';
        week.forEach(date => {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            if (date) {
                cell.textContent = date.getDate();
                if (!currentTimesheetData) cell.classList.add('not-clickable');
                const dStr = formatDate(date);

                // 通所予定の表示（対象日に予定があれば箱を入れる）
                let existingAtt = null;
                if (currentTimesheetData && currentTimesheetData.attendances) {
                    existingAtt = currentTimesheetData.attendances.find(a => a.date === dStr);
                    if (existingAtt) {
                        const evt = document.createElement('div');
                        evt.className = 'attendance-event';
                        evt.textContent = `${existingAtt.startTime} - ${existingAtt.endTime}`;
                        cell.appendChild(evt);
                        cell.classList.add('has-attendance');
                    }
                }

                // クリックで変更申請モーダルを開く
                cell.addEventListener('click', () => {
                    if (!currentTimesheetData) return;
                    openAttendanceChangeModal(dStr, existingAtt);
                });
            }
            row.appendChild(cell);
        });
        grid.appendChild(row);
    });
}

export function openAttendanceChangeModal(date, existingAtt = null) {
    selectedDate = date;
    document.getElementById('original-date').textContent = `対象日: ${date}`;
    document.getElementById('new-date').value = date;
    document.getElementById('change-reason').value = '';

    const typeSelect = document.getElementById('request-type');
    if (typeSelect) {
        // オプションを一旦すべて表示
        Array.from(typeSelect.options).forEach(opt => opt.hidden = false);

        if (existingAtt) {
            // 予定がある場合：削除または日時変更のみ
            const createOpt = Array.from(typeSelect.options).find(o => o.value === 'create');
            if (createOpt) createOpt.hidden = true;
            typeSelect.value = 'update';

            document.getElementById('new-start-time').value = existingAtt.startTime;
            document.getElementById('new-end-time').value = existingAtt.endTime;
        } else {
            // 予定がない場合：新規のみ
            Array.from(typeSelect.options).forEach(opt => {
                if (opt.value !== 'create') opt.hidden = true;
            });
            typeSelect.value = 'create';

            document.getElementById('new-start-time').value = '10:00';
            document.getElementById('new-end-time').value = '15:00';
        }
        typeSelect.dispatchEvent(new Event('change'));
    }

    showModal('attendance-change-modal');
}

export async function submitAttendanceChangeRequest() {
    const type = document.getElementById('request-type').value;
    const newDate = document.getElementById('new-date').value;
    const start = document.getElementById('new-start-time').value;
    const end = document.getElementById('new-end-time').value;
    const reason = document.getElementById('change-reason').value;

    if (!reason.trim()) {
        showToast('申請理由を入力してください', 'error');
        return;
    }

    // 重複チェック
    if (type === 'create' || type === 'update') {
        const targetDate = (type === 'update') ? newDate : selectedDate;
        if (currentTimesheetData && currentTimesheetData.attendances) {
            const alreadyExists = currentTimesheetData.attendances.find(a => a.date === targetDate);
            // 変更先の日付に既に予定があり、かつ「元の日付」と異なる場合（＝別の日への振替時）はエラー
            if (alreadyExists && targetDate !== selectedDate) {
                showToast(`指定された日付（${targetDate}）には既に通所予定があります`, 'error');
                return;
            }
        }
    }

    try {
        showLoading();
        await createAttendanceChangeRequest({
            uid: currentUserData.uid,
            date: selectedDate,
            newDate: type === 'update' ? newDate : null,
            requestType: type,
            newStartTime: start,
            newEndTime: end,
            reason: reason.trim()
        });
        showToast('変更申請を送信しました', 'success');
        hideModal('attendance-change-modal');
        await loadAttendanceChangeRequests();
    } catch (e) {
        console.error(e);
        showToast('送信に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ================= Timesheet =================

let resubmitData = null;

export function openTimesheetModal(rejectedRequestData = null) {
    resubmitData = rejectedRequestData;

    const now = new Date();
    const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const targetEl = document.getElementById('target-month');
    targetEl.value = (rejectedRequestData) ? rejectedRequestData.yearMonth : defaultYm;

    renderTimesheetModalCalendar(targetEl.value);

    if (rejectedRequestData) {
        showToast('却下された内容を復元しました。修正して再送信してください。', 'info');
    }

    showModal('timesheet-modal');
}

function renderTimesheetModalCalendar(yearMonthStr) {
    const container = document.getElementById('timesheet-calendar');
    container.innerHTML = '';

    if (!yearMonthStr) return;
    const parts = yearMonthStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);

    // 月の日数を取得
    const lastDay = new Date(year, month, 0).getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

    for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        const dStr = formatDate(date);

        const row = document.createElement('div');
        row.className = 'ts-row';
        if (dayOfWeek === 0) row.classList.add('sunday');
        if (dayOfWeek === 6) row.classList.add('saturday');
        row.dataset.date = dStr;

        const dayInfo = document.createElement('div');
        dayInfo.className = 'day-info';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) row.classList.add('active');
            else row.classList.remove('active');
        });
        dayInfo.appendChild(checkbox);

        const label = document.createElement('span');
        label.textContent = `${day} (${weekdays[dayOfWeek]})`;
        dayInfo.appendChild(label);

        row.appendChild(dayInfo);

        const timeInputs = document.createElement('div');
        timeInputs.className = 'day-time-inputs';

        const startInp = document.createElement('input');
        startInp.type = 'time';
        startInp.value = '10:00';
        startInp.className = 'start-time';

        const endInp = document.createElement('input');
        endInp.type = 'time';
        endInp.value = (dayOfWeek === 0 || dayOfWeek === 6) ? '14:00' : '15:00';
        endInp.className = 'end-time';

        timeInputs.appendChild(startInp);
        const separator = document.createElement('span');
        separator.textContent = '〜';
        timeInputs.appendChild(separator);
        timeInputs.appendChild(endInp);

        row.appendChild(timeInputs);

        // 列全体クリックでもチェックボックスを切り替え
        row.addEventListener('click', (e) => {
            if (e.target === startInp || e.target === endInp || e.target === checkbox) return;
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });

        if (resubmitData && resubmitData.attendances) {
            const att = resubmitData.attendances.find(a => a.date === dStr);
            if (att) {
                row.classList.add('active');
                checkbox.checked = true;
                startInp.value = att.startTime;
                endInp.value = att.endTime;
            }
        }
        container.appendChild(row);
    }
}

export function fillWeekdays() {
    document.querySelectorAll('.ts-row:not(.inactive)').forEach(row => {
        const dateStr = row.dataset.date;
        const date = new Date(dateStr);
        if (isWeekday(date)) {
            const checkbox = row.querySelector('input[type="checkbox"]');
            const startInp = row.querySelector('.start-time');
            const endInp = row.querySelector('.end-time');

            if (checkbox) {
                checkbox.checked = true;
                row.classList.add('active');
            }
            if (startInp) startInp.value = '10:00';
            if (endInp) endInp.value = '15:00';
        }
    });
}

export async function submitTimesheetRequest() {
    const ym = document.getElementById('target-month').value;
    const activeRows = document.querySelectorAll('.ts-row.active');

    if (activeRows.length === 0) {
        showToast('通所日を選択してください', 'error');
        return;
    }

    let attendances = [];
    activeRows.forEach(row => {
        const start = row.querySelector('.start-time').value;
        const end = row.querySelector('.end-time').value;
        attendances.push({
            date: row.dataset.date,
            startTime: start,
            endTime: end
        });
    });

    if (attendances.length === 0) {
        showToast('1日以上選択してください', 'error');
        return;
    }

    try {
        showLoading();
        await createTimesheetRequest({
            uid: currentUserData.uid,
            yearMonth: ym,
            attendances: attendances
        });
        showToast('タイムシート申請を送信しました', 'success');
        hideModal('timesheet-modal');
        resubmitData = null;
        await loadTimesheetRequests();
    } catch (e) {
        console.error(e);
        showToast(e.message || '送信に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// 却下された申請からの再申請
export function resubmitTimesheetRequest(rejectedId) {
    if (window._reqsMap && window._reqsMap[rejectedId]) {
        openTimesheetModal(window._reqsMap[rejectedId]);
    }
}

export async function loadTimesheetRequests() {
    const listEl = document.getElementById('timesheet-request-list');
    if (!listEl) return;
    try {
        const reqs = await getTimesheetRequests(currentUserData.uid);
        let html = '';
        reqs.forEach(r => {
            const statusStr = r.status === 'pending' ? '承認待ち' : (r.status === 'approved' ? '承認済' : '却下');
            const created = r.createdAt ? formatDate(new Date(r.createdAt.toMillis()), true) : '';

            // 再申請ボタン
            let actionBtn = '';
            if (r.status === 'rejected') {
                window._reqsMap = window._reqsMap || {};
                window._reqsMap[r.id] = r;
                actionBtn = `<button class="btn-small" onclick="window.attendanceModule.resubmitTimesheetRequest('${r.id}')">修正して再申請</button>`;
            }

            const rejectComment = r.status === 'rejected' && r.rejectionComment ?
                `<div class="rejection-box"><strong>却下理由:</strong> ${r.rejectionComment}</div>` : '';

            html += `<tr>
                <td>${r.yearMonth}</td>
                <td>
                    <span class="status-tag status-${r.status}">${statusStr}</span>
                    ${rejectComment}
                    ${actionBtn}
                </td>
                <td>${created}</td>
            </tr>`;
        });

        listEl.innerHTML = html || '<tr><td colspan="3" class="empty-state">申請履歴はありません</td></tr>';
        window.attendanceModule = { resubmitTimesheetRequest };

    } catch (e) { console.error(e); }
}

export async function loadAttendanceChangeRequests() {
    const listEl = document.getElementById('attendance-change-request-list');
    if (!listEl) return;
    try {
        const reqs = await getAttendanceChangeRequests(currentUserData.uid);
        let html = '';
        reqs.forEach(r => {
            const statusStr = r.status === 'pending' ? '承認待ち' : (r.status === 'approved' ? '承認済' : '却下');
            const created = r.createdAt ? formatDate(new Date(r.createdAt.toMillis()), true) : '';
            const typeStr = r.requestType === 'create' ? '新規追加' : (r.requestType === 'cancel' ? '削除' : '日時変更');
            const afterStr = `${r.newDate || r.date} ${r.newStartTime || ''}〜${r.newEndTime || ''}`;

            const rejectComment = r.status === 'rejected' && r.rejectionComment ?
                `<div class="rejection-box"><strong>却下理由:</strong> ${r.rejectionComment}</div>` : '';

            html += `<tr>
                <td>${r.date}</td>
                <td><span class="type-tag type-${r.requestType}">${typeStr}</span></td>
                <td>${afterStr}</td>
                <td>
                    <span class="status-tag status-${r.status}">${statusStr}</span>
                    ${rejectComment}
                </td>
                <td>${created}</td>
            </tr>`;
        });
        listEl.innerHTML = html || '<tr><td colspan="5" class="empty-state">申請履歴はありません</td></tr>';
    } catch (e) { console.error(e); }
}
