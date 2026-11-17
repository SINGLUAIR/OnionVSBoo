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
  attackHitAt: 0.35,       // 攻撃判定が出るタイミング（攻撃モーション全体に対する割合 0〜1）。0.35 なら天使は約0.15秒で判定。
                           // キャラごとに変えるときは assets/config.js の states.attack.hitAt に書く（そちらが優先）
                           // 下の attackWindupMs の方が長い場合は、判定は attackWindupMs まで遅れる（振り抜きの長さは保つ）
  slashFollowsHit: true,   // true = 斬撃エフェクトを判定のタイミングから表示する（false なら motion.slashFrom の位置から）
  whiffRecoveryMs: 250,    // 攻撃を外したときの硬直（ミリ秒）。攻撃モーションが終わってから始まる。この間は移動も攻撃もできない（両者共通）
  whiffLeanDeg: 7,         // 空振り硬直中に前へつんのめる角度（度）。0 で演出なし
  invulnerableMs: 700,     // 被ダメ後の無敵時間（ミリ秒）
  knockback: 140,          // 被ダメ時に後ろへ下がる最低距離（px）
  knockbackReachMargin: 30,// 相手の攻撃が届く範囲より、さらにこの距離だけ外まで押し出す（px）。連続で当てられないようにするため
  wallPushbackRatio: 1.0,  // 壁際で押し出しきれなかった分を、攻撃した側を押し戻す割合（0 = 押し戻さない、1 = 足りない分すべて）
  hitboxFlashMs: 120,      // デバッグ表示で攻撃判定を表示しておく時間（ミリ秒）

  // ---- 攻撃の予備動作（プレイヤー・NPC 共通。新素材は使わない）----
  // 既存の duration × attackHitAt は天使 420×0.35=147ms、ルシファー 460×0.35=161ms で、
  // 人の反応（下の reactionMs）より短く、予備動作としても見えにくい。
  // 判定をこの時刻まで遅らせ、振りかぶったポーズを見せてから振り下ろす。振り抜き（後隙）の長さは変えない。
  // 攻撃速度バフ中は、ほかの攻撃時間と同じくこの時間も倍率で短くなる。
  attackWindupMs: 400,
  windupPullPx: 18,        // 予備動作中、後ろへ引く距離（px）。見た目だけ（判定位置は変わらない）
  windupExtraLeanDeg: 10,  // 予備動作中に追加する後傾（度）
  windupFlashMs: 120,      // 予備動作の開始時に短く光らせる時間（ミリ秒）

  // ---- 回避（プレイヤーのみ。専用モーションや新素材は使わない）----
  // キャリブレーション（この段落の数値の根拠。reactionMs 自体はゲーム中の判定には使わない）：
  //   予備動作は攻撃開始と同時に見える。人が反応する目安 reactionMs のあと回避を始めると、
  //   判定の瞬間ちょうど、攻撃判定の外へギリ出るように dodgeDistance と dodgeMs を決めた。
  //
  //   横（左右）：同じ奥行きで、体が separation で接する近距離からの後退を基準にした。
  //     体幅は天使 80 / ルシファー 86、separation 0.8 → 最小中心距離 66.4px。
  //     長い方の射程（ルシファー near 10 + reach 95）＋ 相手の体の半分の大きい方（43）より外へ出す。
  //     必要距離 = (10+95) + 43 - 66.4 + dodgeClearMargin 8 ≒ 90px。
  //     天使の攻撃（near 10 + reach 90、相手の半分 43）でも 90-76.6=13px ほど外に出る。
  //   縦（上下＝奥行き）：同じ Y から、depthTolerance(36) + dodgeClearMargin(8) = 44px でギリ外。
  //     ※当たる条件の奥行き差は depthTolerance。攻撃判定の top/bottom はスプライト上の高さで、
  //       上下移動ではこの奥行き差を外すことで回避する。
  //   時間：回避開始から判定まで = attackWindupMs - reactionMs = 200ms なので dodgeMs も 200。
  //     ease-out で移動し、判定の瞬間に移動し終わる（その位置が判定のすぐ外）。
  //     判定の 50ms 前など、遅すぎる回避では距離が足りず当たる（ease-out でも 50/200 時点で約 44% しか進まない）。
  reactionMs: 200,         // 人の反応時間の目安（ミリ秒）。距離・速度の説明用で、ゲーム中の判定には使わない
  dodgeClearMargin: 8,     // 判定の外へ出す余白（px）。上の距離計算で使用
  dodgeDistanceX: 90,      // 左右の回避距離（px）
  dodgeDistanceY: 44,      // 上下（奥行き）の回避距離（px）
  dodgeMs: 200,            // 回避移動の時間（ミリ秒）。ease-out
  dodgeCooldownMs: 400,    // 回避を出してから次の回避までの待ち（ミリ秒）。回避開始時点から数える

  // ---- スマホ操作 ----
  touch: {
    tapMaxMove: 14,        // これ以下の指の移動量ならタップ（攻撃）とみなす（px, 画面上）
    tapMaxTime: 250,       // これ以下の時間ならタップ（ミリ秒）
    dragThreshold: 18,     // これ以上動かしたら移動入力（押しっぱなしで移動し続ける）
    flickMoveMs: 320,      // フリック後に指を離してから移動を続ける時間（ミリ秒）
    // 勢いのよいフリックで回避（通常のスワイプ／移動フリックと区別する）。距離は touchstart の位置から測る
    flickDodgeMinDist: 70, // これ以上の移動（画面 px）
    flickDodgeMaxTime: 180,// これ以下の時間（ミリ秒）
    flickDodgeMinSpeed: 0.7 // これ以上の速さ（px/ミリ秒）。70px を 100ms で動かせば 0.7
  },

  // ---- NPC（敵）の AI ----
  ai: {
    speedScale: 1,         // NPC の移動速度倍率（1 = プレイヤーと同じ）
    thinkInterval: 180,    // 行動を考え直す間隔（ミリ秒）
    decisionJitterMs: 60,  // 判断のばらつき（ミリ秒）。攻撃のタイミングにこの範囲のランダムな遅れが少し入る
    reactionDelay: 160,    // 自分から攻撃するときの反応の遅れ（ミリ秒）
    attackChance: 0.5,     // 射程内にいるとき自分から攻撃する確率（判断ごと）

    // 隙を突く（プレイヤーの空振り・攻撃後の待ち時間を狙う）
    punishChance: 0.55,    // 隙を見つけたとき反撃に行く確率（プレイヤーの攻撃1回ごと）
    punishReactionMs: 80,  // 隙を見つけてから攻撃を出すまでの遅れ（ミリ秒）
    punishLungeDist: 90,   // 射程の外でも、この距離（px）までなら踏み込んで反撃する

    // 間合いの駆け引き
    spacingMargin: -10,    // プレイヤーの攻撃が届く距離より、どれだけ外側で待つか（px）。マイナスなら射程の少し内側で待つ
    feintChance: 0.4,      // 判断ごとに、間合いへ一瞬踏み込んで攻撃を誘う確率
    feintDepth: 22,        // 誘いのときにプレイヤーの射程へ入り込む深さ（px）
    feintMs: 260,          // 誘いで踏み込んでいる時間（ミリ秒）
    backstepChance: 0.25,  // 射程内でプレイヤーが攻撃を振り始めたとき、射程の外へ下がる確率
    dodgeChance: 0.25,     // プレイヤーの攻撃を奥行き方向へかわす確率（通常移動での回り込み。プレイヤーの回避移動とは別）
    engageChance: 0.2,     // 判断ごとに、自分から踏み込んで攻撃しに行く確率（受け身になりすぎないように）
    engageMs: 800,         // 踏み込みを続ける最大時間（ミリ秒）
    cornerMargin: 70,      // 背中側の壁までこの距離（px）以下なら「追い詰められた」とみなし、奥行き方向へ回り込む
    sidestepMs: 520        // 回り込みを続ける時間（ミリ秒）
  },

  // ---- 演出 ----
  roundIntroMs: 1600,      // 「ROUND 1」「FIGHT!」表示の時間
  koPauseMs: 2000,         // KO 後、次のラウンドへ進むまでの時間
  debugHitboxes: false     // 起動時から当たり判定を表示するか（H キーで切り替え）
};
