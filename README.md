# イビルライトフォース

ブラウザで遊べる、NPC（コンピューター）対戦型の2Dアクション対戦ゲームです。
HTML / CSS / JavaScript だけで動くため、ビルド作業や外部ライブラリは不要で、そのまま GitHub Pages で公開できます。

---

## ファイル構成

```
（リポジトリの一番上）
├── index.html          … 画面の土台（タイトル・結果画面・canvas）
├── .nojekyll           … GitHub Pages でファイルをそのまま配信させるための空ファイル
├── css/style.css       … 見た目
├── js/config.js        … ★ゲームバランス設定（速度・バフ・ラウンド数・AI など）
├── js/sprites.js       … パーツ画像・APNG の読み込み、パーツの動き、仮の図形での描画
├── js/input.js         … キーボード／タッチ操作
├── js/game.js          … ゲーム本体（キャラ、当たり判定、AI、ラウンド進行）
└── assets/
    ├── config.js       … ★スプライト設定（パーツ画像・ピボット・動き・APNG・大きさ・当たり判定）
    └── sprites/
        ├── angel/
        │   ├── down.png            … 天使の「倒れる瞬間」APNG（1回再生）
        │   ├── down_1.png …        … （任意）APNG の代わりの静止 PNG コマ送り
        │   ├── down/               … 倒れたあとの「倒れ続け」画像
        │   │   ├── body.png / head.png / wings.png / arm.png
        │   │   └── loop.png        … （任意）1枚絵モード
        │   └── parts/              … 立っているときのパーツ（wings / body / head / arm、任意で head_hurt / head_attack / head_win）
        └── lucifer/
            ├── down.png / down_1.png …
            ├── down/               … 同上
            └── parts/              … 同上
```

---

## GitHub Pages で公開する手順

1. GitHub で新しいリポジトリを作成します（例：`angel-vs-lucifer`、Public）。
2. このフォルダの中身（`index.html` がリポジトリの一番上に来るように）をアップロードします。
   - 配布した zip は、展開するとそのまま `index.html` などが出てくる形です。リポジトリの一番上にそのまま展開・上書きしてください。
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

`index.html` をダブルクリックで開く（`file://`）と、ブラウザの制限で **APNG 画像（倒れる瞬間など）が読み込めません**（コマ送りや通常の PNG パーツは見られます。APNG が無いときは仮の図形で動作します）。
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
- H キーで、体の判定（緑）・攻撃判定（赤）・奥行きの許容範囲（青）・パーツのピボット（＋）を表示できます。翼の左右反転中は、反対側のピボットと鏡軸も出ます。倒れ続けのときも、倒れたパーツのピボット（体は「呼吸」付き）を表示します。

---

## キャラクター画像の入れ方（パーツモード）

素材がない間は、仮の図形（天使＝白と金、ルシファー＝紫と黒）で動きます。
初期設定は **パーツモード** です。自分で描いた **4枚のパーツ画像** を置くと、仮の図形と **まったく同じ動き** で動きます。

- 待機：全体がゆっくり上下にふわふわ動き、翼がゆっくり羽ばたく
- 移動：上下の揺れと羽ばたきが速くなり、体が少し前に傾く
- 攻撃：腕と剣を後ろに振りかぶってから前へ振り下ろし、最後に斬撃エフェクト（コードで描画）。頭の差分画像（`head_attack.png`）があれば表情を差し替え
- 被ダメ：体が後ろにのけぞり、赤く点滅（コードで描画）。頭の差分画像（`head_hurt.png`）があれば表情を差し替え
- 勝利：待機と同じふわふわ・羽ばたき。頭の差分画像（`head_win.png`）があれば表情を差し替え。ラウンド終了の間と結果画面でもそのまま
- 倒れる瞬間：**APNG（`down.png`）または静止 PNG のコマ送りを1回再生**（コードで回転させません）。終わると倒れ続けに切り替わります
- 倒れ続け：倒れたポーズのパーツ（または1枚絵）を表示し、**体だけがゆっくり呼吸**します（頭・翼・腕は動きません）

影・斬撃エフェクト・被ダメの赤い点滅は、これまでどおりコードで描きます。
置いたパーツから順に画像に切り替わり、**置いていないパーツは仮の図形のまま** です（混ぜて確認できます）。

### 1. ファイルを置く

| パーツ | 天使 | ルシファー | 回転の軸（ピボット） |
|---|---|---|---|
| 翼（片側3枚。反対側は自動で左右反転して追加） | `assets/sprites/angel/parts/wings.png` | `assets/sprites/lucifer/parts/wings.png` | 背中の付け根（ここを中心に羽ばたく） |
| 体 | `assets/sprites/angel/parts/body.png` | `assets/sprites/lucifer/parts/body.png` | 足元の中央（取り付け位置のみ） |
| 頭（髪・輪・角を含む） | `assets/sprites/angel/parts/head.png` | `assets/sprites/lucifer/parts/head.png` | 首（取り付け位置のみ） |
| 頭（被ダメの表情・任意） | `assets/sprites/angel/parts/head_hurt.png` | `assets/sprites/lucifer/parts/head_hurt.png` | 通常の頭と同じ（首） |
| 頭（攻撃の表情・任意） | `assets/sprites/angel/parts/head_attack.png` | `assets/sprites/lucifer/parts/head_attack.png` | 通常の頭と同じ（首） |
| 頭（勝利の表情・任意） | `assets/sprites/angel/parts/head_win.png` | `assets/sprites/lucifer/parts/head_win.png` | 通常の頭と同じ（首） |
| 腕と剣 | `assets/sprites/angel/parts/arm.png` | `assets/sprites/lucifer/parts/arm.png` | 肩（ここを中心に振る） |
| 倒れる瞬間（APNG） | `assets/sprites/angel/down.png` | `assets/sprites/lucifer/down.png` | —（下端中央が足元。回転なし） |
| 倒れる瞬間（コマ送り・任意） | `assets/sprites/angel/down_1.png` … `down_5.png` | `assets/sprites/lucifer/down_1.png` … `down_5.png` | 同上。3〜5枚程度 |
| 倒れ続け・体 | `assets/sprites/angel/down/body.png` | `assets/sprites/lucifer/down/body.png` | 体の下端（ここを軸に呼吸） |
| 倒れ続け・頭 | `assets/sprites/angel/down/head.png` | `assets/sprites/lucifer/down/head.png` | 首（動きません） |
| 倒れ続け・翼（片側。反対側は自動反転） | `assets/sprites/angel/down/wings.png` | `assets/sprites/lucifer/down/wings.png` | 付け根（動きません） |
| 倒れ続け・腕（任意） | `assets/sprites/angel/down/arm.png` | `assets/sprites/lucifer/down/arm.png` | 肩（動きません） |
| 倒れ続け・1枚絵（任意） | `assets/sprites/angel/down/loop.png` | `assets/sprites/lucifer/down/loop.png` | 下端中央（画像全体が呼吸） |

- 形式：**背景が透明な PNG**（パーツはアニメーションなしの1枚絵）。
- **すべて右向きで描いてください。** 左向きのときはプログラムで左右反転します。
- 描画順は奥から **翼 → 体 → 頭 → 腕と剣**（`parts.order` で変更できます）。
- 体の傾き（前傾・のけぞり）は、全パーツまとめて足元を中心に回転します。翼と腕はさらにそれぞれのピボットを中心に回転します。
- **翼は片側（キャンバスの左側＝キャラの後ろ側）だけ描いてください。** 反対側はゲームが左右反転して足し、羽ばたきの角度を逆向きにします（両側が同時に開いて同時に閉じます）。詳しくは「4. 翼の左右反転」を見てください。

### 2. おすすめの描き方（同じサイズのキャンバスで書き出す）

いちばん簡単なのは、**キャラ全体を1枚のキャンバスに待機ポーズで描き、レイヤーを4つ（翼・体・頭・腕と剣）に分けて、4枚とも同じキャンバスサイズのまま書き出す** 方法です。

| | キャンバスサイズ（表示の2倍） | 足元の中央 |
|---|---|---|
| 天使 | **280×360px**（画面では 140×180px） | 下端中央（140, 360） |
| ルシファー | **300×380px**（画面では 150×190px） | 下端中央（150, 380） |

- 2倍サイズで描き、`scale: 0.5` で半分にして表示します（スマホでもくっきり見えます）。サイズを変えた場合は `scale` を合わせてください（例：3倍で描いたら `scale: 0.333`）。
- 足元（浮いている状態のつま先あたり）がキャンバスの **下端中央** に来るように描きます。影はその少し下にコードで描かれます。
- 腕と剣は、**待機中の角度（真横から下へ約34°）** で描くのがおすすめです（`restAngle` と同じ角度にすると、待機中は描いたとおりに表示されます）。
- この方法なら、設定するのは **各パーツのピボット（キャンバス上の関節の位置）だけ** です。位置（offset）は `'auto'` のままで自動計算されます。

### 3. `assets/config.js` でピボットを設定する

```js
angel: {
  mode: 'parts',                       // 'parts' = パーツモード、'apng' = 従来の APNG モード
  width: 140, height: 180,             // 画面上のキャラの大きさ（当たり判定の基準）
  parts: {
    canvasAnchor: { x: 140, y: 360 },  // キャンバス内の足元中央の位置（px）
    order: ['wings', 'body', 'head', 'arm'],   // 描画順（先に書いたものが奥）
    wings: { src: 'assets/sprites/angel/parts/wings.png', pivot: { x: 119, y: 163 }, offset: 'auto', scale: 0.5, angle: 0, mirror: true, mirrorAxisX: 140 },
    body:  { src: 'assets/sprites/angel/parts/body.png',  pivot: { x: 140, y: 360 }, offset: 'auto', scale: 0.5, angle: 0 },
    head:  { src: 'assets/sprites/angel/parts/head.png',  pivot: { x: 145, y: 141 }, offset: 'auto', scale: 0.5, angle: 0 },
    arm:   { src: 'assets/sprites/angel/parts/arm.png',   pivot: { x: 161, y: 175 }, offset: 'auto', scale: 0.5, angle: 0, restAngle: 34.4 }
  },
  ...
}
```

| 項目 | 説明 |
|---|---|
| `src` | 画像のパス |
| `pivot` | 画像の中の **回転の軸／取り付け位置**（画像の左上を 0,0 とした px）。翼＝背中の付け根、腕＝肩、頭＝首、体＝足元中央。お絵かきソフトのカーソル位置の座標をそのまま書けばOKです |
| `offset` | ピボットをキャラのどこに置くか。`'auto'` なら `(pivot − canvasAnchor) × scale` で自動計算（同じサイズのキャンバスで書き出した場合）。パーツごとに切り抜いた画像を使う場合は `{ x: -11, y: -98 }` のように **画面上の px（足元中央から。右がプラス、上がマイナス）** で直接書きます |
| `scale` | 表示倍率（2倍サイズで描いたら 0.5） |
| `angle` | 画像の角度の微調整（度） |
| `restAngle` | （腕だけ）画像に描いた腕の向き（度）。0＝真横（前）、プラスで下向き。攻撃時は「振りかぶり −91.7° → 振り下ろし 45.8°」との差の分だけ回転します |
| `variants` | （任意）モーション名 → 差し替え画像のパス。ピボットなどは通常のパーツと同じ。詳しくは「5. 表情の差分」 |
| `mirror` など（翼だけ） | 片側の画像を反対側に反転して足す設定。詳しくは次の節 |

- パーツごとに切り抜いた（サイズがバラバラの）画像を使う場合の `offset` の目安（画面 px）：
  天使 … 翼 `{ x: -11, y: -98 }`・体 `{ x: 0, y: 0 }`・頭（首）`{ x: 3, y: -110 }`・腕（肩）`{ x: 11, y: -93 }`
  ルシファー … 翼 `{ x: -11, y: -104 }`・体 `{ x: 0, y: 0 }`・頭（首）`{ x: 3, y: -116 }`・腕（肩）`{ x: 11, y: -98 }`
  （仮の図形の関節と同じ位置です）
- **H キーで当たり判定を表示すると、各パーツのピボットが「＋」で表示されます**（色：翼＝水色、体＝黄、頭＝ピンク、腕＝オレンジ。画像のパーツは点線で画像の範囲も表示、仮の図形のパーツは「(仮)」付き）。
  翼の左右反転（`mirror: true`）がオンのときは、反対側のピボット「翼(鏡)」と、折り返しの中心線「鏡軸」も表示されます。
  倒れ続け（`downLoop`）のときも同じ表示になり、体のピボットには「呼吸」と付きます。画像がまだ無いパーツは「(無)」です。
  動かしながら、翼の付け根や肩がずれていないか確認して `pivot` を調整してください。

### 4. 翼の左右反転（片側だけ描く）

左右の翼を1枚の画像にまとめて描くと、羽ばたきで画像全体を同じ向きに傾けたとき、反対側の翼が逆方向に動いて見えてしまいます。
そのため **片側（右向きのキャラなら、キャンバスの左側に出ている3枚）だけを描き、反対側はゲームが左右反転して足す** 方式にしています。

- 反対側の翼は、体の中心線（`mirrorAxisX`、省略時は `canvasAnchor.x`）で折り返して置かれます。ピボットの x は `2 * mirrorAxisX - pivot.x` になります。
- 羽ばたきの角度は **逆向き** になります。両方の翼が、背中から同時に開いて同時に閉じます。
- キャラ全体を左向きにする左右反転（これまでどおりプログラム側で行います）とも組み合わせて使えます。
- 仮の図形の翼も、`mirror: true` なら同様に反対側が足されます。
- 初期設定は両キャラとも `mirror: true` です。`false` にすると、以前と同じく画像を1枚だけ描画します（左右6枚を1枚にまとめた画像を使う場合）。

`assets/config.js` の `parts.wings` で調整できます。

| 項目 | 初期値 | 説明 |
|---|---|---|
| `mirror` | `true` | `true` で反対側の翼を自動追加。`false` なら従来どおり1枚だけ |
| `mirrorAxisX` | 天使 140 / ルシファー 150（`canvasAnchor.x` と同じ） | 折り返しに使う体の中心線（キャンバス上の x、px）。キャンバスサイズを変えたときは、足元中央の x に合わせて変更してください |
| `mirrorOffset` | `{ x: 0, y: 0 }`（未設定） | 反転翼の位置の微調整（画面 px。足元中央から、右がプラス、上がマイナス） |
| `mirrorLayer` | `'same'` | `'same'` = 元の翼と同じ描画順（通常は体の後ろ）で、反転翼を先（奥）に描く。`'back'` = 反転翼だけ全パーツより一番奥に描く（元の翼を体の前に出したときなど） |
| `mirrorTint` | `0`（オフ） | 反転翼を暗くする量（0〜1）。奥の翼を少し暗くしたいときに使います |
| `mirrorScale` | `1`（オフ） | 反転翼の大きさ倍率。`0.95` のように小さくすると、奥の翼っぽく見えます |

位置がずれたときは、H キーで「翼」「翼(鏡)」「鏡軸」を表示して、`pivot` か `mirrorAxisX`、必要なら `mirrorOffset` を調整してください。

### 5. 表情の差分（被ダメ・攻撃など）

パーツごとに、特定のモーションのときだけ差し替える画像（差分）を置けます。**ピボット・位置・大きさ・角度は通常のパーツと同じもの**が使われるので、通常の頭と同じキャンバスサイズ・同じ位置に描いてください。

今の初期設定では、**被ダメ（`hurt`）・攻撃（`attack`）・勝利（`win`）のとき頭を差し替え**ます。攻撃中はアニメーションの最初から最後まで攻撃の表情になり、攻撃が終わると通常の頭に戻ります。勝利の表情は、そのラウンド（または試合）に勝った側が、ラウンド終了の待ち時間から結果画面まで使い続けます。

| 差分 | 天使 | ルシファー |
|---|---|---|
| 被ダメの頭 | `assets/sprites/angel/parts/head_hurt.png` | `assets/sprites/lucifer/parts/head_hurt.png` |
| 攻撃の頭 | `assets/sprites/angel/parts/head_attack.png` | `assets/sprites/lucifer/parts/head_attack.png` |
| 勝利の頭 | `assets/sprites/angel/parts/head_win.png` | `assets/sprites/lucifer/parts/head_win.png` |

`assets/config.js` の各パーツに `variants` を書きます（キーはモーション名です。攻撃はゲーム内部でも `attack` です）。

```js
head: {
  src: 'assets/sprites/angel/parts/head.png',
  pivot: { x: 145, y: 141 }, offset: 'auto', scale: 0.5, angle: 0,
  variants: {
    hurt: 'assets/sprites/angel/parts/head_hurt.png',
    attack: 'assets/sprites/angel/parts/head_attack.png',
    win: 'assets/sprites/angel/parts/head_win.png'
  }
}
```

- どのパーツにも、どのモーション名でも追加できます。たとえばあとから瞬きを足すときは、同じ頭に `idle` 用の差分を足す、といった書き方ができます。
- 差分画像が無い、または読み込めないときは、**いつもどおり通常のパーツ**（それも無ければ仮の図形）で描画します。ゲームはそのまま遊べます。

### 6. 動きの調整（`assets/config.js` の `motion`）

羽ばたきの振れ幅や揺れの大きさなどは `motion` で変えられます（両キャラ共通、角度は「度」）。仮の図形にも同じ値が使われます。

| 項目 | 初期値 | 説明 |
|---|---|---|
| `floatHeight` | 14 | 浮いている高さ（px） |
| `idleBob` / `moveBob` | 4 / 6 | 待機・移動の上下の揺れ幅（px） |
| `idleBobSpeed` / `moveBobSpeed` | 0.004 / 0.012 | 揺れの速さ |
| `idleFlapSpeed` / `moveFlapSpeed` | 0.004 / 0.014 | 羽ばたきの速さ |
| `wingFlap` | 20 | 羽ばたきの振れ幅（±度） |
| `moveLean` | 8.6 | 移動中の前傾（度） |
| `idleArm` | 34.4 | 待機・移動中の腕の角度（度） |
| `attackArmFrom` / `attackArmTo` | -91.7 / 45.8 | 攻撃の振りかぶり → 振り下ろしの角度（度） |
| `attackLeanFrom` / `attackLeanTo` | -8.6 / 17.2 | 攻撃中の体の傾き（度） |
| `hurtLean` / `hurtArm` / `hurtBob` | -20 / -34.4 / -4 | 被ダメののけぞり・腕の角度・上下のずれ |
| `slashFrom` | 0.82 | 攻撃アニメーションのどこから斬撃エフェクトを出すか（0〜1） |
| `downBreathAmp` | 0.02 | 倒れ続けの呼吸の拡縮幅（`downLoop.breathAmp` があればそちらが優先） |
| `downBreathPeriod` | 2000 | 倒れ続けの呼吸1回の長さ（ミリ秒。`downLoop.breathPeriod` が優先） |

攻撃や被ダメの長さ（ミリ秒）は、これまでどおり `states` の `duration` で変えます。

### 7. 倒れるモーション（瞬間 ＋ 倒れ続け）

倒れる動作は **2段階** です。

1. **倒れる瞬間（`down`）** … APNG または静止 PNG のコマ送りを **1回だけ** 再生します（コードで回転しません）。
2. **倒れ続け（`downLoop`）** … 再生が終わると自動で切り替わり、倒れたポーズの一枚絵（パーツ）を表示します。体だけがゆっくり呼吸し、頭・翼・腕は動きません。結果画面でも、負けた側はこのポーズのままです。

#### 7-1. 倒れる瞬間（APNG またはコマ送り）

- **コードで回転や角度の変更はしません。** 描いた絵のまま表示します（左向きのときの左右反転だけ行います）。
- 右向きで、キャラの足元（倒れたあとの床の位置）が **画像の下端中央** に来るように書き出してください。
  パーツと同じく **2倍サイズ** で描き、`scale: 0.5` で表示します。倒れた姿は横に長くなるので、キャンバスの横幅は広げても大丈夫です（例：天使 360×360px）。
- 位置の微調整は `states.down` の `offsetX` / `offsetY`（px）で行います。`scale: null` にすると `width × height` に合わせて伸縮します。
- `fadeOut: true` にすると、最後のほうでだんだん薄くなります（初期設定は `false` = 薄くしない）。
- 画像が無いときは、今までの仮の倒れ方（パーツ全体が後ろへ倒れる）になります。

`assets/config.js` の `states.down.type` で再生方法を切り替えます。

| `type` | 動き |
|---|---|
| `'apng'`（初期値） | `src` の APNG（`down.png`）を、`duration`（初期値 900ms）に合わせて1回再生 |
| `'frames'` | `frames` に書いた静止 PNG を、`frameMs`（初期値 100ms）ずつ順に再生。合計時間は `frameMs × 枚数` |
| 省略（`'auto'`） | `frames` が設定されて読み込めていればコマ送り、なければ APNG |

選んだ方が読み込めないときは、もう一方 → 仮の倒れ方、の順でフォールバックします。

APNG（`down.png`）が GitHub Pages でうまく動かないときは、3〜5枚程度の静止 PNG を置いて `type` を `'frames'` にするのが確実です。

```js
down: {
  type: 'frames',  // 'apng' から切り替えるだけ
  src: 'assets/sprites/angel/down.png',
  duration: 900, loop: false, scale: 0.5, offsetX: 0, offsetY: 0, fadeOut: false,
  frames: [
    'assets/sprites/angel/down_1.png',
    'assets/sprites/angel/down_2.png',
    'assets/sprites/angel/down_3.png',
    'assets/sprites/angel/down_4.png',
    'assets/sprites/angel/down_5.png'
  ],
  frameMs: 100
}
```

`type: 'frames'` で `frames` を省略すると、`assets/sprites/<キャラ>/down_1.png` … `down_5.png` を自動で探します（ある分だけ使います）。ファイル名は **すべて小文字の `.png`** にしてください（GitHub Pages では大文字と小文字が区別されます）。

#### 7-2. 倒れ続け（`downLoop`）

倒れたポーズを、立っているときとは **別のパーツセット** で描きます。初期設定は `mode: 'parts'` です。

| | おすすめキャンバス（表示の2倍） | 床（足元）の位置 |
|---|---|---|
| 天使 | **400×240px**（画面では 200×120px） | 下端中央（200, 240） |
| ルシファー | **420×260px**（画面では 210×130px） | 下端中央（210, 260） |

4枚とも同じキャンバスサイズで書き出し、`offset: 'auto'` のまま各パーツの `pivot` だけ合わせるのが簡単です。各パーツは任意で、置いたものだけ描画されます。

- **体だけ**が、ピボット（体の下端）を軸に縦方向へゆっくり拡縮します（呼吸）。
- **頭・翼・腕は完全に静止**します（羽ばたき・ふわふわ・腕振りはありません）。
- 翼は立っているときと同じく、`mirror: true` なら片側の画像を反対側に反転して足します（倒れ続けでは羽ばたかないので、開いた角度のまま対称に置かれます）。
- 1枚も画像が無いときは、倒れる瞬間（APNG／コマ送り）の **最後のコマをそのまま表示し続けます**。ゲームは壊れません。

`mode: 'single'` にすると、`down/loop.png`（または `downLoop.src`）の1枚絵を使い、画像全体に同じ呼吸（下端中央を軸にした縦の拡縮）をかけます。

```js
downLoop: {
  mode: 'parts',          // 'parts' または 'single'
  // src: 'assets/sprites/angel/down/loop.png',  // mode: 'single' のとき
  canvasAnchor: { x: 200, y: 240 },
  order: ['wings', 'body', 'head', 'arm'],
  breathAmp: 0.02,        // 体の呼吸の拡縮幅（scaleY の振幅。0.02 = ±2%）
  breathPeriod: 2000,     // 呼吸1回の長さ（ミリ秒）
  wings: { src: 'assets/sprites/angel/down/wings.png', pivot: { x: 140, y: 160 }, offset: 'auto', scale: 0.5, angle: 0, mirror: true, mirrorAxisX: 200 },
  body:  { src: 'assets/sprites/angel/down/body.png',  pivot: { x: 200, y: 240 }, offset: 'auto', scale: 0.5, angle: 0 },
  head:  { src: 'assets/sprites/angel/down/head.png',  pivot: { x: 200, y: 105 }, offset: 'auto', scale: 0.5, angle: 0 },
  arm:   { src: 'assets/sprites/angel/down/arm.png',   pivot: { x: 280, y: 200 }, offset: 'auto', scale: 0.5, angle: 0 }
}
```

| 項目 | 初期値 | 説明 |
|---|---|---|
| `mode` | `'parts'` | `'parts'` = `down/` の4パーツ、`'single'` = `down/loop.png` の1枚絵 |
| `src` | （single 時は `down/loop.png`） | 1枚絵モードの画像パス |
| `canvasAnchor` | 天使 (200, 240) / ルシファー (210, 260) | キャンバス内の床（下端中央） |
| `breathAmp` | 0.02 | 体の縦方向の拡縮幅。大きくすると呼吸が目立ちます |
| `breathPeriod` | 2000 | 呼吸1回の長さ（ミリ秒） |
| 各パーツ | — | 立っているときの `parts` と同じ項目（`src` / `pivot` / `offset` / `scale` / `angle`、翼は `mirror*` も可） |

H キーを押すと、倒れ続けのパーツでもピボット（＋）と画像の範囲、翼の鏡軸が表示されます。体のピボットには「呼吸」と付きます。位置がずれたら `pivot` や `canvasAnchor` を調整してください。

### 8. （参考）APNG モード

キャラごとに `mode: 'apng'` にすると、以前の方式（モーションごとの APNG を丸ごと再生）になります。

| モーション | 天使 | ルシファー | 再生 |
|---|---|---|---|
| 待機 | `assets/sprites/angel/idle.png` | `assets/sprites/lucifer/idle.png` | ループ |
| 移動（浮遊） | `assets/sprites/angel/move.png` | `assets/sprites/lucifer/move.png` | ループ |
| 攻撃 | `assets/sprites/angel/attack.png` | `assets/sprites/lucifer/attack.png` | 1回（最後のコマで判定） |
| 被ダメ | `assets/sprites/angel/hurt.png` | `assets/sprites/lucifer/hurt.png` | 1回 |
| 倒れる瞬間 | `assets/sprites/angel/down.png` | `assets/sprites/lucifer/down.png` | 1回（終わると倒れ続けへ） |
| 勝利（任意） | `assets/sprites/angel/win.png` | `assets/sprites/lucifer/win.png` | ループ |

- 画像は `width × height` に伸縮して表示します。左向きで描いた場合は `baseFacing` を `'left'` にしてください。
- 5つのモーションは、同じキャンバスサイズで書き出すことをおすすめします。

### 共通の設定（当たり判定など）

- `duration`（ミリ秒）は **ゲーム内でのモーションの長さ** です。
  - 攻撃：この時間が終わる瞬間に攻撃判定が出ます。速度アップ中は `duration ÷ 1.3` になり、動きも速くなります。
  - 被ダメ：この時間だけ操作できません。
- `bodyInset`：キャラの矩形（`width × height`）の端から体の当たり判定までの余白。左右反転時は自動で左右が入れ替わります。
- `attackBox`：キャラの中心から前方向に `near` px 離れた所から、幅 `reach` px の範囲が攻撃判定です。`top` / `bottom` は足元からの高さ（px）です。
- H キーで判定を表示しながら、画像に合わせて数値を調整してください。

> 技術メモ：canvas に APNG を `<img>` のまま描画すると、ブラウザによっては1コマ目しか描画されません。
> そのため、このゲームでは APNG を自前で解析して全コマを展開しています（`js/sprites.js`）。
> コマ数×画像サイズ分のメモリを使うので、APNG の画像サイズは表示サイズの 1〜2 倍程度までにするのがおすすめです。
> 画像が見つからないときは、ブラウザの開発者ツールに 404 が表示されますが、ゲームは仮の図形で動きます（問題ありません）。

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
- パーツモードでは、画像を置いていないパーツは仮の図形で描く（画像と図形を混ぜて表示できる）。
- 翼は片側だけ描き、反対側は左右反転して自動で足す（`parts.wings.mirror`）。6枚を1枚にまとめた画像を使う場合は `false` にする。

- 倒れる APNG は、初期設定では最後に薄くならない（`fadeOut`）。
- 倒れる動作は「瞬間（APNG またはコマ送りを1回）」のあと「倒れ続け（体だけ呼吸）」に切り替わる。倒れ続けの画像が無いときは最後のコマを保持する。
- ラウンド（または試合）に勝った側は、終了の待ち時間から結果画面まで勝利ポーズ（`win`、待機と同じ動き＋頭の差分）になる。
