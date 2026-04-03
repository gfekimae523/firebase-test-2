


就労移行支援ポータルサイト

完全版 基本設計書


バージョン 2.0　｜　2026年4月




目次
1. システム概要
2. ページ構成・画面遷移
3. 各ページの詳細設計（利用者側）
   3-1. index.html（ログイン）
   3-2. dashboard.html（利用者ダッシュボード）
   3-3. attendance.html（通所予定）
   3-4. interview.html（面談）
4. 各ページの詳細設計（管理者側）
   4-1. admin-dashboard.html（管理者ダッシュボード）
   4-2. admin-users.html（ユーザー管理）
   4-3. admin-attendance.html（通所管理）
   4-4. admin-interview.html（面談管理）
5. Firestoreコレクション設計
6. セキュリティルール設計
7. 共通JS設計
8. データフロー設計
9. ファイル構成
10. 非機能要件


1. システム概要
1-1. 目的
就労移行支援事業所における利用者と管理者のコミュニケーション・申請業務をデジタル化し、業務効率を改善するポータルサイト。

1-2. 使用技術スタック
カテゴリ
技術・サービス
フロントエンド
HTML / CSS / Vanilla JavaScript
認証
Firebase Authentication（Google OAuth）
データベース
Cloud Firestore
ホスティング
Firebase Hosting


1-3. ユーザー種別
ロール
説明
user
就労移行支援事業所の利用者。通所予定・面談申請を行う。
admin
事業所スタッフ（支援員）。申請の承認・面談確定を行う。


1-4. 設計上の制約・前提
利用者はGoogleアカウントでのみログイン可能
管理者アカウントはFirestoreへの直接書き込みで初期設定（管理者作成UIは本バージョンのスコープ外）
タイムシートの印刷フォーマットは事業所指定の様式に準拠する（別途確認が必要）
モバイル対応：スマートフォン（375px以上）での利用を想定。レスポンシブデザインを採用。


2. ページ構成・画面遷移
2-1. ページ一覧
ページ
ファイル名
対象
ログイン
index.html
全ユーザー
利用者ダッシュボード
dashboard.html
user
通所予定
attendance.html
user
面談
interview.html
user
管理者ダッシュボード
admin-dashboard.html
admin
ユーザー管理
admin-users.html
admin
通所予定管理
admin-attendance.html
admin
面談管理
admin-interview.html
admin


2-2. 画面遷移ルール
条件
遷移先
未ログイン → 保護ページアクセス
index.html にリダイレクト
ログイン成功・role=user
dashboard.html にリダイレクト
ログイン成功・role=admin
admin-dashboard.html にリダイレクト
role=user が /admin-* にアクセス
dashboard.html にリダイレクト
role=admin が /dashboard にアクセス
admin-dashboard.html にリダイレクト



3. 各ページの詳細設計（利用者側）
3-1. index.html（ログインページ）
役割
ユーザー認証を行い、ロールに応じた適切なダッシュボードへ遷移させる。

機能
Googleアカウントログイン（Firebase Authentication）
初回ログイン時のユーザー自動登録（Firestoreへのusersドキュメント作成）
ユーザー権限判定：admin → admin-dashboard.html、user → dashboard.html
ログイン済みユーザーはindex.htmlアクセス時に自動リダイレクト

HTML構造
div#login-container
  h1（サービス名）
  p（サービス説明）
  button#google-login-btn
  p#error-message（エラー表示）

JS変数・関数
種別
名前
説明
変数
googleLoginBtn
ログインボタンDOM参照
関数
initLoginPage()
ページ初期化、認証状態チェック
関数
handleGoogleLogin()
Googleログイン実行
関数
redirectAfterLogin(role)
ロール別リダイレクト処理



3-2. dashboard.html（利用者ダッシュボード）
役割
利用者がポータル機能へアクセスするためのホーム画面。お知らせ・申請状況を一覧表示する。

機能
お知らせ一覧表示（announcementsコレクションから取得）
回答期限の近い申請の通知表示
新着承認・却下通知の表示
各機能ページへのナビゲーション

HTML構造
header
  span#username
  button#logout-btn
aside#sidebar
  a#nav-attendance
  a#nav-interview
main
  section#announcements
  section#pending-requests（期限が近い申請）
  section#notifications（承認・却下通知）

JS変数・関数
種別
名前
説明
変数
usernameEl
ユーザー名表示DOM
変数
logoutBtn
ログアウトボタンDOM
関数
initDashboard()
ページ初期化
関数
loadAnnouncements()
お知らせをFirestoreから取得・表示
関数
loadPendingRequests()
申請状況の取得・表示
関数
loadNotifications()
承認・却下通知の取得・表示



3-3. attendance.html（通所予定ページ）
役割
利用者が月単位の通所予定を確認・申請するページ。最重要ページ。

機能
月カレンダー表示（承認済み通所予定を色表示）
月の切り替え（前月・次月）
タイムシート申請の作成
通所予定変更申請の作成（日付クリックでモーダル開く）
申請状況の一覧確認（承認待ち・承認済み・却下）

HTML構造
header / aside#sidebar
main
  section#calendar-section
    div#calendar-header
      button#prev-month-btn
      span#current-month
      button#next-month-btn
    div#calendar-grid
  section#attendance-actions
    button#btn-create-timesheet
  section#request-list
    h3 タイムシート申請
    ul#timesheet-request-list
    h3 通所変更申請
    ul#attendance-change-request-list

モーダル① 通所予定変更申請
カレンダーの日付セルをクリックすることで開く。
要素
説明
select#request-type
申請種別：create（新規）/ cancel（削除）/ update（日時変更）
span#original-date
変更前日付（カレンダークリック時に自動セット）
input#new-date
変更後日付（requestType=updateのとき表示）
input#new-start-time
変更後開始時刻
input#new-end-time
変更後終了時刻
textarea#change-reason
申請理由（必須）
button#submit-change-request
申請送信
button#cancel-change-request
キャンセル


モーダル② タイムシート作成
「タイムシート作成」ボタンで開く。月単位の通所予定を一括で申請する。
要素
説明
input#target-month
対象月選択（YYYY-MM形式）
div#timesheet-calendar
対象月のカレンダーGUI（日付を選択/解除）
button#fill-weekdays-btn
平日一括入力ボタン
input#default-start-time
通所開始時刻（デフォルト：10:00）
input#default-end-time
通所終了時刻（デフォルト：15:00）
button#submit-timesheet
申請送信
button#cancel-timesheet
キャンセル


JS変数・関数
種別
名前
説明
変数
currentYear / currentMonth
表示中の年月
変数
selectedDate
クリックされた日付（変更申請用）
関数
initAttendancePage()
ページ初期化
関数
renderCalendar(year,month)
カレンダー描画
関数
loadAttendanceData()
承認済みtimesheetを取得しカレンダーに反映
関数
openAttendanceChangeModal(date)
変更申請モーダルを開く
関数
submitAttendanceChangeRequest()
変更申請を送信
関数
openTimesheetModal()
タイムシートモーダルを開く
関数
fillWeekdays()
平日を一括選択
関数
submitTimesheetRequest()
タイムシート申請を送信
関数
loadTimesheetRequests()
タイムシート申請一覧を表示
関数
loadAttendanceChangeRequests()
変更申請一覧を表示



3-4. interview.html（面談ページ）
役割
利用者が面談予定を確認し、面談申請を行うページ。

機能
確定した面談予定の一覧表示
申請中の面談一覧表示
面談申請の作成
申請中の面談の取り下げ（pendingのみ可能）

HTML構造
header / aside#sidebar
main
  section#interview-schedule
    h3 確定した面談予定
    ul#confirmed-interviews
    h3 申請中の面談
    ul#pending-interviews
  section#interview-actions
    button#create-interview-request

モーダル：面談申請作成
要素
説明
input#target-week
対象週選択（月曜日の日付）
div#available-date-picker
その週の各曜日の空き状況選択GUI（複数選択可）
textarea#interview-content
面談内容・希望事項の入力
button#submit-interview-request
申請送信
button#cancel-interview-request
キャンセル


JS変数・関数
種別
名前
説明
変数
confirmedInterviewList
確定面談リストDOM
変数
pendingInterviewList
申請中面談リストDOM
関数
initInterviewPage()
ページ初期化
関数
loadInterviews()
確定面談をFirestoreから取得・表示
関数
loadInterviewRequests()
申請中面談を取得・表示
関数
openInterviewRequestModal()
申請モーダルを開く
関数
submitInterviewRequest()
面談申請を送信
関数
cancelInterviewRequest(id)
申請を取り下げ（status→cancelled）



4. 各ページの詳細設計（管理者側）
4-1. admin-dashboard.html（管理者ダッシュボード）
役割
管理者が申請状況を確認し、各管理機能へアクセスするページ。

機能
お知らせ投稿・一覧表示
未確認申請（タイムシート・変更申請・面談申請）の件数バッジ表示
各管理ページへのナビゲーション

HTML構造
header
  span#admin-name
  button#logout-btn
aside#sidebar
  a#nav-admin-users（バッジなし）
  a#nav-admin-attendance（未確認件数バッジ）
  a#nav-admin-interview（未確認件数バッジ）
main
  section#admin-announcements
    button#create-announcement-btn
    ul#announcement-list
  section#pending-requests
    ul#pending-request-list

モーダル：お知らせ投稿
要素
説明
input#announcement-title
タイトル
textarea#announcement-body
本文
button#submit-announcement
投稿


JS関数
関数名
説明
initAdminDashboard()
ページ初期化
loadAnnouncements()
お知らせ一覧を取得・表示
createAnnouncement()
お知らせを投稿（Firestoreへ書き込み）
loadPendingRequests()
未確認申請をすべての種別から取得・表示



4-2. admin-users.html（ユーザー管理ページ）
役割
利用者アカウントの管理を行う。

機能
ユーザー一覧表示（名前・メール・ロール・ステータス・登録日）
名前・メールアドレスによる検索
ロール・ステータスによるフィルタリング
ユーザーのactive/inactive切り替え（退所処理）
ロールの変更（user ↔ admin）

HTML構造
div#filter-area
  input#search-user
  select#role-filter
  select#status-filter
table#users-table
  thead（名前・メール・ロール・ステータス・登録日・操作）
  tbody

モーダル：ユーザー編集
要素
説明
span#edit-username
ユーザー名（表示のみ）
select#edit-role
ロール選択（user / admin）
select#edit-status
ステータス（active / inactive）
button#save-user-btn
保存


JS関数
関数名
説明
initUsersPage()
ページ初期化
loadUsers()
全ユーザーを取得・表示
filterUsers()
検索・フィルター処理
renderUserRow(userData)
テーブル行のレンダリング
openUserEditModal(uid)
ユーザー編集モーダルを開く
updateUserRole(uid, role)
ロールを更新
updateUserStatus(uid, status)
ステータスを更新（active/inactive）



4-3. admin-attendance.html（通所予定管理ページ）
役割
利用者の通所予定および各種申請の確認・承認を行う。

機能
利用者選択ドロップダウンで個別カレンダー表示
月カレンダー上に通所予定を表示
タイムシート申請の承認・却下
通所予定変更申請の承認・却下
タイムシートのPDF印刷（行政提出用フォーマット）

HTML構造
div#user-selector
  select#user-select
  button#print-timesheet
div#calendar
  div#calendar-header
    button#prev-month / span#current-month / button#next-month
  div#calendar-grid
section#timesheet-requests
  ul#timesheet-request-list（未確認のみ）
section#attendance-change-requests
  ul#attendance-change-request-list（未確認のみ）

モーダル：申請確認
要素
説明
div#request-detail
申請内容（種別・日時・理由）の表示
textarea#admin-comment
却下コメント入力（却下時に必須）
button#approve-request
承認ボタン
button#reject-request
却下ボタン


JS関数
関数名
説明
initAdminAttendancePage()
ページ初期化
loadUsers()
利用者一覧をドロップダウンに表示
loadUserTimesheet(uid, year, month)
選択ユーザーの通所予定を表示
loadTimesheetRequests(uid)
タイムシート申請一覧を表示
loadAttendanceChangeRequests(uid)
変更申請一覧を表示
openRequestModal(requestId, type)
申請確認モーダルを開く
approveRequest(requestId, type)
申請を承認し、timesheetを更新
rejectRequest(requestId, type, comment)
申請を却下し、コメントを保存
printTimesheet(uid, yearMonth)
タイムシートをPDF出力



4-4. admin-interview.html（面談管理ページ）
役割
面談申請の確認、面談予定の確定・変更・削除を行う。

機能
面談申請一覧表示（申請中・承認済み・却下済み）
確定面談一覧表示
面談申請への対応（日時・担当スタッフ指定で確定、または却下）
確定済み面談のキャンセル

HTML構造
section#interview-requests
  h3 申請中
  ul#pending-interview-requests
section#confirmed-interviews
  h3 確定済み面談
  ul#confirmed-interview-list

モーダル：申請確認・面談確定
要素
説明
div#interview-request-info
申請内容（希望日時・面談内容）表示
input#interview-date
確定する面談日時（管理者が選択）
select#staff-select
担当スタッフ選択（adminロールから一覧取得）
textarea#reject-comment
却下コメント（却下時に必須）
button#create-interview
面談確定ボタン
button#reject-interview
申請却下ボタン


モーダル：確定面談の詳細・キャンセル
要素
説明
div#interview-info
面談日時・担当スタッフ・対象利用者表示
button#cancel-interview
面談キャンセルボタン（確認ダイアログ付き）


JS関数
関数名
説明
initAdminInterviewPage()
ページ初期化
loadInterviewRequests()
申請中の面談申請を取得・表示
loadInterviews()
確定済み面談を取得・表示
openInterviewRequestModal(requestId)
申請確認モーダルを開く
createInterview(requestId, date, staffId)
面談を確定し、interviewsに保存
rejectInterviewRequest(requestId, comment)
申請を却下
cancelInterview(interviewId)
確定面談をキャンセル



5. Firestoreコレクション設計
5-1. コレクション一覧
コレクション名
用途
users
ログインユーザー情報
announcements
管理者が投稿するお知らせ
timesheetRequests
申請中・審査済みタイムシート申請
timesheets
承認済み月次通所予定（確定データ）
attendanceChangeRequests
日単位の通所変更申請
interviewRequests
利用者の面談希望申請
interviews
管理者が確定した面談予定


5-2. ① users
ドキュメントID：uid（Firebase AuthのUID）

フィールド
型
説明
email
string
Googleアカウントのメールアドレス
username
string
表示名
role
string
"user" または "admin"
status
string
"active" または "inactive"
createdAt
Timestamp
アカウント作成日時


5-3. ② announcements（新規追加）
ドキュメントID：ランダム生成

フィールド
型
説明
title
string
お知らせタイトル
body
string
お知らせ本文
createdBy
string
投稿した管理者のuid
createdAt
Timestamp
投稿日時


5-4. ③ timesheetRequests（申請中タイムシート）
ドキュメントID：ランダム生成

フィールド
型
説明
uid
string
申請した利用者のuid
yearMonth
string
対象年月（例: "2026-04"）
status
string
"pending" / "approved" / "rejected"
rejectionComment
string
却下コメント（rejected時のみ）
createdAt
Timestamp
申請日時
reviewedAt
Timestamp
審査日時
reviewedBy
string
審査した管理者のuid


サブコレクション：attendanceRequests
フィールド
型
説明
date
string
通所日（例: "2026-04-07"）
startTime
string
開始時刻（例: "10:00"）
endTime
string
終了時刻（例: "15:00"）


5-5. ④ timesheets（承認済みタイムシート）
ドキュメントID：{uid}_{yearMonth}（例: abc123_2026-04）

フィールド
型
説明
uid
string
利用者のuid
yearMonth
string
対象年月（例: "2026-04"）
approvedAt
Timestamp
承認日時
approvedBy
string
承認した管理者のuid


サブコレクション：attendances
ドキュメントID：日付文字列（例: "2026-04-07"）※ 検索・参照を容易にするため日付をIDに使用
フィールド
型
説明
date
string
通所日（例: "2026-04-07"）
startTime
string
開始時刻（例: "10:00"）
endTime
string
終了時刻（例: "15:00"）


5-6. ⑤ attendanceChangeRequests（通所変更申請）
ドキュメントID：ランダム生成

フィールド
型
説明
uid
string
申請した利用者のuid
timesheetId
string
対象のtimesheetドキュメントID
attendanceId
string
対象のattendanceドキュメントID（日付文字列）。create時はnull。
requestType
string
"create" / "cancel" / "update"
originalDate
string
変更前日付（cancel/update時）
originalStartTime
string
変更前開始時刻
originalEndTime
string
変更前終了時刻
newDate
string
変更後日付（create/update時）
newStartTime
string
変更後開始時刻
newEndTime
string
変更後終了時刻
reason
string
申請理由（必須）
status
string
"pending" / "approved" / "rejected"
rejectionComment
string
却下コメント（rejected時のみ）
createdAt
Timestamp
申請日時
reviewedAt
Timestamp
審査日時
reviewedBy
string
審査した管理者のuid


5-7. ⑥ interviewRequests（面談申請）
ドキュメントID：ランダム生成

フィールド
型
説明
uid
string
申請した利用者のuid
targetWeekStart
string
希望週の月曜日の日付（例: "2026-04-06"）
availableDates
array
希望日時の配列（下記参照）
content
string
面談内容・希望事項
status
string
"pending" / "scheduled" / "rejected" / "cancelled"
rejectionComment
string
却下コメント（rejected時のみ）
createdAt
Timestamp
申請日時
updatedAt
Timestamp
最終更新日時


availableDates フィールドの型定義：
availableDates: [
  { date: "2026-04-07", startTime: "13:00", endTime: "17:00" },
  { date: "2026-04-08", startTime: "10:00", endTime: "12:00" }
]

5-8. ⑦ interviews（確定面談）
ドキュメントID：ランダム生成

フィールド
型
説明
uid
string
対象利用者のuid
interviewRequestId
string
元の申請のドキュメントID
date
string
確定した面談日（例: "2026-04-07"）
startTime
string
開始時刻（例: "14:00"）
staffId
string
担当スタッフのuid
status
string
"scheduled" / "cancelled"
createdAt
Timestamp
確定日時
cancelledAt
Timestamp
キャンセル日時（cancelled時のみ）



6. セキュリティルール設計
6-1. 基本方針
認証済みユーザーのみFirestoreにアクセス可能
roleフィールドは本人・管理者ともに直接書き換え不可（Cloud Functionsで管理、または初期設定のみ直接書き込み）
利用者は自分のデータのみ読み書き可能
管理者はすべてのデータを読み書き可能

6-2. コレクション別ルール
コレクション
read
write
備考
users（自分）
本人・admin
本人（role/status除く）・admin
roleはCloud Functions or 管理者のみ変更可
announcements
全認証ユーザー
adminのみ


timesheetRequests
本人・admin
本人（create）・admin（approve/reject）
statusの変更はadminのみ
timesheets
本人・admin
adminのみ（承認時に自動書き込み）
利用者は読み取りのみ
attendanceChangeRequests
本人・admin
本人（create）・admin（approve/reject）
statusの変更はadminのみ
interviewRequests
本人・admin
本人（create/cancel）・admin（approve/reject）
cancelはstatus=pendingのみ
interviews
本人・admin
adminのみ




6-3. Firestore Security Rules（抜粋）
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    function isOwner(uid) {
      return request.auth.uid == uid;
    }
    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow create: if isOwner(uid);
      allow update: if isAdmin();  // role/statusの変更は管理者のみ
    }
    match /announcements/{id} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    match /timesheets/{id} {
      allow read: if isOwner(resource.data.uid) || isAdmin();
      allow write: if isAdmin();
    }
    match /timesheetRequests/{id} {
      allow read: if isOwner(resource.data.uid) || isAdmin();
      allow create: if isOwner(request.resource.data.uid);
      allow update: if isAdmin();
    }
    // attendanceChangeRequests, interviewRequests も同様のパターン
    match /interviews/{id} {
      allow read: if isOwner(resource.data.uid) || isAdmin();
      allow write: if isAdmin();
    }
  }
}


7. 共通JS設計
7-1. ファイル構成
ファイル
役割
firebase-init.js
Firebase初期化（app, auth, db の export）
auth.js
認証・権限管理
firestore.js
Firestore操作の共通関数群
ui.js
モーダル表示・ローディング等のUI共通処理
utils.js
日付フォーマット・カレンダー生成等の汎用関数
attendance.js
attendance.html 専用ロジック
interview.js
interview.html 専用ロジック
admin-attendance.js
admin-attendance.html 専用ロジック
admin-interview.js
admin-interview.html 専用ロジック


7-2. auth.js
関数名
説明
loginWithGoogle()
Googleポップアップ認証を実行
logout()
サインアウトし、index.htmlへリダイレクト
checkAuth(requiredRole)
認証状態・ロール確認。不一致の場合リダイレクト
redirectByRole(role)
ロールに応じた適切なページへリダイレクト
createUserIfFirstLogin(user)
usersコレクションにドキュメントがなければ新規作成
getCurrentUserData()
currentUserDataをFirestoreから取得して返す


7-3. firestore.js
users
関数名
説明
getUser(uid)
usersドキュメントを取得
getAllUsers()
全ユーザーを取得（admin用）
updateUser(uid, data)
ユーザー情報を更新（role/status）


announcements
関数名
説明
getAnnouncements()
お知らせ一覧を取得（新着順）
createAnnouncement(data)
お知らせを投稿


timesheets / timesheetRequests
関数名
説明
getTimesheet(uid, yearMonth)
timesheetドキュメントを取得（サブコレクション含む）
createTimesheetRequest(data)
タイムシート申請を作成
getTimesheetRequests(uid)
タイムシート申請一覧を取得
approveTimesheetRequest(id, adminUid)
申請を承認し、timesheetsコレクションにデータをコピー
rejectTimesheetRequest(id, comment, adminUid)
申請を却下し、コメントを保存


attendanceChangeRequests
関数名
説明
createAttendanceChangeRequest(data)
変更申請を作成
getAttendanceChangeRequests(uid)
変更申請一覧を取得
approveAttendanceChangeRequest(id, adminUid)
申請を承認し、timesheetsを更新
rejectAttendanceChangeRequest(id, comment, adminUid)
申請を却下


interviewRequests / interviews
関数名
説明
createInterviewRequest(data)
面談申請を作成
getInterviewRequests(uid)
面談申請一覧を取得
cancelInterviewRequest(id)
面談申請を取り下げ（status→cancelled）
rejectInterviewRequest(id, comment, adminUid)
面談申請を却下
createInterview(data)
面談を確定（interviewsに保存・申請をscheduledに更新）
getInterviews(uid)
確定面談一覧を取得
cancelInterview(id)
面談をキャンセル（status→cancelled）


7-4. utils.js
関数名
説明
formatDate(date)
DateオブジェクトをYYYY-MM-DD形式の文字列に変換
formatTime(timeStr)
時刻文字列をHH:MM形式に整形
getYearMonth(date)
DateオブジェクトをYYYY-MM形式の文字列に変換
generateCalendar(year, month)
指定月のカレンダー配列を生成
getWeekStart(date)
指定日を含む週の月曜日を返す
isWeekday(date)
平日かどうかを判定（祝日は別途管理）
showModal(id)
モーダルを表示
hideModal(id)
モーダルを非表示
showLoading()
ローディングスピナーを表示
hideLoading()
ローディングスピナーを非表示
showToast(message, type)
トースト通知を表示（success/error/info）



8. データフロー設計
8-1. タイムシート承認フロー（最重要）
approveTimesheetRequest(id, adminUid) の内部処理：

timesheetRequestsドキュメントを取得（uid, yearMonth, attendanceRequestsサブコレクション）
timesheets/{uid}_{yearMonth} ドキュメントが既に存在するか確認
存在する場合：既存のtimesheetドキュメントを上書き（attendancesサブコレクション全削除→再作成）
存在しない場合：新規作成
timesheets/{id}/attendances/ に各日付をドキュメントIDとして一括書き込み（Batch Write使用）
timesheetRequests/{id} のstatusをapprovedに更新（reviewedAt, reviewedByも更新）

8-2. 通所変更申請 承認フロー
approveAttendanceChangeRequest(id, adminUid) の内部処理：

attendanceChangeRequestsドキュメントを取得（requestType, attendanceId, timesheetId等）
  requestTypeごとに処理を分岐：
create：timesheets/{timesheetId}/attendances/{newDate} に新規ドキュメントを作成
cancel：timesheets/{timesheetId}/attendances/{attendanceId} を削除
update：timesheets/{timesheetId}/attendances/{attendanceId} を削除 → {newDate} で再作成
attendanceChangeRequests/{id} のstatusをapprovedに更新

8-3. 面談確定フロー
createInterview(requestId, date, startTime, staffId, adminUid) の内部処理：

interviews コレクションに新規ドキュメントを作成
interviewRequests/{requestId} のstatusをscheduledに更新

8-4. 面談キャンセルフロー
interviews/{id} のstatusをcancelledに更新、cancelledAtを記録
元の interviewRequests/{interviewRequestId} のstatusをpendingに戻す（再申請を可能にする）


9. ファイル構成
/public
  index.html
  dashboard.html
  attendance.html
  interview.html
  admin-dashboard.html
  admin-users.html
  admin-attendance.html
  admin-interview.html
/js
  firebase-init.js
  auth.js
  firestore.js
  attendance.js
  interview.js
  admin-attendance.js
  admin-interview.js
  ui.js
  utils.js
/css
  style.css       （共通スタイル・レスポンシブ）
  calendar.css    （カレンダーコンポーネント）
  modal.css       （モーダルコンポーネント）
firestore.rules
firebase.json


10. 非機能要件
10-1. レスポンシブ対応
ブレークポイント
対応方針
375px〜767px（スマホ）
サイドバーをハンバーガーメニューに。カレンダーはコンパクト表示。モーダルは全画面表示。
768px〜1023px（タブレット）
サイドバーはアイコンのみ表示。カレンダーは通常表示。
1024px以上（PC）
フルレイアウト。サイドバー・カレンダー・申請一覧を横並びに表示。


10-2. エラー処理
Firestoreの読み書きエラーはすべてtry-catchで捕捉し、showToast()でユーザーに通知
ネットワークエラー時はリトライ促すメッセージを表示
認証エラー時はindex.htmlへリダイレクト

10-3. タイムシート印刷
印刷フォーマット：事業所指定の様式（実装前に様式を確認・確定すること）
実装方針：window.print() + 印刷専用CSS（@media print）でA4縦に最適化
管理者は対象利用者・対象月を選択してPDF保存または印刷が可能

10-4. セキュリティ
クライアントサイドのロール判定はUI表示制御のみに使用
データの保護はFirestoreセキュリティルールで実施（6章参照）
APIキー・設定値はFirebase SDK経由のみ使用し、Gitに秘匿情報を含めない

10-5. 今後の拡張候補（スコープ外）
プッシュ通知（Firebase Cloud Messaging）：申請の承認・却下をリアルタイム通知
管理者アカウント作成UI
祝日カレンダーAPI連携（isWeekday()の精度向上）
面談のオンライン（ビデオ通話リンク）連携

