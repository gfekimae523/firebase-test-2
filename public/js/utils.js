/**
 * 純粋関数のみを定義するユーティリティモジュール
 */

/**
 * DateオブジェクトをYYYY-MM-DD形式の文字列に変換
 */
export function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 時刻文字列をHH:MM形式に整形
 */
export function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5); 
}

/**
 * DateオブジェクトをYYYY-MM形式の文字列に変換
 */
export function getYearMonth(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/**
 * 指定月のカレンダー配列を生成
 * 週の配列の中にDateオブジェクト（月外はnull）が格納される2次元配列
 */
export function generateCalendar(year, month) {
    // month is 1-12
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0); // その月の末日
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0(Sun) - 6(Sat)

    let calendar = [];
    let currentDay = 1;

    for (let i = 0; i < 6; i++) {
        let week = [];
        for (let j = 0; j < 7; j++) {
            if (i === 0 && j < startingDayOfWeek) {
                week.push(null);
            } else if (currentDay > daysInMonth) {
                week.push(null);
            } else {
                week.push(new Date(year, month - 1, currentDay));
                currentDay++;
            }
        }
        calendar.push(week);
        if (currentDay > daysInMonth) break;
    }
    return calendar;
}

/**
 * 指定日を含む週の月曜日を返す
 */
export function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 日曜日の場合は先週の月曜日に戻る
    return new Date(d.setDate(diff));
}

/**
 * 平日かどうかを判定
 */
export function isWeekday(date) {
    const day = date.getDay();
    // 0: Sunday, 6: Saturday
    return day !== 0 && day !== 6;
}
