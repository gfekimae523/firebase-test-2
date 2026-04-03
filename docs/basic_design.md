# 基本設計 / 指示書
基本設計
ページ一覧

index.html（ログイン）
│
├ dashboard.html（利用者ダッシュボード）
│  ├ attendance.html（通所・タイムシート）
│  └ interview.html（面談）
│
└ admin-dashboard.html（管理者ダッシュボード）
   ├ admin-users.html（ユーザー管理）
   ├ admin-attendance.html（通所管理）
   └ admin-interview.html（面談管理）


各ページの詳細
利用者側ページ

index.html（ログインページ）
役割
ユーザー認証を行い、適切なダッシュボードへ遷移させる。
機能
Googleアカウントログイン
初回ログイン時のユーザー登録（Firestore）
ユーザー権限判定
admin → admin-dashboard.html
user → dashboard.html
未ログインユーザーのリダイレクト先
構成要素
タイトル
Googleログインボタン

dashboard.html（利用者ダッシュボード）
役割
利用者がポータル機能へアクセスするためのホーム画面。
機能
お知らせ表示
申請状況の通知表示
各機能ページへのナビゲーション
構成要素
サイドバー
attendance.html
interview.html
メインコンテンツ
全体お知らせ
回答期限の近い申請
新着承認通知
ヘッダー
ユーザー名
ログアウト

attendance.html（通所予定ページ）
役割
利用者が通所予定を確認・申請するページ。
機能
月カレンダー表示
通所予定の視覚表示
月の切り替え
通所予定変更申請の作成
タイムシート作成
申請状況の確認
構成要素
カレンダーエリア
月表示カレンダー
前月 / 次月切替ボタン
通所予定日を色表示
操作ボタン
タイムシート作成ボタン
申請一覧エリア
承認待ちタイムシート申請一覧
通所予定変更申請一覧
承認待ち
確認済み

モーダル：通所予定変更申請
機能
通所予定の変更申請を作成する。
構成要素
申請種別選択
新規作成
削除
日時変更
変更後の日時入力
理由入力
申請送信ボタン
キャンセルボタン

モーダル：タイムシート作成
機能
月単位の通所予定を入力して申請する。
構成要素
対象月選択
カレンダーGUI
平日一括入力ボタン
通所時間入力
デフォルト：10:00〜15:00
申請送信ボタン
キャンセルボタン

interview.html（面談ページ）
役割
利用者が面談予定を確認し、面談申請を行うページ。
機能
確定した面談予定の表示
申請中の面談の表示
面談申請の作成
構成要素
面談予定エリア
確定した面談予定一覧
申請中の面談一覧
操作エリア
面談申請作成ボタン

モーダル：面談申請作成
機能
面談希望日時を入力して申請する。
構成要素
対象週選択
面談可能日時GUI
面談内容入力
申請送信ボタン
キャンセルボタン

管理者ページ

admin-dashboard.html（管理者ダッシュボード）
役割
管理者が申請状況を確認し、各管理機能へアクセスするページ。
機能
お知らせ表示
未確認申請の通知
管理ページへのナビゲーション
構成要素
サイドバー
admin-users.html
admin-attendance.html
admin-interview.html
メインコンテンツ
お知らせ
未確認申請一覧
ヘッダー
管理者名
ログアウト

admin-users.html（ユーザー管理ページ）
役割
利用者アカウントの管理を行う。
機能
ユーザー一覧表示
ユーザー情報確認
構成要素
ユーザー一覧テーブル
名前
メールアドレス
ロール
登録日
検索ボックス
フィルター

admin-attendance.html（通所予定管理ページ）
役割
利用者の通所予定および申請の確認・承認を行う。
機能
月カレンダー表示
利用者切り替え表示
タイムシート印刷
タイムシート申請確認
通所予定変更申請確認
構成要素
カレンダーエリア
月カレンダー
前月 / 次月切替
通所予定表示
利用者選択
利用者ドロップダウン
操作ボタン
タイムシート一括印刷
申請一覧
未確認タイムシート申請
未確認通所予定変更申請

モーダル：申請確認
機能
申請内容を確認して承認または却下する。
構成要素
申請内容表示
理由表示
承認ボタン
却下ボタン
コメント入力

admin-interview.html（面談管理ページ）
役割
面談申請の確認および面談予定の管理を行う。
機能
面談予定一覧表示
面談申請確認
構成要素
確定面談一覧
申請中面談一覧
面談詳細表示モーダル


コレクション一覧

users
timesheetRequests
timesheets
attendanceChangeRequests
interviewRequests
interviews

各コレクションの詳細
① users（ユーザー）
ログインユーザー情報
ドキュメントID
users
 └ uid
フィールド
email
username
role        // admin or user
status      // active / inactive
createdAt
例
email: "gfekimae423@gmail.com"
username: "DC太郎"
role: "user"
status: "active"
createdAt: 2026年4月1日 14:14:40 UTC+9

② timesheetRequests（申請中タイムシート）
申請中で承認待ちのタイムシート
ドキュメントID
timesheetRequests
 └ timesheetRequestId (ランダム生成)
フィールド
uid
yearMonth
status      // pending / approved / rejected
createdAt
サブコレクション
timesheetRequests
 └ timesheetRequestId (ランダム生成)
       └ attendanceRequests
           └ attendanceRequestID (ランダム生成)
attendanceRequestフィールド
date
startTime
endTime

③ timesheets（タイムシート）
月単位の通所予定
ドキュメントID
timesheets
 └ timesheetId (uid_yearMonth)
フィールド
uid
yearMonth
サブコレクション
timesheets
 └ timesheetId (ランダム生成)
       └ attendances
           └ attendanceId (ランダム生成)
attendanceフィールド
date
startTime
endTime

④ attendanceChangeRequests（通所変更申請）
日単位の変更申請
ドキュメントID
attendanceChangeRequests
 └ attendanceChangeRequestId (ランダム生成)
フィールド
uid
attendanceId

requestType    // create / cancel / update

originalDate
originalStartTime
originalEndTime

newDate
newStartTime
newEndTime

reason

status         // pending / approved / rejected

createdAt
approvedBy
approvedAt

⑤ interviewRequests（面談申請）
利用者が出す面談希望。1週間単位で希望を出す
interviewRequests
 └ interviewRequestId (ランダム生成)
フィールド
uid
targetWeekStart
availableDates      // 配列
content
status      // pending / scheduled / rejected
createdAt
updatedAt

⑥ interviews（面談予定）
管理者が確定した面談
interviews
 └ interviewId (ランダム生成)
フィールド
uid
interviewRequestId
date
staffId
createdAt

