/**
 * ClearFrame AI - Main Application
 */

// ─── Particles ───────────────────────────────────────────────
function initParticles() {
  const container = document.querySelector('.particles');
  if (!container) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      animation-duration: ${10 + Math.random() * 20}s;
      animation-delay: ${-Math.random() * 20}s;
      opacity: ${0.2 + Math.random() * 0.4};
      width: ${1 + Math.random() * 2}px;
      height: ${1 + Math.random() * 2}px;
    `;
    container.appendChild(p);
  }
}

// ─── Scroll Reveal ────────────────────────────────────────────
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => obs.observe(el));
}

// ─── Mobile Nav ───────────────────────────────────────────────
function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-mobile-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    menu.classList.toggle('open');
    const icon = toggle.querySelector('i');
    icon.className = menu.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
  });

  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.querySelector('i').className = 'fas fa-bars';
    });
  });
}

// ─── FAQ ──────────────────────────────────────────────────────
function initFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
}

// ─── Alert Toast ─────────────────────────────────────────────
let alertTimer;
function showAlert(msg, type = 'info') {
  const toast = document.getElementById('alert-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `alert-toast show ${type}`;
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ─── Upload Zone (hero) ───────────────────────────────────────
function initUploadZone() {
  const zone = document.getElementById('hero-upload-zone');
  const input = document.getElementById('hero-file-input');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => {
    if (e.target.files[0]) openEditorWithFile(e.target.files[0]);
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-active'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-active'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-active');
    if (e.dataTransfer.files[0]) openEditorWithFile(e.dataTransfer.files[0]);
  });
}

// ─── Editor ──────────────────────────────────────────────────
const editor = {
  hasImage: false,
  processing: false,
  watermarkEngine: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  isPanning: false,
  lastMouse: { x: 0, y: 0 },
  history: [],
  historyStep: -1,
  tempOriginal: null,
  ctx: null,
  maskCtx: null,
  filename: 'image',

  init() {
    this.ctx = document.getElementById('main-canvas').getContext('2d', { willReadFrequently: true });
    this.maskCtx = document.getElementById('mask-canvas').getContext('2d');

    if (window.WatermarkEngine) {
      this.watermarkEngine = new window.WatermarkEngine();
      this.watermarkEngine.init();
    }

    this.bindEvents();
  },

  bindEvents() {
    // File input
    const fileInput = document.getElementById('editor-file-input');
    fileInput?.addEventListener('change', e => {
      if (e.target.files[0]) this.loadFile(e.target.files[0]);
    });

    // Upload prompt click
    document.getElementById('editor-upload-prompt')?.addEventListener('click', () => {
      fileInput?.click();
    });

    // Editor file drag/drop
    const canvas_area = document.getElementById('editor-canvas-area');
    canvas_area?.addEventListener('dragover', e => e.preventDefault());
    canvas_area?.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) this.loadFile(e.dataTransfer.files[0]);
    });

    // Paste
    document.addEventListener('paste', e => {
      if (!document.getElementById('editor-section').classList.contains('visible')) return;
      const item = Array.from(e.clipboardData.items).find(x => x.type.startsWith('image/'));
      if (item) this.loadFile(item.getAsFile());
    });

    // Buttons
    document.getElementById('btn-remove')?.addEventListener('click', () => this.process());
    document.getElementById('btn-undo')?.addEventListener('click', () => this.undo());
    document.getElementById('btn-export')?.addEventListener('click', () => this.download());
    document.getElementById('btn-open-file')?.addEventListener('click', () => fileInput?.click());
    document.getElementById('btn-url')?.addEventListener('click', () => this.openUrlModal());
    document.getElementById('btn-back')?.addEventListener('click', () => closeEditor());

    // Compare
    const compareBtn = document.getElementById('btn-compare');
    compareBtn?.addEventListener('mousedown', () => this.startCompare());
    compareBtn?.addEventListener('mouseup', () => this.endCompare());
    compareBtn?.addEventListener('mouseleave', () => this.endCompare());
    compareBtn?.addEventListener('touchstart', e => { e.preventDefault(); this.startCompare(); });
    compareBtn?.addEventListener('touchend', () => this.endCompare());

    // Zoom
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => { this.zoom = Math.min(10, this.zoom + 0.15); this.applyTransform(); });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => { this.zoom = Math.max(0.05, this.zoom - 0.15); this.applyTransform(); });

    // Canvas area pan
    canvas_area?.addEventListener('wheel', e => this.handleWheel(e), { passive: false });
    canvas_area?.addEventListener('mousedown', e => this.startPan(e));
    canvas_area?.addEventListener('touchstart', e => this.startPan(e), { passive: false });
    window.addEventListener('mousemove', e => this.handleMove(e));
    window.addEventListener('touchmove', e => this.handleMove(e), { passive: false });
    window.addEventListener('mouseup', () => this.endPan());
    window.addEventListener('touchend', () => this.endPan());

    // Keyboard
    document.addEventListener('keydown', e => {
      if (!document.getElementById('editor-section').classList.contains('visible')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
      if (e.key === 'Escape') closeEditor();
    });

    // URL modal
    document.getElementById('url-confirm')?.addEventListener('click', () => this.confirmUrl());
    document.getElementById('url-cancel')?.addEventListener('click', () => this.closeUrlModal());
    document.getElementById('url-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') this.confirmUrl(); });
    document.querySelector('.modal-overlay')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) this.closeUrlModal();
    });
  },

  loadFile(file) {
    this.filename = file.name.replace(/\.[^.]+$/, '') || 'clearframe-result';
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => this.setup(img);
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  },

  setup(img) {
    const mc = document.getElementById('main-canvas');
    const mk = document.getElementById('mask-canvas');
    mc.width = img.width; mc.height = img.height;
    mk.width = img.width; mk.height = img.height;

    this.ctx.drawImage(img, 0, 0);
    this.maskCtx.clearRect(0, 0, img.width, img.height);
    this.hasImage = true;

    this.history = []; this.historyStep = -1;
    this.saveState();

    this.pan = { x: 0, y: 0 };
    const container = document.getElementById('editor-canvas-area');
    const pad = 60;
    const sx = (container.clientWidth - pad) / img.width;
    const sy = (container.clientHeight - pad) / img.height;
    this.zoom = Math.min(1, Math.min(sx, sy));
    if (this.zoom < 0.05) this.zoom = 0.05;

    document.getElementById('canvas-stage').classList.add('visible');
    document.getElementById('editor-empty').classList.add('hidden');
    document.getElementById('editor-dims').textContent = `${img.width} × ${img.height}`;
    document.getElementById('editor-filename').textContent = this.filename;
    this.updateUndoState();
    this.applyTransform();
  },

  applyTransform() {
    const stage = document.getElementById('canvas-stage');
    stage.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
    document.getElementById('zoom-display').textContent = Math.round(this.zoom * 100) + '%';
  },

  startPan(e) {
    if (!this.hasImage) return;
    e.preventDefault();
    this.isPanning = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    this.lastMouse = { x: clientX, y: clientY };
  },

  handleMove(e) {
    if (!this.isPanning) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    this.pan.x += clientX - this.lastMouse.x;
    this.pan.y += clientY - this.lastMouse.y;
    this.lastMouse = { x: clientX, y: clientY };
    this.applyTransform();
  },

  endPan() { this.isPanning = false; },

  handleWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.005;
      this.zoom = Math.min(10, Math.max(0.05, this.zoom + delta));
    } else {
      this.pan.x -= e.deltaX;
      this.pan.y -= e.deltaY;
    }
    this.applyTransform();
  },

  async process() {
    if (!this.hasImage || this.processing) return;
    this.processing = true;
    const btn = document.getElementById('btn-remove');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 50));

    const mc = document.getElementById('main-canvas');
    const mk = document.getElementById('mask-canvas');
    const w = mc.width, h = mc.height;

    const srcData = this.ctx.getImageData(0, 0, w, h);
    const maskData = this.maskCtx.getImageData(0, 0, w, h);

    let minX = w, minY = h, maxX = 0, maxY = 0, hasMask = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (maskData.data[i + 3] > 0) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          hasMask = true;
        }
      }
    }

    if (!hasMask) {
      if (this.watermarkEngine) {
        await this.watermarkEngine.removeWatermarkFromCanvas(mc);
        this.saveState();
      }
    } else {
      const pad = 10;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
      this.inpaint(srcData, maskData, minX, minY, maxX - minX, maxY - minY, w);
      this.ctx.putImageData(srcData, 0, 0);
      this.maskCtx.clearRect(0, 0, w, h);
      this.saveState();
    }

    this.processing = false;
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> Remove';
    this.updateUndoState();
  },

  inpaint(img, mask, sx, sy, sw, sh, fullW) {
    const data = img.data, mData = mask.data;
    const buf = new Float32Array(sw * sh * 3);

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const gx = sx + x, gy = sy + y;
        const idx = (gy * fullW + gx) * 4;
        const bIdx = (y * sw + x) * 3;
        if (mData[idx + 3] === 0) {
          buf[bIdx] = data[idx]; buf[bIdx + 1] = data[idx + 1]; buf[bIdx + 2] = data[idx + 2];
        } else { buf[bIdx] = -1; }
      }
    }

    let r = 0, g = 0, b = 0, c = 0;
    for (let i = 0; i < buf.length; i += 3) { if (buf[i] !== -1) { r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; c++; } }
    const ar = c ? r / c : 0, ag = c ? g / c : 0, ab = c ? b / c : 0;
    for (let i = 0; i < buf.length; i += 3) { if (buf[i] === -1) { buf[i] = ar; buf[i + 1] = ag; buf[i + 2] = ab; } }

    for (let pass = 0; pass < 40; pass++) {
      const sy2 = pass % 2 === 0 ? 1 : sh - 2, ey = pass % 2 === 0 ? sh - 1 : 0, step = pass % 2 === 0 ? 1 : -1;
      for (let y = sy2; y !== ey; y += step) {
        for (let x = 1; x < sw - 1; x++) {
          const gx = sx + x, gy = sy + y;
          const idx = (gy * fullW + gx) * 4;
          if (mData[idx + 3] > 0) {
            const bIdx = (y * sw + x) * 3;
            let sr = 0, sg = 0, sb = 0;
            const ns = [((y - 1) * sw + x) * 3, ((y + 1) * sw + x) * 3, (y * sw + (x - 1)) * 3, (y * sw + (x + 1)) * 3];
            ns.forEach(n => { sr += buf[n]; sg += buf[n + 1]; sb += buf[n + 2]; });
            buf[bIdx] = sr / 4; buf[bIdx + 1] = sg / 4; buf[bIdx + 2] = sb / 4;
          }
        }
      }
    }

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const gx = sx + x, gy = sy + y;
        const idx = (gy * fullW + gx) * 4;
        if (mData[idx + 3] > 0) {
          const bIdx = (y * sw + x) * 3;
          const n = (Math.random() - 0.5) * 10;
          data[idx] = Math.min(255, Math.max(0, buf[bIdx] + n));
          data[idx + 1] = Math.min(255, Math.max(0, buf[bIdx + 1] + n));
          data[idx + 2] = Math.min(255, Math.max(0, buf[bIdx + 2] + n));
        }
      }
    }
  },

  saveState() {
    if (this.historyStep < this.history.length - 1) this.history = this.history.slice(0, this.historyStep + 1);
    const mc = document.getElementById('main-canvas');
    const data = this.ctx.getImageData(0, 0, mc.width, mc.height);
    this.history.push(data);
    this.historyStep++;
    if (this.history.length > 20) { this.history.shift(); this.historyStep--; }
    this.updateUndoState();
  },

  undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      this.ctx.putImageData(this.history[this.historyStep], 0, 0);
      this.updateUndoState();
    }
  },

  updateUndoState() {
    const btn = document.getElementById('btn-undo');
    if (btn) btn.disabled = this.historyStep <= 0;
  },

  startCompare() {
    if (this.historyStep < 0) return;
    const mc = document.getElementById('main-canvas');
    this.tempOriginal = this.ctx.getImageData(0, 0, mc.width, mc.height);
    this.ctx.putImageData(this.history[0], 0, 0);
  },

  endCompare() {
    if (this.tempOriginal) {
      this.ctx.putImageData(this.tempOriginal, 0, 0);
      this.tempOriginal = null;
    }
  },

  download() {
    if (!this.hasImage) return;
    const link = document.createElement('a');
    link.download = this.filename + '-clearframe.png';
    link.href = document.getElementById('main-canvas').toDataURL();
    link.click();
  },

  openUrlModal() {
    document.getElementById('url-modal').classList.add('open');
    document.getElementById('url-input').value = '';
    setTimeout(() => document.getElementById('url-input').focus(), 100);
  },

  closeUrlModal() {
    document.getElementById('url-modal').classList.remove('open');
  },

  confirmUrl() {
    const url = document.getElementById('url-input').value.trim();
    if (!url) return;
    this.closeUrlModal();
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => this.setup(img);
    img.onerror = () => showAlert('Failed to load image. CORS may be blocking the request.', 'error');
    img.src = url;
  }
};

// ─── Editor open/close ────────────────────────────────────────
function openEditor() {
  document.getElementById('editor-section').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function openEditorWithFile(file) {
  openEditor();
  editor.loadFile(file);
}

function closeEditor() {
  document.getElementById('editor-section').classList.remove('visible');
  document.body.style.overflow = '';
}

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initReveal();
  initNav();
  initFAQ();
  initUploadZone();
  editor.init();

  // Open editor btn
  document.getElementById('btn-open-editor')?.addEventListener('click', () => {
    openEditor();
    document.getElementById('editor-file-input')?.click();
  });

  // Global paste (landing)
  document.addEventListener('paste', e => {
    if (document.getElementById('editor-section').classList.contains('visible')) return;
    const item = Array.from(e.clipboardData.items).find(x => x.type.startsWith('image/'));
    if (item) openEditorWithFile(item.getAsFile());
  });

  // Global drag/drop (landing)
  document.body.addEventListener('dragover', e => e.preventDefault());
  document.body.addEventListener('drop', e => {
    e.preventDefault();
    if (document.getElementById('editor-section').classList.contains('visible')) return;
    if (e.dataTransfer.files[0]) openEditorWithFile(e.dataTransfer.files[0]);
  });
});