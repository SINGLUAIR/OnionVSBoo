/*
 * UI の画像の差し込み（タイトルロゴ・キャラ選択ボタンの顔）
 * 設定は assets/ui-config.js（window.UI_CONFIG）。画像が無い／読み込めないときは今までどおりの表示のままです。
 */
(function () {
  'use strict';
  const UI = window.UI_CONFIG || {};
  const ASSETS = window.ASSET_CONFIG || { characters: {} };

  // ---- タイトルロゴ ----
  (function setupLogo() {
    const logo = UI.titleLogo || {};
    const wrap = document.getElementById('title-logo');
    const img = document.getElementById('title-logo-img');
    if (!wrap || !img || !logo.src) return;
    if (logo.maxWidth) img.style.maxWidth = logo.maxWidth + 'px';
    if (logo.maxHeight) img.style.maxHeight = logo.maxHeight + 'px';
    img.onload = () => { img.hidden = false; wrap.classList.add('has-image'); };
    img.onerror = () => { img.hidden = true; wrap.classList.remove('has-image'); };
    img.src = logo.src;
  })();

  // ---- キャラ選択ボタンの顔 ----
  // 透明でない範囲（バウンディングボックス）を調べる。file:// などで読めないときは null。
  function alphaBox(img) {
    try {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
      for (let y = 0; y < cv.height; y++) {
        for (let x = 0; x < cv.width; x++) {
          if (d[(y * cv.width + x) * 4 + 3] > 16) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return null;
      return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch (e) {
      return null;
    }
  }

  function cropFor(img, crop) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (crop && typeof crop === 'object' && crop.size > 0) {
      return { cx: crop.x != null ? crop.x : iw / 2, cy: crop.y != null ? crop.y : ih / 2, size: crop.size };
    }
    // 'auto'（または未設定）：透明でない範囲に少し余白を足した正方形
    const b = alphaBox(img) || { x: 0, y: 0, w: iw, h: ih };
    return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, size: Math.max(b.w, b.h) * 1.04 };
  }

  function setupFace(btn) {
    const id = btn.dataset.char;
    const def = ASSETS.characters[id];
    const icon = btn.querySelector('.char-icon');
    if (!def || !icon) return;
    const crops = UI.faceCrop || {};
    const crop = crops[id];
    const headSrc = (crop && crop.src) || (def.parts && def.parts.head && def.parts.head.src);
    if (!headSrc) return;
    const img = new Image();
    img.onload = () => {
      const c = cropFor(img, crop);
      const px = 192; // 内部解像度（表示は約 84px）
      const cv = document.createElement('canvas');
      cv.width = cv.height = px;
      const g = cv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, c.cx - c.size / 2, c.cy - c.size / 2, c.size, c.size, 0, 0, px, px);
      icon.textContent = '';
      icon.appendChild(cv);
      icon.classList.add('has-face');
    };
    img.onerror = () => { /* 画像が無ければ光の玉のまま */ };
    img.src = headSrc;
  }
  document.querySelectorAll('.char-btn').forEach(setupFace);
})();
