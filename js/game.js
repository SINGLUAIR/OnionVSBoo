/*
 * イビルライトフォース  メインロジック
 */
(function () {
  'use strict';

  const W = 960, H = 540;
  const CFG = window.GAME_CONFIG;
  const ASSETS = window.ASSET_CONFIG;
  // キャラの一覧は assets/config.js の characters から自動で作る（ボタンも自動生成）
  const CHAR_IDS = Object.keys(ASSETS.characters || {});

  // ------------------------------------------------------------
  // 性能型（js/config.js の weaponTypes / moveTypes ＋ キャラごとの上書き）
  // ------------------------------------------------------------
  function mergeType(base, over) {
    const out = Object.assign({}, base || {});
    Object.keys(over || {}).forEach((k) => {
      const v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') out[k] = Object.assign({}, out[k], v);
      else out[k] = v;
    });
    return out;
  }
  function resolveWeapon(def) {
    const types = CFG.weaponTypes || {};
    // 特殊な型（例：ドラゴンの 'breath'）：weaponTypes に無い名前でも、weapon.base の型をもとに weapon の値で作れる
    let key = def.weaponType || 'sword';
    let base = types[key];
    if (!base) base = types[(def.weapon && def.weapon.base) || 'sword'] || { kind: 'melee', motion: 'swing' };
    const w = mergeType(base, def.weapon);
    w.type = key;
    return w;
  }
  function resolveMove(def) {
    const types = CFG.moveTypes || {};
    const key = def.moveType || 'fly';
    const fallback = { maxSpeedX: CFG.moveSpeedX, maxSpeedY: CFG.moveSpeedY, accel: 99999, brake: 99999, lifeBonus: 0, hurtStunMult: 1 };
    const base = types[key] || types[(def.move && def.move.base) || 'fly'] || fallback;
    const m = mergeType(base, def.move);
    m.type = key;
    return m;
  }
  // キャラの配色（HUD・ボタン）。uiTheme が無いときは id、それも無ければ天使側
  function themeOf(charId) {
    const d = ASSETS.characters[charId] || {};
    return d.uiTheme || (charId === 'lucifer' ? 'lucifer' : 'angel');
  }
  const DEFAULT_COLORS = {
    angel:   { aura: '255,230,120', flash: '255,230,150', hit: '255,240,150', slash: '255,240,150', buffGlow: '130,160,255', buffText: '#cfe0ff' },
    lucifer: { aura: '170,60,255',  flash: '255,80,70',   hit: '200,80,255',  slash: '200,60,255',  buffGlow: '255,120,40',  buffText: '#ffcf8a' }
  };
  function colorsOf(charId) {
    const d = ASSETS.characters[charId] || {};
    return Object.assign({}, DEFAULT_COLORS[themeOf(charId)] || DEFAULT_COLORS.angel, d.colors || {});
  }
  window.CharTypes = { resolveWeapon: resolveWeapon, resolveMove: resolveMove, colorsOf: colorsOf, themeOf: themeOf };

  // 見た目の動きの上書き（移動の型の motion → キャラの motion の順に、assets/config.js の motion へ重ねる）
  const motionOverrideCache = {};
  function motionOverrideOf(charId) {
    if (!motionOverrideCache[charId]) {
      const d = ASSETS.characters[charId] || {};
      motionOverrideCache[charId] = Object.assign({}, resolveMove(d).motion || {}, d.motion || {});
    }
    return motionOverrideCache[charId];
  }

  // 任意の画像（弾・魔法陣の sprite）。読めないときは null のまま＝図形で描く
  const optImages = {};
  function optImage(src) {
    if (!src) return null;
    if (!(src in optImages)) {
      optImages[src] = null;
      const im = new Image();
      im.onload = () => { optImages[src] = im; };
      im.src = window.cacheBust ? window.cacheBust(src) : src;
    }
    return optImages[src];
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  let renderRatio = 1;

  // ------------------------------------------------------------
  // 画面サイズ合わせ（960x540 を画面に収まるよう拡大縮小）
  // ------------------------------------------------------------
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    const dpr = window.devicePixelRatio || 1;
    renderRatio = Math.max(1, Math.min(scale * dpr, 2.5));
    canvas.width = Math.round(W * renderRatio);
    canvas.height = Math.round(H * renderRatio);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // ------------------------------------------------------------
  // 背景（事前描画）
  // ------------------------------------------------------------
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = W; bgCanvas.height = H;
  function drawBackground() {
    const b = bgCanvas.getContext('2d');
    const sky = b.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a1040');
    sky.addColorStop(0.35, '#5a3a8a');
    sky.addColorStop(0.55, '#e8a0b8');
    sky.addColorStop(0.56, '#c9b8e8');
    sky.addColorStop(1, '#8a78b8');
    b.fillStyle = sky;
    b.fillRect(0, 0, W, H);
    // 光と闇
    const light = b.createRadialGradient(140, 80, 10, 140, 80, 260);
    light.addColorStop(0, 'rgba(255,245,200,0.8)');
    light.addColorStop(1, 'rgba(255,245,200,0)');
    b.fillStyle = light; b.fillRect(0, 0, W, H);
    const dark = b.createRadialGradient(830, 90, 10, 830, 90, 260);
    dark.addColorStop(0, 'rgba(120,0,60,0.7)');
    dark.addColorStop(1, 'rgba(120,0,60,0)');
    b.fillStyle = dark; b.fillRect(0, 0, W, H);
    // 雲
    b.fillStyle = 'rgba(255,255,255,0.25)';
    [[120, 230, 90], [300, 260, 70], [520, 240, 100], [760, 250, 80], [900, 220, 60]].forEach((c) => {
      b.beginPath();
      b.ellipse(c[0], c[1], c[2], c[2] * 0.3, 0, 0, Math.PI * 2);
      b.fill();
    });
    // 床（奥行きの帯）
    const f = CFG.field;
    const floorTop = f.top - 30;
    const floor = b.createLinearGradient(0, floorTop, 0, H);
    floor.addColorStop(0, 'rgba(255,255,255,0.18)');
    floor.addColorStop(1, 'rgba(60,40,110,0.55)');
    b.fillStyle = floor;
    b.fillRect(0, floorTop, W, H - floorTop);
    // 遠近線
    b.strokeStyle = 'rgba(255,255,255,0.12)';
    b.lineWidth = 1;
    for (let i = -10; i <= 20; i++) {
      b.beginPath();
      b.moveTo(W / 2 + i * 40, floorTop);
      b.lineTo(W / 2 + i * 110, H);
      b.stroke();
    }
    for (let y = floorTop; y < H; y += 30) {
      b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke();
    }
  }
  drawBackground();

  // 背景画像の差し込み口（assets/ui-config.js の background.far / background.floor）
  // 画像が読み込めたら背景を描き直す。無いときは上の描画のまま。
  (function loadBackgroundImages() {
    const bg = (window.UI_CONFIG && window.UI_CONFIG.background) || {};
    const imgs = { far: null, floor: null };
    function rebuild() {
      const b = bgCanvas.getContext('2d');
      b.clearRect(0, 0, W, H);
      if (imgs.far) {
        const im = imgs.far;
        const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
        const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
        b.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        drawBackground();
      }
      if (imgs.floor) {
        const r = bg.floorRect || { x: 0, y: CFG.field.top - 30, w: W, h: H - (CFG.field.top - 30) };
        b.drawImage(imgs.floor, r.x, r.y, r.w, r.h);
      }
    }
    ['far', 'floor'].forEach((k) => {
      if (!bg[k]) return;
      const im = new Image();
      im.onload = () => { imgs[k] = im; rebuild(); };
      im.onerror = () => console.warn('背景画像を読み込めませんでした: ' + bg[k]);
      im.src = (window.cacheBust ? window.cacheBust(bg[k]) : bg[k]);
    });
  })();

  // ------------------------------------------------------------
  // ユーティリティ
  // ------------------------------------------------------------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ------------------------------------------------------------
  // キャラクター
  // ------------------------------------------------------------
  class Fighter {
    constructor(charId, isPlayer) {
      this.charId = charId;
      this.isPlayer = isPlayer;
      this.def = ASSETS.characters[charId];
      this.weapon = resolveWeapon(this.def);   // 武器の型（剣・槍・投擲・魔法）
      this.mv = resolveMove(this.def);         // 移動の型（飛行・歩行）
      this.colors = colorsOf(charId);
      this.maxLife = Math.max(1, CFG.maxLife + (this.mv.lifeBonus || 0) + (this.def.lifeBonus || 0));
      this.reset(isPlayer ? 250 : 710, 420);
    }

    reset(x, y) {
      this.x = x; this.y = y;
      this.facing = this.isPlayer ? 1 : -1; // 1 = 右, -1 = 左
      this.life = this.maxLife;
      this.vx = 0; this.vy = 0;     // 移動の速度（px/秒）。加速・減速で変わる
      this.state = 'idle';
      this.stateTime = 0;
      this.invulnUntil = 0;
      this.cooldownUntil = 0;
      this.attackFlashUntil = 0;
      this.lastAttackRect = null;
      this.knock = 0;
      this.recoverLeft = 0;   // 空振り硬直の残り時間（ミリ秒）
      this.recoverTotal = 0;
      this.attackSerial = 0;  // 攻撃を出すたびに増える番号（AI が「この攻撃」を区別するため）
      this.dodge = null;            // { fromX, fromY, dx, dy, t, dur }
      this.dodgeCooldownUntil = 0;
      this.dodgeTrail = [];
    }

    get buff() {
      const b = this.def.buff || (CFG.buffs || {})[this.charId];
      if (!b) return null;
      const on = b.condition === 'lifeAtMost' ? this.life <= b.threshold : this.life >= b.threshold;
      return on && this.life > 0 ? b : null;
    }
    get moveMult() { const b = this.buff; return b ? b.moveSpeed : 1; }
    get attackMult() { const b = this.buff; return b ? b.attackSpeed : 1; }

    duration(state) {
      const st = this.def.states;
      if (state === 'down') return window.SpriteBank.downDuration(this.charId);
      if (state === 'attack') return this.attackTiming().total;
      if (state === 'move') return st.move.duration / this.moveMult;   // 移動速度アップ中は移動モーションも速く
      if (state === 'hurt') return ((st.hurt && st.hurt.duration) || 500) * (this.mv.hurtStunMult || 1); // 重量級は被ダメ硬直が短い
      return (st[state] && st[state].duration) || 500;
    }

    // 攻撃判定が出るタイミング（設定上の割合 0〜1）。実際の判定時刻は hitTime()
    get hitAt() {
      const a = this.def.states && this.def.states.attack;
      const v = a && a.hitAt != null ? a.hitAt : CFG.attackHitAt;
      return v == null ? 1 : clamp(v, 0.05, 1);
    }
    // 攻撃の時間配分。attackWindupMs が duration×hitAt より長いときは判定を遅らせ、振り抜きの長さは保つ
    attackTiming() {
      const st = this.def.states;
      const mult = this.attackStartMult != null ? this.attackStartMult : this.attackMult;
      const base = st.attack.duration / mult;
      const frac = this.hitAt;
      const wu = this.weapon.windupMs != null ? this.weapon.windupMs : CFG.attackWindupMs;
      const windup = (wu || 0) / mult;
      const hit = Math.max(windup, base * frac);
      const follow = base * (1 - frac) * (this.weapon.followMult != null ? this.weapon.followMult : 1);
      const total = hit + follow;
      return { base: base, hit: hit, follow: follow, total: total, progress: total > 0 ? hit / total : frac };
    }
    // 攻撃開始から判定が出るまでの時間（ミリ秒）
    hitTime() { return this.attackTiming().hit; }
    // アニメーション進行度のうち、判定が出る位置（0〜1）。描画の振り下ろし合わせに使う
    hitAtProgress() { return this.attackTiming().progress; }
    // 攻撃中で、まだ判定が出ていない（予備動作中）
    inStartup() { return this.state === 'attack' && !this.hitDone; }
    isDodging() { return !!(this.dodge && this.dodge.t < this.dodge.dur); }
    // 予備動作の「ため」の強さ 0〜1（序盤で立ち上がり、振り下ろしで戻る）
    windupHold() {
      if (!this.inStartup()) return 0;
      const ht = this.hitTime();
      const u = ht > 0 ? clamp(this.stateTime / ht, 0, 1) : 1;
      const charge = u < 0.18 ? u / 0.18 : 1;
      return u < 0.72 ? charge : Math.max(0, (1 - u) / 0.28);
    }

    // ステートを切り替える。stateTime が 0 に戻るので、1回再生のアニメーションは先頭から再生される
    setState(s) {
      if (this.state === s && (s === 'idle' || s === 'move' || s === 'win' || s === 'downLoop')) return;
      this.state = s;
      this.stateTime = 0;
      // 攻撃の途中でバフ状態が変わっても長さが変わらないよう、開始時の倍率を記録
      this.attackStartMult = s === 'attack' ? this.attackMult : null;
      if (s === 'attack') { this.hitDone = false; this.lastSwingHit = false; }
    }

    // 画像の矩形（足元 = this.y, 中央 = this.x）
    imageRect() {
      return { x: this.x - this.def.width / 2, y: this.y - this.def.height, w: this.def.width, h: this.def.height };
    }

    // 体の当たり判定（画像の矩形から余白を除いたもの。左右反転に追従）
    bodyRect() {
      const r = this.imageRect();
      const ins = this.def.bodyInset || { left: 0, right: 0, top: 0, bottom: 0 };
      const flipped = this.isFlipped();
      const l = flipped ? ins.right : ins.left;
      const rr = flipped ? ins.left : ins.right;
      const b = { x: r.x + l, y: r.y + ins.top, w: r.w - l - rr, h: r.h - ins.top - ins.bottom };
      // （任意）やられ判定の倍率 hurtboxScale: { x, y }。足元中央を基準に広げる（ドラゴンなど大きいキャラ用）
      const hs = this.def.hurtboxScale;
      if (hs) {
        const sx = hs.x != null ? hs.x : 1, sy = hs.y != null ? hs.y : 1;
        const cx = b.x + b.w / 2, bottom = b.y + b.h;
        b.w *= sx; b.h *= sy; b.x = cx - b.w / 2; b.y = bottom - b.h;
      }
      return b;
    }

    // 近接攻撃の判定の大きさ（キャラの attackBox が優先、無ければ武器の型の値）
    get attackBox() { return this.def.attackBox || this.weapon.attackBox || { near: 10, reach: 90, top: 150, bottom: 40 }; }
    // 当たる奥行きの差の許容値（武器の型ごと）
    get depthTol() { return this.weapon.depthTolerance != null ? this.weapon.depthTolerance : CFG.depthTolerance; }
    get isMelee() { return (this.weapon.kind || 'melee') === 'melee'; }

    // 攻撃判定（向いている側のみ）
    attackRect() {
      const a = this.attackBox;
      const x = this.facing === 1 ? this.x + a.near : this.x - a.near - a.reach;
      return { x: x, y: this.y - a.top, w: a.reach, h: a.top - a.bottom };
    }

    isFlipped() {
      const base = ASSETS.baseFacing === 'left' ? -1 : 1;
      return this.facing !== base;
    }

    canAct() { return (this.state === 'idle' || this.state === 'move') && !(this.recoverLeft > 0) && !this.isDodging(); }
    isRecovering() { return this.recoverLeft > 0; }

    update(dt, now, move, wantAttack, opp, game) {
      this.stateTime += dt;

      // ノックバック
      if (this.knock) {
        const step = this.knock * Math.min(1, dt / 120);
        this.x = clamp(this.x + step, CFG.field.left, CFG.field.right);
        this.knock -= step;
        if (Math.abs(this.knock) < 0.5) this.knock = 0;
      }

      if (this.state === 'down') {
        if (this.stateTime >= this.duration('down')) this.setState('downLoop');
        return;
      }
      if (this.state === 'downLoop' || this.state === 'win') return;

      if (this.state === 'hurt') {
        if (this.stateTime >= this.duration('hurt')) this.setState('idle');
        return;
      }

      if (this.isDodging()) {
        this.advanceDodge(dt, now);
        if (CFG.autoFaceOpponent) this.faceOpponent(opp);
        return;
      }

      if (this.state === 'attack') {
        // 予備動作 → 判定（hitAt の位置で1回だけ） → 戻り
        if (!this.hitDone && this.stateTime >= this.hitTime()) {
          this.hitDone = true;
          const kind = this.weapon.kind || 'melee';
          if (kind === 'projectile') { game.spawnProjectile(this); this.lastSwingHit = false; }
          else if (kind === 'area') { game.triggerArea(this); this.lastSwingHit = false; }
          else this.lastSwingHit = game.resolveAttack(this, opp);
          if (this.state !== 'attack') return; // KO で勝利ポーズになった
        }
        if (this.stateTime >= this.duration('attack')) {
          const mult = this.attackStartMult || this.attackMult;
          const hit = this.lastSwingHit;
          // 空振りなら（戻りの動作のあとに）硬直（移動・攻撃不可）。待ち時間は硬直が終わってから数える。プレイヤー・NPC 共通
          // 弾・魔法は撃つたびに硬直（recoveryMult で調整）
          const rm = this.weapon.recoveryMult != null ? this.weapon.recoveryMult : 1;
          // recoveryMs で硬直の長さを直接指定、recoveryOnHit: true なら当たっても硬直する（ドラゴンのブレスなど）
          const baseRec = this.weapon.recoveryMs != null ? this.weapon.recoveryMs : (CFG.whiffRecoveryMs || 0) * rm;
          const recover = (hit && !this.weapon.recoveryOnHit) ? 0 : baseRec / mult;
          this.recoverLeft = this.recoverTotal = recover;
          const cm = this.weapon.cooldownMult != null ? this.weapon.cooldownMult : 1;
          this.cooldownUntil = now + recover + CFG.attackCooldown * cm / this.attackMult;
          // KO で勝利ポーズに入っていたら上書きしない
          if (this.state === 'attack') this.setState('idle');
        }
        return;
      }

      // 空振り硬直中：その場で止まる
      if (this.recoverLeft > 0) {
        this.vx = this.vy = 0;
        this.recoverLeft -= dt;
        if (this.recoverLeft < 0) this.recoverLeft = 0;
        this.setState('idle');
        return;
      }

      // 待機・移動
      if (!game.fighting) { move = { x: 0, y: 0 }; wantAttack = false; }
      if (wantAttack && now >= this.cooldownUntil) {
        this.faceOpponent(opp);
        this.attackSerial++;
        this.vx = this.vy = 0;
        this.setState('attack');
        if ((this.weapon.kind || 'melee') === 'area') game.placeArea(this, opp); // 魔法：予備動作の間、魔法陣で発動位置を予告
        return;
      }
      // 移動：入力の方向へ加速、離すと減速（移動の型の accel / brake）。逆方向への切り返しは減速してから加速
      const speedScale = this.isPlayer ? 1 : (CFG.ai.speedScale == null ? 1 : CFG.ai.speedScale);
      const mv = this.mv, k = this.moveMult * speedScale;
      const sec = dt / 1000;
      const axis = (v, input, max) => {
        const target = input * max;
        const acc = (mv.accel || 99999) * this.moveMult, brk = (mv.brake || 99999) * this.moveMult;
        let rate;
        if (!input) rate = brk;
        else if (v * target < 0) rate = brk + acc;       // 切り返し：止まる力 + 進む力
        else if (Math.abs(target) < Math.abs(v)) rate = brk; // 最高速より速い（斜め入力など）
        else rate = acc;
        const d = target - v, step = rate * sec;
        return Math.abs(d) <= step ? target : v + Math.sign(d) * step;
      };
      this.vx = axis(this.vx, move.x || 0, (mv.maxSpeedX || CFG.moveSpeedX) * k);
      this.vy = axis(this.vy, move.y || 0, (mv.maxSpeedY || CFG.moveSpeedY) * k);
      const f = CFG.field;
      const nx = this.x + this.vx * sec, ny = this.y + this.vy * sec;
      this.x = clamp(nx, f.left, f.right);
      this.y = clamp(ny, f.top, f.bottom);
      if (this.x !== nx) this.vx = 0;   // 壁で止まる
      if (this.y !== ny) this.vy = 0;
      if (move.x || move.y || Math.abs(this.vx) > 25 || Math.abs(this.vy) > 25) {
        if (!CFG.autoFaceOpponent && move.x) this.facing = move.x > 0 ? 1 : -1;
        this.setState('move');
      } else {
        this.setState('idle');
      }
      if (CFG.autoFaceOpponent) this.faceOpponent(opp);
    }

    faceOpponent(opp) {
      if (!CFG.autoFaceOpponent) return;
      const dx = opp.x - this.x;
      if (Math.abs(dx) > 4) this.facing = dx > 0 ? 1 : -1;
    }

    // 回避移動（プレイヤー用。専用モーションは使わず、位置だけ素早くずらす）
    tryDodge(dir, now) {
      if (!dir || (!dir.x && !dir.y)) return false;
      if (!this.canAct() || now < this.dodgeCooldownUntil) return false;
      let dx = 0, dy = 0;
      if (Math.abs(dir.x) >= Math.abs(dir.y)) dx = dir.x < 0 ? -1 : 1;
      else dy = dir.y < 0 ? -1 : 1;
      const f = CFG.field;
      const toX = clamp(this.x + dx * (CFG.dodgeDistanceX || 0), f.left, f.right);
      const toY = clamp(this.y + dy * (CFG.dodgeDistanceY || 0), f.top, f.bottom);
      if (Math.abs(toX - this.x) < 0.5 && Math.abs(toY - this.y) < 0.5) return false;
      this.dodge = {
        fromX: this.x, fromY: this.y,
        dx: toX - this.x, dy: toY - this.y,
        t: 0, dur: Math.max(1, CFG.dodgeMs || 200)
      };
      this.dodgeCooldownUntil = now + (CFG.dodgeCooldownMs || 400);
      this.vx = this.vy = 0;
      this.dodgeTrail = [];
      this.setState('move');
      return true;
    }

    advanceDodge(dt, now) {
      const d = this.dodge;
      if (!d) return;
      d.t += dt;
      const u = clamp(d.t / d.dur, 0, 1);
      const e = 1 - (1 - u) * (1 - u); // ease-out quad
      const f = CFG.field;
      this.x = clamp(d.fromX + d.dx * e, f.left, f.right);
      this.y = clamp(d.fromY + d.dy * e, f.top, f.bottom);
      // 残像（既存スプライトの薄い複製。任意演出）
      if (!this.dodgeTrail) this.dodgeTrail = [];
      const last = this.dodgeTrail[this.dodgeTrail.length - 1];
      if (!last || Math.hypot(this.x - last.x, this.y - last.y) >= 14) {
        this.dodgeTrail.push({ x: this.x, y: this.y, t: now });
        if (this.dodgeTrail.length > 3) this.dodgeTrail.shift();
      }
      if (d.t >= d.dur) {
        this.dodge = null;
        this.dodgeTrail = [];
        this.setState('idle');
      }
    }

    // src：近接なら攻撃したキャラ。弾・魔法なら { x, dir }（押し出す向き）
    takeHit(attacker, now, src) {
      this.life = Math.max(0, this.life - 1);
      this.recoverLeft = 0;
      this.dodge = null;
      this.dodgeTrail = [];
      this.vx = this.vy = 0;
      if (src) this.applyKnockbackDir(src.dir);
      else this.applyKnockback(attacker);
      if (this.life <= 0) {
        this.setState('down');
      } else {
        this.setState('hurt');
        this.invulnUntil = now + CFG.invulnerableMs;
      }
    }

    // ノックバック：攻撃した側の攻撃が届く範囲の外まで押し出す（連続ヒット防止）。
    // 壁で押し出しきれない分は、攻撃した側を押し戻す
    applyKnockback(attacker) {
      const dir = attacker.facing;
      const a = attacker.attackBox;
      const half = this.bodyRect().w / 2;
      // 押し出したい位置：相手の判定の先端 + 自分の体の半分 + 余白
      const targetX = attacker.x + dir * (a.near + a.reach + half + (CFG.knockbackReachMargin || 0));
      const push = Math.max(CFG.knockback, (targetX - this.x) * dir);
      const room = Math.max(0, dir > 0 ? CFG.field.right - this.x : this.x - CFG.field.left);
      const own = Math.min(push, room);
      this.knock = dir * own;
      const short = push - own;
      const ratio = CFG.wallPushbackRatio == null ? 1 : CFG.wallPushbackRatio;
      if (short > 0.5 && ratio > 0) attacker.knock = -dir * short * ratio;
    }

    // 弾・魔法のノックバック：決まった距離だけ押し出す（攻撃した側は押し戻さない）。距離は移動の型で変えない
    applyKnockbackDir(dir) {
      dir = dir >= 0 ? 1 : -1;
      const push = CFG.knockback;
      const room = Math.max(0, dir > 0 ? CFG.field.right - this.x : this.x - CFG.field.left);
      this.knock = dir * Math.min(push, room);
    }

    // 飛行：速度に合わせた傾き（度、右向き基準のローカル。前へ進むと前傾、下がると後傾）
    velLean() {
      const deg = this.mv.velLeanDeg || 0;
      if (!deg || this.state === 'attack' || this.state === 'hurt' || this.state === 'down' || this.state === 'downLoop') return 0;
      const max = (this.mv.maxSpeedX || CFG.moveSpeedX) * this.moveMult;
      return deg * clamp(this.vx * this.facing / Math.max(1, max), -1, 1);
    }

    draw(c, now, debug, asGhost) {
      // 回避中の残像（本体の前に薄く描く）
      if (!asGhost && this.dodgeTrail && this.dodgeTrail.length) {
        const trail = this.dodgeTrail;
        const ox = this.x, oy = this.y;
        this.dodgeTrail = null;
        trail.forEach((g, i) => {
          this.x = g.x; this.y = g.y;
          c.save();
          c.globalAlpha *= 0.18 + 0.12 * (i + 1) / trail.length;
          this.draw(c, now, false, true);
          c.restore();
        });
        this.x = ox; this.y = oy;
        this.dodgeTrail = trail;
      }

      const mode = this.def.mode || 'parts';
      const entry = window.SpriteBank.get(this.charId, this.state);
      const dur = this.duration(this.state);
      const sc = this.def.states[this.state] || {};
      let progress = sc.loop ? (this.stateTime % dur) / dur : clamp(this.stateTime / dur, 0, 1);
      const w = this.def.width, h = this.def.height;

      c.save();
      c.translate(this.x, this.y);
      // 予備動作：後ろへ引く（見た目だけ。後傾は左右反転のあと／drawCharacter 側でかける）
      const windupHold = this.windupHold();
      if (windupHold > 0) {
        c.translate(-this.facing * (CFG.windupPullPx || 0) * windupHold, 0);
      }
      // 無敵中は点滅
      if (now < this.invulnUntil && this.state !== 'hurt' && Math.floor(now / 80) % 2 === 0) c.globalAlpha = 0.45;
      // 空振り硬直中は前へつんのめる（足元を軸に傾ける）
      if (this.recoverLeft > 0 && CFG.whiffLeanDeg && this.recoverTotal > 0) {
        const k = this.recoverLeft / this.recoverTotal;           // 1 → 0
        const ease = Math.sin(Math.min(1, k * 1.3) * Math.PI / 2); // すぐ傾いて、最後に戻る
        c.rotate(this.facing * CFG.whiffLeanDeg * ease * Math.PI / 180);
      }

      if (this.state === 'downLoop') {
        drawDownLoopFighter(c, this, now, debug);
      } else if (this.state === 'down') {
        drawFallFighter(c, this, now, debug);
      } else if (mode === 'apng' && entry && entry.ready) {
        // APNG モード：モーションごとの APNG をそのまま再生
        drawShadow(c, w, this, this.state, progress);
        if (this.isFlipped()) c.scale(-1, 1);
        const vl = this.velLean();
        if (vl) c.rotate(vl * Math.PI / 180);
        if (windupHold > 0 && CFG.windupExtraLeanDeg) c.rotate(-CFG.windupExtraLeanDeg * windupHold * Math.PI / 180);
        c.drawImage(entry.frameAt(this.stateTime, dur, !!sc.loop), -w / 2, -h, w, h);
      } else {
        // パーツモード（画像が無いパーツは仮の図形）／画像が無いときの仮の図形。右向き基準で描画し、左向きなら反転
        // win もここに入り、頭の差分（head_win.png）があれば差し替わる
        if (this.facing === -1) c.scale(-1, 1);
        const usesParts = mode !== 'apng';
        window.drawCharacter(c, this.charId, this.state, progress, now, w, h, {
          parts: usesParts ? window.SpriteBank.getParts(this.charId) : {},
          partsConfig: usesParts ? this.def.parts : null,
          debug: debug,
          flipped: this.facing === -1,
          stateTime: this.stateTime,
          hitAt: this.hitAtProgress(),
          windupHold: windupHold,
          windupExtraLeanDeg: CFG.windupExtraLeanDeg || 0,
          weaponMotion: this.weapon.motion || 'swing',
          thrustPx: this.weapon.thrustPx || 0,
          velLeanDeg: this.velLean(),
          motion: motionOverrideOf(this.charId),
          slashColor: this.colors.slash
        });
      }
      c.restore();

      // 予備動作の開始フラッシュ（既存スプライトのまわりを短く光らせる）
      if (!asGhost && this.inStartup() && this.stateTime < (CFG.windupFlashMs || 0)) {
        const a = 1 - this.stateTime / CFG.windupFlashMs;
        const col = this.colors.flash;
        c.save();
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(this.x, this.y - h * 0.55, 8, this.x, this.y - h * 0.55, h * 0.7);
        g.addColorStop(0, 'rgba(' + col + ',' + (0.55 * a) + ')');
        g.addColorStop(1, 'rgba(' + col + ',0)');
        c.fillStyle = g;
        c.fillRect(this.x - h, this.y - h * 1.3, h * 2, h * 1.5);
        c.restore();
      }

      // 速度アップ中のオーラ
      if (this.buff && this.state !== 'down' && this.state !== 'downLoop') {
        c.save();
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(this.x, this.y - h / 2, 10, this.x, this.y - h / 2, h * 0.6);
        const col = this.colors.aura;
        g.addColorStop(0, 'rgba(' + col + ',0.0)');
        g.addColorStop(0.7, 'rgba(' + col + ',' + (0.12 + 0.06 * Math.sin(now * 0.01)) + ')');
        g.addColorStop(1, 'rgba(' + col + ',0)');
        c.fillStyle = g;
        c.fillRect(this.x - h, this.y - h * 1.2, h * 2, h * 1.4);
        c.restore();
      }

      if (debug) this.drawDebug(c, now);
    }

    drawDebug(c, now) {
      c.save();
      c.lineWidth = 2;
      const ir = this.imageRect();
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.setLineDash([4, 4]);
      c.strokeRect(ir.x, ir.y, ir.w, ir.h);
      c.setLineDash([]);
      const br = this.bodyRect();
      c.strokeStyle = '#3f6';
      c.strokeRect(br.x, br.y, br.w, br.h);
      // 足元と奥行き許容範囲
      c.strokeStyle = 'rgba(80,200,255,0.8)';
      c.beginPath();
      c.moveTo(this.x - 30, this.y); c.lineTo(this.x + 30, this.y);
      c.moveTo(this.x, this.y - this.depthTol); c.lineTo(this.x, this.y + this.depthTol);
      c.stroke();
      // 攻撃判定
      if (this.state === 'attack' && this.isMelee) {
        const ar = this.attackRect();
        c.strokeStyle = 'rgba(255,80,80,0.6)';
        c.setLineDash([6, 4]);
        c.strokeRect(ar.x, ar.y, ar.w, ar.h);
        c.setLineDash([]);
      }
      if (now < this.attackFlashUntil && this.lastAttackRect) {
        const ar = this.lastAttackRect;
        c.fillStyle = this.lastAttackHit ? 'rgba(255,40,40,0.55)' : 'rgba(255,160,40,0.35)';
        c.fillRect(ar.x, ar.y, ar.w, ar.h);
      }
      c.fillStyle = '#fff';
      c.font = '12px sans-serif';
      const tag = this.isDodging() ? ' dodge' : (this.inStartup() ? ' windup' : '');
      c.fillText(this.state + tag + ' ' + Math.round(this.stateTime) + '/' + Math.round(this.duration(this.state)) + 'ms', ir.x, ir.y - 4);
      c.restore();
    }
  }

  // ------------------------------------------------------------
  // NPC の AI
  // ------------------------------------------------------------
  class AI {
    constructor(me, opp) {
      this.me = me; this.opp = opp;
      this.reset(0);
    }

    reset(now) {
      this.nextThink = now + 300;
      this.move = { x: 0, y: 0 };
      this.attackAt = 0;          // 自分から攻撃する予定時刻（反応の遅れ付き）
      this.mode = 'space';        // space（間合い取り）/ engage（踏み込み）/ punish（隙を突く）/ evade（下がる・かわす）/ sidestep（回り込み）
      this.modeUntil = 0;
      this.feintUntil = 0;
      this.dodgeDir = 1;
      this.seenSerial = 0;        // 反撃・回避の判断を済ませたプレイヤーの攻撃番号
      this.evadeSerial = 0;
      this.punishAt = 0;
      this.startAt = now + 500;   // ラウンド開始直後の待ち
    }

    // 相手の体の前端までの距離（x）。
    gapX() { return Math.abs(this.opp.x - this.me.x); }

    // 自分の攻撃が当たる最大の横距離（中心同士）
    myReach() {
      const a = this.me.attackBox;
      return a.near + a.reach + this.opp.bodyRect().w / 2;
    }

    // プレイヤーの攻撃が自分に届く最大の横距離（中心同士）
    // 相手が弾・魔法のキャラなら近接の射程は無いので、間合いを取らずに詰める（0 を返す）
    oppReach() {
      if (!this.opp.isMelee) return 0;
      const a = this.opp.attackBox;
      return a.near + a.reach + this.me.bodyRect().w / 2;
    }

    // 奥行きが揃っているか（自分の武器の許容値で判断。槍は狭いのでしっかり揃える）
    depthAligned(k) { return Math.abs(this.opp.y - this.me.y) <= this.me.depthTol * (k || 0.75); }
    // 相手の攻撃が当たる奥行きか（相手の武器の許容値）
    oppDepthAligned(k) { return Math.abs(this.opp.y - this.me.y) <= this.opp.depthTol * (k || 1); }

    // 慣性込みで、今から入力を離したら止まる位置までの距離（飛行は滑るので早めにブレーキ）
    stopOffset() {
      const me = this.me, b = Math.max(1, (me.mv.brake || 99999) * me.moveMult);
      return { x: me.vx * Math.abs(me.vx) / (2 * b), y: me.vy * Math.abs(me.vy) / (2 * b) };
    }

    inRange() {
      const me = this.me, opp = this.opp;
      if (!this.depthAligned(0.75)) return false;
      const facing = opp.x >= me.x ? 1 : -1;
      const a = me.attackBox;
      const x = facing === 1 ? me.x + a.near : me.x - a.near - a.reach;
      // 少し内側で判断（ギリギリだと外れやすいので）
      const r = { x: x + (facing === 1 ? 0 : a.reach * 0.15), y: me.y - a.top, w: a.reach * 0.85, h: a.top - a.bottom };
      return rectsOverlap(r, opp.bodyRect());
    }

    // 背中側の壁に追い詰められているか
    cornered() {
      const me = this.me, dirX = this.opp.x >= me.x ? 1 : -1;
      const back = dirX > 0 ? me.x - CFG.field.left : CFG.field.right - me.x;
      return back < (CFG.ai.cornerMargin || 70);
    }

    // プレイヤーに隙がある（空振り硬直中、または攻撃後の待ち時間中）
    oppVulnerable(now) {
      const o = this.opp;
      if (o.state === 'hurt' || o.state === 'down' || o.state === 'downLoop') return false;
      // 判定が外れたあとの戻りの動作中も隙とみなす
      if (o.state === 'attack' && o.hitDone && !o.lastSwingHit) return true;
      return o.isRecovering() || (o.canAct() && now < o.cooldownUntil && o.attackSerial > 0);
    }

    // 奥行きの空いている方向（回り込み・回避用）
    roomyDepthDir() {
      const me = this.me, f = CFG.field;
      const up = me.y - f.top, down = f.bottom - me.y;
      // プレイヤーと違う奥行きへずれる方が良いが、端に近ければ広い方へ
      const away = me.y <= this.opp.y ? -1 : 1;
      if ((away < 0 && up < 50) || (away > 0 && down < 50)) return up > down ? -1 : 1;
      return away;
    }

    // プレイヤーの攻撃が自分より先に当たりそうなら、攻撃を出さない
    safeToAttack() {
      const o = this.opp;
      if (!o.inStartup()) return true;
      const oppLeft = o.hitTime() - o.stateTime;     // プレイヤーの判定が出るまでの残り
      return oppLeft > this.me.hitTime() + 30;
    }

    stepToward(targetGap, dirX, dy, xScale) {
      // プレイヤーが攻撃を振っている間は、射程の中へは入らない
      if (this.opp.inStartup() && this.opp.isMelee) targetGap = Math.max(targetGap, this.oppReach() + (CFG.ai.spacingMargin || 0));
      // 慣性：止まるまでに進む分を見込んで判断する（行き過ぎ防止）
      const so = this.stopOffset();
      const ex = Math.abs(this.opp.x - (this.me.x + so.x)) - targetGap; // 正 = 遠い
      let mx = Math.abs(ex) > 6 ? (ex > 0 ? dirX : -dirX) : 0;
      if (mx === -dirX && this.cornered()) mx = 0;
      const dy2 = dy - so.y;
      const my = Math.abs(dy2) > 6 ? Math.sign(dy2) : 0;
      const len = Math.hypot(mx, my) || 1;
      return { x: mx / len * (xScale || 1), y: my / len };
    }

    // 戻り値: { move, attack }
    update(now, game) {
      const A = CFG.ai, me = this.me, opp = this.opp;
      this.game = game || this.game;
      if (now < this.startAt || !me.canAct()) return { move: { x: 0, y: 0 }, attack: false };
      const dirX = opp.x >= me.x ? 1 : -1;
      const dy = opp.y - me.y;
      let attack = false;

      // ---- プレイヤーが振り始めた：少し遅れて、射程内なら下がる／奥行きへかわす ----
      if (opp.inStartup()) {
        if (this.evadeSerial !== opp.attackSerial) {
          this.evadeSerial = opp.attackSerial;
          this.evadeDecideAt = now + A.thinkInterval * rand(0.25, 0.65);
          this.evadeDecided = false;
        }
        if (!this.evadeDecided && now >= this.evadeDecideAt) {
          this.evadeDecided = true;
          this.decideEvade(now, dirX);
        }
      }
      if (this.mode === 'evade') {
        if (now >= this.modeUntil) this.mode = 'space';
        else {
          if (!this.evadeDepth && this.cornered()) { this.evadeDepth = true; this.dodgeDir = this.roomyDepthDir(); }
          if (this.evadeVec) this.move = this.evadeVec;
          else this.move = this.evadeDepth ? { x: -dirX * 0.3, y: this.dodgeDir } : { x: -dirX, y: 0 };
          return { move: this.move, attack: false };
        }
      }

      // ---- 弾・魔法のキャラ：距離を取って撃つ ----
      if (!me.isMelee) return this.updateRanged(now, dirX, dy);

      // ---- 隙を突く（毎フレーム監視、反応の遅れはごく短い） ----
      if (this.oppVulnerable(now)) {
        if (this.seenSerial !== opp.attackSerial) {
          this.seenSerial = opp.attackSerial;
          const lunge = this.gapX() - this.myReach() * 0.85;
          if (Math.random() < A.punishChance && lunge <= (A.punishLungeDist || 0) && this.depthAligned(1.6)) {
            this.mode = 'punish';
            this.modeUntil = Infinity;
            this.punishAt = now + (A.punishReactionMs || 0);
            this.attackAt = 0;
          }
        }
      } else if (this.mode === 'punish') {
        this.mode = 'space';   // 隙が終わったら深追いしない
      }

      if (this.mode === 'punish') {
        if (now >= this.punishAt && now >= me.cooldownUntil && this.inRange()) {
          attack = true;
          this.mode = 'space';
        } else {
          this.move = this.stepToward(this.myReach() * 0.6, dirX, dy);
        }
        return { move: attack ? { x: 0, y: 0 } : this.move, attack: attack };
      }

      // ---- 自分からの攻撃（予約済み） ----
      if (this.attackAt && now >= this.attackAt) {
        this.attackAt = 0;
        if (this.inRange() && now >= me.cooldownUntil && this.safeToAttack()) {
          attack = true;
          if (this.mode === 'engage') this.mode = 'space';
        }
      }

      if (now >= this.nextThink) {
        this.nextThink = now + A.thinkInterval * rand(0.7, 1.3);
        this.think(now);
      }
      return { move: attack ? { x: 0, y: 0 } : this.move, attack: attack };
    }

    decideEvade(now, dirX) {
      const A = CFG.ai, opp = this.opp, me = this.me;
      this.evadeVec = null;
      const kind = opp.weapon.kind || 'melee';
      if (kind === 'projectile') {
        // 弾：同じ奥行きで正面にいるなら、奥行き方向へずれる
        const facingMe = (me.x - opp.x) * opp.facing > 0;
        if (!facingMe || Math.abs(opp.y - me.y) > opp.depthTol + 14) return;
        if (Math.random() >= A.backstepChance + A.dodgeChance) return;
        const P = opp.weapon.projectile || {};
        const travel = Math.max(0, this.gapX() - 40) / Math.max(1, P.speed || 700) * 1000;
        this.mode = 'evade';
        this.evadeDepth = true;
        this.dodgeDir = this.roomyDepthDir();
        this.modeUntil = now + Math.max(200, opp.hitTime() - opp.stateTime + travel + 120);
        this.attackAt = 0;
        return;
      }
      if (kind === 'area') {
        // 魔法：予告の魔法陣の中にいるなら、中心から離れる方向へ出る
        const g = this.game;
        const a = g && g.areas.find((x) => x.owner === opp && !x.fireAt);
        if (!a) return;
        const nx = (me.x - a.x) / (a.rx * 1.25), ny = (me.y - a.y) / (a.ry * 1.25);
        if (nx * nx + ny * ny > 1) return;
        if (Math.random() >= A.backstepChance + A.dodgeChance + 0.15) return;
        let vx = me.x - a.x, vy = (me.y - a.y) * (a.rx / a.ry);
        if (Math.abs(vx) < 4 && Math.abs(vy) < 4) vx = -dirX;
        // 壁際なら奥行き方向を優先
        const f = CFG.field;
        if ((vx < 0 && me.x - f.left < 60) || (vx > 0 && f.right - me.x < 60)) { vx = 0; vy = vy || this.roomyDepthDir(); }
        const l = Math.hypot(vx, vy) || 1;
        this.evadeVec = { x: vx / l, y: vy / l };
        this.mode = 'evade';
        this.modeUntil = now + Math.max(200, opp.hitTime() - opp.stateTime + (a.expandMs || 160) + 60);
        this.attackAt = 0;
        return;
      }
      const danger = this.gapX() < this.oppReach() + 10 && this.oppDepthAligned(1.2);
      if (!danger || this.mode === 'punish') return;
      const r = Math.random();
      if (r < A.backstepChance) {
        this.evadeDepth = this.cornered();   // 壁際なら奥行きへ
      } else if (r < A.backstepChance + A.dodgeChance) {
        this.evadeDepth = true;
      } else {
        return;
      }
      this.mode = 'evade';
      this.modeUntil = now + Math.max(200, opp.hitTime() - opp.stateTime + 80);
      this.dodgeDir = this.roomyDepthDir();
      this.attackAt = 0;
    }

    // 弾・魔法のキャラの動き：相手の近接の射程の外（好みの距離）を保ち、撃てるときに撃つ
    updateRanged(now, dirX, dy) {
      const A = CFG.ai, me = this.me, opp = this.opp;
      const kind = me.weapon.kind;
      const P = me.weapon.projectile || {}, AR = me.weapon.area || {};
      const front = kind === 'area' && AR.anchor === 'front';
      const frontReach = (AR.offsetX != null ? AR.offsetX : (AR.radiusX || 85)) + (AR.radiusX || 85) * 0.7;
      const maxR = kind === 'projectile' ? (P.range || 700) * 0.85 : front ? frontReach : (AR.range || 480) + 20;
      const pref = front ? (AR.offsetX != null ? AR.offsetX : (AR.radiusX || 85))
        : Math.min(maxR - 40, Math.max(this.oppReach() + 90, kind === 'projectile' ? 330 : 300));
      const gap = this.gapX();
      let attack = false;

      // 予約した攻撃
      if (this.attackAt && now >= this.attackAt) {
        this.attackAt = 0;
        if (now >= me.cooldownUntil && this.canFire(maxR) && this.safeToAttack()) attack = true;
      }
      if (attack) return { move: { x: 0, y: 0 }, attack: true };

      if (now >= this.nextThink) {
        this.nextThink = now + A.thinkInterval * rand(0.7, 1.3);
        const jitter = rand(0, A.decisionJitterMs || 0);
        if (this.mode !== 'space' && now >= this.modeUntil) this.mode = 'space';
        // 壁際で近寄られたら奥行きへ回り込む
        if (this.mode === 'space' && this.cornered() && gap < pref * 0.6) {
          this.mode = 'sidestep';
          this.modeUntil = now + A.sidestepMs;
          this.dodgeDir = this.roomyDepthDir();
        }
        // 撃つ（隙があればすぐ、なければ確率で）
        const chance = this.oppVulnerable(now) ? 0.9 : A.attackChance;
        if (!this.attackAt && now >= me.cooldownUntil && this.canFire(maxR) && Math.random() < chance) {
          this.attackAt = now + A.reactionDelay * rand(0.5, 1.2) + jitter;
        }
        if (this.mode === 'sidestep') {
          this.move = { x: dirX * 0.5, y: this.dodgeDir };
        } else {
          // 投擲は奥行きを揃える。魔法は揃えなくてよい（少しずらして相手の近接を避ける）
          let ty = dy;
          if (kind === 'area' && !front) ty = Math.abs(dy) < 50 ? 0 : dy * 0.5;
          this.move = this.stepToward(pref, dirX, ty);
          // 近すぎるときは（壁際でなければ）下がる優先
          if (gap < pref * 0.7 && !this.cornered()) this.move = { x: -dirX, y: this.move.y * 0.5 };
        }
      }
      return { move: this.move, attack: false };
    }
    canFire(maxR) {
      const me = this.me, opp = this.opp;
      if (opp.state === 'down' || opp.state === 'downLoop') return false;
      if (this.gapX() > maxR) return false;
      if (me.weapon.kind === 'projectile') return Math.abs(opp.y - me.y) <= me.depthTol * 0.6;
      const AR = me.weapon.area || {};
      if (AR.anchor === 'front') return Math.abs(opp.y - me.y) <= (AR.radiusY || 38) * 0.7 && (opp.x - me.x) * (opp.x >= me.x ? 1 : -1) >= 0;
      return true;
    }

    think(now) {
      const A = CFG.ai, me = this.me, opp = this.opp;
      const dx = opp.x - me.x, dy = opp.y - me.y;
      const dirX = dx >= 0 ? 1 : -1;
      const gap = this.gapX();
      const threat = this.oppReach();
      const jitter = rand(0, A.decisionJitterMs || 0);

      if (this.mode !== 'space' && now >= this.modeUntil) this.mode = 'space';

      // ---- 回り込み（壁際から抜ける） ----
      if (this.mode === 'sidestep') {
        this.move = { x: dirX * 0.6, y: this.dodgeDir };
        return;
      }

      // ---- 射程内：自分から攻撃することもある ----
      if (this.inRange() && !this.attackAt && now >= me.cooldownUntil && Math.random() < A.attackChance) {
        this.attackAt = now + A.reactionDelay * rand(0.6, 1.4) + jitter;
      }

      // ---- 踏み込み（受け身になりすぎないように）。相手が弾・魔法なら距離を取られると不利なので常に詰める ----
      if (this.mode === 'space' && (!opp.isMelee || Math.random() < A.engageChance)) {
        this.mode = 'engage';
        this.modeUntil = now + A.engageMs;
      }
      if (this.mode === 'engage') {
        if (this.inRange() && this.safeToAttack()) {
          if (!this.attackAt && now >= me.cooldownUntil) this.attackAt = now + A.reactionDelay * rand(0.3, 0.8) + jitter;
          this.move = { x: 0, y: Math.abs(dy) > 6 ? Math.sign(dy) * 0.6 : 0 };
        } else {
          // 相手が投擲なら、遠いうちは奥行きを少しずらして弾の線を外しながら近づき、近くで揃える
          let ty = dy;
          if (opp.weapon.kind === 'projectile' && this.gapX() > this.myReach() * 1.4) {
            if (!this.zigDir) this.zigDir = this.roomyDepthDir();
            const off = opp.depthTol + 24;
            const want = opp.y - this.zigDir * off;
            if (want < CFG.field.top + 10 || want > CFG.field.bottom - 10) this.zigDir = -this.zigDir;
            ty = (opp.y - this.zigDir * off) - me.y;
          } else {
            this.zigDir = 0;
          }
          this.move = this.stepToward(this.myReach() * 0.6, dirX, ty);
        }
        return;
      }

      // ---- 間合い取り：プレイヤーの射程のすぐ外で待ち、ときどき踏み込んで誘う ----
      if (now >= this.feintUntil && !opp.inStartup() && Math.random() < A.feintChance) this.feintUntil = now + A.feintMs;
      const target = now < this.feintUntil ? threat - A.feintDepth : threat + A.spacingMargin;
      // 追い詰められていて、プレイヤーが近いなら奥行き方向へ回り込む
      if (this.cornered() && gap < threat + A.spacingMargin) {
        this.mode = 'sidestep';
        this.modeUntil = now + A.sidestepMs;
        this.dodgeDir = this.roomyDepthDir();
        this.move = { x: dirX * 0.6, y: this.dodgeDir };
        return;
      }
      this.move = this.stepToward(target, dirX, dy);
    }
  }

  // ------------------------------------------------------------
  // ゲーム本体
  // ------------------------------------------------------------
  const Game = {
    phase: 'title',      // title / intro / fight / ko / result
    time: 0,
    lastTs: 0,
    playerChar: CHAR_IDS[0] || 'angel',
    player: null,
    enemy: null,
    ai: null,
    round: 0,
    wins: { player: 0, enemy: 0 },
    roundsPlayed: 0,
    phaseStart: 0,
    roundTimeLeft: 0,
    message: null,       // { text, sub, until, color }
    debug: !!CFG.debugHitboxes,
    lastResult: null,
    effects: [],
    projectiles: [],     // 投擲の弾
    areas: [],           // 魔法の範囲（予告の魔法陣 → 発動）
    opponentChar: 'random', // 相手のキャラ（'random' = ランダム。スマブラ式）

    get fighting() { return this.phase === 'fight'; },

    init() {
      this.bindUi();
      window.SpriteBank.loadAll().catch((e) => console.warn(e));
      requestAnimationFrame(this.loop.bind(this));
    },

    // キャラ選択ボタンを assets/config.js の characters から作る（あなた／あいて の2列。どちらにもランダムあり）
    buildSelect() {
      const self = this;
      const W_ = CFG.weaponTypes || {}, M_ = CFG.moveTypes || {};
      const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
      document.querySelectorAll('.char-select[data-side]').forEach((box) => {
        const side = box.dataset.side;
        box.innerHTML = '';
        const add = (id, html, cls) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'char-btn ' + cls;
          b.dataset.char = id;
          b.dataset.side = side;
          b.innerHTML = html;
          b.addEventListener('click', () => (side === 'player' ? self.selectChar(id) : self.selectOpponent(id)));
          box.appendChild(b);
        };
        CHAR_IDS.forEach((id) => {
          const d = ASSETS.characters[id];
          const wl = (d.weapon && d.weapon.label) || (W_[d.weaponType] || W_.sword || {}).label || '';
          const ml = (d.move && d.move.label) || (M_[d.moveType] || M_.fly || {}).label || '';
          add(id,
            '<span class="char-portrait"><span class="char-icon"></span></span>' +
            '<span class="char-name">' + esc(d.name || id) + '</span>' +
            '<span class="char-type">' + esc(wl) + (wl && ml ? ' × ' : '') + esc(ml) + '</span>' +
            (d.selectNote ? '<span class="char-note">' + d.selectNote + '</span>' : ''),
            themeOf(id));
        });
        add('random',
          '<span class="char-portrait"><span class="char-icon"><span class="random-mark">?</span></span></span>' +
          '<span class="char-name">ランダム</span><span class="char-type">おまかせ</span>', 'random');
        box.classList.toggle('compact', CHAR_IDS.length + 1 > 3);
      });
      this.selectChar(this.playerChar);
      this.selectOpponent(this.opponentChar);
    },

    bindUi() {
      const self = this;
      this.buildSelect();
      document.getElementById('start-btn').addEventListener('click', () => self.startMatch());
      document.getElementById('retry-btn').addEventListener('click', () => self.startMatch());
      document.getElementById('title-btn').addEventListener('click', () => self.toTitle());
      document.getElementById('fullscreen-btn').addEventListener('click', () => {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
          Promise.resolve(req.call(el)).then(() => {
            if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
          }).catch(() => {});
        }
      });
      window.Input.onKey((k) => {
        if (k === 'h') { self.debug = !self.debug; return; }
        if (self.phase === 'title') {
          // A / D：自分のキャラ、← / →：相手のキャラ（ランダム含めて順に切り替え）
          const list = CHAR_IDS.concat(['random']);
          const cycle = (cur, d) => list[(list.indexOf(cur) + d + list.length) % list.length];
          if (k === 'a' || k === 'd') {
            self.selectChar(cycle(self.playerChar, k === 'd' ? 1 : -1));
          } else if (k === 'arrowleft' || k === 'arrowright') {
            self.selectOpponent(cycle(self.opponentChar, k === 'arrowright' ? 1 : -1));
          } else if (k === 'enter') {
            self.startMatch();
          }
        } else if (self.phase === 'result') {
          if (k === 'enter') self.startMatch();
          else if (k === 'escape') self.toTitle();
        }
      });
    },

    selectChar(id) {
      if (id !== 'random' && CHAR_IDS.indexOf(id) < 0) return;
      this.playerChar = id;
      this.markSelected('player', id);
    },
    markSelected(side, id) {
      document.querySelectorAll('.char-btn[data-side="' + side + '"]').forEach((b) => {
        const on = b.dataset.char === id;
        b.classList.toggle('selected', on);
        // 枠の中でスクロールしているときは、選んだボタンが見えるようにする（画面全体は動かさない）
        if (on && b.parentElement && b.parentElement.scrollHeight > b.parentElement.clientHeight) {
          const box = b.parentElement;
          if (b.offsetTop < box.scrollTop) box.scrollTop = b.offsetTop - 6;
          else if (b.offsetTop + b.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = b.offsetTop + b.offsetHeight - box.clientHeight + 6;
        }
      });
    },
    selectOpponent(id) {
      if (id !== 'random' && CHAR_IDS.indexOf(id) < 0) return;
      this.opponentChar = id;
      this.markSelected('opponent', id);
    },
    // ランダムは試合のたびに選び直す（同キャラ対戦もあり）
    pickChar(sel) {
      if (sel !== 'random' && CHAR_IDS.indexOf(sel) >= 0) return sel;
      return CHAR_IDS[Math.floor(Math.random() * CHAR_IDS.length)];
    },

    showScreen(id) {
      document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    },

    toTitle() {
      this.phase = 'title';
      this.player = this.enemy = null;
      this.showScreen('title-screen');
    },

    startMatch() {
      const playerChar = this.pickChar(this.playerChar);
      const enemyChar = this.pickChar(this.opponentChar);
      this.player = new Fighter(playerChar, true);
      this.enemy = new Fighter(enemyChar, false);
      this.ai = new AI(this.enemy, this.player);
      this.wins = { player: 0, enemy: 0 };
      this.roundsPlayed = 0;
      this.round = 0;
      this.showScreen(null);
      this.startRound();
    },

    maxRounds() { return CFG.rounds + (CFG.tiebreakerRound ? 1 : 0); },
    winsNeeded() { return Math.floor(CFG.rounds / 2) + 1; },

    startRound() {
      this.round = this.roundsPlayed + 1;
      this.player.reset(250, 420);
      this.enemy.reset(710, 420);
      this.ai.reset(this.time);
      this.effects = [];
      this.projectiles = [];
      this.areas = [];
      window.Input.clear();
      this.phase = 'intro';
      this.phaseStart = this.time;
      this.roundTimeLeft = CFG.roundTimeLimit;
      const isFinal = this.round > CFG.rounds;
      this.message = {
        text: isFinal ? '決着ラウンド' : 'ラウンド ' + this.round,
        sub: '', until: this.time + CFG.roundIntroMs * 0.6, color: '#fff'
      };
    },

    resolveAttack(attacker, defender) {
      const ar = attacker.attackRect();
      const br = defender.bodyRect();
      const depthOk = Math.abs(attacker.y - defender.y) <= attacker.depthTol;
      const hit = this.phase === 'fight' && depthOk && rectsOverlap(ar, br) &&
        this.time >= defender.invulnUntil && defender.state !== 'down' && defender.state !== 'downLoop';
      attacker.lastAttackRect = ar;
      attacker.lastAttackHit = hit;
      attacker.attackFlashUntil = this.time + CFG.hitboxFlashMs;
      if (hit) {
        defender.takeHit(attacker, this.time);
        this.effects.push({ x: (Math.max(ar.x, br.x) + Math.min(ar.x + ar.w, br.x + br.w)) / 2, y: defender.y - defender.def.height * 0.55, t: this.time, color: attacker.colors.hit });
        if (defender.life <= 0) this.onKO(attacker === this.player ? 'player' : 'enemy', 'KO!');
      }
      return hit;
    },

    canBeHit(defender) {
      return this.phase === 'fight' && this.time >= defender.invulnUntil && defender.state !== 'down' && defender.state !== 'downLoop';
    },
    opponentOf(f) { return f === this.player ? this.enemy : this.player; },

    // ---- 投擲：弾 ----
    spawnProjectile(owner) {
      const P = owner.weapon.projectile || {};
      const dir = owner.facing;
      const x = owner.x + dir * (P.spawnX != null ? P.spawnX : 40);
      this.projectiles.push({
        owner: owner, x: x, y: owner.y, startX: x, dir: dir,
        speed: P.speed || 700, radius: P.radius != null ? P.radius : 10, range: P.range || 700,
        height: P.height != null ? P.height : 95, size: P.size || 12,
        depthTol: owner.depthTol, color: owner.colors.slash, sprite: P.sprite || null, t0: this.time, dead: false
      });
    },
    updateProjectiles(dt) {
      const f = CFG.field;
      this.projectiles.forEach((p) => {
        if (p.dead) return;
        const prevX = p.x;
        p.x += p.dir * p.speed * dt / 1000;
        const def = this.opponentOf(p.owner);
        if (def && this.canBeHit(def) && Math.abs(def.y - p.y) <= p.depthTol) {
          const br = def.bodyRect();
          // このフレームで弾が通った範囲（すり抜け防止）と体の重なり
          const x0 = Math.min(prevX, p.x) - p.radius, x1 = Math.max(prevX, p.x) + p.radius;
          if (x1 > br.x && x0 < br.x + br.w) {
            p.dead = true;
            this.applyRangedHit(p.owner, def, p.x, p.dir);
            return;
          }
        }
        if (Math.abs(p.x - p.startX) > p.range || p.x < f.left - 80 || p.x > f.right + 80) p.dead = true;
      });
      this.projectiles = this.projectiles.filter((p) => !p.dead);
    },

    // ---- 魔法：範囲 ----
    // 攻撃開始時：相手の足元（届かなければ range の距離）に魔法陣を置く。発動までは予告だけで当たらない
    placeArea(owner, opp) {
      const A = owner.weapon.area || {};
      const f = CFG.field;
      const range = A.range || 480;
      const lead = (A.lead || 0) * owner.hitTime() / 1000;
      let tx = opp.x + (opp.vx || 0) * lead, ty = opp.y + (opp.vy || 0) * lead;
      if (A.anchor === 'front') {
        // 自分の正面の決まった位置に出す（ブレスなど）。offsetX = キャラ中心から範囲の中心までの距離
        tx = owner.x + owner.facing * (A.offsetX != null ? A.offsetX : (A.radiusX || 85));
        ty = owner.y;
      } else {
        const dx = tx - owner.x, dy = ty - owner.y, d = Math.hypot(dx, dy);
        if (d > range) { tx = owner.x + dx / d * range; ty = owner.y + dy / d * range; }
      }
      this.areas = this.areas.filter((a) => a.owner !== owner);
      this.areas.push({
        owner: owner, serial: owner.attackSerial, x: clamp(tx, f.left, f.right), y: clamp(ty, f.top, f.bottom),
        rx: A.radiusX || 85, ry: A.radiusY || 38, expandMs: A.expandMs || 160, lingerMs: A.lingerMs || 220,
        color: owner.colors.slash, sprite: A.sprite || null, t0: this.time, fireAt: 0, hitDone: false, dead: false
      });
    },
    // 判定のタイミング：魔法陣が広がり始める
    triggerArea(owner) {
      const a = this.areas.find((x) => x.owner === owner && x.serial === owner.attackSerial && !x.fireAt);
      if (a) a.fireAt = this.time;
    },
    areaRadiusK(a) {
      if (!a.fireAt) return 0;
      return clamp((this.time - a.fireAt) / Math.max(1, a.expandMs), 0, 1);
    },
    updateAreas() {
      this.areas.forEach((a) => {
        if (!a.fireAt) {
          // 予備動作中に詠唱がつぶされたら（被ダメ・KO）魔法陣は消える
          if (a.owner.state !== 'attack' || a.owner.attackSerial !== a.serial) a.dead = true;
          return;
        }
        const t = this.time - a.fireAt;
        if (t > a.expandMs + a.lingerMs) { a.dead = true; return; }
        if (a.hitDone) return;
        const k = this.areaRadiusK(a);
        const def = this.opponentOf(a.owner);
        if (!def || !this.canBeHit(def) || k <= 0) return;
        const nx = (def.x - a.x) / (a.rx * k), ny = (def.y - a.y) / (a.ry * k);
        if (nx * nx + ny * ny <= 1) {
          a.hitDone = true;
          const dir = def.x !== a.x ? Math.sign(def.x - a.x) : a.owner.facing;
          this.applyRangedHit(a.owner, def, def.x, dir);
        }
      });
      this.areas = this.areas.filter((a) => !a.dead);
    },
    applyRangedHit(attacker, defender, hx, dir) {
      defender.takeHit(attacker, this.time, { dir: dir });
      attacker.lastAttackHit = true;
      this.effects.push({ x: hx, y: defender.y - defender.def.height * 0.55, t: this.time, color: attacker.colors.hit });
      if (defender.life <= 0) this.onKO(attacker === this.player ? 'player' : 'enemy', 'KO!');
    },

    onKO(winner, text) {
      if (this.phase !== 'fight') return;
      this.phase = 'ko';
      this.phaseStart = this.time;
      this.roundsPlayed++;
      if (winner) this.wins[winner]++;
      if (winner === 'player') this.player.setState('win');
      else if (winner === 'enemy') this.enemy.setState('win');
      this.message = { text: text, sub: '', until: this.time + CFG.koPauseMs, color: '#ffd84a' };
    },

    afterRound() {
      const need = this.winsNeeded();
      const w = this.wins;
      const decided = w.player >= need || w.enemy >= need;
      const basicDone = this.roundsPlayed >= CFG.rounds;
      if (decided || this.roundsPlayed >= this.maxRounds() || (basicDone && !CFG.tiebreakerRound && w.player === w.enemy) ||
          (basicDone && w.player !== w.enemy)) {
        this.endMatch();
      } else {
        this.startRound();
      }
    },

    endMatch() {
      this.phase = 'result';
      const w = this.wins;
      const el = document.getElementById('result-text');
      let r;
      if (w.player > w.enemy) { r = 'win'; el.textContent = '勝利！'; }
      else if (w.player < w.enemy) { r = 'lose'; el.textContent = '敗北…'; }
      else { r = 'draw'; el.textContent = '引き分け'; }
      el.className = 'result-text' + (r === 'lose' ? ' lose' : '');
      // 結果パネルの色：勝った側の陣営（引き分けはプレイヤー側）
      const tintChar = r === 'lose' ? this.enemy.charId : this.player.charId;
      document.getElementById('result-screen').dataset.char = themeOf(tintChar);
      this.lastResult = r;
      const pName = ASSETS.characters[this.player.charId].name;
      const eName = ASSETS.characters[this.enemy.charId].name;
      document.getElementById('result-detail').textContent =
        'あなた（' + pName + '） ' + w.player + ' - ' + w.enemy + ' 相手（' + eName + '）';
      this.showScreen('result-screen');
    },

    loop(ts) {
      const dt = this.lastTs ? Math.min(50, ts - this.lastTs) : 16;
      this.lastTs = ts;
      this.time += dt;
      try {
        this.update(dt);
        this.render();
      } catch (e) {
        console.error(e);
      }
      requestAnimationFrame(this.loop.bind(this));
    },

    update(dt) {
      const now = this.time;
      if (!this.player) return;

      if (this.phase === 'intro') {
        const t = now - this.phaseStart;
        if (t >= CFG.roundIntroMs * 0.6 && this.message && this.message.text !== 'FIGHT!') {
          this.message = { text: 'FIGHT!', sub: '', until: now + CFG.roundIntroMs * 0.4 + 300, color: '#ffd84a' };
        }
        if (t >= CFG.roundIntroMs) { this.phase = 'fight'; window.Input.clear(); }
      }

      let pMove = { x: 0, y: 0 }, pAtk = false, eMove = { x: 0, y: 0 }, eAtk = false;
      if (this.phase === 'fight') {
        pMove = window.Input.getMove();
        pAtk = window.Input.consumeAttack();
        const pDodge = window.Input.consumeDodge();
        if (pDodge) this.player.tryDodge(pDodge, now);
        const d = this.ai.update(now, this);
        eMove = d.move; eAtk = d.attack;
        if (CFG.roundTimeLimit > 0) {
          this.roundTimeLeft -= dt / 1000;
          if (this.roundTimeLeft <= 0) {
            this.roundTimeLeft = 0;
            const p = this.player.life, e = this.enemy.life;
            this.onKO(p > e ? 'player' : e > p ? 'enemy' : null, 'タイムアップ');
          }
        }
      } else {
        window.Input.consumeAttack();
        if (window.Input.consumeDodge) window.Input.consumeDodge();
      }

      // 攻撃の終了判定が同時に起きても公平になるよう、順番を毎フレーム入れ替える
      if (Math.floor(now / 16) % 2 === 0) {
        this.player.update(dt, now, pMove, pAtk, this.enemy, this);
        this.enemy.update(dt, now, eMove, eAtk, this.player, this);
      } else {
        this.enemy.update(dt, now, eMove, eAtk, this.player, this);
        this.player.update(dt, now, pMove, pAtk, this.enemy, this);
      }

      this.updateProjectiles(dt);
      this.updateAreas();
      this.separate();

      if (this.phase === 'ko' && now - this.phaseStart >= CFG.koPauseMs) this.afterRound();
      this.effects = this.effects.filter((e) => now - e.t < 300);
    },

    // 同じ奥行きで体が重なりすぎないよう、左右に軽く押し離す
    separate() {
      const a = this.player, b = this.enemy;
      if (a.state === 'down' || b.state === 'down' || a.state === 'downLoop' || b.state === 'downLoop') return;
      if (Math.abs(a.y - b.y) > CFG.depthTolerance) return; // 体の重なりは武器と関係なく共通の値
      const minGap = (a.bodyRect().w + b.bodyRect().w) / 2 * CFG.separation;
      const dx = b.x - a.x;
      if (Math.abs(dx) >= minGap) return;
      const dir = dx !== 0 ? Math.sign(dx) : a.facing;
      const push = (minGap - Math.abs(dx)) / 2;
      a.x = clamp(a.x - dir * push, CFG.field.left, CFG.field.right);
      b.x = clamp(b.x + dir * push, CFG.field.left, CFG.field.right);
    },

    render() {
      const c = ctx;
      c.setTransform(renderRatio, 0, 0, renderRatio, 0, 0);
      c.drawImage(bgCanvas, 0, 0);
      const now = this.time;

      if (!this.player) {
        // タイトル背景：キャラを飾りで表示
        // 選んでいるキャラ（ランダムは最初の2キャラ）を左右に飾る
        const lc = this.playerChar !== 'random' ? this.playerChar : CHAR_IDS[0];
        const rc = this.opponentChar !== 'random' ? this.opponentChar : (CHAR_IDS[1] || CHAR_IDS[0]);
        c.save();
        c.translate(250, 470); drawTitleChar(c, lc, now); c.restore();
        c.save();
        c.translate(710, 470); c.scale(-1, 1); drawTitleChar(c, rc, now + 500); c.restore();
        return;
      }

      // 魔法陣（床に描く。キャラより先）
      this.areas.forEach((a) => drawAreaFloor(c, a, this, now));
      // 奥行き順（Y が小さい＝奥から）に描画。弾も同じ順番に混ぜる
      const list = [this.player, this.enemy].concat(this.projectiles).sort((a, b) => a.y - b.y);
      list.forEach((f) => {
        if (f instanceof Fighter) f.draw(c, now, this.debug);
        else drawProjectile(c, f, now, this.debug);
      });
      // 魔法の発動（光の柱。キャラの上に重ねる）
      this.areas.forEach((a) => drawAreaBurst(c, a, this, now));

      // ヒットエフェクト
      this.effects.forEach((e) => {
        const k = (now - e.t) / 300;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(' + e.color + ',' + (1 - k) + ')';
        c.lineWidth = 6 * (1 - k) + 1;
        c.beginPath();
        c.arc(e.x, e.y, 10 + k * 50, 0, Math.PI * 2);
        c.stroke();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          c.beginPath();
          c.moveTo(e.x + Math.cos(a) * (8 + k * 20), e.y + Math.sin(a) * (8 + k * 20));
          c.lineTo(e.x + Math.cos(a) * (20 + k * 60), e.y + Math.sin(a) * (20 + k * 60));
          c.stroke();
        }
        c.restore();
      });

      this.renderHud(c, now);

      // メッセージ（ラウンド開始・KO）
      if (this.message && now < this.message.until) {
        drawBanner(c, this.message, now);
      }

      if (this.debug) {
        c.save();
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(W / 2 - 110, H - 26, 220, 22);
        c.fillStyle = '#7f7';
        c.font = '13px sans-serif';
        c.textAlign = 'center';
        c.fillText('当たり判定表示中（H で切替）', W / 2, H - 10);
        c.restore();
      }
    },

    renderHud(c, now) {
      const drawSide = (f, left, label) => {
        const name = ASSETS.characters[f.charId].name;
        const pw = 300, ph = 96;
        const px = left ? 10 : W - 10 - pw;
        drawPlate(c, px, 8, pw, ph, themeOf(f.charId), left);
        const x0 = left ? px + 22 : px + pw - 22;
        c.save();
        c.textAlign = left ? 'left' : 'right';
        c.textBaseline = 'alphabetic';
        // 名前（長い表示名はプレートに収まるまで少し小さくする）
        const title = label + '：' + name;
        let nameSize = 17;
        c.font = '800 ' + nameSize + 'px ' + FONT_JP;
        const nameMax = pw - 44;
        while (nameSize > 13 && c.measureText(title).width > nameMax) {
          nameSize--;
          c.font = '800 ' + nameSize + 'px ' + FONT_JP;
        }
        c.lineWidth = 4; c.lineJoin = 'round';
        c.strokeStyle = 'rgba(10,4,6,0.9)';
        c.fillStyle = '#fff4d6';
        c.strokeText(title, x0, 34);
        c.fillText(title, x0, 34);
        // ライフ（宝石）
        // ライフの数はキャラごと（重量級は多い）。多いときは間隔と大きさを詰めて同じ幅に収める
        const n = f.maxLife;
        const step = Math.min(34, 236 / Math.max(1, n - 1 + 0.7));
        const gr = Math.min(12, step * 0.36);
        for (let i = 0; i < n; i++) {
          const cx = left ? x0 + 12 + i * step : x0 - 12 - i * step;
          drawGem(c, cx, 56, gr, i < f.life, themeOf(f.charId), now);
        }
        // 勝利ラウンド数（星）
        for (let i = 0; i < this.winsNeeded(); i++) {
          const cx = left ? x0 + 8 + i * 22 : x0 - 8 - i * 22;
          const won = i < (left ? this.wins.player : this.wins.enemy);
          drawStar(c, cx, 84, 8, won);
        }
        if (f.buff) {
          c.font = '800 14px ' + FONT_JP;
          const tx = left ? x0 + 60 : x0 - 60;
          const pulse = 0.65 + 0.35 * Math.sin(now * 0.012);
          c.shadowColor = 'rgba(' + f.colors.buffGlow + ',' + pulse + ')';
          c.shadowBlur = 10;
          c.lineWidth = 3;
          c.strokeText('速度アップ中！', tx, 89);
          c.fillStyle = f.colors.buffText;
          c.fillText('速度アップ中！', tx, 89);
        }
        c.restore();
      };
      drawSide(this.player, true, 'あなた');
      drawSide(this.enemy, false, 'あいて');

      // ラウンド表示（中央の尖ったプレート）
      const rt = this.round > CFG.rounds ? '決着ラウンド' : 'ラウンド ' + this.round + ' / ' + CFG.rounds;
      drawPointedPlate(c, W / 2 - 96, 12, 192, 36);
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '800 18px ' + FONT_JP;
      c.lineWidth = 4; c.lineJoin = 'round';
      c.strokeStyle = 'rgba(10,4,6,0.9)';
      c.strokeText(rt, W / 2, 31);
      c.fillStyle = goldFill(c, 20, 42);
      c.fillText(rt, W / 2, 31);
      if (CFG.roundTimeLimit > 0) {
        c.font = '700 32px ' + FONT_EN;
        const tt = String(Math.ceil(this.roundTimeLeft));
        c.lineWidth = 5;
        c.strokeText(tt, W / 2, 72);
        c.fillStyle = goldFill(c, 56, 88);
        c.fillText(tt, W / 2, 72);
      }
      c.restore();
    }
  };

  // 倒れる途中で絵を少しずつ下げる量（画面上の px）。states.down.sinkY / sinkFrom
  //  progress < sinkFrom のあいだは 0、そこから最後（progress = 1）までに sinkY まで、なめらかに下げる
  function downSink(f, progress) {
    const sc = (f.def.states && f.def.states.down) || {};
    const y = sc.sinkY || 0;
    if (!y) return 0;
    const from = sc.sinkFrom != null ? Math.max(0, Math.min(0.99, sc.sinkFrom)) : 0.3;
    const t = Math.max(0, Math.min(1, (progress - from) / (1 - from)));
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOut
    return y * e;
  }

  function drawFallFrame(c, frame, sc, w, h, debug, sink) {
    if (!frame) return false;
    const fw = frame.naturalWidth || frame.width, fh = frame.naturalHeight || frame.height;
    const dw = sc.scale ? fw * sc.scale : w;
    const dh = sc.scale ? fh * sc.scale : h;
    const dx = -dw / 2 + (sc.offsetX || 0), dy = -dh + (sc.offsetY || 0) + (sink || 0);
    c.drawImage(frame, dx, dy, dw, dh);
    if (debug) {
      c.strokeStyle = 'rgba(255,255,255,0.6)';
      c.setLineDash([3, 3]);
      c.strokeRect(dx, dy, dw, dh);
      c.setLineDash([]);
    }
    return true;
  }

  // 倒れる瞬間：コマ送り → APNG → 仮の倒れ方
  function drawFallFighter(c, f, now, debug) {
    const w = f.def.width, h = f.def.height;
    const sc = f.def.states.down || {};
    const kind = window.SpriteBank.resolveDownKind(f.charId);
    const dur = f.duration('down');
    const progress = Math.max(0, Math.min(1, f.stateTime / dur));
    if (kind === 'frames' || kind === 'apng') {
      drawShadow(c, w, f, 'down', progress);
      if (sc.fadeOut) c.globalAlpha *= Math.max(0, 1 - Math.max(0, progress - 0.7) / 0.3);
      if (f.facing === -1) c.scale(-1, 1);
      const seq = kind === 'frames' ? window.SpriteBank.getDownFrames(f.charId) : window.SpriteBank.get(f.charId, 'down');
      const frame = seq.frameAt(f.stateTime, dur, false);
      drawFallFrame(c, frame, sc, w, h, debug, downSink(f, progress)); // 影は床のまま、絵だけ下げる
      return;
    }
    if (f.facing === -1) c.scale(-1, 1);
    window.drawCharacter(c, f.charId, 'down', progress, now, w, h, {
      parts: (f.def.mode || 'parts') !== 'apng' ? window.SpriteBank.getParts(f.charId) : {},
      partsConfig: (f.def.mode || 'parts') !== 'apng' ? f.def.parts : null,
      debug: debug,
      flipped: f.facing === -1
    });
  }

  // 倒れ続け：downLoop パーツ or 1枚絵。無ければ倒れる瞬間の最後のコマ、それも無ければ仮の倒れ方
  function drawDownLoopFighter(c, f, now, debug) {
    const w = f.def.width, h = f.def.height;
    const kind = window.SpriteBank.resolveDownLoopKind(f.charId);
    const dl = f.def.downLoop || {};
    if (kind === 'single') {
      const single = window.SpriteBank.getDownLoopSingle(f.charId);
      if (f.facing === -1) c.scale(-1, 1);
      window.drawDownLoopSingle(c, single.img, dl, now, w, h, {
        debug: debug, flipped: f.facing === -1, stateTime: f.stateTime, sinkY: downSink(f, 1), charId: f.charId
      });
      return;
    }
    if (kind === 'parts') {
      if (f.facing === -1) c.scale(-1, 1);
      const dur = f.duration('downLoop');
      const progress = dur ? ((f.stateTime % dur) / dur) : 0;
      window.drawCharacter(c, f.charId, 'downLoop', progress, now, w, h, {
        parts: window.SpriteBank.getDownParts(f.charId),
        partsConfig: dl,
        debug: debug,
        flipped: f.facing === -1,
        stateTime: f.stateTime,
        sinkY: downSink(f, 1)   // 倒れる瞬間の最後と同じだけ下げる（切り替わりでずれない）
      });
      return;
    }
    const last = window.SpriteBank.lastFallFrame(f.charId);
    if (last) {
      const sc = f.def.states.down || {};
      drawShadow(c, w, f, 'downLoop', 1);
      if (f.facing === -1) c.scale(-1, 1);
      drawFallFrame(c, last, sc, w, h, debug, downSink(f, 1));
      return;
    }
    if (f.facing === -1) c.scale(-1, 1);
    window.drawCharacter(c, f.charId, 'down', 1, now, w, h, {
      parts: (f.def.mode || 'parts') !== 'apng' ? window.SpriteBank.getParts(f.charId) : {},
      partsConfig: (f.def.mode || 'parts') !== 'apng' ? f.def.parts : null,
      debug: debug,
      flipped: f.facing === -1
    });
  }

  function drawShadow(c, w, f, state, progress) {
    if (window.drawGroundShadow && f) {
      window.drawGroundShadow(c, f.charId, { width: w, state: state, progress: progress, facing: f.facing });
      return;
    }
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(0, 0, w * 0.32, 10, 0, 0, Math.PI * 2); c.fill();
  }

  // ------------------------------------------------------------
  // 弾・魔法の描画（画像が無くても図形で描く。sprite を指定すればその画像）
  // ------------------------------------------------------------
  function drawProjectile(c, p, now, debug) {
    const y = p.y - p.height;
    c.save();
    // 床の影
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(p.x, p.y, p.size * 0.9, 4, 0, 0, Math.PI * 2); c.fill();
    const img = optImage(p.sprite);
    if (img) {
      c.translate(p.x, y);
      if (p.dir < 0) c.scale(-1, 1);
      const s = p.size * 2.4;
      c.drawImage(img, -s / 2, -s / 2, s, s);
    } else {
      c.globalCompositeOperation = 'lighter';
      // 尾（進んできた方向へ伸びる光）
      const tail = Math.min(70, Math.abs(p.x - p.startX));
      const g = c.createLinearGradient(p.x - p.dir * tail, 0, p.x, 0);
      g.addColorStop(0, 'rgba(' + p.color + ',0)');
      g.addColorStop(1, 'rgba(' + p.color + ',0.75)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(p.x - p.dir * tail, y);
      c.lineTo(p.x, y - p.size * 0.45);
      c.lineTo(p.x, y + p.size * 0.45);
      c.closePath(); c.fill();
      // 回転する光の刃（4方向の星）
      c.translate(p.x, y);
      c.rotate(now * 0.03 * p.dir);
      const r = p.size;
      const glow = c.createRadialGradient(0, 0, 1, 0, 0, r * 1.6);
      glow.addColorStop(0, 'rgba(255,255,255,0.95)');
      glow.addColorStop(0.4, 'rgba(' + p.color + ',0.8)');
      glow.addColorStop(1, 'rgba(' + p.color + ',0)');
      c.fillStyle = glow;
      c.beginPath(); c.arc(0, 0, r * 1.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, rr = i % 2 === 0 ? r : r * 0.3;
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath(); c.fill();
    }
    c.restore();
    if (debug) {
      c.save();
      c.strokeStyle = 'rgba(255,80,80,0.8)';
      c.setLineDash([4, 3]);
      c.strokeRect(p.x - p.radius, y - 10, p.radius * 2, 20);
      c.beginPath(); c.moveTo(p.x, p.y - p.depthTol); c.lineTo(p.x, p.y + p.depthTol); c.stroke();
      c.restore();
    }
  }

  function ellipsePath(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }

  // 魔法陣：予告（輪郭＋たまっていく内側）→ 発動で光が広がる
  function drawAreaFloor(c, a, game, now) {
    const col = a.color;
    const img = optImage(a.sprite);
    c.save();
    if (!a.fireAt) {
      const o = a.owner;
      const total = Math.max(1, o.hitTime());
      const k = clamp(o.stateTime / total, 0, 1);
      if (img) {
        c.globalAlpha = 0.5 + 0.5 * k;
        c.drawImage(img, a.x - a.rx, a.y - a.ry, a.rx * 2, a.ry * 2);
      } else {
        // 外周（点滅）と、発動に向けて広がる内側
        c.lineWidth = 2.5;
        c.strokeStyle = 'rgba(' + col + ',' + (0.55 + 0.35 * Math.sin(now * 0.025)) + ')';
        ellipsePath(c, a.x, a.y, a.rx, a.ry); c.stroke();
        c.lineWidth = 1.2;
        ellipsePath(c, a.x, a.y, a.rx * 0.72, a.ry * 0.72); c.stroke();
        c.fillStyle = 'rgba(' + col + ',' + (0.12 + 0.22 * k) + ')';
        ellipsePath(c, a.x, a.y, a.rx * k, a.ry * k); c.fill();
        // 回る紋様（6本の線）
        c.strokeStyle = 'rgba(' + col + ',0.6)';
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = now * 0.002 + i * Math.PI / 3;
          c.moveTo(a.x + Math.cos(ang) * a.rx * 0.72, a.y + Math.sin(ang) * a.ry * 0.72);
          c.lineTo(a.x + Math.cos(ang + Math.PI * 2 / 3) * a.rx * 0.72, a.y + Math.sin(ang + Math.PI * 2 / 3) * a.ry * 0.72);
        }
        c.stroke();
      }
    } else {
      const k = game.areaRadiusK(a);
      const t = now - a.fireAt;
      const fade = 1 - clamp((t - a.expandMs) / Math.max(1, a.lingerMs), 0, 1);
      c.globalCompositeOperation = 'lighter';
      if (img) {
        c.globalAlpha = fade;
        c.drawImage(img, a.x - a.rx * k, a.y - a.ry * k, a.rx * 2 * k, a.ry * 2 * k);
      } else {
        const g = c.createRadialGradient(a.x, a.y, 1, a.x, a.y, Math.max(1, a.rx * k));
        g.addColorStop(0, 'rgba(255,255,255,' + (0.8 * fade) + ')');
        g.addColorStop(0.5, 'rgba(' + col + ',' + (0.6 * fade) + ')');
        g.addColorStop(1, 'rgba(' + col + ',0)');
        c.save();
        c.translate(a.x, a.y); c.scale(1, a.ry / a.rx); c.translate(-a.x, -a.y);
        c.fillStyle = g;
        c.beginPath(); c.arc(a.x, a.y, Math.max(0.1, a.rx * k), 0, Math.PI * 2); c.fill();
        c.restore();
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(255,255,255,' + (0.9 * fade) + ')';
        ellipsePath(c, a.x, a.y, a.rx * k, a.ry * k); c.stroke();
      }
    }
    c.restore();
    if (game.debug) {
      c.save();
      c.strokeStyle = 'rgba(255,80,80,0.8)';
      c.setLineDash([5, 4]);
      ellipsePath(c, a.x, a.y, a.rx, a.ry); c.stroke();
      c.restore();
    }
  }
  function drawAreaBurst(c, a, game, now) {
    if (!a.fireAt) return;
    const t = now - a.fireAt;
    const k = game.areaRadiusK(a);
    const fade = 1 - clamp((t - a.expandMs) / Math.max(1, a.lingerMs), 0, 1);
    if (fade <= 0) return;
    const hgt = 190;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const w = a.rx * 0.9 * k;
    const g = c.createLinearGradient(0, a.y - hgt, 0, a.y);
    g.addColorStop(0, 'rgba(' + a.color + ',0)');
    g.addColorStop(0.6, 'rgba(' + a.color + ',' + (0.35 * fade) + ')');
    g.addColorStop(1, 'rgba(255,255,255,' + (0.55 * fade) + ')');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(a.x - w, a.y);
    c.lineTo(a.x - w * 0.6, a.y - hgt);
    c.lineTo(a.x + w * 0.6, a.y - hgt);
    c.lineTo(a.x + w, a.y);
    c.closePath(); c.fill();
    c.restore();
  }

  // タイトル画面の飾り（待機モーション）
  function drawTitleChar(c, charId, now) {
    const def = ASSETS.characters[charId];
    const mode = def.mode || 'parts';
    const entry = window.SpriteBank.get(charId, 'idle');
    if (mode === 'apng' && entry && entry.ready) {
      drawShadow(c, def.width);
      if (ASSETS.baseFacing === 'left') c.scale(-1, 1);
      const d = def.states.idle.duration;
      c.drawImage(entry.frameAt(now, d, true), -def.width / 2, -def.height, def.width, def.height);
      return;
    }
    window.drawCharacter(c, charId, 'idle', 0, now, def.width, def.height, {
      parts: mode === 'apng' ? {} : window.SpriteBank.getParts(charId),
      partsConfig: mode === 'apng' ? null : def.parts,
      motion: motionOverrideOf(charId)
    });
  }

  // ------------------------------------------------------------
  // UI 描画（堕天使・悪魔・高貴：金のベベル縁＋尖った角）
  // ------------------------------------------------------------
  const FONT_JP = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
  const FONT_EN = '"Cinzel", "Times New Roman", serif';
  const SIDE = {
    angel:   { deep: '#060a2a', mid: '#13308a', hi: '#3f6cff', glow: 'rgba(155,107,255,', gem: ['#e8eeff', '#6f93ff', '#1b2f9a', '#070d3a'] },
    lucifer: { deep: '#120204', mid: '#7a0a10', hi: '#e2361c', glow: 'rgba(255,154,46,',  gem: ['#fff0c8', '#ff6a2a', '#a3140f', '#2a0306'] }
  };

  function goldFill(c, y0, y1) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#fff4c8');
    g.addColorStop(0.25, '#f6d77a');
    g.addColorStop(0.5, '#d9a83e');
    g.addColorStop(0.72, '#9a6a1c');
    g.addColorStop(0.88, '#f6d77a');
    g.addColorStop(1, '#4a2c08');
    return g;
  }

  // 角を斜めに落とした形（片側だけトゲのように尖らせる：spikeSide = 'left' | 'right' | null）
  function chamferPath(c, x, y, w, h, k, spikeSide) {
    c.beginPath();
    c.moveTo(x + k, y);
    c.lineTo(x + w - k, y);
    if (spikeSide === 'right') { c.lineTo(x + w + k * 0.9, y + h * 0.32); c.lineTo(x + w, y + k); }
    else c.lineTo(x + w, y + k);
    c.lineTo(x + w, y + h - k);
    c.lineTo(x + w - k, y + h);
    c.lineTo(x + k, y + h);
    c.lineTo(x, y + h - k);
    if (spikeSide === 'left') { c.lineTo(x, y + k); c.lineTo(x - k * 0.9, y + h * 0.32); }
    c.lineTo(x, y + k);
    c.closePath();
  }

  // 金縁プレート（HUD 用）。陣営の色で塗る
  function drawPlate(c, x, y, w, h, charId, left) {
    const s = SIDE[charId] || SIDE.angel;
    const k = 14;
    const spike = null; // 'left' | 'right' にすると片側の角がトゲ状に尖ります
    c.save();
    // 金のベベル
    chamferPath(c, x, y, w, h, k, spike);
    c.fillStyle = goldFill(c, y, y + h);
    c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
    c.fill();
    c.shadowColor = 'transparent';
    // 内側の細い黒線
    chamferPath(c, x + 3, y + 3, w - 6, h - 6, k - 2, spike);
    c.fillStyle = '#12070a';
    c.fill();
    // 塗り
    chamferPath(c, x + 4.5, y + 4.5, w - 9, h - 9, k - 3, spike);
    c.save();
    c.clip();
    const g = c.createLinearGradient(x, y, left ? x + w : x, y + h);
    if (charId === 'lucifer') {
      g.addColorStop(0, 'rgba(42,3,6,0.92)'); g.addColorStop(1, 'rgba(18,2,4,0.92)');
    } else {
      g.addColorStop(0, 'rgba(19,48,138,0.92)'); g.addColorStop(1, 'rgba(6,10,42,0.92)');
    }
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
    if (charId === 'lucifer') {
      // 下から立ちのぼる炎の光
      const fl = c.createRadialGradient(x + w / 2, y + h * 1.25, 4, x + w / 2, y + h * 1.25, w * 0.6);
      fl.addColorStop(0, 'rgba(255,170,60,0.75)');
      fl.addColorStop(0.4, 'rgba(226,54,28,0.45)');
      fl.addColorStop(1, 'rgba(122,10,16,0)');
      c.fillStyle = fl; c.fillRect(x, y, w, h);
    } else {
      // 紫の光と星
      const gl = c.createRadialGradient(x + w * 0.5, y + h * 0.2, 4, x + w * 0.5, y + h * 0.2, w * 0.55);
      gl.addColorStop(0, 'rgba(155,107,255,0.45)');
      gl.addColorStop(1, 'rgba(155,107,255,0)');
      c.fillStyle = gl; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 18; i++) {
        const sx = x + ((i * 97.3) % w), sy = y + ((i * 53.7) % h);
        c.fillRect(sx, sy, i % 4 === 0 ? 1.6 : 1, i % 4 === 0 ? 1.6 : 1);
      }
    }
    c.restore();
    c.restore();
  }

  // 両端が尖ったプレート（中央のラウンド表示）
  function drawPointedPlate(c, x, y, w, h) {
    const k = h / 2;
    const path = (ix, iy, iw, ih, ik) => {
      c.beginPath();
      c.moveTo(ix + ik, iy); c.lineTo(ix + iw - ik, iy); c.lineTo(ix + iw, iy + ih / 2);
      c.lineTo(ix + iw - ik, iy + ih); c.lineTo(ix + ik, iy + ih); c.lineTo(ix, iy + ih / 2);
      c.closePath();
    };
    c.save();
    path(x, y, w, h, k);
    c.fillStyle = goldFill(c, y, y + h);
    c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
    c.fill();
    c.shadowColor = 'transparent';
    path(x + 3, y + 3, w - 6, h - 6, k - 3);
    c.fillStyle = '#12070a'; c.fill();
    path(x + 4.5, y + 4.5, w - 9, h - 9, k - 4.5);
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#13308a'); g.addColorStop(0.5, '#1a0a1e'); g.addColorStop(1, '#7a0a10');
    c.fillStyle = g; c.fill();
    c.restore();
  }

  // ライフの宝石（ひし形）。満タン = 陣営色に光る、空 = 暗い穴
  function drawGem(c, x, y, r, filled, charId, now) {
    const s = SIDE[charId] || SIDE.angel;
    c.save();
    c.translate(x, y);
    const dia = (rr, ry) => {
      c.beginPath();
      c.moveTo(0, -ry); c.lineTo(rr, 0); c.lineTo(0, ry); c.lineTo(-rr, 0); c.closePath();
    };
    // 金の台座
    dia(r * 0.95, r * 1.25);
    c.fillStyle = goldFill(c, -r * 1.25, r * 1.25);
    c.fill();
    c.lineWidth = 1; c.strokeStyle = '#12070a'; c.stroke();
    dia(r * 0.68, r * 0.95);
    if (filled) {
      const g = c.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, s.gem[0]); g.addColorStop(0.35, s.gem[1]); g.addColorStop(0.7, s.gem[2]); g.addColorStop(1, s.gem[3]);
      c.fillStyle = g;
      c.shadowColor = s.glow + '0.9)'; c.shadowBlur = 8;
      c.fill();
      c.shadowBlur = 0;
      // ハイライト
      c.beginPath();
      c.moveTo(0, -r * 0.8); c.lineTo(r * 0.3, -r * 0.2); c.lineTo(0, -r * 0.05); c.lineTo(-r * 0.3, -r * 0.2); c.closePath();
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.fill();
    } else {
      c.fillStyle = '#0c0608';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; c.stroke();
    }
    c.restore();
  }

  // 勝ちラウンドの星（4方向に尖った星）
  function drawStar(c, x, y, r, filled) {
    c.save();
    c.translate(x, y);
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 4;
      const rr = i % 2 === 0 ? r : r * 0.38;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    if (filled) {
      c.fillStyle = goldFill(c, -r, r);
      c.shadowColor = 'rgba(255,210,110,0.9)'; c.shadowBlur = 8;
    } else {
      c.fillStyle = 'rgba(20,10,14,0.85)';
    }
    c.fill();
    c.shadowBlur = 0;
    c.lineWidth = 1.2;
    c.strokeStyle = filled ? '#4a2c08' : 'rgba(246,215,122,0.55)';
    c.stroke();
    c.restore();
  }

  // ラウンド開始・ファイト・KO の帯
  function drawBanner(c, msg, now) {
    const cy = H / 2 - 18;
    const bandH = msg.sub ? 128 : 100;
    c.save();
    // 暗い帯（左右に向かって消える）
    const band = c.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, 'rgba(8,16,70,0)');
    band.addColorStop(0.18, 'rgba(8,16,70,0.78)');
    band.addColorStop(0.5, 'rgba(12,6,16,0.85)');
    band.addColorStop(0.82, 'rgba(80,8,10,0.78)');
    band.addColorStop(1, 'rgba(80,8,10,0)');
    c.fillStyle = band;
    c.fillRect(0, cy - bandH / 2, W, bandH);
    // 金の細線（上下）＋中央のひし形
    const line = c.createLinearGradient(0, 0, W, 0);
    line.addColorStop(0, 'rgba(246,215,122,0)');
    line.addColorStop(0.2, 'rgba(246,215,122,0.95)');
    line.addColorStop(0.8, 'rgba(246,215,122,0.95)');
    line.addColorStop(1, 'rgba(246,215,122,0)');
    c.fillStyle = line;
    [cy - bandH / 2, cy + bandH / 2 - 2].forEach((ly) => {
      c.fillRect(0, ly, W, 2);
      c.beginPath();
      c.moveTo(W / 2, ly - 6); c.lineTo(W / 2 + 9, ly + 1); c.lineTo(W / 2, ly + 8); c.lineTo(W / 2 - 9, ly + 1); c.closePath();
      c.fillStyle = goldFill(c, ly - 6, ly + 8); c.fill();
      c.fillStyle = line;
    });
    // 文字（無地の金＋輪郭＋弱い影。文字の上にグラデや炎の模様は乗せない）
    const ty = msg.sub ? cy - 14 : cy;
    const isEn = /^[A-Z0-9!?.]+$/i.test(msg.text);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = (isEn ? '900 72px ' : '800 68px ') + (isEn ? FONT_EN : FONT_JP);
    c.lineJoin = 'round';
    c.lineWidth = 10;
    c.strokeStyle = 'rgba(14,6,8,0.95)';
    c.strokeText(msg.text, W / 2, ty);
    c.shadowColor = 'rgba(255,210,110,0.55)';
    c.shadowBlur = 8;
    c.fillStyle = '#ffe4a0';
    c.fillText(msg.text, W / 2, ty);
    c.shadowBlur = 0;
    if (msg.sub) {
      c.font = '800 22px ' + FONT_JP;
      c.lineWidth = 5;
      c.strokeStyle = 'rgba(14,6,8,0.95)';
      c.strokeText(msg.sub, W / 2, cy + 40);
      c.fillStyle = '#f6ecd6';
      c.fillText(msg.sub, W / 2, cy + 40);
    }
    c.restore();
  }

  window.__game = Game; // デバッグ・テスト用
  window.__AI = AI;     // テスト用（AI 同士の対戦シミュレーション）
  Game.init();
})();
