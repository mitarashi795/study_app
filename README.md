# 勉強きろく

勉強した項目を「✅ 答えを見ずにこたえられた / 🤔 考え方は合ってたが間違えた / ❌ 答えられなかった」で評価し、
評価・科目タグ・キーワードで絞り込めるWebアプリです。評価の履歴と、日ごとの正答率(✅の割合)グラフ付き。

- ビルド不要(HTML / CSS / JavaScript のみ)
- データはブラウザの localStorage に保存(「バックアップ」でJSON書き出し可)

## GitHub Pages で公開する手順
1. GitHub で新しいリポジトリを作成(例: `study-tracker`)
2. このフォルダの中身(index.html, style.css, app.js, README.md)をリポジトリ直下にアップロード
   ```
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/<ユーザー名>/study-tracker.git
   git push -u origin main
   ```
3. リポジトリの Settings → Pages → Branch を `main` / `/ (root)` にして Save
4. 数分後 `https://<ユーザー名>.github.io/study-tracker/` で開けます
