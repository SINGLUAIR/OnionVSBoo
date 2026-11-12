/*
 * スプライト管理
 *  - パーツモード（mode: 'parts'、初期設定）
 *      翼・体・頭・腕と剣の4枚の PNG を、仮の図形と同じ動き（ふわふわ・羽ばたき・前傾・振りかぶり・のけぞり）で動かします。
 *      倒れるモーションだけは APNG（down.png）をそのまま再生します（コードで回転させません）。
 *      パーツ画像が無いものは、そのパーツだけ仮の図形で描画します。
 *      各パーツは variants（モーション名 → 画像パス）で、そのモーションのときだけ差し替え画像を使えます
 *      （ピボット・位置・大きさ・角度は通常のパーツと同じ。画像が無いときは通常のパーツへフォールバック）。
 *  - APNG モード（mode: 'apng'）
 *      モーションごとの APNG（idle / move / attack / hurt / down）を丸ごと再生します。
 *  - canvas の drawImage に <img> の APNG をそのまま渡すと、ブラウザによっては1コマ目しか描画されない
 *    （仕様上そうなっている）ため、APNG を自前で解析して全コマを canvas に展開しています。
 *    これにより「先頭から再生し直す」「攻撃速度の倍率に合わせて速く再生する」「最後のコマで判定を出す」が
 *    どのブラウザでも確実に行えます。
 *  - 普通の PNG（1枚絵）も使えます（その場合は静止画として表示）。
 *  - 画像がない場合は仮の図形（プレースホルダー）を描画します。
 */
(function () {
  'use strict';

  // ---------------- APNG 解析 ----------------
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes, start, len) {
    let c = 0xFFFFFFFF;
    for (let i = start; i < start + len; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeChunk(type, data) {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out, 4, 4 + data.length));
    return out;
  }
  const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  function parsePng(buffer) {
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) throw new Error('PNG ではありません');
    const dv = new DataView(buffer);
    let pos = 8;
    let ihdr = null, animated = false, numPlays = 0;
    const pre = [];       // IDAT より前の補助チャンク（PLTE, tRNS など）
    const frames = [];
    let cur = null;
    let defaultImage = [];
    while (pos + 8 <= bytes.length) {
      const len = dv.getUint32(pos);
      const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      const dStart = pos + 8;
      const data = bytes.subarray(dStart, dStart + len);
      if (type === 'IHDR') ihdr = data;
      else if (type === 'acTL') { animated = true; numPlays = dv.getUint32(dStart + 4); }
      else if (type === 'fcTL') {
        let delayDen = dv.getUint16(dStart + 22);
        if (!delayDen) delayDen = 100;
        cur = {
          w: dv.getUint32(dStart + 4), h: dv.getUint32(dStart + 8),
          x: dv.getUint32(dStart + 12), y: dv.getUint32(dStart + 16),
          delay: Math.max(10, dv.getUint16(dStart + 20) / delayDen * 1000),
          dispose: bytes[dStart + 24], blend: bytes[dStart + 25], data: []
        };
        frames.push(cur);
      } else if (type === 'IDAT') {
        if (cur) cur.data.push(data); else defaultImage.push(data);
      } else if (type === 'fdAT') {
        if (cur) cur.data.push(data.subarray(4));
      } else if (type === 'IEND') break;
      else if (!cur && defaultImage.length === 0 && type !== 'acTL') pre.push({ type: type, data: data });
      pos = dStart + len + 4;
    }
    if (!ihdr) throw new Error('IHDR がありません');
    const width = new DataView(ihdr.buffer, ihdr.byteOffset).getUint32(0);
    const height = new DataView(ihdr.buffer, ihdr.byteOffset).getUint32(4);
    if (!animated || frames.length === 0) {
      frames.length = 0;
      frames.push({ w: width, h: height, x: 0, y: 0, delay: 1000, dispose: 0, blend: 0, data: defaultImage });
    }
    const blobs = frames.map((f) => {
      const hd = new Uint8Array(ihdr);
      const hv = new DataView(hd.buffer);
      hv.setUint32(0, f.w); hv.setUint32(4, f.h);
      const parts = [PNG_SIG, makeChunk('IHDR', hd)];
      pre.forEach((c) => parts.push(makeChunk(c.type, c.data)));
      f.data.forEach((d) => parts.push(makeChunk('IDAT', d)));
      parts.push(makeChunk('IEND', new Uint8Array(0)));
      return new Blob(parts, { type: 'image/png' });
    });
    return { width: width, height: height, frames: frames, blobs: blobs, numPlays: numPlays };
  }

  function decodeBlob(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  // 各コマを、ディスポーズ／ブレンドを反映した「完成済みの1枚」に合成する
  function compose(parsed, images) {
    const W = parsed.width, H = parsed.height;
    const work = document.createElement('canvas');
    work.width = W; work.height = H;
    const wc = work.getContext('2d');
    const out = [];
    parsed.frames.forEach((f, i) => {
      let saved = null;
      if (f.dispose === 2) saved = wc.getImageData(f.x, f.y, f.w, f.h);
      if (f.blend === 0) wc.clearRect(f.x, f.y, f.w, f.h);
      wc.drawImage(images[i], f.x, f.y);
      const fc = document.createElement('canvas');
      fc.width = W; fc.height = H;
      fc.getContext('2d').drawImage(work, 0, 0);
      out.push(fc);
      if (f.dispose === 1) wc.clearRect(f.x, f.y, f.w, f.h);
      else if (f.dispose === 2 && saved) wc.putImageData(saved, f.x, f.y);
      if (images[i].close) images[i].close();
    });
    return out;
  }

  class SpriteEntry {
    constructor(charId, stateKey, cfg) {
      this.charId = charId;
      this.stateKey = stateKey;
      this.cfg = cfg;
      this.ready = false;
      this.frames = [];     // 合成済みの各コマ（canvas）
      this.delays = [];     // 各コマの表示時間（ms, ファイル内の値）
      this.total = 0;       // ファイル内のアニメーション全体の長さ
    }

    load() {
      const src = this.cfg && this.cfg.src;
      if (!src || typeof fetch !== 'function') return Promise.resolve(false);
      return fetch(src)
        .then((res) => { if (!res.ok) throw new Error('not found'); return res.arrayBuffer(); })
        .then((buf) => {
          const parsed = parsePng(buf);
          return Promise.all(parsed.blobs.map(decodeBlob)).then((imgs) => {
            this.frames = compose(parsed, imgs);
            this.delays = parsed.frames.map((f) => f.delay);
            this.total = this.delays.reduce((a, b) => a + b, 0);
            this.ready = this.frames.length > 0;
            return this.ready;
          });
        })
        .catch((e) => {
          if (e && e.message !== 'not found') console.warn('[sprites] ' + src + ' を読み込めませんでした: ' + e.message);
          return false;
        });
    }

    /*
     * 経過時間 elapsed（ms）と、ゲーム側で決めた長さ duration（ms）から表示するコマを返す。
     * ファイル内の各コマの比率を保ったまま duration に収まるよう伸縮します
     * （攻撃速度アップ中は duration が短くなる → 速く再生される）。
     */
    frameAt(elapsed, duration, loop) {
      const n = this.frames.length;
      if (n === 1) return this.frames[0];
      let t = loop ? (elapsed % duration) : Math.min(elapsed, duration);
      if (!loop && t >= duration) return this.frames[n - 1]; // 最後のコマ
      const ft = t / duration * this.total;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        acc += this.delays[i];
        if (ft < acc) return this.frames[i];
      }
      return this.frames[n - 1];
    }
  }


  // ---------------- パーツ画像（普通の PNG） ----------------
  const PART_NAMES = ['wings', 'body', 'head', 'arm'];
  const PART_LABELS = { wings: '翼', body: '体', head: '頭', arm: '腕' };

  function loadPng(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  class PartImage {
    constructor(charId, name, cfg) {
      this.charId = charId;
      this.name = name;
      this.cfg = cfg || {};
      this.img = null;
      this.ready = false;
      this.variants = {}; // stateKey -> { img, ready }
    }
    load() {
      const variants = this.cfg.variants || {};
      const jobs = [];
      jobs.push(loadPng(this.cfg.src).then((img) => {
        this.img = img;
        this.ready = !!img;
        return this.ready;
      }));
      Object.keys(variants).forEach((stateKey) => {
        const vsrc = variants[stateKey];
        jobs.push(loadPng(vsrc).then((img) => {
          this.variants[stateKey] = { img: img, ready: !!img };
          return !!img;
        }));
      });
      return Promise.all(jobs).then(() => this.ready);
    }
    // 指定モーション用の画像。差分が無ければ（または未ロードなら）通常のパーツ画像。
    imageFor(state) {
      const v = state && this.variants[state];
      if (v && v.ready && v.img) return v.img;
      return this.ready ? this.img : null;
    }
  }

  const SpriteBank = {
    entries: {},   // entries[charId][stateKey] = SpriteEntry（APNG）
    parts: {},     // parts[charId][partName] = PartImage

    loadAll() {
      const conf = window.ASSET_CONFIG;
      const jobs = [];
      const isFile = location.protocol === 'file:';
      if (isFile) {
        console.warn('[sprites] file:// では APNG を読み込めません。ローカルサーバー（README 参照）か GitHub Pages で開いてください。');
      }
      Object.keys(conf.characters).forEach((charId) => {
        const ch = conf.characters[charId];
        const mode = ch.mode || 'parts';
        this.entries[charId] = {};
        this.parts[charId] = {};
        Object.keys(ch.states).forEach((stateKey) => {
          const e = new SpriteEntry(charId, stateKey, ch.states[stateKey]);
          this.entries[charId][stateKey] = e;
          // パーツモードで使う APNG は「倒れる」だけ
          if (isFile) return;
          if (mode === 'apng' || stateKey === 'down') jobs.push(e.load().then((ok) => ({ kind: 'apng', ok: ok })));
        });
        if (mode === 'parts' && ch.parts) {
          PART_NAMES.forEach((name) => {
            const p = new PartImage(charId, name, ch.parts[name]);
            this.parts[charId][name] = p;
            jobs.push(p.load().then((ok) => ({ kind: 'part', ok: ok })));
          });
        }
      });
      return Promise.all(jobs).then((results) => {
        const count = (k) => results.filter((r) => r.kind === k);
        const a = count('apng'), p = count('part');
        let vOk = 0, vAll = 0;
        Object.keys(this.parts).forEach((charId) => {
          Object.keys(this.parts[charId]).forEach((name) => {
            const vs = this.parts[charId][name].variants || {};
            Object.keys(vs).forEach((k) => { vAll++; if (vs[k].ready) vOk++; });
          });
        });
        console.info('[sprites] APNG: ' + a.filter((r) => r.ok).length + ' / ' + a.length +
          '、パーツ画像: ' + p.filter((r) => r.ok).length + ' / ' + p.length +
          (vAll ? '、差分画像: ' + vOk + ' / ' + vAll : '') +
          '（不足分は仮の図形／通常のパーツで表示）');
      });
    },

    get(charId, stateKey) {
      return this.entries[charId] && this.entries[charId][stateKey];
    },

    // 読み込めたパーツだけを { wings: PartImage, ... } で返す（無いものは入らない）
    getParts(charId) {
      const src = this.parts[charId] || {};
      const out = {};
      PART_NAMES.forEach((n) => { if (src[n] && src[n].ready) out[n] = src[n]; });
      return out;
    }
  };

  // ---------------- 動きの設定 ----------------
  // assets/config.js の motion で上書きできます（角度は「度」）。
  const DEFAULT_MOTION = {
    floatHeight: 14,          // 浮いている高さ（影から足元まで, px）
    idleBob: 4,               // 待機：上下の揺れ幅（px）
    idleBobSpeed: 0.004,      // 待機：揺れの速さ
    idleFlapSpeed: 0.004,     // 待機：羽ばたきの速さ
    moveBob: 6,               // 移動：上下の揺れ幅（px）
    moveBobSpeed: 0.012,      // 移動：揺れの速さ
    moveFlapSpeed: 0.014,     // 移動：羽ばたきの速さ
    moveLean: 8.6,            // 移動：前傾（度）
    wingFlap: 20,             // 羽ばたきの振れ幅（度、±）
    idleArm: 34.4,            // 待機・移動中の腕の角度（度。0 = 真横（前）、プラスで下向き）
    attackArmFrom: -91.7,     // 攻撃：振りかぶったときの腕の角度（度）
    attackArmTo: 45.8,        // 攻撃：振り下ろした後の腕の角度（度）
    attackLeanFrom: -8.6,     // 攻撃：最初の体の傾き（度。マイナス = 後ろへ反る）
    attackLeanTo: 17.2,       // 攻撃：最後の体の傾き（度）
    hurtLean: -20,            // 被ダメ：のけぞり（度）
    hurtBob: -4,              // 被ダメ：上下のずれ（px）
    hurtArm: -34.4,           // 被ダメ：腕の角度（度）
    slashFrom: 0.82           // 攻撃：アニメーションのこの割合から斬撃エフェクトを表示（0〜1）
  };
  const DEG = Math.PI / 180;
  function motionCfg() {
    const m = (window.ASSET_CONFIG && window.ASSET_CONFIG.motion) || {};
    return Object.assign({}, DEFAULT_MOTION, m);
  }

  /*
   * キャラクターの描画（右向き基準。原点 = 足元の中央）
   *  state   : idle / move / attack / hurt / down
   *  progress: アニメーションの進み具合 0〜1（ループ系は周期内の位置）
   *  time    : 経過時間（ms）
   *  opts.parts  : SpriteBank.getParts() の結果。入っているパーツは画像、無いパーツは仮の図形で描画
   *  opts.partsConfig : assets/config.js の parts（順番・ピボットなど）
   *  opts.debug  : true ならピボット（回転の軸）を表示
   *  opts.flipped: 左右反転して描画中か（デバッグ文字を読めるようにするため）
   */
  function drawCharacter(ctx, charId, state, progress, time, w, h, opts) {
    opts = opts || {};
    const parts = opts.parts || {};
    const pconf = opts.partsConfig || {};
    const M = motionCfg();
    const isAngel = charId === 'angel';
    const body = isAngel ? '#fff6dc' : '#4a1670';
    const body2 = isAngel ? '#e8c45a' : '#1c0630';
    const wing = isAngel ? 'rgba(255,255,255,0.92)' : 'rgba(20,6,30,0.95)';
    const wingEdge = isAngel ? '#d8c27a' : '#a040ff';
    const eye = isAngel ? '#3a6cff' : '#ff2040';

    ctx.save();
    const baseAlpha = ctx.globalAlpha;
    let bob = 0, lean = 0, rot = 0, alpha = 1, flapSpeed = M.idleFlapSpeed;
    if (state === 'idle') { bob = Math.sin(time * M.idleBobSpeed) * M.idleBob; }
    if (state === 'move') { bob = Math.sin(time * M.moveBobSpeed) * M.moveBob; lean = M.moveLean * DEG; flapSpeed = M.moveFlapSpeed; }
    if (state === 'attack') { lean = (M.attackLeanFrom + (M.attackLeanTo - M.attackLeanFrom) * progress) * DEG; }
    if (state === 'hurt') { lean = M.hurtLean * DEG; bob = M.hurtBob; }
    if (state === 'down') { rot = -Math.min(1, progress * 1.4) * Math.PI / 2; alpha = 1 - Math.max(0, progress - 0.7) * 1.2; }

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.32, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = baseAlpha * Math.max(0.15, alpha);
    const floatY = -M.floatHeight + bob; // 浮遊
    ctx.translate(0, floatY);
    if (state === 'down') {
      // 倒れる APNG が無いときだけ使われる（仮の図形の倒れ方）
      ctx.translate(-w * 0.1, 10);
      ctx.rotate(rot);
    } else {
      ctx.rotate(lean);
    }

    const bh = h * 0.78; // 体の高さ
    const bw = w * 0.38;
    const headR = w * 0.15;

    // 各パーツの「付け根（ピボットを置く位置）」と角度（仮の図形と共通）
    const flap = Math.sin(time * flapSpeed) * M.wingFlap * DEG;
    let armAngle = M.idleArm * DEG;
    if (state === 'attack') armAngle = (M.attackArmFrom + (M.attackArmTo - M.attackArmFrom) * progress) * DEG; // 振りかぶり → 振り下ろし
    if (state === 'hurt') armAngle = M.hurtArm * DEG;
    const joints = {
      wings: { x: -bw * 0.2, y: -bh * 0.7 },
      body:  { x: 0, y: 0 },
      head:  { x: bw * 0.05, y: -bh * 0.78 },   // 首
      arm:   { x: bw * 0.2, y: -bh * 0.66 }      // 肩
    };

    // 画像パーツの配置（位置と角度）
    function placement(name) {
      const c = (parts[name] && parts[name].cfg) || pconf[name] || {};
      const scale = c.scale != null ? c.scale : 0.5;
      const pivot = c.pivot || { x: 0, y: 0 };
      let off = c.offset;
      if (!off || off === 'auto') {
        const an = pconf.canvasAnchor;
        off = an ? { x: (pivot.x - an.x) * scale, y: (pivot.y - an.y) * scale } : joints[name];
      }
      let angle = (c.angle || 0) * DEG;
      if (name === 'wings') angle += flap;
      if (name === 'arm') angle += armAngle - (c.restAngle != null ? c.restAngle : M.idleArm) * DEG;
      return { x: off.x, y: off.y, angle: angle, scale: scale, pivot: pivot };
    }

    function partImage(name) {
      const p = parts[name];
      if (!p) return null;
      if (typeof p.imageFor === 'function') return p.imageFor(state);
      return p.img || null;
    }

    function drawImagePart(name) {
      const img = partImage(name);
      if (!img) return;
      const pl = placement(name);
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.rotate(pl.angle);
      ctx.scale(pl.scale, pl.scale);
      ctx.drawImage(img, -pl.pivot.x, -pl.pivot.y);
      ctx.restore();
    }

    // ---- 仮の図形のパーツ ----
    const hx = bw * 0.05, hy = -bh * 0.78 - headR * 0.9;
    const shapes = {
      wings() {
        ctx.save();
        ctx.translate(joints.wings.x, joints.wings.y);
        ctx.rotate(-0.4 + flap);
        ctx.fillStyle = wing;
        ctx.strokeStyle = wingEdge;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (isAngel) {
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-w * 0.55, -h * 0.25, -w * 0.5, h * 0.1);
          ctx.quadraticCurveTo(-w * 0.3, h * 0.05, 0, h * 0.12);
        } else {
          ctx.moveTo(0, 0);
          ctx.lineTo(-w * 0.55, -h * 0.22);
          ctx.lineTo(-w * 0.42, -h * 0.02);
          ctx.lineTo(-w * 0.5, h * 0.12);
          ctx.lineTo(-w * 0.28, h * 0.06);
          ctx.lineTo(0, h * 0.14);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      },
      body() {
        const grd = ctx.createLinearGradient(0, -bh, 0, 0);
        grd.addColorStop(0, body);
        grd.addColorStop(1, body2);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(-bw * 0.35, -bh * 0.78);
        ctx.lineTo(bw * 0.35, -bh * 0.78);
        ctx.lineTo(bw * 0.6, 0);
        ctx.lineTo(-bw * 0.6, 0);
        ctx.closePath();
        ctx.fill();
      },
      head() {
        ctx.fillStyle = isAngel ? '#ffe8cf' : '#d9c6e6';
        ctx.beginPath();
        ctx.arc(hx, hy, headR, 0, Math.PI * 2);
        ctx.fill();
        // 髪
        ctx.fillStyle = isAngel ? '#ffd860' : '#140018';
        ctx.beginPath();
        ctx.arc(hx - headR * 0.25, hy - headR * 0.2, headR * 0.95, Math.PI * 0.9, Math.PI * 1.95);
        ctx.fill();
        // 天使の輪 / 角
        if (isAngel) {
          ctx.strokeStyle = '#ffe34d';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(hx, hy - headR * 1.45, headR * 0.8, headR * 0.25, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#e8e0d0';
          [-1, 1].forEach((s) => {
            ctx.beginPath();
            ctx.moveTo(hx + s * headR * 0.5, hy - headR * 0.7);
            ctx.lineTo(hx + s * headR * 0.95, hy - headR * 1.8);
            ctx.lineTo(hx + s * headR * 0.1, hy - headR * 0.9);
            ctx.closePath();
            ctx.fill();
          });
        }
        // 目（前を向いている側 = 右に寄せる → 向きの目印）
        ctx.fillStyle = state === 'down' ? '#000' : eye;
        if (state === 'down' || state === 'hurt') {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(hx + headR * 0.3, hy - 4); ctx.lineTo(hx + headR * 0.7, hy + 4);
          ctx.moveTo(hx + headR * 0.7, hy - 4); ctx.lineTo(hx + headR * 0.3, hy + 4);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(hx + headR * 0.5, hy, headR * 0.17, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      arm() {
        ctx.save();
        ctx.translate(joints.arm.x, joints.arm.y);
        ctx.rotate(armAngle);
        ctx.fillStyle = body;
        ctx.fillRect(0, -5, w * 0.22, 10);
        // 武器（剣 / 槍）
        ctx.fillStyle = isAngel ? '#cfe8ff' : '#ff3050';
        ctx.fillRect(w * 0.2, -3, w * 0.32, 6);
        ctx.restore();
      }
    };

    // ---- 描画順に描く（奥 → 手前） ----
    let order = Array.isArray(pconf.order) ? pconf.order.filter((n) => PART_NAMES.indexOf(n) >= 0) : [];
    PART_NAMES.forEach((n) => { if (order.indexOf(n) < 0) order.push(n); });
    order.forEach((name) => {
      if (name === 'arm' && state === 'down') return; // 倒れるときは腕を描かない（仮の図形と同じ）
      if (partImage(name)) drawImagePart(name);
      else shapes[name]();
    });

    // ---- デバッグ：ピボット（回転の軸）と画像の範囲 ----
    if (opts.debug) {
      const colors = { wings: '#4cf', body: '#fc4', head: '#f6c', arm: '#f84' };
      order.forEach((name) => {
        const isImg = !!parts[name];
        const pl = isImg ? placement(name) : { x: joints[name].x, y: joints[name].y, angle: 0 };
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.translate(pl.x, pl.y);
        ctx.strokeStyle = colors[name];
        ctx.fillStyle = colors[name];
        ctx.lineWidth = 1.5;
        if (isImg) {
          ctx.save();
          ctx.rotate(pl.angle);
          ctx.setLineDash([3, 3]);
          const dimg = partImage(name);
          ctx.strokeRect(-pl.pivot.x * pl.scale, -pl.pivot.y * pl.scale, dimg.naturalWidth * pl.scale, dimg.naturalHeight * pl.scale);
          ctx.setLineDash([]);
          ctx.restore();
        }
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
        ctx.moveTo(0, -6); ctx.lineTo(0, 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.stroke();
        if (opts.flipped) ctx.scale(-1, 1);
        ctx.font = '10px sans-serif';
        ctx.fillText(PART_LABELS[name] + (isImg ? '' : '(仮)'), 5, -5);
        ctx.restore();
      });
    }

    ctx.restore();

    // 攻撃の最後：前方に斬撃エフェクト
    if (state === 'attack' && progress > M.slashFrom) {
      const a = (progress - M.slashFrom) / (1 - M.slashFrom);
      ctx.save();
      ctx.strokeStyle = isAngel ? 'rgba(255,240,150,' + (1 - a * 0.5) + ')' : 'rgba(200,60,255,' + (1 - a * 0.5) + ')';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w * 0.3, -h * 0.5, w * 0.45, -1.1, 1.1);
      ctx.stroke();
      ctx.restore();
    }

    // 被ダメ：赤いフラッシュ
    if (state === 'hurt' && Math.floor(time / 60) % 2 === 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,80,80,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.5, w * 0.4, h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 向きの目印（前方の小さな三角）。頭の画像があるときは表示しない
    if (state !== 'down' && !parts.head) {
      ctx.fillStyle = isAngel ? 'rgba(255,220,90,0.9)' : 'rgba(190,90,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, -h * 0.5);
      ctx.lineTo(w * 0.38, -h * 0.56);
      ctx.lineTo(w * 0.38, -h * 0.44);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 互換用：パーツなし（すべて仮の図形）で描画
  function drawPlaceholder(ctx, charId, state, progress, time, w, h, opts) {
    drawCharacter(ctx, charId, state, progress, time, w, h, Object.assign({}, opts, { parts: {} }));
  }

  window.SpriteBank = SpriteBank;
  window.drawCharacter = drawCharacter;
  window.drawPlaceholder = drawPlaceholder;
})();
