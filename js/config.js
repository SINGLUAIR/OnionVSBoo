/*
 * ゲームバランス設定（テストプレイで調整する値はここにまとめています）
 *
 * ============================================================
 * ■ キャラクターの追加方法（性能型）
 * ============================================================
 * キャラは assets/config.js の characters に1件足すだけで、選択画面のボタンも自動で増えます。
 * 性能は「武器の型（weaponType）」×「移動の型（moveType）」の組み合わせで決まり、
 * 型の標準値はこのファイル下の weaponTypes / moveTypes にあります。キャラごとに一部だけ上書きもできます。
 *
 *   characters: {
 *     myChar: {
 *       name: '表示名',
 *       weaponType: 'sword',   // 'sword'（剣）/ 'spear'（槍）/ 'throw'（投擲）/ 'magic'（魔法）
 *       moveType: 'fly',       // 'fly'（飛行）/ 'walkFast'（歩行・スピード）/ 'walkHeavy'（歩行・重量級）
 *       weapon: { windupMs: 300, projectile: { speed: 800 } }, // （任意）武器の型の値を一部だけ上書き
 *       move:   { maxSpeedX: 250, lifeBonus: 1 },               // （任意）移動の型の値を一部だけ上書き
 *       colors: {              // （任意）エフェクトの色（'R,G,B'）。省略時は uiTheme に合わせた色
 *         aura: '255,230,120',   // 速度アップ中のオーラ
 *         flash: '255,230,150',  // 予備動作の開始フラッシュ
 *         hit: '255,240,150',    // ヒットエフェクト
 *         slash: '255,240,150',  // 斬撃・突き・弾・魔法陣の色
 *         buffGlow: '130,160,255', buffText: '#cfe0ff' // HUD の「速度アップ中！」
 *       },
 *       uiTheme: 'angel',      // HUD・選択ボタンの配色。'angel'（蒼）/ 'lucifer'（紅）
 *       selectNote: '説明文',   // 選択ボタンの下の説明（<br> 可）
 *       buff: { condition: 'lifeAtMost', threshold: 2, moveSpeed: 1.3, attackSpeed: 1.3 }, // （任意）下の buffs より優先
 *       width, height, bodyInset, attackBox, mode, parts, downLoop, states … // 今までどおり（画像・当たり判定）
 *     }
 *   }
 *  ・attackBox（剣・槍の当たり判定）は省略すると武器の型の attackBox を使います。
 *  ・投擲の弾は weapon.projectile、魔法の範囲は weapon.area で調整します（下の weaponTypes を参照）。
 *    projectile.sprite / area.sprite に画像パスを書くと、図形の代わりにその画像を描きます（任意）。
 *  ・回避（dodge*）は全キャラ共通です。
 *
 *  ■ 特殊キャラ（組み合わせの外。例：ドラゴン）
 *   weaponTypes に無い名前を weaponType に書き、weapon.base で元にする型を選んで、weapon で値を上書きします。
 *     dragon: {
 *       name: 'ドラゴン', moveType: 'fly',                 // 移動は飛行で固定
 *       weaponType: 'breath',                               // 特殊な型（名前は自由）
 *       weapon: { base: 'magic', label: 'ブレス', motion: 'cast', windupMs: 500,
 *                 area: { anchor: 'front', offsetX: 170, radiusX: 180, radiusY: 70 }, // 正面に出る超広範囲
 *                 recoveryMs: 900, recoveryOnHit: true },  // 攻撃後の硬直が長い（当たっても硬直）
 *       hurtboxScale: { x: 1.6, y: 1.3 },                   // やられ判定を大きく（bodyInset で直接決めても可）
 *       move: { maxSpeedX: 230 }, ...
 *     }
 *   ・area.anchor: 'front' = 自分の正面に出す（無指定 = 相手の位置に魔法陣）
 *   ・recoveryMs = 攻撃後の硬直（ミリ秒、whiffRecoveryMs の代わり）、recoveryOnHit = 当たっても硬直する
 *   ・hurtboxScale = 体の当たり判定の倍率（足元中央を基準）
 *   ・移動も同じく、moveTypes に無い名前なら move.base を元に move で上書きできます
 */
window.GAME_CONFIG = {
  // ---- ライフ・ラウンド ----
  maxLife: 5,              // ライフの数（5回当てれば勝ち）
  rounds: 2,               // 基本ラウンド数（2ラウンド制）
  tiebreakerRound: true,   // 1勝1敗になったら3ラウンド目（決着ラウンド）を行うか。false なら引き分け
  roundTimeLimit: 0,       // ラウンドの制限時間（秒）。0 = 無制限。時間切れはライフが多い方の勝ち

  // ---- 速度アップ（バフ） ----
  // キャラの定義（assets/config.js）に buff があればそちらが優先。ライフの値（threshold）はライフが多いキャラでも同じ数で判定します
  buffs: {
    angel:   { condition: 'lifeAtMost',  threshold: 2, moveSpeed: 1.3, attackSpeed: 1.3 }, // ライフ2以下で発動
    lucifer: { condition: 'lifeAtLeast', threshold: 4, moveSpeed: 1.3, attackSpeed: 1.3 }  // ライフ4以上で発動
  },

  // ---- 移動 ----
  // 移動速度は下の moveTypes（性能型）で決まります。moveSpeedX/Y は型が見つからないときの予備の値です
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

  // ---- 性能型：武器（攻撃の型）----
  // 共通の項目
  //  kind          : 'melee'（近接）/ 'projectile'（弾）/ 'area'（範囲）
  //  motion        : 攻撃の動き 'swing'（振り下ろし）/ 'thrust'（突き）/ 'throw'（投げ）/ 'cast'（詠唱）
  //  windupMs      : 予備動作（攻撃開始から判定・発射・発動まで）の最低時間（ミリ秒）。null = attackWindupMs
  //  followMult    : 判定のあとの振り抜き（戻り）の長さの倍率
  //  recoveryMult  : 空振り硬直 whiffRecoveryMs の倍率（弾・魔法は撃つたびにこの硬直が入る）
  //  cooldownMult  : attackCooldown の倍率
  //  depthTolerance: 当たる奥行き(Y)の差の許容値（px）。null = 上の depthTolerance
  //  attackBox     : キャラの assets/config.js に attackBox が無いときに使う当たり判定
  weaponTypes: {
    // 剣：オーソドックス（今までの攻撃そのまま）
    sword: { label: '剣', kind: 'melee', motion: 'swing', windupMs: null, followMult: 1, recoveryMult: 1, cooldownMult: 1, depthTolerance: null,
             attackBox: { near: 10, reach: 90, top: 150, bottom: 40 } },
    // 槍：予備動作・後隙が短い。判定は正面だけで、細く・奥行きの許容が狭い（剣の半分）
    spear: { label: '槍', kind: 'melee', motion: 'thrust', windupMs: 360, followMult: 0.7, recoveryMult: 0.6, cooldownMult: 0.8, depthTolerance: 16,
             attackBox: { near: 10, reach: 80, top: 118, bottom: 88 }, // 剣（near 10 + reach 90）より短く細い
             thrustPx: 26 },        // 突きの瞬間に体ごと前へ出る見た目の距離（px）
    // 投擲：弾が当たったときだけダメージ。弾速は速いが判定は細い
    throw: { label: '投擲', kind: 'projectile', motion: 'throw', windupMs: 380, followMult: 1, recoveryMult: 1.6, cooldownMult: 2.5, depthTolerance: 16,
             projectile: {
               speed: 760,          // 弾速（px/秒）
               radius: 8,           // 弾の横の当たり半径（px）
               range: 520,          // 飛ぶ最大距離（px）
               spawnX: 40,          // 発射位置：キャラ中心から前へ（px）
               height: 95,          // 弾の高さ（足元から, px。見た目だけ）
               size: 13,            // 見た目の大きさ（px）
               sprite: null         // 画像パス（任意）。null なら図形で描画
             } },
    // 魔法：発動まで長いが範囲が広い。予備動作中に足元へ魔法陣（予告）が出て、発動で広がる
    magic: { label: '魔法', kind: 'area', motion: 'cast', windupMs: 600, followMult: 1, recoveryMult: 1, cooldownMult: 2, depthTolerance: null,
             area: {
               range: 480,          // 魔法陣を置ける最大距離（キャラ中心から, px）。相手がそれより遠いときはこの距離に置く
               radiusX: 110,        // 範囲の横半径（px）。足元（中心の点）がこの楕円に入ると当たる
               radiusY: 48,         // 範囲の奥行き半径（px）
                                    // 予告が見えて反応(200ms)してから、回避(200ms)＋残りの移動で中心からでも外へ出られる大きさ
                                    // （横：90 + 265×0.25 ≒ 156 > 110、奥行き：44 + 172×0.25 ≒ 87 > 48。重量級でも 135 / 74）
               lead: 0.35,          // 相手が動いているとき、発動までに進む先へ少しずらして置く割合（0 = 今いる位置）
               expandMs: 160,       // 発動してから最大まで広がる時間（ミリ秒）。広がった範囲に入っていたら当たる
               lingerMs: 220,       // 最大まで広がったあと判定が残る時間（ミリ秒）
               sprite: null         // 画像パス（任意）。null なら図形で描画
             } }
  },

  // ---- 性能型：移動 ----
  //  maxSpeedX / maxSpeedY : 最高速度（px/秒）
  //  accel   : 加速（px/秒²）。大きいほどすぐ最高速
  //  brake   : 減速（px/秒²）。入力を離したとき・逆へ切り返すときの止まりやすさ。小さいと滑る
  //  lifeBonus     : maxLife に足すライフ
  //  hurtStunMult  : 被ダメ硬直（states.hurt.duration）の倍率。ノックバックの距離は変えない
  //  velLeanDeg    : 速度に合わせた前傾・後傾（度）。飛行の「流れる」感じ
  //  motion        : 見た目の動き（assets/config.js の motion を上書き）。歩行は浮かない
  moveTypes: {
    // 飛行・浮遊：最高速が一番速いが、加速・減速がゆるく切り返しが滑る
    fly:       { label: '飛行', maxSpeedX: 265, maxSpeedY: 172, accel: 2000, brake: 1300, lifeBonus: 0, hurtStunMult: 1, velLeanDeg: 6, motion: {} },
    // 歩行（スピード）：最高速は飛行より少し遅いが、すぐ止まれてすぐ切り返せる
    walkFast:  { label: '歩行・速', maxSpeedX: 240, maxSpeedY: 160, accel: 3200, brake: 4200, lifeBonus: 0, hurtStunMult: 1, velLeanDeg: 0,
                 motion: { floatHeight: 0, idleBob: 1.5, moveBob: 3, moveBobSpeed: 0.02, idleFlapSpeed: 0.002, moveFlapSpeed: 0.004, wingFlap: 6 } },
    // 歩行（重量級）：遅いが打たれ強い（ライフ +2、被ダメ硬直が短い）
    walkHeavy: { label: '歩行・重', maxSpeedX: 180, maxSpeedY: 120, accel: 1900, brake: 2800, lifeBonus: 2, hurtStunMult: 0.55, velLeanDeg: 0,
                 motion: { floatHeight: 0, idleBob: 1, moveBob: 2.5, moveBobSpeed: 0.014, idleFlapSpeed: 0.002, moveFlapSpeed: 0.003, wingFlap: 4, moveLean: 4 } }
  },

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
