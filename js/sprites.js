/*
 * スプライト管理
 *  - パーツモード（mode: 'parts'、初期設定）
 *      翼・体・頭・腕と剣の4枚の PNG を、仮の図形と同じ動き（ふわふわ・羽ばたき・前傾・振りかぶり・のけぞり）で動かします。
 *      倒れる瞬間（down）だけは APNG（down.png）または静止 PNG のコマ送りを1回再生します（コードで回転させません）。
 *      再生が終わると倒れ続け（downLoop）に切り替わり、down/ のパーツ（または loop.png）を使います。
 *      倒れ続けでは体だけが呼吸し、頭・翼・腕は動きません。downLoop の画像が無いときは倒れる瞬間の最後のコマを保持します。
 *      勝利（win）は待機と同じ動きで、頭の差分（head_win.png）があれば差し替えます。
 *      パーツ画像が無いものは、そのパーツだけ仮の図形で描画します（downLoop では欠けたパーツは描きません）。
 *      各パーツは variants（モーション名 → 画像パス）で、そのモーションのときだけ差し替え画像を使えます
 *      （ピボット・位置・大きさ・角度は通常のパーツと同じ。画像が無いときは通常のパーツへフォールバック）。
 *      翼は mirror: true で、片側だけの画像＋左右反転コピーを描き、羽ばたき角を逆向きにして対称に動かします。
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

  // index.html の ?v= を画像の読み込みにも付けて、GitHub Pages の 10分キャッシュで古い画像が残らないようにする
  function cacheBust(src) {
    if (!src || src.indexOf('data:') === 0 || src.indexOf('blob:') === 0) return src;
    try {
      const scripts = document.getElementsByTagName('script');
      let v = '';
      for (let i = 0; i < scripts.length; i++) {
        const m = (scripts[i].src || '').match(/[?&]v=([^&]+)/);
        if (m) { v = decodeURIComponent(m[1]); break; }
      }
      if (!v) return src;
      return src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(v);
    } catch (e) { return src; }
  }
  window.cacheBust = cacheBust;

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
      return fetch(cacheBust(src))
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
      img.src = cacheBust(src);
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

  // 静止 PNG のコマ送り（倒れる瞬間の APNG 代替）
  class FrameSequence {
    constructor(charId, srcs, frameMs) {
      this.charId = charId;
      this.srcs = srcs || [];
      this.frameMs = frameMs || 100;
      this.frames = [];
      this.delays = [];
      this.total = 0;
      this.ready = false;
    }
    load() {
      return Promise.all(this.srcs.map(loadPng)).then((imgs) => {
        imgs.forEach((img) => {
          if (img) {
            this.frames.push(img);
            this.delays.push(this.frameMs);
          }
        });
        this.total = this.delays.reduce((a, b) => a + b, 0);
        this.ready = this.frames.length > 0;
        return this.ready;
      });
    }
    frameAt(elapsed, duration, loop) {
      const n = this.frames.length;
      if (!n) return null;
      if (n === 1) return this.frames[0];
      const dur = duration || this.total || 1;
      let t = loop ? (elapsed % dur) : Math.min(elapsed, dur);
      if (!loop && t >= dur) return this.frames[n - 1];
      const ft = t / dur * this.total;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        acc += this.delays[i];
        if (ft < acc) return this.frames[i];
      }
      return this.frames[n - 1];
    }
  }

  function defaultDownFramePaths(charId) {
    const out = [];
    for (let i = 1; i <= 5; i++) out.push('assets/sprites/' + charId + '/down_' + i + '.png');
    return out;
  }

  const SpriteBank = {
    entries: {},         // entries[charId][stateKey] = SpriteEntry（APNG）
    parts: {},           // parts[charId][partName] = PartImage
    downFrames: {},      // downFrames[charId] = FrameSequence
    downParts: {},       // downParts[charId][partName] = PartImage
    downLoopSingle: {},  // downLoopSingle[charId] = { img, ready, cfg }

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
        const downCfg = ch.states.down || {};
        const frameSrcs = Array.isArray(downCfg.frames) && downCfg.frames.length
          ? downCfg.frames
          : (downCfg.type === 'frames' ? defaultDownFramePaths(charId) : []);
        if (frameSrcs.length) {
          const seq = new FrameSequence(charId, frameSrcs, downCfg.frameMs || 100);
          this.downFrames[charId] = seq;
          jobs.push(seq.load().then((ok) => ({ kind: 'frames', ok: ok })));
        }
        const dl = ch.downLoop;
        if (dl) {
          this.downParts[charId] = {};
          PART_NAMES.forEach((name) => {
            if (!dl[name] || !dl[name].src) return;
            const p = new PartImage(charId, 'down-' + name, dl[name]);
            this.downParts[charId][name] = p;
            jobs.push(p.load().then((ok) => ({ kind: 'downPart', ok: ok })));
          });
          let singleSrc = dl.src || null;
          if (!singleSrc && dl.mode === 'single') singleSrc = 'assets/sprites/' + charId + '/down/loop.png';
          if (singleSrc) {
            jobs.push(loadPng(singleSrc).then((img) => {
              this.downLoopSingle[charId] = { img: img, ready: !!img, cfg: dl };
              return { kind: 'downSingle', ok: !!img };
            }));
          }
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
        const f = count('frames'), dp = count('downPart'), ds = count('downSingle');
        console.info('[sprites] APNG: ' + a.filter((r) => r.ok).length + ' / ' + a.length +
          '、パーツ画像: ' + p.filter((r) => r.ok).length + ' / ' + p.length +
          (vAll ? '、差分画像: ' + vOk + ' / ' + vAll : '') +
          (f.length ? '、倒れコマ送り: ' + f.filter((r) => r.ok).length + ' / ' + f.length : '') +
          (dp.length ? '、倒れ続けパーツ: ' + dp.filter((r) => r.ok).length + ' / ' + dp.length : '') +
          (ds.length ? '、倒れ続け1枚絵: ' + ds.filter((r) => r.ok).length + ' / ' + ds.length : '') +
          '（不足分は仮の図形／通常のパーツ／最後のコマで表示）');
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
    },

    getDownFrames(charId) {
      const s = this.downFrames[charId];
      return (s && s.ready) ? s : null;
    },

    getDownParts(charId) {
      const src = this.downParts[charId] || {};
      const out = {};
      PART_NAMES.forEach((n) => { if (src[n] && src[n].ready) out[n] = src[n]; });
      return out;
    },

    hasDownLoopParts(charId) {
      return Object.keys(this.getDownParts(charId)).length > 0;
    },

    getDownLoopSingle(charId) {
      const s = this.downLoopSingle[charId];
      return (s && s.ready) ? s : null;
    },

    // テストや後からコマ送りを足すとき用
    loadDownFrames(charId, srcs, frameMs) {
      const seq = new FrameSequence(charId, srcs, frameMs || 100);
      this.downFrames[charId] = seq;
      return seq.load();
    },

    // 'frames' | 'apng' | 'placeholder'
    resolveDownKind(charId) {
      const ch = window.ASSET_CONFIG && window.ASSET_CONFIG.characters[charId];
      const cfg = (ch && ch.states && ch.states.down) || {};
      const framesOk = !!(this.downFrames[charId] && this.downFrames[charId].ready);
      const apng = this.get(charId, 'down');
      const apngOk = !!(apng && apng.ready);
      const want = cfg.type || 'auto';
      if (want === 'frames') {
        if (framesOk) return 'frames';
        if (apngOk) return 'apng';
        return 'placeholder';
      }
      if (want === 'apng') {
        if (apngOk) return 'apng';
        if (framesOk) return 'frames';
        return 'placeholder';
      }
      // auto: コマ送りが設定されて読み込めていればそちら、なければ APNG
      const configured = Array.isArray(cfg.frames) && cfg.frames.length > 0;
      if (configured && framesOk) return 'frames';
      if (apngOk) return 'apng';
      if (framesOk) return 'frames';
      return 'placeholder';
    },

    // 倒れ続けの描画方法。無ければ null（呼び出し側は最後のコマ or 仮の図形へ）
    resolveDownLoopKind(charId) {
      const ch = window.ASSET_CONFIG && window.ASSET_CONFIG.characters[charId];
      const dl = ch && ch.downLoop;
      const single = this.getDownLoopSingle(charId);
      const partsOk = this.hasDownLoopParts(charId);
      if (dl && dl.mode === 'single') {
        if (single) return 'single';
        if (partsOk) return 'parts';
        return null;
      }
      if (partsOk) return 'parts';
      if (single) return 'single';
      return null;
    },

    downDuration(charId) {
      const ch = window.ASSET_CONFIG && window.ASSET_CONFIG.characters[charId];
      const st = (ch && ch.states && ch.states.down) || {};
      const kind = this.resolveDownKind(charId);
      if (kind === 'frames') {
        const seq = this.getDownFrames(charId);
        if (seq && seq.frames.length) {
          const ms = st.frameMs || Math.round((st.duration || 900) / seq.frames.length);
          return ms * seq.frames.length;
        }
      }
      return st.duration || 900;
    },

    lastFallFrame(charId) {
      const kind = this.resolveDownKind(charId);
      if (kind === 'frames') {
        const seq = this.getDownFrames(charId);
        return seq ? seq.frames[seq.frames.length - 1] : null;
      }
      if (kind === 'apng') {
        const e = this.get(charId, 'down');
        return (e && e.ready && e.frames.length) ? e.frames[e.frames.length - 1] : null;
      }
      return null;
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
    slashFrom: 0.82,          // 攻撃：アニメーションのこの割合から斬撃エフェクトを表示（0〜1）
    downBreathAmp: 0.02,      // 倒れ続け：体の呼吸の拡縮幅
    downBreathPeriod: 2000    // 倒れ続け：呼吸1回の長さ（ミリ秒）
  };
  const DEG = Math.PI / 180;
  // 攻撃の振りの進み具合（0 = 振りかぶり、1 = 振り下ろし終わり）
  //  0〜hitAt   : 振りかぶったポーズでため、終盤で一気に振り下ろす（判定の瞬間に振り下ろし終わる）
  //  hitAt〜1   : 振り抜いた勢いで少し行き過ぎて、ゆっくり戻る
  function attackSwing(p, hitAt) {
    if (hitAt >= 1) return p; // 従来どおり（最後に判定）
    if (p < hitAt) {
      const t = p / hitAt;
      const holdEnd = 0.72;   // ここまでは振りかぶったまま
      if (t <= holdEnd) return 0;
      const s = (t - holdEnd) / (1 - holdEnd);
      return s * s;           // 判定に向けて加速して振り下ろす
    }
    const t = (p - hitAt) / (1 - hitAt);
    return 1 + 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t * 0.5);
  }

  // 突き（槍）の踏み込み 0〜1：ためている間は 0、判定の直前に一気に 1、少し残してから戻る
  function thrustDrive(p, hitAt) {
    if (hitAt >= 1) return p;
    if (p < hitAt) {
      const t = p / hitAt;
      if (t <= 0.78) return 0;
      const s = (t - 0.78) / 0.22;
      return s * s;
    }
    const t = (p - hitAt) / (1 - hitAt);
    if (t < 0.35) return 1;
    const r = (t - 0.35) / 0.65;
    return 1 - r * r * (3 - 2 * r);
  }
  // 構え（腕を前へ向ける）0〜1：攻撃の最初で構え、最後に戻す
  function readyPose(p, hitAt) {
    if (p < hitAt) return Math.min(1, (p / Math.max(0.01, hitAt)) / 0.25);
    const t = (p - hitAt) / Math.max(0.01, 1 - hitAt);
    return t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
  }

  function motionCfg() {
    const m = (window.ASSET_CONFIG && window.ASSET_CONFIG.motion) || {};
    return Object.assign({}, DEFAULT_MOTION, m);
  }

  /*
   * キャラクターの描画（右向き基準。原点 = 足元の中央）
   *  state   : idle / move / attack / hurt / down / downLoop / win
   *  progress: アニメーションの進み具合 0〜1（ループ系は周期内の位置）
   *  time    : 経過時間（ms）
   *  opts.parts  : SpriteBank.getParts() の結果。入っているパーツは画像、無いパーツは仮の図形で描画
   *  opts.partsConfig : assets/config.js の parts（順番・ピボットなど）
   *  opts.debug  : true ならピボット（回転の軸）を表示
   *  opts.flipped: 左右反転して描画中か（デバッグ文字を読めるようにするため）
   */
  // 地面の影の形。downLoop.shadow があるキャラは、倒れる途中で足元から背中の位置へなめらかに移動する
  function groundShadowShape(charId, opts) {
    opts = opts || {};
    const def = (window.ASSET_CONFIG && window.ASSET_CONFIG.characters && window.ASSET_CONFIG.characters[charId]) || {};
    const w0 = opts.width != null ? opts.width : (def.width || 140);
    const stand = { x: 0, y: 0, rx: w0 * 0.32, ry: 10 };
    const state = opts.state;
    if (state && state !== 'down' && state !== 'downLoop') return stand;
    const sh = (def.downLoop && def.downLoop.shadow) || def.downShadow || null;
    if (!sh) return stand;
    const lie = {
      x: sh.offsetX || 0,
      y: sh.offsetY || 0,
      rx: sh.radiusX != null ? sh.radiusX : stand.rx,
      ry: sh.radiusY != null ? sh.radiusY : stand.ry
    };
    let p = opts.progress;
    if (state === 'downLoop' || p == null) p = 1;
    if (p <= 0) return stand;
    const from = sh.from != null ? Math.max(0, Math.min(0.99, sh.from)) : 0.4;
    const t = Math.max(0, Math.min(1, (p - from) / (1 - from)));
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return {
      x: stand.x + (lie.x - stand.x) * e,
      y: stand.y + (lie.y - stand.y) * e,
      rx: stand.rx + (lie.rx - stand.rx) * e,
      ry: stand.ry + (lie.ry - stand.ry) * e
    };
  }

  function drawGroundShadow(ctx, charId, opts) {
    opts = opts || {};
    const shape = groundShadowShape(charId, opts);
    const x = shape.x * (opts.facing === -1 ? -1 : 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, shape.y, shape.rx, shape.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCharacter(ctx, charId, state, progress, time, w, h, opts) {
    opts = opts || {};
    const parts = opts.parts || {};
    const pconf = opts.partsConfig || {};
    const M = Object.assign(motionCfg(), opts.motion || {});
    const cdef = (window.ASSET_CONFIG && window.ASSET_CONFIG.characters && window.ASSET_CONFIG.characters[charId]) || {};
    const isAngel = (cdef.uiTheme || (charId === 'lucifer' ? 'lucifer' : 'angel')) === 'angel';
    const wMotion = opts.weaponMotion || 'swing';
    const body = isAngel ? '#fff6dc' : '#4a1670';
    const body2 = isAngel ? '#e8c45a' : '#1c0630';
    const wing = isAngel ? 'rgba(255,255,255,0.92)' : 'rgba(20,6,30,0.95)';
    const wingEdge = isAngel ? '#d8c27a' : '#a040ff';
    const eye = isAngel ? '#3a6cff' : '#ff2040';

    ctx.save();
    const baseAlpha = ctx.globalAlpha;
    let bob = 0, lean = 0, rot = 0, alpha = 1, flapSpeed = M.idleFlapSpeed;
    // 攻撃の振り：判定のタイミング（hitAt）で振り下ろしが終わり、残りは振り抜いた後の余韻
    const hitAt = opts.hitAt != null ? opts.hitAt : 1;
    const swing = state === 'attack' ? attackSwing(progress, hitAt) : 0;
    const drive = state === 'attack' && wMotion === 'thrust' ? thrustDrive(progress, hitAt) : 0;
    const ready = state === 'attack' && (wMotion === 'thrust' || wMotion === 'cast') ? readyPose(progress, hitAt) : 0;
    if (state === 'idle' || state === 'win') { bob = Math.sin(time * M.idleBobSpeed) * M.idleBob; }
    if (state === 'move') { bob = Math.sin(time * M.moveBobSpeed) * M.moveBob; lean = M.moveLean * DEG; flapSpeed = M.moveFlapSpeed; }
    if (state === 'attack') {
      if (wMotion === 'thrust') lean = (-5 + 13 * drive) * DEG;           // 槍：少し反って構え、突きで前のめり
      else if (wMotion === 'cast') lean = (-6 * ready + (progress >= hitAt ? 8 * ready : 0)) * DEG; // 魔法：反ってため、発動で前へ
      else lean = (M.attackLeanFrom + (M.attackLeanTo - M.attackLeanFrom) * swing) * DEG;
      // 予備動作中の追加後傾（左右反転後のローカル空間なので向きを気にしなくてよい）
      if (opts.windupHold > 0 && opts.windupExtraLeanDeg) {
        lean -= opts.windupExtraLeanDeg * opts.windupHold * DEG;
      }
    }
    if (state === 'hurt') { lean = M.hurtLean * DEG; bob = M.hurtBob; }
    if (opts.velLeanDeg && state === 'move') lean += opts.velLeanDeg * DEG; // 飛行：速度に合わせた傾き
    if (state === 'down') { rot = -Math.min(1, progress * 1.4) * Math.PI / 2; alpha = 1 - Math.max(0, progress - 0.7) * 1.2; }

    // 影（倒れたときは downLoop.shadow の位置。左右反転は呼び出し側ですでにかかっている）
    drawGroundShadow(ctx, charId, { state: state, progress: progress, width: w });

    ctx.globalAlpha = baseAlpha * Math.max(0.15, alpha);
    // 浮遊（倒れ続けは床に寝ているので浮かせない。states.down.sinkY の分だけ下げる。影は動かさない）
    const floatY = (state === 'downLoop') ? (opts.sinkY || 0) : (-M.floatHeight + bob);
    ctx.translate(0, floatY);
    if (drive > 0 && opts.thrustPx) ctx.translate(opts.thrustPx * drive, 0); // 槍：突きで体ごと前へ
    if (state === 'down') {
      // 倒れる APNG／コマ送りが無いときだけ使われる（仮の図形の倒れ方）
      ctx.translate(-w * 0.1, 10);
      ctx.rotate(rot);
    } else if (state !== 'downLoop') {
      ctx.rotate(lean);
    }

    const bh = h * 0.78; // 体の高さ
    const bw = w * 0.38;
    const headR = w * 0.15;

    // 各パーツの「付け根（ピボットを置く位置）」と角度（仮の図形と共通）
    const flap = (state === 'downLoop') ? 0 : Math.sin(time * flapSpeed) * M.wingFlap * DEG;
    let armAngle = M.idleArm * DEG;
    if (state === 'attack') {
      if (wMotion === 'thrust') armAngle = (M.idleArm + ((M.thrustArm != null ? M.thrustArm : 0) - M.idleArm) * ready) * DEG; // 槍：腕を水平に構えて突く
      else if (wMotion === 'cast') armAngle = (M.idleArm + ((progress < hitAt ? (M.castArm != null ? M.castArm : -60) : 0) - M.idleArm) * ready) * DEG; // 魔法：掲げて、発動で前へ
      else armAngle = (M.attackArmFrom + (M.attackArmTo - M.attackArmFrom) * swing) * DEG; // 剣・投擲：振りかぶり → 振り下ろし
    }
    if (state === 'hurt') armAngle = M.hurtArm * DEG;
    const joints = {
      wings: { x: -bw * 0.2, y: -bh * 0.7 },
      body:  { x: 0, y: 0 },
      head:  { x: bw * 0.05, y: -bh * 0.78 },   // 首
      arm:   { x: bw * 0.2, y: -bh * 0.66 }      // 肩
    };

    // 翼の左右反転設定（parts.wings。画像が無くても pconf から読む）
    function wingsCfg() {
      return (parts.wings && parts.wings.cfg) || pconf.wings || {};
    }
    function wingsMirrorOn() {
      return !!wingsCfg().mirror;
    }

    // 画像パーツの配置（位置と角度）
    // mirrored=true のときは、体の中心線（mirrorAxisX、省略時は canvasAnchor.x）で折り返した反対側の翼用。
    // 取り付け位置は折り返したピボットから計算し、描画時のピボットは元画像のまま（左右反転は scale(-1,1)）。
    function placement(name, mirrored) {
      const c = (parts[name] && parts[name].cfg) || pconf[name] || {};
      const baseScale = c.scale != null ? c.scale : 0.5;
      const srcPivot = c.pivot || { x: 0, y: 0 };
      const an = pconf.canvasAnchor;
      const axis = c.mirrorAxisX != null ? c.mirrorAxisX : (an ? an.x : 0);
      const placePivot = (mirrored && name === 'wings')
        ? { x: 2 * axis - srcPivot.x, y: srcPivot.y }
        : srcPivot;
      let off = c.offset;
      if (!off || off === 'auto') {
        off = an
          ? { x: (placePivot.x - an.x) * baseScale, y: (placePivot.y - an.y) * baseScale }
          : (mirrored && name === 'wings' ? { x: -joints[name].x, y: joints[name].y } : joints[name]);
      } else if (mirrored && name === 'wings') {
        const axisChar = an ? (axis - an.x) * baseScale : 0;
        off = { x: 2 * axisChar - off.x, y: off.y };
      }
      if (mirrored && name === 'wings' && c.mirrorOffset) {
        off = { x: off.x + (c.mirrorOffset.x || 0), y: off.y + (c.mirrorOffset.y || 0) };
      }
      let angle = (c.angle || 0) * DEG;
      if (name === 'wings') angle += flap;
      if (name === 'arm' && state !== 'downLoop') angle += armAngle - (c.restAngle != null ? c.restAngle : M.idleArm) * DEG;
      if (mirrored) angle = -angle;
      let scale = baseScale;
      if (mirrored && name === 'wings' && c.mirrorScale != null) scale = baseScale * c.mirrorScale;
      const tint = (mirrored && name === 'wings' && c.mirrorTint) ? c.mirrorTint : 0;
      return { x: off.x, y: off.y, angle: angle, scale: scale, pivot: srcPivot, tint: tint };
    }

    function partImage(name) {
      const p = parts[name];
      if (!p) return null;
      if (typeof p.imageFor === 'function') return p.imageFor(state);
      return p.img || null;
    }

    function applyTint(tint) {
      const t = Math.max(0, Math.min(1, tint || 0));
      if (t) ctx.filter = 'brightness(' + (1 - t) + ')';
    }

    function breathScaleY() {
      const amp = (pconf.breathAmp != null) ? pconf.breathAmp : (M.downBreathAmp || 0.02);
      const period = (pconf.breathPeriod != null) ? pconf.breathPeriod : (M.downBreathPeriod || 2000);
      const t = (opts.stateTime != null) ? opts.stateTime : time;
      return 1 + Math.sin((t / Math.max(1, period)) * Math.PI * 2) * amp;
    }

    // 0〜1 は画像サイズに対する比率、1より大きい値は画像上の px
    function resolveBreathSplit(val, size) {
      if (val == null || val === '') return null;
      const n = Number(val);
      if (!isFinite(n)) return null;
      if (n >= 0 && n <= 1) return n * size;
      return n;
    }

    // 倒れ続けの体だけ：breathRegion で呼吸する範囲を切り出せる（省略時は従来どおり画像全体を縦に拡縮）
    //  body パーツ（なければ downLoop）の breathRegion / breathSplit / breathSplitX / breathSplitY / breathXSide / breathYSide
    function bodyBreathRegion(img) {
      const c = (parts.body && parts.body.cfg) || pconf.body || {};
      const region = c.breathRegion || pconf.breathRegion || 'full';
      if (!region || region === 'full') return null;
      const w = img.naturalWidth, h = img.naturalHeight;
      const splitVal = c.breathSplit != null ? c.breathSplit : pconf.breathSplit;
      let splitX = resolveBreathSplit(c.breathSplitX != null ? c.breathSplitX : pconf.breathSplitX, w);
      let splitY = resolveBreathSplit(c.breathSplitY != null ? c.breathSplitY : pconf.breathSplitY, h);
      if ((region === 'upper' || region === 'lower') && splitY == null) {
        splitY = resolveBreathSplit(splitVal != null ? splitVal : 0.5, h);
      }
      if ((region === 'left' || region === 'right') && splitX == null) {
        splitX = resolveBreathSplit(splitVal != null ? splitVal : 0.5, w);
      }
      const xSide = c.breathXSide || pconf.breathXSide || 'left';
      const ySide = c.breathYSide || pconf.breathYSide || 'upper';
      return { region: region, splitX: splitX, splitY: splitY, w: w, h: h, xSide: xSide, ySide: ySide };
    }

    // 境目の線を軸に拡縮するので、静止側とのあいだに隙間も重なりも出ない
    function drawBreathingBody(img, pl, breath, ro) {
      const s = pl.scale;
      const px = pl.pivot.x, py = pl.pivot.y;
      const W = ro.w, H = ro.h;
      applyTint(pl.tint);

      function drawStatic(ix, iy, iw, ih) {
        if (iw <= 0.5 || ih <= 0.5) return;
        ctx.save();
        ctx.scale(s, s);
        ctx.drawImage(img, ix, iy, iw, ih, -px + ix, -py + iy, iw, ih);
        ctx.restore();
      }
      function drawScaleY(ix, iy, iw, ih, seamY, amp) {
        if (iw <= 0.5 || ih <= 0.5) return;
        ctx.save();
        ctx.translate(0, (seamY - py) * s);
        ctx.scale(s, s * amp);
        ctx.translate(0, -(seamY - py));
        ctx.drawImage(img, ix, iy, iw, ih, -px + ix, -py + iy, iw, ih);
        ctx.restore();
      }
      function drawScaleX(ix, iy, iw, ih, seamX, amp) {
        if (iw <= 0.5 || ih <= 0.5) return;
        ctx.save();
        ctx.translate((seamX - px) * s, 0);
        ctx.scale(s * amp, s);
        ctx.translate(-(seamX - px), 0);
        ctx.drawImage(img, ix, iy, iw, ih, -px + ix, -py + iy, iw, ih);
        ctx.restore();
      }

      if (ro.region === 'upper' || ro.region === 'lower') {
        const seam = ro.splitY;
        const movingUpper = ro.region === 'upper';
        if (movingUpper) drawStatic(0, seam, W, H - seam);
        else drawStatic(0, 0, W, seam);
        let mx0 = 0, mw = W;
        if (ro.splitX != null) {
          if (ro.xSide === 'right') {
            if (movingUpper) drawStatic(0, 0, ro.splitX, seam);
            else drawStatic(0, seam, ro.splitX, H - seam);
            mx0 = ro.splitX; mw = W - ro.splitX;
          } else {
            if (movingUpper) drawStatic(ro.splitX, 0, W - ro.splitX, seam);
            else drawStatic(ro.splitX, seam, W - ro.splitX, H - seam);
            mx0 = 0; mw = ro.splitX;
          }
        }
        if (movingUpper) drawScaleY(mx0, 0, mw, seam, seam, breath);
        else drawScaleY(mx0, seam, mw, H - seam, seam, breath);
        return;
      }

      if (ro.region === 'left' || ro.region === 'right') {
        const seam = ro.splitX;
        const movingLeft = ro.region === 'left';
        if (movingLeft) drawStatic(seam, 0, W - seam, H);
        else drawStatic(0, 0, seam, H);
        let my0 = 0, mh = H;
        if (ro.splitY != null) {
          if (ro.ySide === 'lower') {
            if (movingLeft) drawStatic(0, 0, seam, ro.splitY);
            else drawStatic(seam, 0, W - seam, ro.splitY);
            my0 = ro.splitY; mh = H - ro.splitY;
          } else {
            if (movingLeft) drawStatic(0, ro.splitY, seam, H - ro.splitY);
            else drawStatic(seam, ro.splitY, W - seam, H - ro.splitY);
            my0 = 0; mh = ro.splitY;
          }
        }
        if (movingLeft) drawScaleX(0, my0, seam, mh, seam, breath);
        else drawScaleX(seam, my0, W - seam, mh, seam, breath);
      }
    }

    function drawImagePart(name, mirrored) {
      const img = partImage(name);
      if (!img) return;
      const pl = placement(name, mirrored);
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.rotate(pl.angle);
      const doBreath = (state === 'downLoop' && name === 'body' && !mirrored);
      const region = doBreath ? bodyBreathRegion(img) : null;
      if (doBreath && region) {
        drawBreathingBody(img, pl, breathScaleY(), region);
      } else {
        const sy = doBreath ? pl.scale * breathScaleY() : pl.scale;
        ctx.scale(pl.scale, sy);
        if (mirrored) ctx.scale(-1, 1);
        applyTint(pl.tint);
        ctx.drawImage(img, -pl.pivot.x, -pl.pivot.y);
      }
      ctx.restore();
    }

    // ---- 仮の図形のパーツ ----
    const hx = bw * 0.05, hy = -bh * 0.78 - headR * 0.9;
    const shapes = {
      wings(mirrored) {
        const j = joints.wings;
        const wc = wingsCfg();
        let x = mirrored ? -j.x : j.x;
        let y = j.y;
        if (mirrored && wc.mirrorOffset) {
          x += wc.mirrorOffset.x || 0;
          y += wc.mirrorOffset.y || 0;
        }
        const ang = -0.4 + flap;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(mirrored ? -ang : ang);
        if (mirrored) {
          ctx.scale(-1, 1);
          if (wc.mirrorScale != null && wc.mirrorScale !== 1) ctx.scale(wc.mirrorScale, wc.mirrorScale);
          applyTint(wc.mirrorTint);
        }
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
    function drawOne(name, mirrored) {
      if (partImage(name)) drawImagePart(name, mirrored);
      else if (state === 'downLoop') return; // 倒れ続けは欠けたパーツを仮の図形で補わない（立っている絵になるため）
      else shapes[name](mirrored);
    }
    const doMirror = wingsMirrorOn();
    const wingLayer = wingsCfg().mirrorLayer || 'same';
    // mirrorLayer: 'back' なら反転翼を全パーツより奥に描く（翼を体の前に出したときなど）
    if (doMirror && wingLayer === 'back') drawOne('wings', true);
    order.forEach((name) => {
      if (name === 'arm' && state === 'down') return; // 倒れるときは腕を描かない（仮の図形と同じ）
      if (name === 'wings') {
        if (doMirror && wingLayer !== 'back') drawOne('wings', true); // 反対側を先（奥）に
        drawOne('wings', false);
        return;
      }
      drawOne(name, false);
    });

    // ---- デバッグ：ピボット（回転の軸）と画像の範囲、翼の鏡軸 ----
    if (opts.debug) {
      const colors = { wings: '#4cf', body: '#fc4', head: '#f6c', arm: '#f84' };
      function drawPivotMark(name, pl, isImg, label, color, flipBounds) {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.translate(pl.x, pl.y);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;
        if (isImg) {
          ctx.save();
          ctx.rotate(pl.angle);
          if (flipBounds) ctx.scale(-1, 1);
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
        ctx.fillText(label, 5, -5);
        ctx.restore();
      }
      order.forEach((name) => {
        const isImg = !!partImage(name);
        if (!isImg && state === 'downLoop' && !pconf[name]) return; // 設定も画像も無いパーツは出さない
        const pl = (isImg || pconf[name])
          ? placement(name, false)
          : { x: joints[name].x, y: joints[name].y, angle: 0, scale: 1, pivot: { x: 0, y: 0 } };
        const extra = (state === 'downLoop' && name === 'body') ? '(呼吸)' : '';
        const missing = (!isImg && state === 'downLoop') ? '(無)' : (isImg ? '' : '(仮)');
        drawPivotMark(name, pl, isImg, PART_LABELS[name] + extra + missing, colors[name], false);
      });
      if (doMirror) {
        const isImg = !!parts.wings;
        const wc = wingsCfg();
        let pl;
        if (isImg) {
          pl = placement('wings', true);
        } else {
          let mx = -joints.wings.x, my = joints.wings.y;
          if (wc.mirrorOffset) { mx += wc.mirrorOffset.x || 0; my += wc.mirrorOffset.y || 0; }
          pl = { x: mx, y: my, angle: -(-0.4 + flap), scale: 1, pivot: { x: 0, y: 0 } };
        }
        drawPivotMark('wings', pl, isImg, '翼(鏡)' + (isImg ? '' : '(仮)'), '#8af', true);
        // 体の中心線（折り返しの軸）
        const an = pconf.canvasAnchor;
        const axis = wc.mirrorAxisX != null ? wc.mirrorAxisX : (an ? an.x : 0);
        const sc = wc.scale != null ? wc.scale : 0.5;
        const axisX = an ? (axis - an.x) * sc : 0;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#9ef';
        ctx.fillStyle = '#9ef';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(axisX, -h * 1.05);
        ctx.lineTo(axisX, 8);
        ctx.stroke();
        ctx.setLineDash([]);
        if (opts.flipped) {
          ctx.translate(axisX, 0);
          ctx.scale(-1, 1);
          ctx.translate(-axisX, 0);
        }
        ctx.font = '10px sans-serif';
        ctx.fillText('鏡軸', axisX + 4, -h * 0.12);
        ctx.restore();
      }
    }

    ctx.restore();

    // 斬撃エフェクト（判定のタイミングから。slashFollowsHit が false なら slashFrom から）
    const G = window.GAME_CONFIG || {};
    const slashLen = Math.max(0.05, 1 - M.slashFrom);
    const slashStart = (G.slashFollowsHit !== false && hitAt < 1) ? Math.max(0, hitAt - 0.04) : M.slashFrom;
    const slashEnd = Math.min(1, slashStart + slashLen);
    const sc = opts.slashColor || (isAngel ? '255,240,150' : '200,60,255');
    if (state === 'attack' && wMotion === 'swing' && progress > slashStart && progress <= slashEnd) {
      const a = (progress - slashStart) / (slashEnd - slashStart);
      ctx.save();
      ctx.strokeStyle = 'rgba(' + sc + ',' + (1 - a * 0.5) + ')';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w * 0.3, -h * 0.5, w * 0.45, -1.1, 1.1);
      ctx.stroke();
      ctx.restore();
    }
    // 槍：突きの軌跡（正面へまっすぐの細い光）
    if (state === 'attack' && wMotion === 'thrust' && progress > slashStart && progress <= slashEnd) {
      const a = (progress - slashStart) / (slashEnd - slashStart);
      const y = -h * 0.56 + (-M.floatHeight);
      const x0 = w * 0.18 + (opts.thrustPx || 0) * drive, x1 = x0 + w * 0.72;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, 'rgba(' + sc + ',0)');
      g.addColorStop(0.7, 'rgba(' + sc + ',' + (0.9 * (1 - a)) + ')');
      g.addColorStop(1, 'rgba(255,255,255,' + (1 - a) + ')');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, y - 5); ctx.lineTo(x1, y); ctx.lineTo(x0, y + 5); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // 魔法：詠唱中、掲げた手の先に光がたまる
    if (state === 'attack' && wMotion === 'cast' && progress < hitAt + 0.05) {
      const k = Math.min(1, progress / Math.max(0.01, hitAt));
      const hx = w * 0.22, hy = -h * 0.92 + (-M.floatHeight);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 6 + 16 * k;
      const g = ctx.createRadialGradient(hx, hy, 1, hx, hy, r * 1.8);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.5 + 0.5 * k) + ')');
      g.addColorStop(0.35, 'rgba(' + sc + ',' + (0.7 * k + 0.2) + ')');
      g.addColorStop(1, 'rgba(' + sc + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx, hy, r * 1.8, 0, Math.PI * 2); ctx.fill();
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
    if (state !== 'down' && state !== 'downLoop' && !parts.head) {
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

  // 倒れ続けの1枚絵（down/loop.png）。画像全体に体と同じ呼吸（下端中央を軸にした scaleY）をかける。
  function drawDownLoopSingle(ctx, img, cfg, time, w, h, opts) {
    opts = opts || {};
    cfg = cfg || {};
    const M = motionCfg();
    const amp = (cfg.breathAmp != null) ? cfg.breathAmp : (M.downBreathAmp || 0.02);
    const period = (cfg.breathPeriod != null) ? cfg.breathPeriod : (M.downBreathPeriod || 2000);
    const t = (opts.stateTime != null) ? opts.stateTime : time;
    const breath = 1 + Math.sin((t / Math.max(1, period)) * Math.PI * 2) * amp;
    const scale = cfg.scale != null ? cfg.scale : 0.5;
    const an = cfg.canvasAnchor || { x: img.naturalWidth / 2, y: img.naturalHeight };
    const ox = cfg.offsetX || 0, oy = cfg.offsetY || 0;

    ctx.save();
    drawGroundShadow(ctx, opts.charId, { state: 'downLoop', progress: 1, width: w });
    ctx.translate(ox, oy + (opts.sinkY || 0)); // 影は sinkY の影響を受けない。絵だけ下げる
    ctx.scale(scale, scale * breath);
    ctx.drawImage(img, -an.x, -an.y);
    ctx.restore();

    if (opts.debug) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.translate(ox, oy + (opts.sinkY || 0));
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale * breath;
      ctx.strokeStyle = '#fc4';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(-an.x * scale, -an.y * scale * breath, dw, dh);
      ctx.setLineDash([]);
      ctx.strokeStyle = '#fc4';
      ctx.fillStyle = '#fc4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.moveTo(0, -6); ctx.lineTo(0, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.stroke();
      if (opts.flipped) ctx.scale(-1, 1);
      ctx.font = '10px sans-serif';
      ctx.fillText('倒れ続け(1枚・呼吸)', 5, -5);
      ctx.restore();
    }
  }

  window.SpriteBank = SpriteBank;
  window.drawCharacter = drawCharacter;
  window.drawPlaceholder = drawPlaceholder;
  window.drawDownLoopSingle = drawDownLoopSingle;
  window.groundShadowShape = groundShadowShape;
  window.drawGroundShadow = drawGroundShadow;
})();
