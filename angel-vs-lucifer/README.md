# 天使 vs 堕天使ルシファー

ブラウザで遊べる、NPC（コンピューター）対戦型の2Dアクション対戦ゲームです。
HTML / CSS / JavaScript だけで動くため、ビルド作業や外部ライブラリは不要で、そのまま GitHub Pages で公開できます。

---

## ファイル構成

```
angel-vs-lucifer/
├── index.html          … 画面の土台（タイトル・結果画面・canvas）
├── .nojekyll           … GitHub Pages でファイルをそのまま配信させるための空ファイル
├── css/style.css       … 見た目
├── js/config.js        … ★ゲームバランス設定（速度・バフ・ラウンド数・AI など）
├── js/sprites.js       … APNG の読み込み・コマ展開、仮の図形での描画
├── js/input.js         … キーボード／タッチ操作
├── js/game.js          … ゲーム本体（キャラ、当たり判定、AI、ラウンド進行）
└── assets/
    ├── config.js       … ★スプライト（APNG）設定（ファイル名・長さ・大きさ・当たり判定）
    └── sprites/
        ├── angel/      … 天使の APNG を置く場所
        └── lucifer/    … ルシファーの APNG を置く場所
```

---

## GitHub Pages で公開する手順

1. GitHub で新しいリポジトリを作成します（例：`angel-vs-lucifer`、Public）。
2. このフォルダの中身（`index.html` がリポジトリの一番上に来るように）をアップロードします。
   - ブラウザの場合：リポジトリ画面の「Add file」→「Upload files」に、フォルダの中身をまとめてドラッグ＆ドロップ →「Commit changes」。
   - git の場合：
     ```bash
     cd angel-vs-lucifer
     git init
     git add .
     git commit -m "first commit"
     git branch -M main
     git remote add origin https://github.com/＜ユーザー名＞/angel-vs-lucifer.git
     git push -u origin main
     ```
3. リポジトリの「Settings」→「Pages」を開きます。
4. 「Build and deployment」の Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして「Save」。
5. 1〜2分後、`https://＜ユーザー名＞.github.io/angel-vs-lucifer/` で遊べるようになります。

### 手元のパソコンで試すとき

`index.html` をダブルクリックで開く（`file://`）と、ブラウザの制限で **APNG 画像が読み込めません**（仮の図形で動作はします）。
画像を確認するときは、フォルダ内で簡易サーバーを起動してください。

```bash
cd angel-vs-lucifer
python3 -m http.server 8000
# → ブラウザで http://localhost:8000/ を開く
```

スマホで試す場合は、同じ Wi-Fi で `http://＜パソコンのIPアドレス＞:8000/` を開くか、GitHub Pages に上げて確認するのが簡単です。

---

## 遊び方・操作方法

**画面の流れ：** タイトル（キャラクター選択）→ バトル開始（ラウンド表示）→ 勝ち負けの結果表示（「もう一度」「タイトルへ」）

タイトルで天使かルシファーを選ぶと、選ばなかった方が敵（NPC）として登場します。

| 操作 | スマホ（横画面） | PC |
|---|---|---|
| 移動（上下左右・斜め） | フリック／スワイプした方向へ移動。指を置いたまま動かすと移動し続けます | W A S D（矢印キーも可） |
| 攻撃 | 画面をタップ | Enter |
| キャラ選択 | ボタンをタップ | A / D で切り替え、Enter で開始 |
| 当たり判定の表示 | — | H（デバッグ用） |

- 上下の移動は「奥・手前」への移動です（ベルトスクロールアクション風の 2.5D）。奥にいるキャラが後ろに描画されます。
- スマホを縦向きにすると「横向きにしてください」と表示されます。タイトル右上の「全画面にする」で全画面表示にできます（対応ブラウザのみ）。
- ページのスクロールやピンチズームは無効にしています。

### ルール
- ライフは5つ。攻撃を1回受けるごとに1つ減ります（攻撃力・防御力の計算はなし）。5回当てた方がそのラウンドの勝ち。
- 2ラウンド制。2本先取で勝利。
- **1勝1敗になった場合は、3ラウンド目（決着ラウンド）を行います。**（※仕様で決まっていなかったため、こちらで決めた仮のルールです。`js/config.js` の `tiebreakerRound: false` にすると、1勝1敗は「引き分け」になります。）
- 攻撃を受けると少し後ろに下がり、短い無敵時間があります（点滅表示）。ライフが0になると「倒れる」モーションになります。
- **天使：** ライフが2以下になると、移動速度と攻撃速度が1.3倍。
- **堕天使ルシファー：** ライフが4以上のとき、移動速度と攻撃速度が1.3倍。
- 速度アップ中はキャラのまわりにオーラが出て、画面上部に「速度アップ中！」と表示されます。

### 攻撃の当たり判定
- 攻撃判定は **攻撃アニメーションの最後（最後のコマ）** に一瞬だけ出ます。
- 判定はキャラが **向いている側（左右の片側）だけ** に出ます。
- 攻撃判定の範囲が **相手の画像（体の当たり判定）に触れているとき** だけ当たります。
- さらに、奥行き（上下の位置）が近いときだけ当たります（`depthTolerance`）。
- H キーで、体の判定（緑）・攻撃判定（赤）・奥行きの許容範囲（青）を表示できます。

---

## スプライト（APNG）の差し替え方法

素材がない間は、仮の図形（天使＝白と金、ルシファー＝紫と黒）で動きます。
APNG ファイルを置くと、**自動的にその画像に切り替わります**（置いたものから順に反映。足りない分は仮の図形のまま）。

### 1. ファイルを置く

SpriteStudio などで書き出した APNG を、次の名前で置いてください。

| モーション | 天使 | ルシファー | 再生 |
|---|---|---|---|
| 待機 | `assets/sprites/angel/idle.png` | `assets/sprites/lucifer/idle.png` | ループ |
| 移動（浮遊） | `assets/sprites/angel/move.png` | `assets/sprites/lucifer/move.png` | ループ |
| 攻撃 | `assets/sprites/angel/attack.png` | `assets/sprites/lucifer/attack.png` | 1回（最後のコマで判定） |
| 被ダメ | `assets/sprites/angel/hurt.png` | `assets/sprites/lucifer/hurt.png` | 1回 |
| 倒れる | `assets/sprites/angel/down.png` | `assets/sprites/lucifer/down.png` | 1回（最後のコマで止まる） |

- 拡張子は `.png` でも `.apng` でも構いません（`assets/config.js` の `src` と合わせてください）。
- **キャラクターは右向きで描いてください。** 左向きのときはプログラムで左右反転します。
  左向きで描いた場合は `assets/config.js` の `baseFacing` を `'left'` にしてください。
- 背景は透明にしてください。キャラの **足元（浮遊している場合は影の位置）が画像の下端中央** に来るように書き出すと、位置合わせが楽です。
- 5つのモーションは、同じキャンバスサイズで書き出すことをおすすめします（切り替え時に位置がずれないため）。
- 1枚絵の普通の PNG でも動きます（静止画として表示）。

### 2. `assets/config.js` を調整する

```js
angel: {
  width: 140,            // 画面に描画する幅（px、画面は 960×540 基準）
  height: 180,           // 画面に描画する高さ（画像の縦横比に合わせてください）
  bodyInset: { left: 30, right: 30, top: 20, bottom: 6 }, // 画像の端から体の当たり判定までの余白
  attackBox: { near: 10, reach: 90, top: 150, bottom: 40 }, // 攻撃判定（前方）
  states: {
    idle:   { src: 'assets/sprites/angel/idle.png',   duration: 1000, loop: true },
    move:   { src: 'assets/sprites/angel/move.png',   duration: 600,  loop: true },
    attack: { src: 'assets/sprites/angel/attack.png', duration: 420,  loop: false },
    hurt:   { src: 'assets/sprites/angel/hurt.png',   duration: 400,  loop: false },
    down:   { src: 'assets/sprites/angel/down.png',   duration: 900,  loop: false }
  }
}
```

- `duration`（ミリ秒）は **ゲーム内でのモーションの長さ** です。APNG の各コマはこの長さに収まるよう伸縮して再生されます。
  **APNG に書き出したアニメーションの長さと同じ値にすると、書き出したとおりの速さ** で再生されます。
  - 攻撃：この時間が終わる瞬間（最後のコマ）に攻撃判定が出ます。速度アップ中は `duration ÷ 1.3` になり、アニメーションも速く再生されます。
  - 被ダメ：この時間だけ操作できません。
- `bodyInset`：画像には透明な余白があることが多いので、体の部分だけが当たるよう余白を指定します。0 にすると画像全体が当たり判定になります。左右反転時は自動で左右が入れ替わります。
- `attackBox`：キャラの中心から前方向に `near` px 離れた所から、幅 `reach` px の範囲が攻撃判定です。`top` / `bottom` は足元からの高さ（px）です。
- H キーで判定を表示しながら、画像に合わせて数値を調整してください。

> 技術メモ：canvas に APNG を `<img>` のまま描画すると、ブラウザによっては1コマ目しか描画されません。
> そのため、このゲームでは APNG を自前で解析して全コマを展開しています（`js/sprites.js`）。
> 攻撃・被ダメ・倒れるは毎回必ず1コマ目から再生されます。コマ数×画像サイズ分のメモリを使うので、
> 画像サイズは表示サイズの 1〜2 倍程度（例：300×400px 前後）までにするのがおすすめです。

---

## 調整できるパラメータ（`js/config.js`）

テストプレイで調整する値はすべて `js/config.js` にまとめています。

| 項目 | 初期値 | 説明 |
|---|---|---|
| `maxLife` | 5 | ライフの数 |
| `rounds` | 2 | ラウンド数（2ラウンド制） |
| `tiebreakerRound` | true | 1勝1敗のとき3ラウンド目を行うか（false なら引き分け） |
| `roundTimeLimit` | 0 | 制限時間（秒）。0 で無制限。時間切れはライフが多い方の勝ち |
| `buffs.angel` | ライフ2以下で 1.3倍 | `threshold`（しきい値）、`moveSpeed`（移動速度倍率）、`attackSpeed`（攻撃速度倍率） |
| `buffs.lucifer` | ライフ4以上で 1.3倍 | 同上 |
| `moveSpeedX` / `moveSpeedY` | 260 / 170 | 横・奥行き方向の移動速度（px/秒） |
| `field` | — | 動ける範囲（足元の座標） |
| `autoFaceOpponent` | true | 常に相手の方を向く（false なら移動方向を向く） |
| `separation` | 0.8 | 同じ奥行きで体が重ならないようにする距離（0 ですり抜け可） |
| `depthTolerance` | 36 | 攻撃が当たる奥行きの差（px） |
| `attackCooldown` | 120 | 攻撃後、次の攻撃までの待ち時間（ms） |
| `invulnerableMs` | 700 | 被ダメ後の無敵時間（ms） |
| `knockback` | 70 | 被ダメ時に下がる距離（px） |
| `touch.*` | — | タップ／フリック判定のしきい値、フリック後に移動を続ける時間 |
| `ai.*` | — | 敵の強さ（攻撃する確率、反応の遅れ、攻撃後の休み、下がる確率、移動速度倍率など） |
| `roundIntroMs` / `koPauseMs` | 1600 / 2000 | ラウンド開始表示・KO 後の待ち時間（ms） |
| `debugHitboxes` | false | 起動時から当たり判定を表示するか |

**敵を弱くしたいとき：** `ai.attackChance` を下げる、`ai.reactionDelay` や `ai.attackCooldownMin/Max` を上げる、`ai.speedScale` を下げる。
**敵を強くしたいとき：** その逆にします。

---

## 決めたこと（仮のルール）

仕様で決まっていなかった点は、次のようにしています。すべて設定で変えられます。

- 1勝1敗のときは3ラウンド目（決着ラウンド）を行う（`tiebreakerRound`）。
- キャラは常に相手の方を向く、格闘ゲーム風（`autoFaceOpponent`）。
- 速度アップの判定は攻撃の開始時に行い、攻撃の途中で状態が変わっても、その攻撃の長さは変わらない。
- 移動速度アップ中は移動モーションの再生も速くなる。
- 制限時間はなし（`roundTimeLimit` で追加可能）。
- 敵の速度はプレイヤーの 0.9 倍（`ai.speedScale`）。
