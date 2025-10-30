# Project Context

このファイルは OpenSpec を使用するプロジェクトの汎用的なテンプレートです。プロジェクト固有の情報（技術スタック、ドメイン知識、依存関係など）は README.md に記載してください。

## OpenSpec Naming Conventions

proposal と spec の両方にチケット番号を付与し、課題管理システムで親子関係を管理する命名規則を採用できます。

### Change ID (Proposal ID)

- **形式**: `{PROJECT_KEY}-{TASK_ID}{separator}{descriptive-name}`
- **例**:
  - ハイフン区切り: `ABC-005-add-user-authentication`
  - アンダースコア区切り: `ABC-005_add-user-authentication`
- **PROJECT_KEY**: プロジェクト識別子（プロジェクトごとに定義、リポジトリルートの README.md に記載）
- **TASK_ID**: タスク番号（桁数はプロジェクトごとに定義、例: 005 や 1443）
- **separator**: 区切り文字（`-` または `_`、プロジェクトごとに選択）
- **descriptive-name**: kebab-case の説明的な名前（動詞で始めることを推奨: `add-`, `fix-`, `update-`, `remove-` など）

**区切り文字の選択:**
- **ハイフン（`-`）**: 一般的で読みやすい（例: `ABC-005-add-user-authentication`）
- **アンダースコア（`_`）**: 課題キー部分と説明部分を視覚的に分離（例: `ABC-005_add-user-authentication`）

この命名により、以下が実現される：
- Proposal ID として `{PROJECT_KEY}-{TASK_ID}` 部分が識別子として機能
- change-id として全体が使用可能
- Git コミットメッセージとの整合性維持
- ディレクトリ一覧で ID と内容の両方が把握可能

### Spec Directory Name

Spec ディレクトリにも**proposal とは異なるチケット番号**を付与できます：

- **形式**: `{PROJECT_KEY}-{TASK_ID}{separator}{descriptive-name}`
- **例**:
  - ハイフン区切り: `ABC-006-auth-ui`, `ABC-008-auth-api`
  - アンダースコア区切り: `ABC-006_auth-ui`, `ABC-008_auth-api`
- **親子関係**: 課題管理システムで proposal を親、spec を子として管理

**構造例（ハイフン区切り）:**
```
openspec/changes/ABC-005-add-user-authentication/  ← proposal (親)
├── proposal.md
├── tasks.md
└── specs/
    ├── ABC-006-auth-ui/      ← spec1 (子)
    │   └── spec.md
    ├── ABC-008-auth-api/     ← spec2 (子)
    │   └── spec.md
    └── ABC-010-auth-notification/  ← spec3 (子)
        └── spec.md
```

**構造例（アンダースコア区切り、参考資料含む）:**
```
openspec/changes/ABC-005_add-user-authentication/  ← proposal (親)
├── proposal.md
├── tasks.md
├── references/                                    ← 参考資料（オプション）
│   ├── original-spec.md
│   └── implementation-gap-analysis.md
└── specs/
    └── ABC-006_auth-ui/                           ← spec (子)
        └── spec.md
```

**メリット:**
- proposal と spec の両方を課題管理システムで追跡可能
- 親子関係により依存関係が明確
- 各 spec に独立したチケット番号を割り当てることで、個別に進捗管理が可能

### References Directory（参考資料）

元の仕様書や実装ギャップ分析などの参考資料を保管する場合、change 配下に `references/` ディレクトリを作成できます。

**配置例:**
```
openspec/changes/{change-id}/
├── proposal.md
├── tasks.md
├── references/
│   ├── original-spec.md              ← 元の仕様書
│   ├── implementation-gap-analysis.md ← 実装ギャップ分析
│   └── other-reference.md            ← その他の参考資料
└── specs/
    └── {spec-id}/
        └── spec.md
```

proposal.md に References セクションを追加し、これらの資料へのリンクを記載することを推奨します。

## OpenSpec Language Convention

多言語プロジェクトでは、以下の言語規約を採用できます：

### Proposal Files

- **セクション名は英語のみ**: `## Why`, `## What Changes`, `## Impact`
  - OpenSpec パーサーの要件により、proposal のセクション名は英語必須
- **タイトルは任意の言語**: `# ユーザー認証機能の追加` または `# Add User Authentication`
- **本文は任意の言語**: プロジェクトの主要言語で記述可能

### Spec Files

- **見出しは英語と他言語の併記可能**: `#### Scenario: User login success（ユーザーログイン成功）`
  - 英語見出しで OpenSpec ツールとの互換性を維持
  - 括弧内の他言語で母語話者の理解を容易にする
- **または英語のみ・他言語のみも可**: プロジェクトの方針による
- **本文は任意の言語**: プロジェクトの主要言語で記述可能
- **Requirement 見出しにも適用**: `### Requirement: User Authentication（ユーザー認証）`

## Migration from Legacy Specs to OpenSpec

既存の仕様書を OpenSpec 形式に移行する手順です。

### 前提条件

- 元の仕様書が存在する（例: `docs/spec/{TASK_ID}/spec.md`）
- プロジェクトの PROJECT_KEY、区切り文字、命名規則が決定済み
- OpenSpec CLI がインストール済み（検証用）

### 移行手順

#### 1. 元の仕様書の理解

元の仕様書を読み込み、以下を把握する：
- 変更の目的（Why）
- 変更内容（What）
- 影響範囲（Impact）
- 実装すべき機能要件
- 実装タスクの一覧

#### 2. OpenSpec 形式の理解

`openspec/AGENTS.md` を参照し、以下を確認する：
- proposal.md の構造（Why/What Changes/Impact セクション）
- tasks.md の記述方法（実装タスクのチェックリスト）
- spec.md の記述方法（Requirements with SHALL/MUST, Scenarios）

#### 3. ディレクトリ構造の作成

命名規則に従ってディレクトリを作成する：

```bash
# 例: ABC-005_add-feature の場合
mkdir -p openspec/changes/ABC-005_add-feature/specs/ABC-006_feature-spec
```

#### 4. proposal.md の作成

元の仕様書から抽出して作成する：

```markdown
# {機能名}

## Why

{この変更が必要な理由・背景}

## What Changes

- {変更内容の箇条書き}

## Impact

- **Affected specs**: {影響を受ける既存仕様}
- **Affected code**: {影響を受けるコード範囲}
- **Breaking changes**: {破壊的変更の有無と詳細}
```

#### 5. tasks.md の作成

実装タスクをセクションごとに整理する：

```markdown
# Implementation Tasks

## {セクション1}
- [ ] {タスク1}
- [ ] {タスク2}

## {セクション2}
- [ ] {タスク3}
- [ ] {タスク4}
```

#### 6. spec.md の作成

機能要件を Requirements と Scenarios に分解する：

```markdown
# {Spec Title}

## Overview

{仕様の概要説明}

### Requirement: {要件名}

システムは{要件の説明}しなければならない（MUST provide / SHALL be）。

#### Scenario: {シナリオ名}

- **GIVEN** {前提条件}
- **WHEN** {操作}
- **THEN** {期待結果}
```

**重要**: 各 Requirement に必ず SHALL または MUST を含める。

#### 7. 検証と修正

OpenSpec CLI で検証する：

```bash
openspec validate {change-id} --strict
```

エラーが出た場合：
- Requirements に SHALL/MUST が含まれているか確認
- 各 Requirement に少なくとも1つの `#### Scenario:` があるか確認
- 修正後、再度検証

#### 8. 命名規則の確認

以下を確認する：
- change-id が `{PROJECT_KEY}-{TASK_ID}{separator}{descriptive-name}` 形式か
- PROJECT_KEY が大文字か
- 区切り文字がプロジェクトの規約に合致しているか

必要に応じて `mv` コマンドでディレクトリ名を修正する。

#### 9. 元のファイルの保存

元の仕様書を references/ に移動する：

```bash
# ディレクトリ作成
mkdir -p openspec/changes/{change-id}/references/

# ファイル移動
mv docs/spec/{TASK_ID}/spec.md openspec/changes/{change-id}/references/original-spec.md
mv docs/spec/{TASK_ID}/other-doc.md openspec/changes/{change-id}/references/

# 空ディレクトリ削除
rmdir docs/spec/{TASK_ID}
```

#### 10. References セクションの追加

proposal.md に References セクションを追加する：

```markdown
## References

以下の参考資料は、この変更提案の元となった仕様書です：

- [元の仕様書](./references/original-spec.md) - `docs/spec/{TASK_ID}/spec.md` から移動
- [実装ギャップ分析](./references/implementation-gap-analysis.md) - 実装状況の分析資料
```

#### 11. コミット

変更をコミットする：

```bash
git add openspec/changes/{change-id}
git add openspec/project.md  # 更新した場合
git rm -r docs/spec/{TASK_ID}
git commit -m "{PROJECT_KEY}-{TASK_ID} OpenSpec 形式に移行"
```

### 移行後の確認事項

- [ ] proposal.md に Why/What Changes/Impact セクションがある
- [ ] tasks.md に実装タスクが整理されている
- [ ] spec.md の全 Requirements に SHALL/MUST がある
- [ ] spec.md の全 Requirements に少なくとも1つの Scenario がある
- [ ] `openspec validate` がエラーなく通る
- [ ] 命名規則がプロジェクトの規約に合致している
- [ ] 元の仕様書が references/ に保存されている
- [ ] proposal.md に References セクションがある
