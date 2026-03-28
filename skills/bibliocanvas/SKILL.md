---
name: bibliocanvas
description: BiblioCanvasの書籍管理CLI。本の追加・更新・削除、本棚管理、Kindle本のASIN登録に対応。ユーザーが本・読書・本棚・BiblioCanvasに言及したら使用。
allowed-tools: Bash(bibliocanvas:*), Bash(curl:*), Bash(npx:*)
---

# BiblioCanvas CLI

BiblioCanvasの書籍ライブラリをコマンドラインから管理する。

## セットアップ

```bash
npx bibliocanvas --version    # インストール確認
npx bibliocanvas login        # 初回: ブラウザ認証
```

## コマンド一覧

### 書籍の一覧・検索

```bash
npx bibliocanvas list                          # 全書籍
npx bibliocanvas list -q "キーワード"           # タイトル・著者で検索
npx bibliocanvas list --status READ            # ステータスで絞り込み（READ, READING, UNREAD, BACKLOG）
npx bibliocanvas list --shelf <shelfId>        # 特定の本棚の書籍
npx bibliocanvas list --rating 5               # 最低評価で絞り込み
npx bibliocanvas list --limit 20               # 表示件数制限
npx bibliocanvas list --json                   # JSON出力
```

### 書籍の追加

**Kindle本（ASIN指定）:**
```bash
npx bibliocanvas add --title "タイトル" --authors "著者" --book-id <ASIN> --source kindle_import --image <画像URL>
```

**ISBN指定:**
```bash
npx bibliocanvas add --isbn 9784065371534
```

**手動入力:**
```bash
npx bibliocanvas add --title "タイトル" --authors "著者"
```

### 書籍の更新

```bash
npx bibliocanvas update <bookId> --status READ
npx bibliocanvas update <bookId> --rating 5
npx bibliocanvas update <bookId> --memo "感想テキスト"
```

### 書籍の削除

```bash
npx bibliocanvas delete <bookId>
```

### 本棚の管理

```bash
npx bibliocanvas shelf list                              # 本棚一覧
npx bibliocanvas shelf books <shelfId>                   # 本棚の中身を表示
npx bibliocanvas shelf add-book <shelfId> <bookId>       # 本棚に書籍追加
npx bibliocanvas shelf remove-book <shelfId> <bookId>    # 本棚から書籍削除
npx bibliocanvas shelf create --name "本棚名"            # 新規本棚作成
```

### 公開本棚の閲覧（ログイン不要）

```bash
npx bibliocanvas public shelves                           # 公開本棚一覧
npx bibliocanvas public shelves --user <username>         # ユーザーの公開本棚一覧
npx bibliocanvas public shelf <shelfId>                   # 公開本棚の詳細+書籍一覧
npx bibliocanvas public shelves --json                    # JSON出力
```

## Kindle本の登録手順

BiblioCanvasのKindleインポートで取り込めなかった本や、手動で追加したいKindle本をASINで登録する。

### 1. ASINを特定する

AmazonのURLから取得: `https://www.amazon.co.jp/dp/{ASIN}`

### 2. 表紙画像を取得する

Amazonの商品ページからOG画像を取得:
```bash
curl -s -H "User-Agent: Mozilla/5.0" "https://www.amazon.co.jp/dp/{ASIN}" | grep -oP 'property="og:image"[^>]*content="([^"]+)"' | grep -oP 'https://[^"]+' | head -1
```

### 3. 登録する

```bash
npx bibliocanvas add --title "タイトル" --authors "著者" --book-id {ASIN} --source kindle_import --image "{画像URL}"
```

### シリーズ全巻の一括登録

1. 1巻のページからシリーズのASINを取得:
```bash
curl -s -H "User-Agent: Mozilla/5.0" "https://www.amazon.co.jp/dp/{1巻のASIN}" | grep -oP 'dp/(B[A-Z0-9]{9,10})' | sort -u
```

2. 各ASINのタイトルを確認:
```bash
curl -s -H "User-Agent: Mozilla/5.0" "https://www.amazon.co.jp/dp/{ASIN}" | grep -oP '<title>[^<]*' | sed 's/<title>//'
```

3. 各巻を表紙画像付きで登録する。

### 重要: 追加前に重複チェック

```bash
npx bibliocanvas list -q "タイトル"
```

## メモの書式（=== セパレータ）

```
ひとこと感想（本棚ビューでポップ表示）
===
読書ログ（リストビューで全文表示）。
Markdown対応。
```

`===` の前が「ひとこと」、後が「読書ログ」。`===` がない場合はメモ全体が「ひとこと」として扱われる。

## 補足

- トークンは自動リフレッシュ。期限切れで再ログイン不要。
- `--dev` フラグで開発環境に接続。
- CLIからの変更は公開本棚にも自動同期される。
