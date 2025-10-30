# Backlog Monthly Report

Backlog のアクティビティを月単位で集計し、CSV 形式で出力する Node.js スクリプトです。

## 必要要件

- **Node.js**: 18.0.0 以上（推奨: 22.x LTS）
- **Backlog API キー**: 個人設定 > API から取得

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成し、Backlog 認証情報を設定します：

```bash
cp .env.example .env
```

`.env` ファイルを編集：

```bash
BACKLOG_SPACE_ID=your-space-id  # 例：nepula の場合、https://nepula.backlog.com
BACKLOG_API_KEY=your-api-key    # 個人設定 > API から取得
```

## 使用方法

```bash
npm run generate-report -- --month 2025-10
```

または環境変数で直接指定：

```bash
BACKLOG_SPACE_ID=nepula BACKLOG_API_KEY=YOUR_API_KEY npm run generate-report -- --month 2025-10
```

### オプション

- `--month <YYYY-MM>`: 対象月（必須）
- `--encoding <shift-jis|utf-8>`: CSV ファイルのエンコーディング（デフォルト: shift-jis）

```bash
# UTF-8 で出力
npm run generate-report -- --month 2025-10 --encoding utf-8
```

## 出力ファイル

スクリプトは `reports/` ディレクトリに2種類の CSV ファイルを生成します：

### 1. 明細 CSV (`reports/{YYYY-MM}-report-detail.csv`)

全アクティビティの詳細情報を1行ずつ出力します。

**カラム：**
- 日時（YYYY/MM/DD HH:mm:ss JST）
- プロジェクトキー（例：SDBT）
- プロジェクト名（例：(社内)すいどーばた）
- アクティビティ種類（課題追加、課題更新、コメント、Wiki 追加/更新、Git push など）
- タイトル/概要（課題タイトル、Wiki 名、コミットメッセージなど）

### 2. サマリ CSV (`reports/{YYYY-MM}-report-summary.csv`)

日付とプロジェクトキーごとにアクティビティを集計します。

**カラム構成：**
- 日付（YYYY-MM-DD）
- 開始時刻（HH:mm）：原則 9:00、最小日時が 13:00 以降なら 13:00（午前半休と推測）
- 終了時刻（HH:mm）：最大日時を30分刻みで丸め、15:00以降の場合は1時間減算（家事休憩を再現）
- 稼動時間：勤務開始〜勤務終了の労働時間から休憩時間を引いた値（小数、例：8.5）
- プロジェクト別稼動時間列：プロジェクトキーごとに1列
  - 稼動時間を各プロジェクトの件数で按分（0.5刻み、最小単位0.5）
- プロジェクト別統計列：プロジェクトキーごとに3列
  - `{プロジェクトキー}_件数`：アクティビティ件数
  - `{プロジェクトキー}_最小日時`：最初のアクティビティの日時
  - `{プロジェクトキー}_最大日時`：最後のアクティビティの日時

**業務日の定義：**
- AM6:00〜翌日の AM5:59:59 を1業務日として扱います
- AM6:00 前のアクティビティは前日の業務日として集計されます

**稼動時間の計算：**
- Google Spreadsheet の休憩時間ロジックを実装
- 朝休憩・午後休憩・深夜休憩コードに基づく休憩時間算出
- 15:00以降の終了時刻から1時間減算（家事休憩）
- 深夜残業対応（24時間超表記：例 午前2:00 → 26:00）

**例：**
```
日付,開始時刻,終了時刻,稼動時間,BLS,SDBT,BLS_件数,BLS_最小日時,BLS_最大日時,SDBT_件数,SDBT_最小日時,SDBT_最大日時
2025-10-15,9:00,17:00,8,3.5,4.5,5,2025/10/15 08:30:00,2025/10/15 18:20:00,12,2025/10/15 09:15:00,2025/10/15 17:45:00
```

## 対応するアクティビティタイプ

- Type 1：課題追加
- Type 2：課題更新
- Type 3：課題コメント追加
- Type 14：課題の一括更新（個別のコメントに分解して処理）
- Type 5：Wiki ページ追加
- Type 6：Wiki ページ更新
- Type 12：Git push
- Type 13：Git リポジトリ作成

## 技術スタック

- **TypeScript 5.7**: 最新の TypeScript で実装
- **tsx**: TypeScript 実行環境
- **Backlog API v2**: 公式 REST API を使用
- **csv-writer**: CSV ファイル生成
- **commander**: CLI 引数パース
- **dayjs**: 日付操作
- **dotenv**: 環境変数管理
- **iconv-lite**: エンコーディング変換（UTF-8 ⇔ Shift-JIS）

## 開発

### TypeScript のビルド

```bash
npx tsc
```

### スクリプトの直接実行（開発時）

```bash
npx tsx scripts/generate-monthly-report.ts --month 2025-10
```

## ライセンス

Private
