/*
 * ゲームバランス設定（テストプレイで調整する値はここにまとめています）
 */
window.GAME_CONFIG = {
  // ---- ライフ・ラウンド ----
  maxLife: 5,              // ライフの数（5回当てれば勝ち）
  rounds: 2,               // 基本ラウンド数（2ラウンド制）
  tiebreakerRound: true,   // 1勝1敗になったら3ラウンド目（決着ラウンド）を行うか。false なら引き分け
  roundTimeLimit: 0,       // ラウンドの制限時間（秒）。0 = 無制限。時間切れはライフが多い方の勝ち

  // ---- 速度アップ（バフ） ----
  buffs: {
    angel:   { condition: 'lifeAtMost',  threshold: 2, moveSpeed: 1.3, attackSpeed: 1.3 }, // ライフ2以下で発動
    lucifer: { condition: 'lifeAtLeast', threshold: 4, moveSpeed: 1.3, attackSpeed: 1.3 }  // ライフ4以上で発動
  },

  // ---- 移動 ----
  moveSpeedX: 260,         // 横方向の移動速度（px/秒）
  moveSpeedY: 170,         // 奥行き方向の移動速度（px/秒）
  field: { left: 60, right: 900, top: 300, bottom: 520 }, // 足元が動ける範囲（Y が奥行き）
  autoFaceOpponent: true,
  separation: 0.8,         // 同じ奥行きにいるとき体が重ならないように保つ距離（体の幅に対する割合。0 = すり抜け可）  // true = 常に相手の方を向く（格闘ゲーム風）／ false = 移動方向を向く

  // ---- 攻撃・被ダメ ----
  depthTolerance: 36,      // 攻撃が当たる奥行き(Y)の差の許容値（px）
  attackCooldown: 120,     // 攻撃終了後、次の攻撃までの待ち時間（ミリ秒）。プレイヤーと NPC で共通
  whiffRecoveryMs: 350,    // 攻撃を外したときの硬直（ミリ秒）。この間は移動も攻撃もできない（両者共通）
  whiffLeanDeg: 7,         // 空振り硬直中に前へつんのめる角度（度）。0 で演出なし
  invulnerableMs: 700,     // 被ダメ後の無敵時間（ミリ秒）
  knockback: 140,          // 被ダメ時に後ろへ下がる最低距離（px）
  knockbackReachMargin: 30,// 相手の攻撃が届く範囲より、さらにこの距離だけ外まで押し出す（px）。連続で当てられないようにするため
  wallPushbackRatio: 1.0,  // 壁際で押し出しきれなかった分を、攻撃した側を押し戻す割合（0 = 押し戻さない、1 = 足りない分すべて）
  hitboxFlashMs: 120,      // デバッグ表示で攻撃判定を表示しておく時間（ミリ秒）

  // ---- スマホ操作 ----
  touch: {
    tapMaxMove: 14,        // これ以下の指の移動量ならタップ（攻撃）とみなす（px, 画面上）
    tapMaxTime: 250,       // これ以下の時間ならタップ（ミリ秒）
    dragThreshold: 18,     // これ以上動かしたら移動入力（押しっぱなしで移動し続ける）
    flickMoveMs: 320       // フリック後に指を離してから移動を続ける時間（ミリ秒）
  },

  // ---- NPC（敵）の AI ----
  ai: {
    speedScale: 1,         // NPC の移動速度倍率（1 = プレイヤーと同じ）
    thinkInterval: 180,    // 行動を考え直す間隔（ミリ秒）
    decisionJitterMs: 60,  // 判断のばらつき（ミリ秒）。攻撃のタイミングにこの範囲のランダムな遅れが少し入る
    reactionDelay: 160,    // 自分から攻撃するときの反応の遅れ（ミリ秒）
    attackChance: 0.5,     // 射程内にいるとき自分から攻撃する確率（判断ごと）

    // 隙を突く（プレイヤーの空振り・攻撃後の待ち時間を狙う）
    punishChance: 0.85,    // 隙を見つけたとき反撃に行く確率（プレイヤーの攻撃1回ごと）
    punishReactionMs: 80,  // 隙を見つけてから攻撃を出すまでの遅れ（ミリ秒）
    punishLungeDist: 90,   // 射程の外でも、この距離（px）までなら踏み込んで反撃する

    // 間合いの駆け引き
    spacingMargin: 24,     // プレイヤーの攻撃が届く距離より、どれだけ外側で待つか（px）
    feintChance: 0.3,      // 判断ごとに、間合いへ一瞬踏み込んで攻撃を誘う確率
    feintDepth: 22,        // 誘いのときにプレイヤーの射程へ入り込む深さ（px）
    feintMs: 260,          // 誘いで踏み込んでいる時間（ミリ秒）
    backstepChance: 0.5,   // 射程内でプレイヤーが攻撃を振り始めたとき、射程の外へ下がる確率
    dodgeChance: 0.25,     // プレイヤーの攻撃を奥行き方向へかわす確率
    engageChance: 0.12,    // 判断ごとに、自分から踏み込んで攻撃しに行く確率（受け身になりすぎないように）
    engageMs: 800,         // 踏み込みを続ける最大時間（ミリ秒）
    cornerMargin: 70,      // 背中側の壁までこの距離（px）以下なら「追い詰められた」とみなし、奥行き方向へ回り込む
    sidestepMs: 520        // 回り込みを続ける時間（ミリ秒）
  },

  // ---- 演出 ----
  roundIntroMs: 1600,      // 「ROUND 1」「FIGHT!」表示の時間
  koPauseMs: 2000,         // KO 後、次のラウンドへ進むまでの時間
  debugHitboxes: false     // 起動時から当たり判定を表示するか（H キーで切り替え）
};
