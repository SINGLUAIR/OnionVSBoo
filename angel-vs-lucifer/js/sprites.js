/*
 * スプライト管理
 *  - assets/config.js に登録された APNG を読み込みます。
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

  const SpriteBank = {
    entries: {},   // entries[charId][stateKey] = SpriteEntry

    loadAll() {
      const conf = window.ASSET_CONFIG;
      const jobs = [];
      if (location.protocol === 'file:') {
        console.warn('[sprites] file:// では画像を読み込めません。ローカルサーバー（README 参照）か GitHub Pages で開いてください。');
      }
      Object.keys(conf.characters).forEach((charId) => {
        const ch = conf.characters[charId];
        this.entries[charId] = {};
        Object.keys(ch.states).forEach((stateKey) => {
          const e = new SpriteEntry(charId, stateKey, ch.states[stateKey]);
          this.entries[charId][stateKey] = e;
          if (location.protocol !== 'file:') jobs.push(e.load());
        });
      });
      return Promise.all(jobs).then((results) => {
        const loaded = results.filter(Boolean).length;
        console.info('[sprites] APNG 読み込み: ' + loaded + ' / ' + results.length + '（不足分はプレースホルダーで表示）');
      });
    },

    get(charId, stateKey) {
      return this.entries[charId] && this.entries[charId][stateKey];
    }
  };

  /*
   * 仮の図形での描画（右向き基準。原点 = 足元の中央）
   *  state   : idle / move / attack / hurt / down
   *  progress: アニメーションの進み具合 0〜1（ループ系は周期内の位置）
   *  time    : 経過時間（ms）
   */
  function drawPlaceholder(ctx, charId, state, progress, time, w, h) {
    const isAngel = charId === 'angel';
    const body = isAngel ? '#fff6dc' : '#4a1670';
    const body2 = isAngel ? '#e8c45a' : '#1c0630';
    const wing = isAngel ? 'rgba(255,255,255,0.92)' : 'rgba(20,6,30,0.95)';
    const wingEdge = isAngel ? '#d8c27a' : '#a040ff';
    const eye = isAngel ? '#3a6cff' : '#ff2040';

    ctx.save();
    let bob = 0, lean = 0, rot = 0, alpha = 1, flapSpeed = 0.004;
    if (state === 'idle') { bob = Math.sin(time * 0.004) * 4; }
    if (state === 'move') { bob = Math.sin(time * 0.012) * 6; lean = 0.15; flapSpeed = 0.014; }
    if (state === 'attack') { lean = -0.15 + progress * 0.45; }
    if (state === 'hurt') { lean = -0.35; bob = -4; }
    if (state === 'down') { rot = -Math.min(1, progress * 1.4) * Math.PI / 2; alpha = 1 - Math.max(0, progress - 0.7) * 1.2; }

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.32, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = Math.max(0.15, alpha);
    const floatY = -14 + bob; // 浮遊
    ctx.translate(0, floatY);
    if (state === 'down') {
      ctx.translate(-w * 0.1, 10);
      ctx.rotate(rot);
    } else {
      ctx.rotate(lean);
    }

    const bh = h * 0.78; // 体の高さ
    const bw = w * 0.38;

    // 羽（背中側 = 左）
    const flap = Math.sin(time * flapSpeed) * 0.35;
    ctx.save();
    ctx.translate(-bw * 0.2, -bh * 0.7);
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

    // 体（ローブ）
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

    // 頭
    const headR = w * 0.15;
    const hx = bw * 0.05, hy = -bh * 0.78 - headR * 0.9;
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

    // 腕＋武器（攻撃時に振り下ろす）
    if (state !== 'down') {
      let armAngle = 0.6; // 下向き
      if (state === 'attack') armAngle = -1.6 + progress * 2.4; // 振りかぶり → 振り下ろし
      if (state === 'hurt') armAngle = -0.6;
      ctx.save();
      ctx.translate(bw * 0.2, -bh * 0.66);
      ctx.rotate(armAngle);
      ctx.fillStyle = body;
      ctx.fillRect(0, -5, w * 0.22, 10);
      // 武器（剣 / 槍）
      ctx.fillStyle = isAngel ? '#cfe8ff' : '#ff3050';
      ctx.fillRect(w * 0.2, -3, w * 0.32, 6);
      ctx.restore();
    }

    ctx.restore();
    ctx.globalAlpha = 1;

    // 攻撃の最後：前方に斬撃エフェクト
    if (state === 'attack' && progress > 0.82) {
      const a = (progress - 0.82) / 0.18;
      ctx.save();
      ctx.strokeStyle = isAngel ? 'rgba(255,240,150,' + (1 - a * 0.5) + ')' : 'rgba(200,60,255,' + (1 - a * 0.5) + ')';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w * 0.3, -h * 0.5, w * 0.45, -1.1, 1.1);
      ctx.stroke();
      ctx.restore();
    }

    // 被ダメ：白フラッシュ
    if (state === 'hurt' && Math.floor(time / 60) % 2 === 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,80,80,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.5, w * 0.4, h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 向きの目印（前方の小さな三角）
    if (state !== 'down') {
      ctx.fillStyle = isAngel ? 'rgba(255,220,90,0.9)' : 'rgba(190,90,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, -h * 0.5);
      ctx.lineTo(w * 0.38, -h * 0.56);
      ctx.lineTo(w * 0.38, -h * 0.44);
      ctx.closePath();
      ctx.fill();
    }
  }

  window.SpriteBank = SpriteBank;
  window.drawPlaceholder = drawPlaceholder;
})();
