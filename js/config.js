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
  attackCooldown: 120,     // 攻撃終了後、次の攻撃までの待ち時間（ミリ秒）
  invulnerableMs: 700,     // 被ダメ後の無敵時間（ミリ秒）
  knockback: 70,           // 被ダメ時に後ろへ下がる距離（px）
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
    thinkInterval: 180,    // 行動を考え直す間隔（ミリ秒）
    reactionDelay: 160,    // 攻撃判断の反応の遅れ（ミリ秒）
    attackChance: 0.55,    // 射程内にいるとき攻撃する確率（判断ごと）
    attackCooldownMin: 450,// NPC の攻撃後の追加クールダウン（ミリ秒）
    attackCooldownMax: 1100,
    retreatChance: 0.18,   // 判断ごとに一時的に下がる確率
    retreatMs: 500,        // 下がる時間（ミリ秒）
    preferredGap: 70,      // 相手との横の距離の目安（px, 体の端同士）
    speedScale: 0.9        // NPC の移動速度倍率（1 = プレイヤーと同じ）
  },

  // ---- 演出 ----
  roundIntroMs: 1600,      // 「ROUND 1」「FIGHT!」表示の時間
  koPauseMs: 2000,         // KO 後、次のラウンドへ進むまでの時間
  debugHitboxes: false     // 起動時から当たり判定を表示するか（H キーで切り替え）
};
