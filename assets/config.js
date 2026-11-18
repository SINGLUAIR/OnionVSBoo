/*
 * スプライト（画像）設定
 * ------------------------------------------------------------
 * 画像ファイルが存在しない／読み込めない場合は、自動で仮の図形（プレースホルダー）で描画されます。
 *
 * ■ mode（キャラごと）
 *   'parts' … パーツモード（初期設定）。翼・体・頭・腕と剣の4枚の PNG を、ゲーム側の動きで動かします。
 *             倒れる瞬間だけは down.png（APNG）または静止 PNG のコマ送りを再生します（角度は変えません）。
 *             倒れたあとは downLoop（倒れ続け）に切り替わり、体だけが呼吸します。
 *   'apng'  … APNG モード。モーションごとの APNG（idle / move / attack / hurt / down）を丸ごと再生します。
 *
 * ■ states（モーションの長さなど。どちらのモードでも使います）
 *  src      : APNG のパス（index.html からの相対パス）。パーツモードでは down（倒れる瞬間）の src だけを使います。
 *  duration : ゲーム内でのアニメーションの長さ（ミリ秒）。
 *             APNG の各コマは、この長さにぴったり収まるよう伸縮して再生されます
 *             （APNG に書き出した長さと同じ値にすると、書き出したとおりの速さになります）。
 *             攻撃(attack)はこの時間の「最後」に攻撃判定が出ます。
 *             速度アップ中は duration ÷ 攻撃速度倍率 になり、アニメーションも速く再生されます。
 *             被ダメ(hurt)はこの時間だけ操作不能になります。
 *  loop     : true = ループ再生（待機・移動・勝利・倒れ続け）、false = 1回再生（攻撃・被ダメ・倒れる瞬間）
 *  （down だけの追加項目・パーツモード用）
 *  type     : 'apng'（初期値）= down.png の APNG を再生。'frames' = 静止 PNG のコマ送りを再生。
 *             選んだ方が読めないときは、もう一方 → 仮の倒れ方、の順でフォールバックします。
 *             type を省略（'auto'）した場合は、frames が設定されて読み込めたらコマ送り、なければ APNG です。
 *  frames   : 倒れる瞬間の静止 PNG のパス配列（最大5枚程度）。type: 'frames' のときに使います。
 *             type: 'frames' で frames を省略すると、assets/sprites/<c>/down_1.png … down_5.png を探します。
 *  frameMs  : コマ送りの1枚あたりの表示時間（ミリ秒、初期値 100）。合計時間は frameMs × 枚数になります。
 *  scale    : 倒れる APNG／コマ送りを「画像の実寸 × scale」で表示（0.5 = 2倍サイズで描いた画像を半分で表示）。
 *             null にすると width × height に合わせて伸縮します。
 *  offsetX / offsetY : 倒れる画像の表示位置の微調整（px）。画像の下端中央がキャラの足元に来ます。
 *  fadeOut  : true にすると、倒れる画像の最後のほうでだんだん薄くなります（初期設定 false）。
 *
 * ■ parts（パーツモード用・立っているとき）
 *  canvasAnchor : パーツ画像を「全部同じサイズのキャンバス」で書き出したときの、キャンバス内の足元中央の位置（px）。
 *                 offset: 'auto' のパーツは、ピボットとこの位置の差から自動で配置されます。
 *  order        : 描画順（先に書いたものが奥）。
 *  各パーツ（wings = 翼、body = 体、head = 頭、arm = 腕と剣）
 *    src       : 画像のパス（背景が透明な PNG、右向きで描く）
 *    pivot     : 画像の中の「回転の軸／取り付け位置」（画像の左上からの px）
 *                翼 = 背中の付け根、体 = 足元中央、頭 = 首、腕 = 肩
 *    offset    : 'auto' か { x, y }。ピボットを置くキャラ上の位置（画面 px、足元中央からの距離。上がマイナス）
 *    scale     : 表示倍率（0.5 = 2倍サイズで描いた画像を半分で表示）
 *    angle     : 画像の角度の微調整（度）
 *    restAngle : （腕だけ）画像に描いた腕の角度（度）。0 = 真横（前）、プラスで下向き。
 *                待機中の腕の角度（motion.idleArm）と同じにすると、待機中は描いたとおりの角度で表示されます。
 *    variants  : （任意）モーション名 → 差し替え画像のパス。ピボット・位置・大きさ・角度は通常のパーツと同じです
 *                （同じキャンバスサイズで描いてください）。
 *                例: { hurt: 'assets/sprites/angel/parts/head_hurt.png',
 *                      attack: 'assets/sprites/angel/parts/head_attack.png',
 *                      win: 'assets/sprites/angel/parts/head_win.png' }
 *                どのパーツにも、どのモーション名でも追加できます。画像が無い／読めないときは
 *                通常のパーツ（それも無ければ仮の図形）で描画します。
 *    （翼だけの追加項目：片側3枚だけ描き、反対側は左右反転して自動で足す）
 *    mirror       : true なら、同じ画像を体の中心線で左右反転して反対側にも描く。羽ばたきの角度は逆向き
 *                   （両側が同時に開いて同時に閉じる）。false または省略なら従来どおり1枚だけ。
 *    mirrorAxisX  : 折り返しに使う体の中心線（キャンバス上の x、px）。省略すると canvasAnchor.x。
 *                   反転翼のピボットは pivot.x' = 2 * mirrorAxisX - pivot.x。
 *    mirrorOffset : （任意）反転翼の位置の微調整 { x, y }（画面 px、足元中央から。右がプラス、上がマイナス）
 *    mirrorLayer  : 'same'（初期値）= 元の翼と同じ描画順（通常は体の後ろ）で、反転翼を先（奥）に描く
 *                   'back' = 反転翼だけ全パーツより一番奥に描く（元の翼を体の前に出したときなど）
 *    mirrorTint   : （任意）反転翼を暗くする量（0〜1）。初期値 0（変更しない）
 *    mirrorScale  : （任意）反転翼の大きさ倍率。初期値 1。1より小さくすると奥の翼っぽく見える
 *
 * ■ downLoop（倒れたあとの「倒れ続け」。立っているときの parts とは別セット）
 *  mode         : 'parts'（初期値）= down/ 以下の4パーツ。'single' = down/loop.png の1枚絵。
 *  src          : mode: 'single' のときの画像パス（省略時は assets/sprites/<c>/down/loop.png）。
 *  canvasAnchor / order / 各パーツ（src, pivot, offset, scale, angle, 翼の mirror*）
 *               : parts と同じ書き方。倒れたポーズで描いた画像を置きます（コードで回転しません）。
 *  breathAmp    : 体の呼吸の拡縮幅（scaleY の振幅。初期値 0.02 = ±2%）
 *  breathPeriod : 呼吸1回の長さ（ミリ秒、初期値 2000）
 *  体だけがピボット（体の下端）を軸に縦方向へ拡縮します。頭・翼・腕は完全に静止します。
 *  （体パーツ、または downLoop に書ける追加項目。省略時は従来どおり画像全体を縦に拡縮）
 *  breathRegion : 'full'（初期値）/ 'upper' / 'lower' / 'left' / 'right'
 *                 呼吸する側。境目を軸に拡縮するので、静止側とのあいだに隙間は出ません。
 *  breathSplit  : 境目の位置。0〜1 なら画像サイズに対する比率、1より大きい値は画像上の px。
 *                 upper/lower では Y、left/right では X。省略時は 0.5。
 *  breathSplitX / breathSplitY : もう一方の軸の切り出し（px または比率）。
 *                 例: 仰向けで脚が右にあるとき、breathRegion:'upper' に breathSplitX を足すと
 *                 胸側（左・上）だけが動き、脚は完全に静止します。
 *  breathXSide  : breathSplitX を使うとき、動かす側 'left'（初期値）または 'right'
 *  breathYSide  : breathSplitY を使うとき、動かす側 'upper'（初期値）または 'lower'
 *  画像が1枚も無いときは、倒れる瞬間の最後のコマをそのまま表示し続けます。
 */
window.ASSET_CONFIG = {
  // 画像内のキャラクターが向いている方向（'right' または 'left'）。APNG モードで使います。
  // パーツ画像と倒れる APNG／コマ送り、倒れ続けの画像は右向きで描いてください。
  baseFacing: 'right',

  // パーツモード／仮の図形の動き（両キャラ共通。角度は「度」）
  motion: {
    floatHeight: 14,       // 浮いている高さ（影から足元まで, px）
    idleBob: 4,            // 待機：上下の揺れ幅（px）
    idleBobSpeed: 0.004,   // 待機：揺れの速さ
    idleFlapSpeed: 0.004,  // 待機：羽ばたきの速さ
    moveBob: 6,            // 移動：上下の揺れ幅（px）
    moveBobSpeed: 0.012,   // 移動：揺れの速さ
    moveFlapSpeed: 0.014,  // 移動：羽ばたきの速さ
    moveLean: 8.6,         // 移動：前傾（度）
    wingFlap: 20,          // 羽ばたきの振れ幅（度、±）
    idleArm: 34.4,         // 待機・移動中の腕の角度（度。0 = 真横（前）、プラスで下向き）
    attackArmFrom: -91.7,  // 攻撃：振りかぶったときの腕の角度（度）
    attackArmTo: 45.8,     // 攻撃：振り下ろした後の腕の角度（度）
    attackLeanFrom: -8.6,  // 攻撃：最初の体の傾き（度。マイナス = 後ろへ反る）
    attackLeanTo: 17.2,    // 攻撃：最後の体の傾き（度）
    hurtLean: -20,         // 被ダメ：のけぞり（度）
    hurtBob: -4,           // 被ダメ：上下のずれ（px）
    hurtArm: -34.4,        // 被ダメ：腕の角度（度）
    slashFrom: 0.82,       // 攻撃：アニメーションのこの割合から斬撃エフェクトを表示（0〜1）
    downBreathAmp: 0.02,   // 倒れ続け：体の呼吸の拡縮幅（downLoop.breathAmp が優先）
    downBreathPeriod: 2000 // 倒れ続け：呼吸1回の長さ（ミリ秒。downLoop.breathPeriod が優先）
  },

  characters: {
    angel: {
      name: '熾天使ルシファー',
      mode: 'parts',
      // 画面上のキャラの大きさ（px, 960x540 基準）。当たり判定や倒れる APNG（scale: null のとき）の基準になります。
      width: 140,
      height: 180,
      // 体の当たり判定（キャラの矩形に対する内側の余白、px）。0 なら矩形全体が当たり判定。
      bodyInset: { left: 30, right: 30, top: 20, bottom: 6 },
      // 攻撃判定（向いている側にのみ出ます）。
      //  near : キャラ中心から前方向へ何pxの位置から判定が始まるか
      //  reach: 判定の横幅（px）
      //  top/bottom: 足元からの高さ範囲（px）
      attackBox: { near: 10, reach: 90, top: 150, bottom: 40 },
      // パーツ画像（おすすめ：4枚とも 280×360px の同じキャンバスで、足元中央を下端中央にして書き出す）
      parts: {
        canvasAnchor: { x: 140, y: 360 },
        order: ['wings', 'body', 'head', 'arm'],
        wings: {
          src: 'assets/sprites/angel/parts/wings.png', pivot: { x: 119, y: 163 }, offset: 'auto', scale: 0.5, angle: 0,
          // 片側（左）の翼だけ描き、反対側は左右反転して自動で足す。羽ばたきは逆向き。
          mirror: true,
          mirrorAxisX: 140,            // 体の中心線（キャンバス上の x）。省略すると canvasAnchor.x
          // mirrorOffset: { x: 0, y: 0 }, // 反転翼の位置の微調整（画面 px）
          // mirrorLayer: 'same',       // 'same' = 翼と同じ順、'back' = 反転翼を一番奥に
          // mirrorTint: 0,             // 0〜1、反転翼を暗くする（0 = しない）
          // mirrorScale: 1             // 反転翼の大きさ（1より小さくすると奥の翼っぽい）
        },
        body:  { src: 'assets/sprites/angel/parts/body.png',  pivot: { x: 140, y: 360 }, offset: 'auto', scale: 0.5, angle: 0 },
        head:  { src: 'assets/sprites/angel/parts/head.png',  pivot: { x: 145, y: 141 }, offset: 'auto', scale: 0.5, angle: 0, variants: { hurt: 'assets/sprites/angel/parts/head_hurt.png', attack: 'assets/sprites/angel/parts/head_attack.png', win: 'assets/sprites/angel/parts/head_win.png' } },
        arm:   { src: 'assets/sprites/angel/parts/arm.png',   pivot: { x: 161, y: 175 }, offset: 'auto', scale: 0.5, angle: 0, restAngle: 34.4 }
      },
      // 倒れたあとのパーツ（400×400px のキャンバス全体で書き出し。倒れる APNG と同じキャンバスで、下端中央が床）
      // 各パーツは描いた位置のまま重なるよう、ピボットも同じキャンバス上の座標で指定。
      downLoop: {
        mode: 'parts',                 // 'parts' = 下の4パーツ、'single' = src（down/loop.png）の1枚絵
        // src: 'assets/sprites/angel/down/loop.png',
        canvasAnchor: { x: 200, y: 400 },
        order: ['wings', 'body', 'arm', 'head'],
        breathAmp: 0.08,               // 胸だけの呼吸なので、全体拡縮より少し大きめ（画面上で約 2〜3px）
        breathPeriod: 2000,            // 呼吸1回の長さ（ミリ秒）
        wings: {
          src: 'assets/sprites/angel/down/wings.png', pivot: { x: 200, y: 300 }, offset: 'auto', scale: 0.5, angle: 0
          // 倒れ絵の翼は両側が1枚に描いてあるので、mirror はしない
        },
        body:  {
          src: 'assets/sprites/angel/down/body.png',  pivot: { x: 180, y: 280 }, offset: 'auto', scale: 0.5, angle: 0,
          // 仰向け（頭が左・脚が右）。胸＝画像の左上だけを、境目を軸に上下へ拡縮。脚とスカート下は静止
          breathRegion: 'upper',
          breathSplit: 280,            // 胸とスカート／脚の境（画像上の Y、px）
          breathSplitX: 248            // 胴と脚の境（この X より右は動かさない）
        },
        head:  { src: 'assets/sprites/angel/down/head.png',  pivot: { x: 106, y: 279 }, offset: 'auto', scale: 0.5, angle: 0 },
        arm:   { src: 'assets/sprites/angel/down/arm.png',   pivot: { x: 146, y: 295 }, offset: 'auto', scale: 0.5, angle: 0 }
      },
      states: {
        idle:     { src: 'assets/sprites/angel/idle.png',   duration: 1000, loop: true },
        move:     { src: 'assets/sprites/angel/move.png',   duration: 600,  loop: true },
        attack:   { src: 'assets/sprites/angel/attack.png', duration: 420,  loop: false },
        hurt:     { src: 'assets/sprites/angel/hurt.png',   duration: 400,  loop: false },
        win:      { src: 'assets/sprites/angel/win.png',    duration: 1000, loop: true },
        downLoop: { duration: 2000, loop: true },
        down:     {
          type: 'apng',                // 'apng' | 'frames'（切り替えるだけ）
          src: 'assets/sprites/angel/down.png',
          duration: 900, loop: false, scale: 0.5, offsetX: 0, offsetY: 0, fadeOut: false
          // コマ送りに切り替えるとき：type を 'frames' にして、次の行のコメントを外す
          // , frames: ['assets/sprites/angel/down_1.png', 'assets/sprites/angel/down_2.png', 'assets/sprites/angel/down_3.png', 'assets/sprites/angel/down_4.png', 'assets/sprites/angel/down_5.png'], frameMs: 100
        }
      }
    },
    lucifer: {
      name: '堕天使ルシファー',
      mode: 'parts',
      width: 150,
      height: 190,
      bodyInset: { left: 32, right: 32, top: 20, bottom: 6 },
      attackBox: { near: 10, reach: 95, top: 160, bottom: 40 },
      // パーツ画像（おすすめ：4枚とも 300×380px の同じキャンバスで、足元中央を下端中央にして書き出す）
      parts: {
        canvasAnchor: { x: 150, y: 380 },
        order: ['wings', 'body', 'head', 'arm'],
        wings: {
          src: 'assets/sprites/lucifer/parts/wings.png', pivot: { x: 127, y: 173 }, offset: 'auto', scale: 0.5, angle: 0,
          // 片側（左）の翼だけ描き、反対側は左右反転して自動で足す。羽ばたきは逆向き。
          mirror: true,
          mirrorAxisX: 150,
          // mirrorOffset: { x: 0, y: 0 },
          // mirrorLayer: 'same',
          // mirrorTint: 0,
          // mirrorScale: 1
        },
        body:  { src: 'assets/sprites/lucifer/parts/body.png',  pivot: { x: 150, y: 380 }, offset: 'auto', scale: 0.5, angle: 0 },
        head:  { src: 'assets/sprites/lucifer/parts/head.png',  pivot: { x: 156, y: 149 }, offset: 'auto', scale: 0.5, angle: 0, variants: { hurt: 'assets/sprites/lucifer/parts/head_hurt.png', attack: 'assets/sprites/lucifer/parts/head_attack.png', win: 'assets/sprites/lucifer/parts/head_win.png' } },
        arm:   { src: 'assets/sprites/lucifer/parts/arm.png',   pivot: { x: 173, y: 184 }, offset: 'auto', scale: 0.5, angle: 0, restAngle: 34.4 }
      },
      // 倒れたあとのパーツ（400×400px のキャンバス全体で書き出し。倒れる APNG と同じキャンバスで、下端中央が床）
      // 体と頭は描いた位置のまま重なるよう、ピボットも同じキャンバス上の座標で指定。腕・翼はこのポーズでは無し
      downLoop: {
        mode: 'parts',
        // src: 'assets/sprites/lucifer/down/loop.png',
        canvasAnchor: { x: 200, y: 400 },
        order: ['wings', 'body', 'head', 'arm'],
        breathAmp: 0.05,      // 体（マント）の呼吸の拡縮幅（±5%）。体の下端を軸に上へ膨らむ
        breathPeriod: 2000,
        wings: {
          src: 'assets/sprites/lucifer/down/wings.png', pivot: { x: 145, y: 170 }, offset: 'auto', scale: 0.5, angle: 0,
          mirror: true,
          mirrorAxisX: 210
        },
        body:  { src: 'assets/sprites/lucifer/down/body.png',  pivot: { x: 180, y: 293 }, offset: 'auto', scale: 0.5, angle: 0 }, // ピボット = 体（マント）の下端。ここを軸に呼吸
        head:  { src: 'assets/sprites/lucifer/down/head.png',  pivot: { x: 206, y: 364 }, offset: 'auto', scale: 0.5, angle: 0 }, // 頭は床の上で静止
        arm:   { src: 'assets/sprites/lucifer/down/arm.png',   pivot: { x: 295, y: 215 }, offset: 'auto', scale: 0.5, angle: 0 }
      },
      states: {
        idle:     { src: 'assets/sprites/lucifer/idle.png',   duration: 1000, loop: true },
        move:     { src: 'assets/sprites/lucifer/move.png',   duration: 600,  loop: true },
        attack:   { src: 'assets/sprites/lucifer/attack.png', duration: 460,  loop: false },
        hurt:     { src: 'assets/sprites/lucifer/hurt.png',   duration: 400,  loop: false },
        win:      { src: 'assets/sprites/lucifer/win.png',    duration: 1000, loop: true },
        downLoop: { duration: 2000, loop: true },
        down:     {
          type: 'apng',
          src: 'assets/sprites/lucifer/down.png',
          duration: 900, loop: false, scale: 0.5, offsetX: 0, offsetY: 0, fadeOut: false,
          sinkY: 18, sinkFrom: 0.6 // 倒れる途中（60%〜最後）で絵を少しずつ18px下げ、倒れたポーズを床に接地させる（倒れ続けも同じだけ下がる）
          // , frames: ['assets/sprites/lucifer/down_1.png', 'assets/sprites/lucifer/down_2.png', 'assets/sprites/lucifer/down_3.png', 'assets/sprites/lucifer/down_4.png', 'assets/sprites/lucifer/down_5.png'], frameMs: 100
        }
      }
    }
  }
};
