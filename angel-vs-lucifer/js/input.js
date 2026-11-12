/*
 * 入力管理
 *  PC   : W A S D で移動、Enter で攻撃、H で当たり判定表示の切り替え
 *  スマホ: フリック／スワイプで移動（押しっぱなしなら移動し続ける）、タップで攻撃
 */
(function () {
  'use strict';

  const keys = {};
  let attackQueued = false;
  const listeners = { key: [] };

  // タッチ状態
  const touches = {};            // identifier -> { sx, sy, x, y, t, dragging }
  let touchMove = { x: 0, y: 0 }; // 押しっぱなしの移動方向
  let flickMove = { x: 0, y: 0, until: 0 }; // フリック後の惰性移動

  function cfgTouch() { return window.GAME_CONFIG.touch; }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'enter', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) {
      e.preventDefault();
    }
    if (!keys[k] && k === 'enter') attackQueued = true;
    keys[k] = true;
    if (!e.repeat) listeners.key.forEach((fn) => fn(k));
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); });

  // ---- タッチ ----
  function isUi(target) {
    return target && target.closest && target.closest('button');
  }

  function dirFromDelta(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return { x: 0, y: 0 };
    // 8方向に丸める（斜め移動もできるように）
    const ang = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const a = Math.round(ang / step) * step;
    let x = Math.cos(a), y = Math.sin(a);
    if (Math.abs(x) < 1e-6) x = 0;
    if (Math.abs(y) < 1e-6) y = 0;
    return { x: x, y: y };
  }

  function recomputeTouchMove() {
    let m = { x: 0, y: 0 };
    Object.keys(touches).forEach((id) => {
      const t = touches[id];
      if (t.dragging) m = dirFromDelta(t.x - t.sx, t.y - t.sy);
    });
    touchMove = m;
  }

  window.addEventListener('touchstart', (e) => {
    if (isUi(e.target)) return;
    e.preventDefault();
    const now = performance.now();
    for (const t of e.changedTouches) {
      touches[t.identifier] = { sx: t.clientX, sy: t.clientY, x: t.clientX, y: t.clientY, t: now, dragging: false };
    }
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const c = cfgTouch();
    for (const t of e.changedTouches) {
      const s = touches[t.identifier];
      if (!s) continue;
      s.x = t.clientX; s.y = t.clientY;
      if (Math.hypot(s.x - s.sx, s.y - s.sy) >= c.dragThreshold) s.dragging = true;
      // 押しっぱなしで方向を変えたい時のため、大きく動いたら始点を追従させる
      const dx = s.x - s.sx, dy = s.y - s.sy;
      const max = c.dragThreshold * 4;
      const len = Math.hypot(dx, dy);
      if (len > max) { s.sx = s.x - dx / len * max; s.sy = s.y - dy / len * max; }
    }
    recomputeTouchMove();
  }, { passive: false });

  function endTouch(e) {
    if (!isUi(e.target)) e.preventDefault();
    const c = cfgTouch();
    const now = performance.now();
    for (const t of e.changedTouches) {
      const s = touches[t.identifier];
      if (!s) continue;
      const dist = Math.hypot(t.clientX - s.sx, t.clientY - s.sy);
      const dur = now - s.t;
      if (!s.dragging && dist <= c.tapMaxMove && dur <= c.tapMaxTime * 2) {
        attackQueued = true;                    // タップ → 攻撃
        listeners.key.forEach((fn) => fn('tap'));
      } else if (dist >= c.dragThreshold) {
        // フリック：離した後も少しの間その方向へ移動
        const d = dirFromDelta(t.clientX - s.sx, t.clientY - s.sy);
        flickMove = { x: d.x, y: d.y, until: now + c.flickMoveMs };
      }
      delete touches[t.identifier];
    }
    recomputeTouchMove();
  }
  window.addEventListener('touchend', endTouch, { passive: false });
  window.addEventListener('touchcancel', endTouch, { passive: false });

  // iOS Safari のピンチズーム・ダブルタップズーム対策
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  });
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  const Input = {
    // 移動方向 {x, y}（-1〜1, 斜めは正規化済み）
    getMove() {
      let x = 0, y = 0;
      if (keys['a'] || keys['arrowleft']) x -= 1;
      if (keys['d'] || keys['arrowright']) x += 1;
      if (keys['w'] || keys['arrowup']) y -= 1;
      if (keys['s'] || keys['arrowdown']) y += 1;
      if (x === 0 && y === 0) {
        if (touchMove.x || touchMove.y) { x = touchMove.x; y = touchMove.y; }
        else if (performance.now() < flickMove.until) { x = flickMove.x; y = flickMove.y; }
      }
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      return { x: x, y: y };
    },
    consumeAttack() {
      const a = attackQueued;
      attackQueued = false;
      return a;
    },
    clear() {
      attackQueued = false;
      flickMove.until = 0;
      Object.keys(touches).forEach((id) => delete touches[id]);
      touchMove = { x: 0, y: 0 };
    },
    onKey(fn) { listeners.key.push(fn); }
  };

  window.Input = Input;
})();
