/*
 * スプライト（APNG）設定
 * ------------------------------------------------------------
 * SpriteStudio などで書き出した APNG をここに登録します。
 * ファイルが存在しない／読み込めない場合は、自動で仮の図形（プレースホルダー）で描画されます。
 *
 *  src      : 画像ファイルのパス（index.html からの相対パス）
 *  duration : ゲーム内でのアニメーションの長さ（ミリ秒）。
 *             APNG の各コマは、この長さにぴったり収まるよう伸縮して再生されます
 *             （APNG に書き出した長さと同じ値にすると、書き出したとおりの速さになります）。
 *             攻撃(attack)はこの時間の「最後（最後のコマ）」に攻撃判定が出ます。
 *             速度アップ中は duration ÷ 攻撃速度倍率 になり、アニメーションも速く再生されます。
 *             被ダメ(hurt)はこの時間だけ操作不能になります。
 *  loop     : true = ループ再生（待機・移動）、false = 1回再生（攻撃・被ダメ・倒れる。最後のコマで止まる）
 */
window.ASSET_CONFIG = {
  // 画像内のキャラクターが向いている方向（'right' または 'left'）。反対を向くときは左右反転して描画します。
  baseFacing: 'right',

  characters: {
    angel: {
      name: '天使',
      // 画面上に描画するサイズ（px, 960x540 基準）。画像の比率に合わせてください。
      width: 140,
      height: 180,
      // 体の当たり判定（画像の矩形に対する内側の余白、px）。0 なら画像全体が当たり判定。
      bodyInset: { left: 30, right: 30, top: 20, bottom: 6 },
      // 攻撃判定（向いている側にのみ出ます）。
      //  near : キャラ中心から前方向へ何pxの位置から判定が始まるか
      //  reach: 判定の横幅（px）
      //  top/bottom: 足元からの高さ範囲（px）
      attackBox: { near: 10, reach: 90, top: 150, bottom: 40 },
      states: {
        idle:   { src: 'assets/sprites/angel/idle.png',   duration: 1000, loop: true },
        move:   { src: 'assets/sprites/angel/move.png',   duration: 600,  loop: true },
        attack: { src: 'assets/sprites/angel/attack.png', duration: 420,  loop: false },
        hurt:   { src: 'assets/sprites/angel/hurt.png',   duration: 400,  loop: false },
        down:   { src: 'assets/sprites/angel/down.png',   duration: 900,  loop: false }
      }
    },
    lucifer: {
      name: '堕天使ルシファー',
      width: 150,
      height: 190,
      bodyInset: { left: 32, right: 32, top: 20, bottom: 6 },
      attackBox: { near: 10, reach: 95, top: 160, bottom: 40 },
      states: {
        idle:   { src: 'assets/sprites/lucifer/idle.png',   duration: 1000, loop: true },
        move:   { src: 'assets/sprites/lucifer/move.png',   duration: 600,  loop: true },
        attack: { src: 'assets/sprites/lucifer/attack.png', duration: 460,  loop: false },
        hurt:   { src: 'assets/sprites/lucifer/hurt.png',   duration: 400,  loop: false },
        down:   { src: 'assets/sprites/lucifer/down.png',   duration: 900,  loop: false }
      }
    }
  }
};
