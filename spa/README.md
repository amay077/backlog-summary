# Backlog Summary SPA

Backlog のアクティビティを日付とプロジェクトごとにグルーピングして表示する Angular 13 ベースのシングルページアプリケーション（SPA）です。

## プロジェクト概要

このアプリケーションは Backlog API から直接ユーザーのアクティビティデータを取得し、見やすくサマリー表示します。バックエンドを持たない純粋なクライアントサイド SPA として動作します。

## 使い方

アプリケーションにアクセスする際は、以下のように URL パラメータで Backlog のドメインと API キーを指定します：

```
https://<host>/#/?domain=<your-company-backlog-domain>&apikey=<your-backlog-api-key>
```

## 開発環境

このプロジェクトは [Angular CLI](https://github.com/angular/angular-cli) version 13.3.1 で構築されています。

### 開発サーバーの起動

```bash
npm start
# または
ng serve
```

開発サーバーが起動したら `http://localhost:4200/` にアクセスしてください。ソースファイルを変更すると自動的にリロードされます。

### ビルド

#### 開発ビルド
```bash
npm run build
```
- 出力先：`dist/prod` ディレクトリ
- 相対パス対応（`--base-href=./`）

#### 本番ビルド
```bash
npm run build-prod
```
- 最適化された本番用バンドル
- 出力先：`dist/prod` ディレクトリ

#### ウォッチモード
```bash
npm run watch
```
ファイル変更時に自動的に再ビルドされます。

### テストの実行

```bash
npm test
# または
ng test
```

[Karma](https://karma-runner.github.io) + Jasmine でユニットテストを実行します。

#### 特定のテストファイルのみ実行
```bash
ng test --include='**/specific.component.spec.ts'
```

### コード生成

```bash
# コンポーネント生成
ng generate component component-name

# その他のスキーマティック
ng generate directive|pipe|service|class|guard|interface|enum|module
```

## アーキテクチャ

### アプリケーション構造

- **シングルルートアプリケーション**：ハッシュベースルーティング（`useHash: true`）を使用し、静的ホスティングに対応
- **MainComponent**：すべての Backlog API 連携とデータ表示を担当するコアコンポーネント
- **バックエンド不要**：Backlog API と直接通信する純粋なクライアントサイド SPA

### データフロー

1. コンポーネント初期化時に URL のクエリパラメータ（`domain` と `apikey`）を取得
2. Backlog API の `/users/myself` エンドポイントでユーザー認証を検証
3. `/users/{userId}/activities` エンドポイントからアクティビティをページネーション付きで取得
4. LINQ.js を使用して生データを日付とプロジェクトごとにグルーピング・変換
5. テンプレートでレンダリング（「さらに読み込む」によるページネーション対応）

### 主要な依存ライブラリ

- **LINQ.js** (`linq`)：データのグルーピングと変換操作に広く使用
- **dayjs**：日付・時刻の操作とフォーマット
- **ng-bootstrap**：UI コンポーネント（Bootstrap 4 統合）
- **ハッシュベースルーティング**：静的ホスティング互換性のために有効化

### 対応するアクティビティタイプ

アプリケーションは以下の Backlog アクティビティタイプを処理します：

- Type 1：課題追加
- Type 2：課題更新
- Type 3：課題コメント追加
- Type 14：課題の一括更新（個別のコメントに分解して処理）
- Type 5：Wiki ページ追加
- Type 6：Wiki ページ更新
- Type 12：Git push
- Type 13：Git リポジトリ作成

Type 14（一括更新）は特別に処理され、リンクされた各課題に対する個別の Type 3 アクティビティに分解されます。

## TypeScript 設定

- **strict モード有効**：すべての厳格な TypeScript チェックが有効
- **ターゲット**：ES2017（ES2020 モジュール使用）
- **スタイル**：コンポーネントスタイルは SCSS
- **デコレーター**：Angular 用に experimental decorators を有効化

## ビルド出力

- デフォルト出力パス：`dist/prod`
- バンドルサイズの予算が設定されています：
  - 初期バンドル：500KB で警告、1MB でエラー
  - コンポーネントスタイル：2KB で警告、4KB でエラー

## 注意事項

- API 認証情報は URL クエリパラメータ経由で渡されます（domain と apiKey）
- すべての Backlog URL が現在 `nepula.backlog.com` ドメインにハードコードされています（main.component.ts の 142、146、151 行目など）
- ルーターは `shouldReuseRoute: false` に設定されており、ナビゲーション時にコンポーネントの再初期化が強制されます

## 月次報告書の生成

月々の Backlog アクティビティを集計して、CSV 形式の月次報告書を生成できます。

### セットアップ

1. `.env` ファイルを作成し、Backlog 認証情報を設定します：

```bash
cp .env.example .env
```

2. `.env` ファイルを編集：

```bash
BACKLOG_SPACE_ID=your-space-id  # 例：nepula の場合、https://nepula.backlog.com
BACKLOG_API_KEY=your-api-key    # 個人設定 > API から取得
```

### 使用方法

```bash
npm run generate-report -- --month 2025-10
```

または環境変数で直接指定：

```bash
BACKLOG_SPACE_ID=nepula BACKLOG_API_KEY=YOUR_API_KEY npm run generate-report -- --month 2025-10
```

### 出力ファイル

スクリプトは `reports/` ディレクトリに2種類の CSV ファイルを生成します：

#### 1. 明細 CSV (`reports/{YYYY-MM}-report-detail.csv`)

全アクティビティの詳細情報を1行ずつ出力します。

**カラム：**
- 日時（YYYY/MM/DD HH:mm:ss JST）
- プロジェクトキー（例：SDBT）
- プロジェクト名（例：(社内)すいどーばた）
- アクティビティ種類（課題追加、課題更新、コメント、Wiki 追加/更新、Git push など）
- タイトル/概要（課題タイトル、Wiki 名、コミットメッセージなど）

#### 2. サマリ CSV (`reports/{YYYY-MM}-report-summary.csv`)

日付とプロジェクトキーごとにアクティビティを集計します。

**カラム構成：**
- 日付（YYYY-MM-DD）
- 開始時刻（HH:mm）：その業務日のすべてのアクティビティの最小日時
- 終了時刻（HH:mm）：その業務日のすべてのアクティビティの最大日時
- 各プロジェクトキーごとに3列：
  - `{プロジェクトキー}_件数`：アクティビティ件数
  - `{プロジェクトキー}_最小日時`：最初のアクティビティの日時
  - `{プロジェクトキー}_最大日時`：最後のアクティビティの日時

**業務日の定義：**
- AM6:00〜翌日の AM5:59:59 を1業務日として扱います
- AM6:00 前のアクティビティは前日の業務日として集計されます

**例：**
```
日付,開始時刻,終了時刻,BLS_件数,BLS_最小日時,BLS_最大日時,SDBT_件数,SDBT_最小日時,SDBT_最大日時
2025-10-15,08:30,18:20,5,2025/10/15 08:30:00,2025/10/15 18:20:00,12,2025/10/15 09:15:00,2025/10/15 17:45:00
```

## ヘルプ

Angular CLI の詳細については `ng help` を実行するか、[Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md) を参照してください。
