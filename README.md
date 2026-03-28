# bibliocanvas-cli

[BiblioCanvas](https://bibliocanvas.web.app) の書籍・本棚をコマンドラインから管理するCLIツール。

## インストール

```bash
npm install -g bibliocanvas
```

または `npx` で直接実行:

```bash
npx bibliocanvas <command>
```

## 使い方

### ログイン

```bash
bibliocanvas login
```

ブラウザが開いてGoogleログイン画面が表示されます。ログインすると認証情報が `~/.bibliocanvas/credentials.json` に保存されます。

```bash
# 開発環境にログイン
bibliocanvas login --dev

# 現在のユーザーを確認
bibliocanvas whoami

# ログアウト
bibliocanvas logout
```

### 書籍の管理

```bash
# 書籍一覧
bibliocanvas list
bibliocanvas list --status READ           # 読了した本のみ
bibliocanvas list -q "ChatGPT"            # タイトル・著者で検索
bibliocanvas list --sort title --dir asc  # タイトル順
bibliocanvas list --shelf <shelfId>       # 特定の本棚の書籍のみ
bibliocanvas list --rating 5              # ★5の本のみ
bibliocanvas list --limit 20              # 20件まで表示
bibliocanvas list --shelf <id> --rating 4 --status READ  # 組み合わせ

# ISBN で追加
bibliocanvas add --isbn 9784065371534

# タイトルで検索して追加
bibliocanvas add --search "面倒なことはChatGPT"

# 手動で追加
bibliocanvas add --title "本のタイトル" --authors "著者名"

# Google Books 検索（追加はしない）
bibliocanvas search "Pythonプログラミング"
bibliocanvas search 9784065371534 --isbn

# 読了ステータス更新
bibliocanvas update <bookId> --status READ

# 評価をつける
bibliocanvas update <bookId> --rating 5

# メモを追加
bibliocanvas update <bookId> --memo "面白かった"

# 書籍を削除
bibliocanvas delete <bookId>
```

### 本棚の管理

```bash
# 本棚一覧
bibliocanvas shelf list

# 本棚の中身を表示
bibliocanvas shelf books <shelfId>

# 本棚を作成
bibliocanvas shelf create "AI・機械学習" -d "AI関連の本をまとめた本棚"

# 本棚に書籍を追加
bibliocanvas shelf add-book <shelfId> <bookId>

# 本棚から書籍を削除
bibliocanvas shelf remove-book <shelfId> <bookId>

# 本棚を削除
bibliocanvas shelf delete <shelfId>
```

### 公開本棚の閲覧（ログイン不要）

```bash
# 公開本棚一覧
bibliocanvas public shelves
bibliocanvas public shelves --user karaage0703  # ユーザー指定
bibliocanvas public shelves --limit 10          # 件数制限

# 公開本棚の詳細（書籍一覧＋メモ）
bibliocanvas public shelf <shelfId>
bibliocanvas public shelf <shelfId> --json      # JSON出力
```

### 共通オプション

| オプション | 説明 |
|-----------|------|
| `--dev` | 開発環境（bibliocanvas-dev）を使用 |
| `--json` | JSON形式で出力 |

### 読了ステータスの値

| 値 | 説明 |
|----|------|
| `NONE` | 未設定 |
| `UNREAD` | 未読 |
| `READING` | 読書中 |
| `READ` | 読了 |
| `BACKLOG` | 積読 |

## 認証情報の保存先

認証情報は `~/.bibliocanvas/credentials.json` に保存されます。このファイルにはFirebaseのリフレッシュトークンが含まれるため、他人と共有しないでください。

## 開発

```bash
git clone https://github.com/karaage0703/bibliocanvas-cli.git
cd bibliocanvas-cli
npm install
npm run build
node dist/index.js --help
```

## ライセンス

MIT
