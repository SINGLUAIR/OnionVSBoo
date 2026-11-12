/*
 * イビルライトフォース  メインロジック
 */
(function () {
  'use strict';

  const W = 960, H = 540;
  const CFG = window.GAME_CONFIG;
  const ASSETS = window.ASSET_CONFIG;
  const CHAR_IDS = ['angel', 'lucifer'];

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
  (function drawBackground() {
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
      this.reset(isPlayer ? 250 : 710, 420);
    }

    reset(x, y) {
      this.x = x; this.y = y;
      this.facing = this.isPlayer ? 1 : -1; // 1 = 右, -1 = 左
      this.life = CFG.maxLife;
      this.state = 'idle';
      this.stateTime = 0;
      this.invulnUntil = 0;
      this.cooldownUntil = 0;
      this.attackFlashUntil = 0;
      this.lastAttackRect = null;
      this.knock = 0;
    }

    get buff() {
      const b = CFG.buffs[this.charId];
      if (!b) return null;
      const on = b.condition === 'lifeAtMost' ? this.life <= b.threshold : this.life >= b.threshold;
      return on && this.life > 0 ? b : null;
    }
    get moveMult() { const b = this.buff; return b ? b.moveSpeed : 1; }
    get attackMult() { const b = this.buff; return b ? b.attackSpeed : 1; }

    duration(state) {
      const st = this.def.states;
      if (state === 'attack') {
        if (this.attackStartMult == null) return st.attack.duration / this.attackMult;
        return st.attack.duration / this.attackStartMult; // 攻撃速度倍率でアニメーション時間を短縮（再生も速くなる）
      }
      if (state === 'move') return st.move.duration / this.moveMult;   // 移動速度アップ中は移動モーションも速く
      return (st[state] && st[state].duration) || 500;
    }

    // ステートを切り替える。stateTime が 0 に戻るので、1回再生のアニメーションは先頭から再生される
    setState(s) {
      if (this.state === s && (s === 'idle' || s === 'move')) return;
      this.state = s;
      this.stateTime = 0;
      // 攻撃の途中でバフ状態が変わっても長さが変わらないよう、開始時の倍率を記録
      this.attackStartMult = s === 'attack' ? this.attackMult : null;
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
      return { x: r.x + l, y: r.y + ins.top, w: r.w - l - rr, h: r.h - ins.top - ins.bottom };
    }

    // 攻撃判定（向いている側のみ）
    attackRect() {
      const a = this.def.attackBox;
      const x = this.facing === 1 ? this.x + a.near : this.x - a.near - a.reach;
      return { x: x, y: this.y - a.top, w: a.reach, h: a.top - a.bottom };
    }

    isFlipped() {
      const base = ASSETS.baseFacing === 'left' ? -1 : 1;
      return this.facing !== base;
    }

    canAct() { return this.state === 'idle' || this.state === 'move'; }

    update(dt, now, move, wantAttack, opp, game) {
      this.stateTime += dt;

      // ノックバック
      if (this.knock) {
        const step = this.knock * Math.min(1, dt / 120);
        this.x = clamp(this.x + step, CFG.field.left, CFG.field.right);
        this.knock -= step;
        if (Math.abs(this.knock) < 0.5) this.knock = 0;
      }

      if (this.state === 'down') return;

      if (this.state === 'hurt') {
        if (this.stateTime >= this.duration('hurt')) this.setState('idle');
        return;
      }

      if (this.state === 'attack') {
        // アニメーションの最後に攻撃判定を出す
        if (this.stateTime >= this.duration('attack')) {
          game.resolveAttack(this, opp);
          this.cooldownUntil = now + CFG.attackCooldown / this.attackMult;
          this.setState('idle');
        }
        return;
      }

      // 待機・移動
      if (!game.fighting) { move = { x: 0, y: 0 }; wantAttack = false; }
      if (wantAttack && now >= this.cooldownUntil) {
        this.faceOpponent(opp);
        this.setState('attack');
        return;
      }
      const speedScale = this.isPlayer ? 1 : CFG.ai.speedScale;
      const sx = CFG.moveSpeedX * this.moveMult * speedScale;
      const sy = CFG.moveSpeedY * this.moveMult * speedScale;
      if (move.x || move.y) {
        this.x = clamp(this.x + move.x * sx * dt / 1000, CFG.field.left, CFG.field.right);
        this.y = clamp(this.y + move.y * sy * dt / 1000, CFG.field.top, CFG.field.bottom);
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

    takeHit(fromFacing, now) {
      this.life = Math.max(0, this.life - 1);
      this.knock = fromFacing * CFG.knockback;
      if (this.life <= 0) {
        this.setState('down');
      } else {
        this.setState('hurt');
        this.invulnUntil = now + CFG.invulnerableMs;
      }
    }

    draw(c, now, debug) {
      const mode = this.def.mode || 'parts';
      const entry = window.SpriteBank.get(this.charId, this.state);
      const dur = this.duration(this.state);
      const sc = this.def.states[this.state] || {};
      let progress = sc.loop ? (this.stateTime % dur) / dur : clamp(this.stateTime / dur, 0, 1);
      const w = this.def.width, h = this.def.height;

      c.save();
      c.translate(this.x, this.y);
      // 無敵中は点滅
      if (now < this.invulnUntil && this.state !== 'hurt' && Math.floor(now / 80) % 2 === 0) c.globalAlpha = 0.45;

      if (mode === 'apng' && entry && entry.ready) {
        // APNG モード：モーションごとの APNG をそのまま再生
        drawShadow(c, w);
        if (this.isFlipped()) c.scale(-1, 1);
        c.drawImage(entry.frameAt(this.stateTime, dur, !!sc.loop), -w / 2, -h, w, h);
      } else if (mode !== 'apng' && this.state === 'down' && entry && entry.ready) {
        // パーツモードの「倒れる」：APNG をそのまま再生（コードで回転・角度変更はしない。左右反転のみ）
        drawShadow(c, w);
        if (sc.fadeOut) c.globalAlpha *= Math.max(0, 1 - Math.max(0, progress - 0.7) / 0.3);
        if (this.facing === -1) c.scale(-1, 1);
        const frame = entry.frameAt(this.stateTime, dur, false);
        const dw = sc.scale ? frame.width * sc.scale : w;
        const dh = sc.scale ? frame.height * sc.scale : h;
        const dx = -dw / 2 + (sc.offsetX || 0), dy = -dh + (sc.offsetY || 0);
        c.drawImage(frame, dx, dy, dw, dh);
        if (debug) {
          c.strokeStyle = 'rgba(255,255,255,0.6)';
          c.setLineDash([3, 3]);
          c.strokeRect(dx, dy, dw, dh);
          c.setLineDash([]);
        }
      } else {
        // パーツモード（画像が無いパーツは仮の図形）／画像が無いときの仮の図形。右向き基準で描画し、左向きなら反転
        if (this.facing === -1) c.scale(-1, 1);
        const usesParts = mode !== 'apng';
        window.drawCharacter(c, this.charId, this.state, progress, now, w, h, {
          parts: usesParts ? window.SpriteBank.getParts(this.charId) : {},
          partsConfig: usesParts ? this.def.parts : null,
          debug: debug,
          flipped: this.facing === -1
        });
      }
      c.restore();

      // 速度アップ中のオーラ
      if (this.buff && this.state !== 'down') {
        c.save();
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(this.x, this.y - h / 2, 10, this.x, this.y - h / 2, h * 0.6);
        const col = this.charId === 'angel' ? '255,230,120' : '170,60,255';
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
      c.moveTo(this.x, this.y - CFG.depthTolerance); c.lineTo(this.x, this.y + CFG.depthTolerance);
      c.stroke();
      // 攻撃判定
      if (this.state === 'attack') {
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
      c.fillText(this.state + ' ' + Math.round(this.stateTime) + '/' + Math.round(this.duration(this.state)) + 'ms', ir.x, ir.y - 4);
      c.restore();
    }
  }

  // ------------------------------------------------------------
  // NPC の AI
  // ------------------------------------------------------------
  class AI {
    constructor(me, opp) {
      this.me = me; this.opp = opp;
      this.nextThink = 0;
      this.move = { x: 0, y: 0 };
      this.retreatUntil = 0;
      this.attackAt = 0;
      this.cooldownUntil = 0;
      this.dodgeUntil = 0;
      this.dodgeDir = 1;
    }

    reset(now) {
      this.nextThink = now + 300;
      this.move = { x: 0, y: 0 };
      this.retreatUntil = 0;
      this.attackAt = 0;
      this.cooldownUntil = now + 500;
      this.dodgeUntil = 0;
    }

    inRange() {
      const me = this.me, opp = this.opp;
      if (Math.abs(opp.y - me.y) > CFG.depthTolerance * 0.75) return false;
      const facing = opp.x >= me.x ? 1 : -1;
      const a = me.def.attackBox;
      const x = facing === 1 ? me.x + a.near : me.x - a.near - a.reach;
      // 少し内側で判断（ギリギリだと外れやすいので）
      const r = { x: x + (facing === 1 ? 0 : a.reach * 0.15), y: me.y - a.top, w: a.reach * 0.85, h: a.top - a.bottom };
      return rectsOverlap(r, opp.bodyRect());
    }

    // 戻り値: { move, attack }
    update(now) {
      const A = CFG.ai, me = this.me, opp = this.opp;
      let attack = false;

      if (this.attackAt && now >= this.attackAt) {
        this.attackAt = 0;
        if (me.canAct() && this.inRange()) {
          attack = true;
          this.cooldownUntil = now + me.duration('attack') + rand(A.attackCooldownMin, A.attackCooldownMax);
          if (Math.random() < A.retreatChance * 1.5) this.retreatUntil = now + me.duration('attack') + A.retreatMs;
        }
      }

      if (now >= this.nextThink) {
        this.nextThink = now + A.thinkInterval * rand(0.7, 1.3);
        this.think(now);
      }

      if (!me.canAct()) return { move: { x: 0, y: 0 }, attack: false };
      return { move: this.move, attack: attack };
    }

    think(now) {
      const A = CFG.ai, me = this.me, opp = this.opp;
      const dx = opp.x - me.x, dy = opp.y - me.y;
      const dirX = dx >= 0 ? 1 : -1;

      // 相手の攻撃が来そうなら、たまに奥行き方向へ避ける
      if (opp.state === 'attack' && Math.abs(dx) < 200 && Math.random() < 0.25 && now >= this.dodgeUntil) {
        this.dodgeUntil = now + 380;
        this.dodgeDir = me.y < (CFG.field.top + CFG.field.bottom) / 2 ? 1 : -1;
      }
      if (now < this.dodgeUntil) { this.move = { x: -dirX * 0.3, y: this.dodgeDir }; return; }

      // 一時的に下がる
      if (now < this.retreatUntil) {
        const nearWall = (me.x < CFG.field.left + 40 && dirX > 0) || (me.x > CFG.field.right - 40 && dirX < 0);
        this.move = { x: nearWall ? 0 : -dirX, y: Math.sign(rand(-1, 1)) * 0.4 };
        return;
      }
      if (Math.random() < A.retreatChance * 0.3) { this.retreatUntil = now + A.retreatMs; return; }

      // 射程内なら攻撃を予約（反応の遅れ付き）
      if (this.inRange()) {
        if (!this.attackAt && now >= this.cooldownUntil && Math.random() < A.attackChance) {
          this.attackAt = now + A.reactionDelay * rand(0.6, 1.4);
        }
        this.move = { x: 0, y: Math.abs(dy) > 6 ? Math.sign(dy) * 0.6 : 0 };
        return;
      }

      // 近づく：攻撃が届く距離まで横移動しつつ、奥行きを合わせる
      const a = me.def.attackBox;
      const oppHalf = opp.bodyRect().w / 2;
      const desired = a.near + a.reach * 0.5 + oppHalf - 4 + A.preferredGap * 0.1;
      const targetX = opp.x - dirX * desired;
      const ex = targetX - me.x;
      let mx = Math.abs(ex) > 8 ? Math.sign(ex) : 0;
      let my = Math.abs(dy) > 8 ? Math.sign(dy) : 0;
      // クールダウン中は少し距離を取る
      if (now < this.cooldownUntil && Math.abs(dx) < desired + A.preferredGap) mx = Math.random() < 0.5 ? -dirX : 0;
      const len = Math.hypot(mx, my) || 1;
      this.move = { x: mx / len, y: my / len };
    }
  }

  // ------------------------------------------------------------
  // ゲーム本体
  // ------------------------------------------------------------
  const Game = {
    phase: 'title',      // title / intro / fight / ko / result
    time: 0,
    lastTs: 0,
    playerChar: 'angel',
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

    get fighting() { return this.phase === 'fight'; },

    init() {
      this.bindUi();
      window.SpriteBank.loadAll().catch((e) => console.warn(e));
      requestAnimationFrame(this.loop.bind(this));
    },

    bindUi() {
      const self = this;
      document.querySelectorAll('.char-btn').forEach((btn) => {
        btn.addEventListener('click', () => self.selectChar(btn.dataset.char));
      });
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
          if (k === 'a' || k === 'd' || k === 'arrowleft' || k === 'arrowright') {
            self.selectChar(self.playerChar === 'angel' ? 'lucifer' : 'angel');
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
      if (CHAR_IDS.indexOf(id) < 0) return;
      this.playerChar = id;
      document.querySelectorAll('.char-btn').forEach((b) => b.classList.toggle('selected', b.dataset.char === id));
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
      const enemyChar = this.playerChar === 'angel' ? 'lucifer' : 'angel';
      this.player = new Fighter(this.playerChar, true);
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
      const depthOk = Math.abs(attacker.y - defender.y) <= CFG.depthTolerance;
      const hit = this.phase === 'fight' && depthOk && rectsOverlap(ar, br) &&
        this.time >= defender.invulnUntil && defender.state !== 'down';
      attacker.lastAttackRect = ar;
      attacker.lastAttackHit = hit;
      attacker.attackFlashUntil = this.time + CFG.hitboxFlashMs;
      if (hit) {
        defender.takeHit(attacker.facing, this.time);
        this.effects.push({ x: (Math.max(ar.x, br.x) + Math.min(ar.x + ar.w, br.x + br.w)) / 2, y: defender.y - defender.def.height * 0.55, t: this.time, color: attacker.charId === 'angel' ? '255,240,150' : '200,80,255' });
        if (defender.life <= 0) this.onKO(attacker === this.player ? 'player' : 'enemy', 'KO!');
      }
      return hit;
    },

    onKO(winner, text) {
      if (this.phase !== 'fight') return;
      this.phase = 'ko';
      this.phaseStart = this.time;
      this.roundsPlayed++;
      if (winner) this.wins[winner]++;
      this.message = { text: text, sub: winner ? (winner === 'player' ? 'あなたがこのラウンドを取った！' : '相手がこのラウンドを取った…') : '引き分け', until: this.time + CFG.koPauseMs, color: '#ffd84a' };
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
        if (t >= CFG.roundIntroMs * 0.6 && this.message && this.message.text !== 'ファイト！') {
          this.message = { text: 'ファイト！', sub: '', until: now + CFG.roundIntroMs * 0.4 + 300, color: '#ff7aa8' };
        }
        if (t >= CFG.roundIntroMs) { this.phase = 'fight'; window.Input.clear(); }
      }

      let pMove = { x: 0, y: 0 }, pAtk = false, eMove = { x: 0, y: 0 }, eAtk = false;
      if (this.phase === 'fight') {
        pMove = window.Input.getMove();
        pAtk = window.Input.consumeAttack();
        const d = this.ai.update(now);
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
      }

      // 攻撃の終了判定が同時に起きても公平になるよう、順番を毎フレーム入れ替える
      if (Math.floor(now / 16) % 2 === 0) {
        this.player.update(dt, now, pMove, pAtk, this.enemy, this);
        this.enemy.update(dt, now, eMove, eAtk, this.player, this);
      } else {
        this.enemy.update(dt, now, eMove, eAtk, this.player, this);
        this.player.update(dt, now, pMove, pAtk, this.enemy, this);
      }

      this.separate();

      if (this.phase === 'ko' && now - this.phaseStart >= CFG.koPauseMs) this.afterRound();
      this.effects = this.effects.filter((e) => now - e.t < 300);
    },

    // 同じ奥行きで体が重なりすぎないよう、左右に軽く押し離す
    separate() {
      const a = this.player, b = this.enemy;
      if (a.state === 'down' || b.state === 'down') return;
      if (Math.abs(a.y - b.y) > CFG.depthTolerance) return;
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
        c.save();
        c.translate(250, 470); drawTitleChar(c, 'angel', now); c.restore();
        c.save();
        c.translate(710, 470); c.scale(-1, 1); drawTitleChar(c, 'lucifer', now + 500); c.restore();
        return;
      }

      // 奥行き順（Y が小さい＝奥から）に描画
      const list = [this.player, this.enemy].sort((a, b) => a.y - b.y);
      list.forEach((f) => f.draw(c, now, this.debug));

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
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = 'bold 72px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
        c.lineWidth = 8;
        c.strokeStyle = 'rgba(20,10,40,0.85)';
        c.strokeText(this.message.text, W / 2, H / 2 - 30);
        c.fillStyle = this.message.color;
        c.fillText(this.message.text, W / 2, H / 2 - 30);
        if (this.message.sub) {
          c.font = 'bold 26px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
          c.lineWidth = 5;
          c.strokeText(this.message.sub, W / 2, H / 2 + 30);
          c.fillStyle = '#fff';
          c.fillText(this.message.sub, W / 2, H / 2 + 30);
        }
        c.restore();
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
        const x0 = left ? 20 : W - 20;
        c.save();
        c.textAlign = left ? 'left' : 'right';
        c.font = 'bold 18px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
        c.fillStyle = '#fff';
        c.strokeStyle = 'rgba(0,0,0,0.6)';
        c.lineWidth = 4;
        const title = label + '：' + name;
        c.strokeText(title, x0, 28);
        c.fillText(title, x0, 28);
        // ライフ（5つ）
        for (let i = 0; i < CFG.maxLife; i++) {
          const cx = left ? x0 + 16 + i * 36 : x0 - 16 - i * 36;
          drawHeart(c, cx, 54, 14, i < f.life, f.charId);
        }
        // 勝利ラウンド数
        for (let i = 0; i < this.winsNeeded(); i++) {
          const cx = left ? x0 + 10 + i * 22 : x0 - 10 - i * 22;
          const won = i < (left ? this.wins.player : this.wins.enemy);
          c.beginPath();
          c.arc(cx, 86, 7, 0, Math.PI * 2);
          c.fillStyle = won ? '#ffd84a' : 'rgba(255,255,255,0.15)';
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.6)';
          c.lineWidth = 1.5;
          c.stroke();
        }
        if (f.buff) {
          c.font = 'bold 15px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
          c.fillStyle = f.charId === 'angel' ? '#ffe680' : '#d090ff';
          const tx = left ? x0 + 70 : x0 - 70;
          c.strokeText('速度アップ中！', tx, 91);
          c.fillText('速度アップ中！', tx, 91);
        }
        c.restore();
      };
      drawSide(this.player, true, 'あなた');
      drawSide(this.enemy, false, 'あいて');

      c.save();
      c.textAlign = 'center';
      c.fillStyle = '#fff';
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.lineWidth = 4;
      c.font = 'bold 20px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
      const rt = this.round > CFG.rounds ? '決着ラウンド' : 'ラウンド ' + this.round + ' / ' + CFG.rounds;
      c.strokeText(rt, W / 2, 30); c.fillText(rt, W / 2, 30);
      if (CFG.roundTimeLimit > 0) {
        c.font = 'bold 34px sans-serif';
        const tt = String(Math.ceil(this.roundTimeLeft));
        c.strokeText(tt, W / 2, 68); c.fillText(tt, W / 2, 68);
      }
      c.restore();
    }
  };

  function drawShadow(c, w) {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(0, 0, w * 0.32, 10, 0, 0, Math.PI * 2); c.fill();
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
      partsConfig: mode === 'apng' ? null : def.parts
    });
  }

  function drawHeart(c, x, y, r, filled, charId) {
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.moveTo(0, r * 0.9);
    c.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.1, 0, -r * 0.35);
    c.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.9);
    c.closePath();
    if (filled) {
      c.fillStyle = charId === 'angel' ? '#ff6f9a' : '#b04cff';
      c.fill();
    } else {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fill();
    }
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2;
    c.stroke();
    c.restore();
  }

  window.__game = Game; // デバッグ・テスト用
  Game.init();
})();
