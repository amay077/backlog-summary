# Monthly Report Generator Specification（月次報告書生成仕様）

## Overview

Backlog API を使用して指定月のアクティビティを取得し、CSV 形式で月次報告書を生成する TypeScript スクリプトの仕様。

このスクリプトは、既存の Angular SPA（main.component.ts）と同じ Backlog API v2 を使用し、認証方式やアクティビティ処理ロジックを踏襲する。

## ADDED Requirements

### Requirement: Authentication and User Information（認証とユーザー情報取得）

スクリプトは、Backlog API キーを使用してユーザー認証を行い、認証されたユーザーの ID を取得しなければならない（MUST authenticate）。

#### Scenario: Successful authentication（認証成功）

- **GIVEN** 有効な Backlog ドメインと API キーが提供されている
- **WHEN** `/api/v2/users/myself?apiKey={apiKey}` エンドポイントにリクエストを送信する
- **THEN** レスポンスステータスコードが 200 である
- **AND** レスポンスボディに `id` フィールドが含まれている
- **AND** 取得した `id` を以降のアクティビティ取得に使用する

#### Scenario: Authentication failure（認証失敗）

- **GIVEN** 無効な API キーが提供されている
- **WHEN** `/api/v2/users/myself?apiKey={apiKey}` エンドポイントにリクエストを送信する
- **THEN** レスポンスステータスコードが 401 Unauthorized である
- **AND** エラーメッセージ「認証に失敗しました。API キーを確認してください。」を表示する
- **AND** スクリプトが終了コード 1 で終了する

---

### Requirement: Activity Retrieval with Pagination（ページネーション付きアクティビティ取得）

スクリプトは、指定月の全アクティビティをページネーションを使用して取得しなければならない（MUST retrieve all activities）。

#### Scenario: Retrieve all activities for a given month（指定月の全アクティビティ取得）

- **GIVEN** 対象月が `2025-10` である
- **AND** ユーザー ID が `12345` である
- **WHEN** `/api/v2/users/12345/activities?apiKey={apiKey}&count=100&maxId={maxId}` エンドポイントに繰り返しリクエストを送信する
- **THEN** 各リクエストで最大 100 件のアクティビティを取得する
- **AND** レスポンスの最後のアクティビティの `id` を次のリクエストの `maxId` パラメータとして使用する
- **AND** 取得したアクティビティの `created` 日付が `2025-10-01` より前になるまで繰り返す
- **AND** `created` 日付が `2025-10-01` 以降 `2025-11-01` 未満のアクティビティのみをフィルタリングする

#### Scenario: Handle empty response（空のレスポンス処理）

- **GIVEN** アクティビティ取得リクエストを送信する
- **WHEN** レスポンスが空配列である
- **THEN** ページネーションループを終了する
- **AND** それまでに取得したアクティビティを処理対象とする

---

### Requirement: Activity Type Processing（アクティビティタイプ処理）

スクリプトは、以下のアクティビティタイプを処理し、適切な情報を抽出しなければならない（SHALL process the following activity types）。

#### Scenario: Process Type 1 - Issue Created（課題追加）

- **GIVEN** アクティビティの `type` が `1` である
- **WHEN** アクティビティを処理する
- **THEN** `activity_type` を「課題を追加」とする
- **AND** `title` を `content.summary` から取得する
- **AND** `activity_url` を `https://{domain}/view/{project.projectKey}-{content.key_id}` とする

#### Scenario: Process Type 2 - Issue Updated（課題更新）

- **GIVEN** アクティビティの `type` が `2` である
- **WHEN** アクティビティを処理する
- **THEN** `activity_type` を「課題を更新」とする
- **AND** `title` を `content.summary` から取得する
- **AND** `activity_url` を `https://{domain}/view/{project.projectKey}-{content.key_id}` とする
- **AND** `detail` を `content.changes` から更新フィールド一覧を生成する

#### Scenario: Process Type 3 - Issue Comment（課題コメント）

- **GIVEN** アクティビティの `type` が `3` である
- **WHEN** アクティビティを処理する
- **THEN** `activity_type` を「課題にコメント」とする
- **AND** `title` を `content.summary` から取得する
- **AND** `activity_url` を `https://{domain}/view/{project.projectKey}-{content.key_id}#comment-{content.comment.id}` とする
- **AND** `detail` を `content.comment.content` の先頭 100 文字とする

#### Scenario: Process Type 5 - Wiki Created（Wiki 追加）

- **GIVEN** アクティビティの `type` が `5` である
- **WHEN** アクティビティを処理する
- **THEN** `activity_type` を「Wiki を追加」とする
- **AND** `title` を `content.name` から取得する
- **AND** `activity_url` を `https://{domain}/wiki/{project.projectKey}/{content.name}` とする

#### Scenario: Process Type 6 - Wiki Updated（Wiki 更新）

- **GIVEN** アクティビティの `type` が `6` である
- **WHEN** アクティビティを処理する
- **THEN** `activity_type` を「Wiki を更新」とする
- **AND** `title` を `content.name` から取得する
- **AND** `activity_url` を `https://{domain}/wiki/{project.projectKey}/{content.name}/diff/{version-1}...{version}` とする

#### Scenario: Process Type 12 - Git Push（Git プッシュ）

- **GIVEN** アクティビティの `type` が `12` である
- **WHEN** アクティビティを処理する
- **THEN** `activity_type` を「PUSH」とする
- **AND** `title` を `content.repository.name` から取得する
- **AND** `activity_url` を `https://{domain}/git/{project.projectKey}/{content.repository.name}/commit/{revision}` とする
- **AND** `detail` を `content.revisions` からコミットメッセージと件数を生成する

#### Scenario: Process Type 13 - Repository Created（リポジトリ作成）

- **GIVEN** アクティビティの `type` が `13` である
- **WHEN** アクティビティを処理する
- **THEN** `activity_type` を「リポジトリ作成」とする
- **AND** `title` を `content.repository.name` から取得する
- **AND** `activity_url` を `https://{domain}/git/{project.projectKey}/{content.repository.name}` とする

---

### Requirement: Bulk Update Decomposition（一括更新の分解処理）

スクリプトは、Type 14（課題一括更新）のアクティビティを個別の Type 3（課題コメント）アクティビティに分解しなければならない（MUST decompose bulk updates）。

#### Scenario: Decompose Type 14 into multiple Type 3 activities（Type 14 を複数の Type 3 に分解）

- **GIVEN** アクティビティの `type` が `14` である
- **AND** `content.link` に 3 件の課題リンクが含まれている
- **WHEN** アクティビティを処理する
- **THEN** 3 件の個別の Type 3 アクティビティを生成する
- **AND** 各アクティビティの `content.summary` を対応するリンクの `title` から取得する
- **AND** 各アクティビティの `content.key_id` を対応するリンクの `key_id` から取得する
- **AND** 各アクティビティの `content.comment` を対応するリンクの `comment` から取得する

#### Scenario: Handle Type 14 with no links（リンクなしの Type 14 処理）

- **GIVEN** アクティビティの `type` が `14` である
- **AND** `content.link` が空配列である
- **WHEN** アクティビティを処理する
- **THEN** アクティビティを無視する（出力に含めない）

---

### Requirement: Detail CSV Output Format（明細 CSV 出力フォーマット）

スクリプトは、全アクティビティの詳細情報を明細 CSV 形式で出力しなければならない（SHALL output detailed activity information in CSV format）。

#### Scenario: Generate CSV with correct headers（正しいヘッダー行を生成）

- **GIVEN** アクティビティデータが存在する
- **WHEN** CSV ファイルを生成する
- **THEN** 1 行目が以下のヘッダーである
  - `日時,プロジェクトキー,プロジェクト名,アクティビティ種類,タイトル/概要`
- **AND** ヘッダー行の各フィールドがダブルクォートで囲まれている

#### Scenario: Generate CSV data rows（CSV データ行を生成）

- **GIVEN** 以下のアクティビティが存在する
  - 日時: `2025/10/15 14:30:00` (JST)
  - プロジェクトキー: `BLS`
  - プロジェクト名: `Backlog Summary`
  - アクティビティ種類: `課題を追加`
  - タイトル: `月次報告書生成機能の追加`
- **WHEN** CSV ファイルを生成する
- **THEN** データ行が以下のフォーマットである
  - `"2025/10/15 14:30:00","BLS","Backlog Summary","課題を追加","月次報告書生成機能の追加"`
- **AND** 各フィールドがダブルクォートで囲まれている
- **AND** フィールド内のダブルクォートがエスケープされている（`"` → `""`）

#### Scenario: Save detail CSV to correct file path（明細CSVを正しいファイルパスに保存）

- **GIVEN** 対象月が `2025-10` である
- **WHEN** 明細 CSV ファイルを生成する
- **THEN** ファイルパスが `reports/2025-10-report-detail.csv` である
- **AND** `reports/` ディレクトリが存在しない場合は自動作成する

---

### Requirement: Summary CSV Output Format（月日別サマリ CSV 出力フォーマット）

スクリプトは、日付とプロジェクトキーごとにアクティビティを集計したサマリ CSV を出力しなければならない（SHALL output summary CSV aggregated by date and project key）。

#### Scenario: Group activities by business day（業務日基準でアクティビティをグルーピング）

- **GIVEN** 以下のアクティビティが存在する
  - アクティビティ1: `2025/10/15 05:30:00` (JST) プロジェクトキー: `SDBT`
  - アクティビティ2: `2025/10/15 08:00:00` (JST) プロジェクトキー: `SDBT`
  - アクティビティ3: `2025/10/16 02:00:00` (JST) プロジェクトキー: `SDBT`
- **WHEN** サマリ CSV を生成する
- **THEN** アクティビティ1 は `2025-10-14` の業務日としてグルーピングされる（AM6:00 前のため前日扱い）
- **AND** アクティビティ2 は `2025-10-15` の業務日としてグルーピングされる
- **AND** アクティビティ3 は `2025-10-15` の業務日としてグルーピングされる（翌日 AM6:00 前のため同じ日扱い）

#### Scenario: Generate summary CSV with correct structure（正しい構造でサマリCSVを生成）

- **GIVEN** 対象月のアクティビティに `SDBT` と `BLS` の2つのプロジェクトが含まれる
- **WHEN** サマリ CSV を生成する
- **THEN** ヘッダー行が以下の構造である
  - `日付,開始時刻,終了時刻,稼動時間,BLS,SDBT,BLS_件数,BLS_最小日時,BLS_最大日時,SDBT_件数,SDBT_最小日時,SDBT_最大日時`
- **AND** プロジェクトキーはアルファベット順にソートされている（BLS, SDBT）
- **AND** 共通列（日付、開始時刻、終了時刻、稼動時間）の次にプロジェクト別稼動時間列が配置される
- **AND** プロジェクト別稼動時間列の列名はプロジェクトキーのみである（例: `BLS`, `SDBT`）
- **AND** その次にプロジェクト別統計列（件数、最小日時、最大日時）が配置される

#### Scenario: Calculate start and end time for business day（業務日の開始時刻と終了時刻を計算）

- **GIVEN** `2025-10-15` の業務日に以下のアクティビティが存在する
  - `SDBT` プロジェクト: `2025/10/15 08:34:00`, `2025/10/15 12:45:00`
  - `BLS` プロジェクト: `2025/10/15 09:15:00`, `2025/10/15 18:47:00`
- **WHEN** サマリ CSV を生成する
- **THEN** `2025-10-15` 行の `開始時刻` 列が `9:00` である（原則 9:00 固定）
- **AND** `終了時刻` 列が `18:00` である（最大日時 18:47 → 19:00に丸める → 15:00以降なので1時間減算 → 18:00）

#### Scenario: Set start time to 13:00 for half-day work（午前半休の場合は開始時刻を 13:00 に設定）

- **GIVEN** `2025-10-15` の業務日に以下のアクティビティが存在する
  - 最小日時: `2025/10/15 13:30:00`
  - 最大日時: `2025/10/15 18:12:00`
- **WHEN** サマリ CSV を生成する
- **THEN** `開始時刻` 列が `13:00` である（最小日時が 13:00 以降なので午前半休と推測）
- **AND** `終了時刻` 列が `17:00` である（18:12 → 18:00に丸める → 15:00以降なので1時間減算 → 17:00）

#### Scenario: Handle late-night work with 24+ hour notation（深夜残業時の24時間超表記）

- **GIVEN** `2025-10-15` の業務日に以下のアクティビティが存在する
  - 最小日時: `2025/10/15 09:00:00`
  - 最大日時: `2025/10/16 02:15:00`（翌日午前2時15分）
- **WHEN** サマリ CSV を生成する
- **THEN** `開始時刻` 列が `9:00` である
- **AND** `終了時刻` 列が `25:30` である（翌日午前2:15 = 26:15 → 26:30に丸める → 15:00以降なので1時間減算 → 25:30）

#### Scenario: Do not subtract 1 hour for end time before 15:00（15:00未満の終了時刻は1時間減算しない）

- **GIVEN** `2025-10-15` の業務日に以下のアクティビティが存在する
  - 最小日時: `2025/10/15 09:00:00`
  - 最大日時: `2025/10/15 14:19:00`
- **WHEN** サマリ CSV を生成する
- **THEN** `開始時刻` 列が `9:00` である
- **AND** `終了時刻` 列が `14:30` である（14:19 → 14:30に丸める → 15:00未満なので1時間減算しない）

#### Scenario: Output all dates in the target month（指定月の全日付を出力）

- **GIVEN** 対象月が `2025-10` である
- **AND** `2025-10-01` と `2025-10-03` にのみアクティビティが存在する（`2025-10-02` にはアクティビティなし）
- **WHEN** サマリ CSV を生成する
- **THEN** CSV に `2025-10-01` から `2025-10-31` までの31行が存在する
- **AND** `2025-10-02` 行の `開始時刻` と `終了時刻` が空文字列である
- **AND** すべてのプロジェクトキーの件数が `0` で、最小日時・最大日時が空文字列である

#### Scenario: Calculate statistics per project and date（プロジェクトと日付ごとに統計を計算）

- **GIVEN** `2025-10-15` の業務日に `SDBT` プロジェクトの以下のアクティビティが存在する
  - アクティビティ1: `2025/10/15 08:30:00`
  - アクティビティ2: `2025/10/15 12:45:00`
  - アクティビティ3: `2025/10/15 18:20:00`
- **WHEN** サマリ CSV を生成する
- **THEN** `2025-10-15` 行の `SDBT_件数` 列が `3` である
- **AND** `SDBT_最小日時` 列が `2025/10/15 08:30:00` である
- **AND** `SDBT_最大日時` 列が `2025/10/15 18:20:00` である

#### Scenario: Handle date with no activities for a project（アクティビティがないプロジェクトの処理）

- **GIVEN** `2025-10-15` の業務日に `SDBT` プロジェクトのアクティビティは存在するが、`BLS` プロジェクトのアクティビティは存在しない
- **WHEN** サマリ CSV を生成する
- **THEN** `2025-10-15` 行の `BLS_件数` 列が `0` である
- **AND** `BLS_最小日時` 列が空文字列である
- **AND** `BLS_最大日時` 列が空文字列である

#### Scenario: Calculate working hours based on break time logic（休憩時間ロジックに基づいて稼動時間を計算）

- **GIVEN** `2025-10-15` の業務日に以下のアクティビティが存在する
  - 開始時刻: `9:00`
  - 終了時刻: `18:00`
- **WHEN** サマリ CSV を生成する
- **THEN** `稼動時間` 列が `8` である
- **AND** 計算ロジックは以下の通り
  - 勤務開始 = 9:00（15分単位切り上げ、9:00のまま）
  - 勤務終了 = 18:00（15分単位切り捨て、18:00のまま）
  - 労働時間 = 18:00 - 9:00 = 9.0 時間
  - 朝休憩コード（勤務開始 9:00）: 9:00 < 11:45 → 4
  - 午後休憩コード（勤務終了 18:00）: 18:00 > 17:00 かつ <= 19:30 → 1
  - 深夜休憩コード（勤務終了 18:00）: 18:00 <= 24:00 → 0
  - 休憩時間 = INT((4 + 1 + 0) / 2) × 0.5 = INT(2.5) × 0.5 = 2 × 0.5 = 1.0 時間
  - 稼動時間 = 9.0 - 1.0 = 8.0 時間

#### Scenario: Calculate working hours for afternoon half-day work（午前半休の稼動時間を計算）

- **GIVEN** `2025-10-15` の業務日に以下のアクティビティが存在する
  - 開始時刻: `13:00`
  - 終了時刻: `18:00`
- **WHEN** サマリ CSV を生成する
- **THEN** `稼動時間` 列が `5` である
- **AND** 計算ロジックは以下の通り
  - 勤務開始 = 13:00（15分単位切り上げ、13:00のまま）
  - 勤務終了 = 18:00（15分単位切り捨て、18:00のまま）
  - 労働時間 = 18:00 - 13:00 = 5.0 時間
  - 朝休憩コード（勤務開始 13:00）: 13:00 >= 12:45 → 0
  - 午後休憩コード（勤務終了 18:00）: 18:00 > 17:00 かつ <= 19:30 → 1
  - 深夜休憩コード（勤務終了 18:00）: 18:00 <= 24:00 → 0
  - 休憩時間 = INT((0 + 1 + 0) / 2) × 0.5 = INT(0.5) × 0.5 = 0 × 0.5 = 0.0 時間
  - 稼動時間 = 5.0 - 0.0 = 5.0 時間

#### Scenario: Calculate working hours for late-night work（深夜残業の稼動時間を計算）

- **GIVEN** `2025-10-15` の業務日に以下のアクティビティが存在する
  - 開始時刻: `9:00`
  - 終了時刻: `26:30`（翌日 午前2:30）
- **WHEN** サマリ CSV を生成する
- **THEN** `稼動時間` 列が `14.5` である
- **AND** 計算ロジックは以下の通り
  - 勤務開始 = 9:00（15分単位切り上げ、9:00のまま）
  - 勤務終了 = 26:00（深夜休憩コード=3なので固定値26:00）
  - 労働時間 = 26:00 - 9:00 = 17.0 時間
  - 朝休憩コード（勤務開始 9:00）: 9:00 < 11:45 → 4
  - 午後休憩コード（勤務終了 26:00）: 26:00 > 22:44 → 4
  - 深夜休憩コード（勤務終了 26:00）: 26:00 > 24:44 かつ <= 26:00 → 3
  - 休憩時間 = INT((4 + 4 + 3) / 2) × 0.5 = INT(5.5) × 0.5 = 5 × 0.5 = 2.5 時間
  - 稼動時間 = 17.0 - 2.5 = 14.5 時間

#### Scenario: Distribute working hours across projects（稼動時間をプロジェクト間で配分）

- **GIVEN** `2025-10-15` の業務日に以下のアクティビティが存在する
  - `SDBT` プロジェクト: 18 件
  - `OSG` プロジェクト: 3 件
  - `CKR_LS` プロジェクト: 1 件
  - `SDBTC` プロジェクト: 2 件
  - 稼動時間: 5.0 時間
- **WHEN** サマリ CSV を生成する
- **THEN** プロジェクト別稼動時間が以下のように計算される
  - 全件数: 18 + 3 + 1 + 2 = 24
  - `SDBT`: 5.0 × (18/24) = 3.75 → 0.5刻みで丸めると 4.0
  - `OSG`: 5.0 × (3/24) = 0.625 → 0.5刻みで丸めると 0.5
  - `CKR_LS`: 5.0 × (1/24) = 0.208... → 0.5刻みで丸めると 0.0 → 0.5未満なので 0.5
  - `SDBTC`: 5.0 × (2/24) = 0.416... → 0.5刻みで丸めると 0.5
  - 合計: 4.0 + 0.5 + 0.5 + 0.5 = 5.5（稼動時間 5.0 より多い）
  - 調整: 稼動の多い順（SDBT → OSG/CKR_LS/SDBTC）に 0.5 減算
    - SDBT: 4.0 - 0.5 = 3.5（合計 5.0 に到達）
  - 最終結果: `SDBT=3.5`, `OSG=0.5`, `CKR_LS=0.5`, `SDBTC=0.5`

#### Scenario: Adjust project working hours to match total（プロジェクト別稼動時間を合計に一致させる）

- **GIVEN** `2025-10-22` の業務日に以下のアクティビティが存在する
  - `SDBT` プロジェクト: 107 件
  - `SDBTC` プロジェクト: 7 件
  - 稼動時間: 11.0 時間
- **WHEN** サマリ CSV を生成する
- **THEN** プロジェクト別稼動時間が以下のように計算される
  - 全件数: 107 + 7 = 114
  - `SDBT`: 11.0 × (107/114) = 10.32... → 0.5刻みで丸めると 10.5
  - `SDBTC`: 11.0 × (7/114) = 0.67... → 0.5刻みで丸めると 0.5
  - 合計: 10.5 + 0.5 = 11.0（稼動時間 11.0 と一致、調整不要）
  - 最終結果: `SDBT=10.5`, `SDBTC=0.5`

#### Scenario: Save summary CSV to correct file path（サマリCSVを正しいファイルパスに保存）

- **GIVEN** 対象月が `2025-10` である
- **WHEN** サマリ CSV ファイルを生成する
- **THEN** ファイルパスが `reports/2025-10-report-summary.csv` である
- **AND** `reports/` ディレクトリが存在しない場合は自動作成する

---

### Requirement: Environment Variables and Configuration（環境変数と設定）

スクリプトは、Backlog の認証情報（space ID と apikey）を環境変数または .env ファイルから読み込まなければならない（MUST load credentials from environment variables or .env file）。

#### Scenario: Load credentials from .env file（.env ファイルから認証情報を読み込む）

- **GIVEN** プロジェクトルートに `.env` ファイルが存在する
- **AND** `.env` ファイルに以下の内容が記載されている
  ```
  BACKLOG_SPACE_ID=nepula
  BACKLOG_API_KEY=your-api-key
  ```
- **WHEN** スクリプトが起動する
- **THEN** `BACKLOG_SPACE_ID` 環境変数が `nepula` として読み込まれる
- **AND** `BACKLOG_API_KEY` 環境変数が `your-api-key` として読み込まれる
- **AND** ドメインが `https://nepula.backlog.com` として構築される

#### Scenario: Load credentials from environment variables（環境変数から認証情報を読み込む）

- **GIVEN** シェルで以下の環境変数が設定されている
  ```bash
  export BACKLOG_SPACE_ID=nepula
  export BACKLOG_API_KEY=YOUR_API_KEY
  ```
- **WHEN** スクリプトが起動する
- **THEN** `BACKLOG_SPACE_ID` 環境変数が `nepula` として読み込まれる
- **AND** `BACKLOG_API_KEY` 環境変数が `YOUR_API_KEY` として読み込まれる
- **AND** ドメインが `https://nepula.backlog.com` として構築される

#### Scenario: Reject missing credentials（認証情報の不足を拒否）

- **GIVEN** `BACKLOG_SPACE_ID` 環境変数が設定されていない
- **WHEN** スクリプトが起動する
- **THEN** エラーメッセージ「環境変数 BACKLOG_SPACE_ID が設定されていません。.env ファイルまたは環境変数で設定してください。」を表示する
- **AND** スクリプトが終了コード 1 で終了する

---

### Requirement: Command-Line Interface（コマンドラインインターフェース）

スクリプトは、コマンドライン引数で対象月とエンコーディングを受け取らなければならない（MUST accept target month and encoding as command-line arguments）。

#### Scenario: Accept valid command-line arguments（有効なコマンドライン引数を受け取る）

- **GIVEN** 以下のコマンドを実行する
  - `npm run generate-report -- --month 2025-10`
- **WHEN** スクリプトが起動する
- **THEN** `month` パラメータが `2025-10` である
- **AND** `encoding` パラメータが `shift-jis` である（デフォルト値）

#### Scenario: Accept encoding option（エンコーディングオプションを受け取る）

- **GIVEN** 以下のコマンドを実行する
  - `npm run generate-report -- --month 2025-10 --encoding utf-8`
- **WHEN** スクリプトが起動する
- **THEN** `month` パラメータが `2025-10` である
- **AND** `encoding` パラメータが `utf-8` である

#### Scenario: Reject invalid month format（無効な月フォーマットを拒否）

- **GIVEN** コマンドライン引数で `--month 2025/10` が指定されている
- **WHEN** スクリプトが起動する
- **THEN** エラーメッセージ「月のフォーマットが不正です。YYYY-MM 形式で指定してください。」を表示する
- **AND** スクリプトが終了コード 1 で終了する

#### Scenario: Reject missing required arguments（必須引数の不足を拒否）

- **GIVEN** コマンドライン引数で `--month` が指定されていない
- **WHEN** スクリプトが起動する
- **THEN** エラーメッセージ「必須パラメータが不足しています: --month」を表示する
- **AND** スクリプトが終了コード 1 で終了する

#### Scenario: Reject invalid encoding（無効なエンコーディングを拒否）

- **GIVEN** コマンドライン引数で `--encoding invalid` が指定されている
- **WHEN** スクリプトが起動する
- **THEN** エラーメッセージ「エラー: エンコーディングは shift-jis または utf-8 を指定してください。」を表示する
- **AND** スクリプトが終了コード 1 で終了する

---

### Requirement: Error Handling（エラーハンドリング）

スクリプトは、エラーが発生した場合に適切なエラーメッセージを表示し、終了コード 1 で終了しなければならない（SHALL handle errors appropriately）。

#### Scenario: Handle network error（ネットワークエラー処理）

- **GIVEN** Backlog API へのリクエスト中にネットワークエラーが発生する
- **WHEN** エラーをキャッチする
- **THEN** エラーメッセージ「ネットワークエラーが発生しました: {エラー詳細}」を表示する
- **AND** スクリプトが終了コード 1 で終了する

#### Scenario: Handle file write error（ファイル書き込みエラー処理）

- **GIVEN** CSV ファイルの書き込み中にエラーが発生する（ディスク容量不足など）
- **WHEN** エラーをキャッチする
- **THEN** エラーメッセージ「CSV ファイルの書き込みに失敗しました: {エラー詳細}」を表示する
- **AND** スクリプトが終了コード 1 で終了する

#### Scenario: Display success message（成功メッセージ表示）

- **GIVEN** すべての処理が正常に完了する
- **WHEN** スクリプトが終了する
- **THEN** 成功メッセージ「月次報告書を生成しました: reports/2025-10-report.csv（合計 123 件のアクティビティ）」を表示する
- **AND** スクリプトが終了コード 0 で終了する
