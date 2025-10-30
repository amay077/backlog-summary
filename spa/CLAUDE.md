<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AGENTS.md / CLAUDE.md - AIエージェント指示書

※このドキュメントの内容は `AGENTS.md` と `CLAUDE.md` で常に一致させること。更新時は必ず両方を同時に修正する。

このファイルは、対応するAIエージェントがこのリポジトリで作業する際の動作規約を定義する。

## 対応するAIエージェント

- Claude（claude.ai/code）
    - 実装要求があるまでは提案や計画の共有に留める
    - 操作ログを簡潔に保持し、不要な再実行を避ける
    - 対応するスキルが存在する場合は、直接コマンド、API 呼び出し、MCP サーバーより優先的に使用すること
        - 例1: JST 時刻取得 - `jst-time`
        - 例2: Backlog 課題操作（取得・ステータス更新・コメント追加・プルリクエスト作成） - `backlog-issue`
        - 例3: デスクトップ通知送信（macOS/Linux/Windows 対応） - `notify`
- Codex（Codex CLI）
    - 対話環境はターミナルベースのCLIであり、`shell` 経由でコマンドを実行する
    - コマンド実行時は必ず作業ディレクトリを明示する
    - テキスト出力は簡潔にまとめ、必要な情報のみ提示する
    - 既存の指示を優先し、不要なファイル生成や過剰な修正を避ける

## 言語設定
- エージェントとの会話はすべて日本語で行う
- Gitコミットメッセージも日本語を使用する
- コミット時はチケット番号をコミットメッセージの接頭辞に付与する（例: ABCD-1234 ○○を修正）
- 用語の使用は [GLOSSARY.md](./doc/GLOSSARY.md) の定義に従う

## 共通の動作制限
- 既存ファイルの編集を優先し、新規ファイル作成は必要最小限に留める
- ドキュメントファイル（`*.md`）の作成は明示的に要求された場合のみ
- タスクは要求された内容のみを実行し、余計な作業は行わない
- 独断でのコミットは禁止し、必ず指示者の合意を得る
- 過去のコミットを書き換える操作（`git commit --amend` や履歴書き換えを伴うコマンド）は禁止し、常に通常の `git commit` を使用する

## 操作の実行原則

AI エージェントは、すべての操作を実行する前に、以下の3カテゴリで判定すること。

### ❌ 原則禁止（カテゴリ A）：復元不可能 or リモートへの影響

ユーザーの明示的指示がある場合**のみ**実行可能。

**禁止操作**：`git stash drop/pop/branch`, `git branch -D <未pushブランチ>`, `git reset --hard`, `git clean -fd`, `git push`, `git push --force`, `rm -rf`

### ⚠️ 条件付き許可（カテゴリ B）：復元可能だが状態変更

ユーザー指示、または作業フロー内で許可されている場合のみ実行可能。

**条件付き操作**：`git commit`, `git checkout`, `git merge`, `git stash`, `git stash apply`, `git restore`

### ✅ 実行可能（カテゴリ C）：読み取り専用

承認不要で自由に実行可能。

**安全操作**：`git show/diff/log/status`, `git stash show`, `cat/ls/grep/find`, Read/Grep/Glob ツール, Write/Edit ツール（Git 管理下）

## Stash の調査手順（非破壊的）

ユーザーから stash の内容調査を依頼された場合、以下の手順で実施：

### 手順

1. **stash 一覧の確認**（カテゴリ C: 実行可能）
   ```bash
   git stash list
   ```

2. **統計情報の取得**（カテゴリ C: 実行可能）
   ```bash
   git stash show stash@{N} --stat
   ```

3. **変更ファイル一覧の取得**（カテゴリ C: 実行可能）
   ```bash
   git stash show stash@{N} --name-only
   ```

4. **特定ファイルの差分確認**（カテゴリ C: 実行可能）
   ```bash
   git stash show stash@{N} -p -- <file-path> | head -100
   ```

### 禁止事項（カテゴリ A: 原則禁止）

調査段階では以下を**絶対に使用しない**：

- ❌ `git stash branch` - stash を消費
- ❌ `git stash pop` - stash を消費
- ❌ `git stash drop` - stash を削除
- ❌ `git stash apply` - ワーキングツリーを変更（カテゴリ B だが調査には不要）

### 調査結果の報告

ユーザーに以下を報告：
1. 統計情報（ファイル数、変更行数）
2. ファイル分類（ソースコード/ドキュメント/設定ファイル）
3. 重要な差分内容
4. 適用判断の材料

### 適用の実行（ユーザー承認後のみ）

調査完了後、ユーザーから指示があった場合のみ：

```bash
# 適用（stash は保持）- カテゴリ B
git stash apply stash@{N}

# 適用と削除 - カテゴリ A（原則禁止）
git stash pop stash@{N}

# 破棄 - カテゴリ A（原則禁止）
git stash drop stash@{N}
```

## 実装前の確認ルール
- **重要**: 指示者が明示的に指示しない限り、ソースコードの修正を禁止する
- 「実行計画を立てて」「どうすればいい？」などの質問や計画段階では、実際のコード修正を行わない
- 以下の明示的な指示があった場合に限り、ソースコードの修正を許可する：
  - 「実装して」
  - 「修正して」
  - 「コードを書いて」
  - 「作成して」
  - その他、明確に実装を要求する指示
- 計画や提案の段階では、実装内容の説明に留め、実際のコード変更は行わない

## Git コミット後の振り返り
git へコミットした後、以下を実施すること：
1. その作業で得られた学び・教訓・実行したエージェントが知らなかったことを指示者へ列挙
2. 指示者から指定された項目について適切なドキュメントへの追記・修正を提案
3. これは後学者が本プロジェクトを正しく、早く理解する助けになるものである

## コミットメッセージフォーマット
```
{PROJECT_KEY}-{TASK_ID} 変更内容の概要

- 詳細な変更点 1
- 詳細な変更点 2

🤖 Generated with {AGENT_NAME}({AGENT_URL})
```

- `PROJECT_KEY` は、プロジェクトごとに書き換えること。不明な場合は指示者に問い合わせること。
- `TASK_ID` は、タスクのID、多くは4桁程度の数値である（例: 1234）。不明な場合は指示者に問い合わせること。
- `AGENT_NAME`、`AGENT_URL` はコミットを実行したエージェントに合わせて置き換えること。
- **重要**: フッターは `🤖 Generated with` の1行のみとし、`Co-Authored-By` などの追加行は含めないこと。

## プロジェクト情報の参照先

技術的な実装や設計に関する情報は [README.md](./README.md) を起点として参照すること。
README.md には全ドキュメントへのリンクが整理されている。

## Markdown 記述時の注意
- [Markdown スタイルガイド](./docs/markdown-style-guide.md) のカーニングルールを適用すること
- これにより、プロジェクト全体で一貫した日本語表記が保たれる

## 通知ルール（作業完了通知）

### 通知必須タイミング

  - TodoWrite タスクがすべて完了 → 通知送信
  - コード実装・修正完了 → 通知送信
  - 分析・調査完了 → 通知送信
  - バグ修正完了 → 通知送信
  - ドキュメント作成完了 → 通知送信

### 通知コマンド

通知を送るスキル（`notify` など）が利用可能な場合は、そのスキルを優先的に使用すること。

```bash
# notify スキルを使用（推奨）
bash ~/.claude/skills/notify/notify.sh "タイトル" "メッセージ"
```

スキルが利用できない場合は、以下のコマンドを参考にすること：

- **macOS**: `osascript -e 'display notification "具体的な作業内容が完了しました" with title "{AIエージェント名}" sound name "default"'`
- **Windows**: `powershell.exe -Command "[System.Media.SystemSounds]::Exclamation.Play()"`

### メッセージ形式

- 具体的な作業内容を含める（例: "ABC-1409 タイムスケジュール共有機能の実装が完了しました"）

### 通知不要な場合

- 単純な質疑応答、継続中の対話、部分的な進捗報告

## 対話ログ記録ルール
- **エージェントの応答が完了したら毎回** `.agents_logs/{YYYYMMDD}.md` へ、「ユーザーの指示」、「エージェントの対応」を記入すること。
- {YYYYMMDD} および、対話ログ内の日時表記は、原則として JST（日本標準時）とする。
- 各ターンの完了前に「ログ追記済みか」を必ず自己チェックし、未実施なら直ちに記録すること。
- 記録漏れが判明した場合は、すぐにユーザーへ報告し、その場で不足分を補記すること。

### 対話ログの時刻と所要時間の記録方法

1. **対話開始時**: JST 時刻を取得
   - **優先**: `jst-time` スキルが利用可能な場合は、そのスキルを使用する
   - **代替**: 以下のいずれかのコマンドで JST 時刻を取得
     - macOS/Linux: `TZ='Asia/Tokyo' date '+%Y/%m/%d %H:%M:%S'`
     - Node.js（クロスプラットフォーム）: `node -e "const d = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Tokyo'})); const pad = n => String(n).padStart(2, '0'); console.log(\`\${d.getFullYear()}/\${pad(d.getMonth()+1)}/\${pad(d.getDate())} \${pad(d.getHours())}:\${pad(d.getMinutes())}:\${pad(d.getSeconds())}\`)"`
2. **対話終了時**: 再度同じ方法で JST 時刻を取得し、開始時刻との差分から所要時間を計算
3. **所要時間の表記**: 
   - 60秒未満: `（所要時間:XX秒）`
   - 60秒以上: `（所要時間:XX分XX秒）` または `（所要時間:XX分）`
4. **時刻の表記**: `## YYYY/MM/DD HH:MM:SS JST` の形式で JST を明記

### 対話ログの書式

```
## YYYY/MM/DD HH:MM:SS JST
- ユーザーの指示
    1. ユーザーの指示内容(簡潔に)1
    2. ユーザーの指示内容(簡潔に)2
    3. ユーザーの指示内容(簡潔に)3...
- エージェントの対応（所要時間:XX秒） by {AIエージェント名}
    1. エージェントの対応内容(簡潔に)1
    2. エージェントの対応内容(簡潔に)2
    3. エージェントの対応内容(簡潔に)3...
----
```

## Worktree での作業手順

AIエージェントが worktree での作業を依頼された場合、以下の手順を実施すること：

### 1. Worktree の作成

**重要**：作業ブランチは **開発用ブランチ** から分岐させること。
開発用ブランチ名はプロジェクトの README.md の「Git ブランチ運用」セクションを参照すること。

**手順**：
1. README.md から「Git ブランチ運用」セクションを確認し、開発用ブランチ名を取得
2. `git worktree add <worktree-path> -b <branch-name> <開発用ブランチ名>` で worktree を作成
   - 派生元ブランチを明示的に指定することで、現在のブランチを切り替える必要がない

**注意**：派生元ブランチは必ず明示的に指定すること。
指定しない場合、現在チェックアウトしているブランチから分岐されるため、誤ったブランチから分岐する可能性がある。

### 2. .env 関連ファイルのコピー

派生元ディレクトリの `.env*` ファイル（`.env`, `.env.local`, `.env.test` など）を worktree 側にコピーする。
これにより、worktree でアプリケーションを実行する際に必要な環境変数が利用可能になる。

**注意**:
- 既存の `.env*` ファイルは上書きしない（worktree での作業内容を保護）
- `.env*` ファイルが存在しない場合は警告を表示してスキップ

### 3. node_modules シンボリックリンクの作成

派生元ディレクトリの `node_modules/` のシンボリックリンクを worktree 側に作成する。
これにより、ディスク容量を節約しつつビルド環境を整える。

**検索範囲**: ルートディレクトリと、その3階層下まで
**スキップ条件**: `node_modules` が重複する場合（`xxx/node_modules/yyy/node_modules/`）

#### macOS / Linux の場合
```bash
# 派生元ディレクトリから3階層下まで node_modules を検索
find <派生元ディレクトリ> -maxdepth 3 -type d -name "node_modules" | while read src; do
  target="${src/<派生元ディレクトリ>/<worktree-path>}"
  # 重複チェック（node_modules/*/node_modules はスキップ）
  if [[ ! "$src" =~ node_modules.*node_modules ]]; then
    mkdir -p "$(dirname "$target")"
    ln -s "$src" "$target"
  fi
done
```

#### Windows の場合
```powershell
# PowerShell で実行（管理者権限が必要な場合がある）
Get-ChildItem -Path <派生元ディレクトリ> -Recurse -Depth 3 -Directory -Filter "node_modules" | ForEach-Object {
  $src = $_.FullName
  $target = $src.Replace("<派生元ディレクトリ>", "<worktree-path>")
  # 重複チェック（node_modules\*\node_modules はスキップ）
  if ($src -notmatch "node_modules.*node_modules") {
    New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
    New-Item -ItemType SymbolicLink -Path $target -Target $src
  }
}
```

**注意**: Windows でシンボリックリンク作成には管理者権限が必要な場合があります。
権限問題が発生する場合は、worktree で `npm install` を実行してください（ディスク容量は増加します）。

### 4. 課題管理システムのステータス更新（実装開始時）

プロジェクトで課題管理システム（Backlog など）を使用している場合、実装開始時にステータスを更新する。

**実行条件**：
1. 課題キー（例：PROJ-1234）が提供されている、またはブランチ名から推測可能
2. プロジェクトの README.md に「課題管理システム設定」セクションが記載されている
3. 「開始時ステータス」が定義されている

**手順**：
1. README.md から課題管理システムの設定を確認
2. 課題キーを特定（ブランチ名 `feature/PROJ-1234` から抽出可能）
3. 定義されている「開始時ステータス」に課題を更新
4. ステータス更新と同時に、以下の形式でコメントを追加：
   ```
   AI エージェント（{AGENT_NAME}）が worktree での実装を開始しました。
   ステータスを「{STATUS_NAME}」に更新しました。
   ブランチ: {BRANCH_NAME}
   コミット: {COMMIT_HASH}

   🤖 Generated by {AGENT_NAME} ({AGENT_URL})
   ```
   - `{AGENT_NAME}`: 実行中の AI エージェント名（Claude Code、Codex など）
   - `{AGENT_URL}`: AI エージェントの URL（https://claude.com/claude-code など）
   - `{STATUS_NAME}`: README.md で定義された開始時ステータス名
   - `{BRANCH_NAME}`: 作業ブランチ名（`git branch --show-current` で取得）
   - `{COMMIT_HASH}`: 開始時点の最新コミットハッシュ（`git rev-parse --short HEAD` で取得、短縮形7文字）
5. コメント追加に失敗した場合でもステータス更新は継続（エラーログのみ出力）
6. 設定がない、または課題キーが不明な場合はスキップ（エラーにしない）

### 5. 実装作業

worktree 環境で実装作業を実施する。
ファイルパスは worktree のパスを基準にして、Read/Edit/Write ツールを使用する。

### 6. ビルド確認

実装完了後、すべてのプロジェクトでビルドを確認すること。
ビルドコマンドは README.md の「ビルド確認」セクションに記載されています（詳細なドキュメントへのリンクが提供されていることもあります）。
ビルドエラーが発生した場合は、実装を修正してから再度ビルドを確認すること。

### 7. 実装内容のコミットと push

ビルド確認が成功したら、実装内容を作業ブランチにコミットし、リモートにプッシュする。

**手順**：
1. `git status` で変更内容を確認
2. `git add` で変更をステージング
3. `git commit` でコミット（コミットメッセージは「コミットメッセージフォーマット」に従う）
4. `git push` でリモートにプッシュ

**重要**：このコミットのハッシュが、次のステップで Backlog コメントに記載される。
実装内容がコミットされていない状態でステータス更新すると、古いコミットハッシュが記載されてしまう。

### 8. プルリクエストの作成（実装完了時）

実装内容をコミットした後、プルリクエストを作成する。

**実行条件**：
1. 課題キーがブランチ名から取得可能（例：feature/SDBT-1234 → SDBT-1234）
2. Backlog Git リポジトリ内での作業
3. プルリクエストを作成するスキルが利用可能

**手順**：
1. ブランチ名から課題キーを抽出（`feature/PROJ-1234` → `PROJ-1234`）
2. 現在のブランチ名を取得（`git branch --show-current`）
3. worktree の作成元のブランチをターゲットブランチとして使用
   - worktree 作成時に `git worktree add <worktree-path> -b <branch-name> <開発用ブランチ名>` で指定した `<開発用ブランチ名>` がターゲットブランチ
4. プルリクエストを作成するスキルが使えるなら、それを使用してプルリクエストを作成
   - タイトル・説明は課題情報から自動生成
   - レビュワーは必要に応じて指定
5. プルリクエスト URL をユーザーに提示

**スキップ条件**：
- 課題キーがブランチ名から抽出できない
- Backlog Git リポジトリでない
- プルリクエストを作成するスキルが利用不可

### 9. 課題管理システムのステータス更新（実装完了時）

プルリクエストを作成した後、課題のステータスを更新する。

**実行条件**：
1. 課題キーが利用可能
2. プロジェクトの README.md に「完了時ステータス」が定義されている
3. すべてのビルドが成功している
4. 実装内容がコミット済みである

**【重要】スキップ条件**:
以下の場合はステータス更新をスキップし、課題管理システムへのコメントで残作業を報告する：
- コア実装（UI、ロジック、データ取得など）が未完了
- プロトタイプや最小限の実装のみ完了
- 「TODO」「FIXME」「暫定実装」などのコメントが残っている

※テストやドキュメント更新が残っていても、コア実装が完了していればステータス更新OK

**スキップ時のコメント記録**:
ステータス更新をスキップした場合は、以下の形式で課題管理システムにコメントを追加する：

```
AI エージェント（{AGENT_NAME}）が実装を完了しましたが、残作業があるためステータス更新をスキップしました。

## 実装完了
- （完了した作業を箇条書きで記載）

## 実装未完了
- （未完了の作業を箇条書きで記載）

## ステータス更新をスキップした理由
（なぜコア実装が完了していないか、何が不足しているかを簡潔に記載）

🤖 Generated by {AGENT_NAME} ({AGENT_URL})
```

**手順**：
1. README.md から課題管理システムの設定を確認
2. 定義されている「完了時ステータス」に課題を更新
3. ステータス更新と同時に、以下の形式でコメントを追加：
   ```
   AI エージェント（{AGENT_NAME}）が実装とビルド確認を完了しました。
   ステータスを「{STATUS_NAME}」に更新しました。
   ブランチ: {BRANCH_NAME}
   コミット: {COMMIT_HASH}

   🤖 Generated by {AGENT_NAME} ({AGENT_URL})
   ```
   - `{AGENT_NAME}`: 実行中の AI エージェント名（Claude Code、Codex など）
   - `{AGENT_URL}`: AI エージェントの URL（https://claude.com/claude-code など）
   - `{STATUS_NAME}`: README.md で定義された完了時ステータス名
   - `{BRANCH_NAME}`: 作業ブランチ名（`git branch --show-current` で取得）
   - `{COMMIT_HASH}`: 完了時点の最新コミットハッシュ（`git rev-parse --short HEAD` で取得、短縮形7文字）
4. コメント追加に失敗した場合でもステータス更新は継続（エラーログのみ出力）
5. 設定がない場合はスキップ（エラーにしない）

**注意**：
- ビルドエラーが発生している場合は、ステータスを更新せず、実装を修正すること
- 実装内容がコミットされていない場合は、必ず先にコミットすること

### 10. 作業終了とクリーンアップ

すべての作業が完了したら、worktree 環境をクリーンアップして元ディレクトリに戻る。

**手順**：
1. worktree でコミット漏れがないか確認し、未コミットがあればコミットする
2. 作業開始時に作成したシンボリックリンク（node_modules）や .env 関連ファイルを削除する
3. 元ディレクトリに戻る
4. `git worktree remove <worktree-path>` で worktree を削除する

**注意**：
- 未コミットのファイルが残っている場合、worktree の削除は失敗する（未コミットをコミットしてから再度削除すること）
- `--force` オプションは**絶対に使用しない**（データ損失が発生する）
- シンボリックリンクや .env ファイルの削除は任意（worktree 削除時に一緒に削除されるため）

## 課題管理システムコメントの署名ルール

AI エージェントが課題管理システムにコメントを追加する際は、必ず以下の署名を含めること：

```
🤖 Generated by {AGENT_NAME} ({AGENT_URL})
```

- `{AGENT_NAME}`: 実行中の AI エージェント名（Claude Code、Codex など）
- `{AGENT_URL}`: AI エージェントの URL（https://claude.com/claude-code など）

署名は、コメント本文の最後に空行を1つ開けてから追加する。

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

<!-- 以下は、Claude Code 固有の情報 -->

# SuperClaude Entry Point

@COMMANDS.md
@FLAGS.md
@PRINCIPLES.md
@RULES.md
@MCP.md
@PERSONAS.md
@ORCHESTRATOR.md
@MODES.md
