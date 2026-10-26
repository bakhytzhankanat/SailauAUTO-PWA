// Minimal browser emulation of the Scriptable widget API, good enough to preview layouts on a PC.
// Fonts and SF Symbols are approximated (Nunito / Material Symbols); iOS rendering will differ slightly.
(function () {
  const SCALE = 3;
  class Color {
    constructor(hex, alpha = 1) { this.hex = hex.replace('#', ''); this.alpha = alpha; }
    css() {
      const h = this.hex.length === 3 ? this.hex.split('').map((c) => c + c).join('') : this.hex.slice(0, 6);
      const n = parseInt(h, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${this.alpha})`;
    }
    static white() { return new Color('#FFFFFF'); }
  }
  class Size { constructor(w, h) { this.width = w; this.height = h; } }
  class Point { constructor(x, y) { this.x = x; this.y = y; } }
  class Rect { constructor(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; } }
  class LinearGradient { constructor() { this.colors = []; this.locations = []; this.startPoint = new Point(0, 0); this.endPoint = new Point(0, 1); } }
  const mkFont = (weight, rounded, mono) => (size) => ({ size, weight, rounded, mono });
  const Font = {
    heavyRoundedSystemFont: mkFont(900, true), boldRoundedSystemFont: mkFont(800, true), semiboldRoundedSystemFont: mkFont(700, true),
    mediumRoundedSystemFont: mkFont(600, true), regularRoundedSystemFont: mkFont(500, true), boldMonospacedSystemFont: mkFont(700, false, true),
    semiboldSystemFont: mkFont(600), boldSystemFont: mkFont(700), systemFont: mkFont(400),
  };
  const fontCss = (f) => f ? `${f.weight} ${f.size}px ${f.mono ? "'JetBrains Mono',monospace" : "'Nunito',sans-serif"}` : "500 12px 'Nunito',sans-serif";

  // ---- SF Symbols -> Material Symbols
  const SYM = { calendar: 'calendar_month', 'square.grid.2x2': 'grid_view', banknote: 'payments', 'chart.bar.fill': 'bar_chart', 'shippingbox.fill': 'inventory_2', checklist: 'checklist', 'car.fill': 'directions_car', timer: 'timer', 'arrow.up.right': 'north_east', 'arrow.down.right': 'south_east', 'checkmark.seal.fill': 'verified', 'lock.fill': 'lock', 'wifi.exclamationmark': 'wifi_off', 'person.crop.circle.badge.exclamationmark': 'person_alert' };
  class SFSymbol {
    static named(n) { const s = new SFSymbol(); s.name = SYM[n] || 'help'; s.image = { sym: s }; return s; }
    applyFont(f) { this.font = f; }
  }

  // ---- widget tree
  class Node { constructor(type) { this.type = type; } }
  class Container extends Node {
    constructor(type) { super(type); this.children = []; this.dir = 'row'; this.align = 'flex-start'; this.padding = null; }
    addStack() { const s = new WidgetStack(); this.children.push(s); return s; }
    addText(t) { const n = new WidgetText(t); this.children.push(n); return n; }
    addDate(d) { const n = new WidgetDate(d); this.children.push(n); return n; }
    addImage(img) { const n = new WidgetImage(img); this.children.push(n); return n; }
    addSpacer(len) { this.children.push({ type: 'spacer', len }); }
    setPadding(t, l, b, r) { this.padding = [t, r, b, l]; }
    layoutHorizontally() { this.dir = 'row'; }
    layoutVertically() { this.dir = 'column'; }
    topAlignContent() { this.align = 'flex-start'; }
    centerAlignContent() { this.align = 'center'; }
    bottomAlignContent() { this.align = 'flex-end'; }
  }
  class WidgetStack extends Container { constructor() { super('stack'); } }
  class ListWidget extends Container {
    constructor() { super('widget'); this.dir = 'column'; this.padding = [16, 16, 16, 16]; }
    presentSmall() { window.__present(this, 'small'); } presentMedium() { window.__present(this, 'medium'); } presentLarge() { window.__present(this, 'large'); }
  }
  class WidgetText extends Node { constructor(t) { super('text'); this.text = t; this.lineLimit = 0; this.align = 'left'; } leftAlignText() { this.align = 'left'; } centerAlignText() { this.align = 'center'; } rightAlignText() { this.align = 'right'; } }
  class WidgetDate extends Node { constructor(d) { super('date'); this.date = d; } applyTimerStyle() { this.timer = true; } applyRelativeStyle() {} }
  class WidgetImage extends Node { constructor(img) { super('image'); this.img = img; } centerAlignImage() { this.center = true; } }

  function render(n, family) {
    if (n.type === 'spacer') {
      const d = document.createElement('div');
      if (n.len == null) d.style.flex = '1 1 0'; else { d.style.flex = `0 0 ${n.len}px`; }
      return d;
    }
    if (n.type === 'text' || n.type === 'date') {
      const d = document.createElement('div');
      let txt = n.text;
      if (n.type === 'date') {
        const s = Math.max(0, Math.floor((Date.now() - n.date.getTime()) / 1000));
        txt = `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }
      d.textContent = txt;
      d.style.font = fontCss(n.font);
      d.style.color = n.textColor ? n.textColor.css() : '#000';
      if (n.textOpacity != null) d.style.opacity = n.textOpacity;
      d.style.textAlign = n.align || 'left';
      d.style.lineHeight = '1.2';
      d.style.minWidth = '0';
      d.style.flexShrink = '1';
      if (n.lineLimit === 1) { d.style.whiteSpace = 'nowrap'; d.style.overflow = 'hidden'; d.style.textOverflow = 'ellipsis'; }
      else if (n.lineLimit > 1) { d.style.display = '-webkit-box'; d.style.webkitLineClamp = n.lineLimit; d.style.webkitBoxOrient = 'vertical'; d.style.overflow = 'hidden'; }
      return d;
    }
    if (n.type === 'image') {
      const sz = n.imageSize;
      if (n.img && n.img.sym) {
        const d = document.createElement('span');
        d.className = 'material-symbols-rounded';
        d.textContent = n.img.sym.name;
        d.style.fontSize = `${sz ? sz.width : 16}px`;
        d.style.width = `${sz ? sz.width : 16}px`;
        d.style.height = `${sz ? sz.height : 16}px`;
        d.style.lineHeight = '1';
        d.style.color = n.tintColor ? n.tintColor.css() : '#fff';
        d.style.flex = '0 0 auto';
        d.style.overflow = 'hidden';
        return d;
      }
      const img = document.createElement('img');
      img.src = n.img.dataUrl;
      img.style.width = `${(sz || n.img.size).width}px`;
      img.style.height = `${(sz || n.img.size).height}px`;
      img.style.flex = '0 0 auto';
      if (n.center) img.style.alignSelf = 'center';
      return img;
    }
    const d = document.createElement('div');
    d.style.display = 'flex';
    d.style.flexDirection = n.dir;
    d.style.alignItems = n.type === 'widget' ? 'stretch' : n.align;
    d.style.minWidth = '0';
    d.style.boxSizing = 'border-box';
    if (n.padding) d.style.padding = n.padding.map((p) => `${p}px`).join(' ');
    if (n.backgroundColor) d.style.background = n.backgroundColor.css();
    if (n.cornerRadius) d.style.borderRadius = `${n.cornerRadius}px`;
    if (n.borderWidth) d.style.border = `${n.borderWidth}px solid ${n.borderColor ? n.borderColor.css() : '#000'}`;
    if (n.size) {
      if (n.size.width > 0) { d.style.width = `${n.size.width}px`; d.style.flex = '0 0 auto'; }
      if (n.size.height > 0) d.style.height = `${n.size.height}px`;
    }
    if (n.type === 'widget') {
      const dims = { small: [170, 170], medium: [364, 170], large: [364, 382], accessoryCircular: [76, 76], accessoryRectangular: [172, 76], accessoryInline: [240, 24] }[family];
      d.style.width = `${dims[0]}px`;
      d.style.height = `${dims[1]}px`;
      d.style.borderRadius = family.startsWith('accessory') ? (family === 'accessoryCircular' ? '50%' : '12px') : '22px';
      d.style.overflow = 'hidden';
      d.style.flex = '0 0 auto';
      if (n.backgroundGradient) {
        const g = n.backgroundGradient;
        d.style.background = `linear-gradient(135deg, ${g.colors.map((c, i) => `${c.css()} ${g.locations[i] * 100}%`).join(',')})`;
      } else if (family.startsWith('accessory')) {
        d.style.background = n.addAccessoryWidgetBackground ? 'rgba(255,255,255,0.18)' : 'transparent';
      }
    }
    // Horizontal stacks: children keep their natural width unless they are flexible spacers.
    if (n.spacing) d.style.gap = `${n.spacing}px`;
    // Like iOS: a stack that holds a flexible spacer grows to fill its parent along that axis.
    const flexIn = (c, dir) => c.children && c.dir === dir && c.children.some((x) => x.type === 'spacer' && x.len == null);
    for (const c of n.children) {
      const el = render(c, family);
      const fixedW = c.size && c.size.width > 0;
      if (c.type === 'stack' && n.dir === 'column' && !fixedW) el.style.alignSelf = (n.type === 'widget' || flexIn(c, 'row')) ? 'stretch' : 'flex-start';
      if (c.type === 'stack' && n.dir === 'row' && !fixedW) el.style.flex = flexIn(c, 'row') ? '1 1 0' : '0 1 auto';
      d.appendChild(el);
    }
    return d;
  }

  // ---- DrawContext on a canvas
  class Path {
    constructor() { this.ops = []; }
    addLines(pts) { this.ops.push({ t: 'lines', pts }); }
    addRoundedRect(r, cw, ch) { this.ops.push({ t: 'rrect', r, cw, ch }); }
    addRect(r) { this.ops.push({ t: 'rrect', r, cw: 0, ch: 0 }); }
  }
  class DrawContext {
    constructor() { this.size = new Size(100, 100); this.paths = []; this._init = false; }
    _c() {
      if (!this._init) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size.width * SCALE; this.canvas.height = this.size.height * SCALE;
        this.g = this.canvas.getContext('2d'); this.g.scale(SCALE, SCALE);
        this.align = 'left'; this._init = true;
      }
      return this.g;
    }
    addPath(p) { this.paths.push(p); }
    _trace() {
      const g = this._c(); g.beginPath();
      for (const p of this.paths) for (const op of p.ops) {
        if (op.t === 'lines') { op.pts.forEach((pt, i) => (i ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y))); }
        else { g.roundRect(op.r.x, op.r.y, op.r.width, op.r.height, Math.min(op.cw, op.r.width / 2, op.r.height / 2)); }
      }
      this.paths = [];
    }
    setFillColor(c) { this._c().fillStyle = c.css(); }
    setStrokeColor(c) { this._c().strokeStyle = c.css(); }
    setLineWidth(w) { this._c().lineWidth = w; }
    fillPath() { this._trace(); this.g.fill(); }
    strokePath() { this._trace(); this.g.lineJoin = 'round'; this.g.stroke(); }
    fillRect(r) { this._c().fillRect(r.x, r.y, r.width, r.height); }
    fillEllipse(r) { const g = this._c(); g.beginPath(); g.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2); g.fill(); }
    setTextAlignedCenter() { this._c(); this.align = 'center'; }
    setTextAlignedLeft() { this._c(); this.align = 'left'; }
    setTextColor(c) { this._c(); this.textColor = c.css(); }
    setFont(f) { this._c(); this.font = fontCss(f); this.fontSize = f.size; }
    drawTextInRect(t, r) {
      const g = this._c(); g.fillStyle = this.textColor || '#fff'; g.font = this.font; g.textBaseline = 'top'; g.textAlign = this.align;
      g.fillText(t, this.align === 'center' ? r.x + r.width / 2 : r.x, r.y + Math.max(0, (r.height - this.fontSize) / 2) * 0.4);
    }
    getImage() { this._c(); return { dataUrl: this.canvas.toDataURL(), size: this.size }; }
  }

  const store = {};
  window.Keychain = { contains: (k) => k in store, get: (k) => store[k], set: (k, v) => { store[k] = v; }, remove: (k) => { delete store[k]; } };
  window.FileManager = { local: () => ({ cacheDirectory: () => '/c', joinPath: (a, b) => `${a}/${b}`, writeString() {}, readString: () => '', fileExists: () => false }) };
  window.Script = { setWidget: (w) => window.__present(w, window.config.widgetFamily), complete() {}, name: () => 'Sailau Widget' };
  window.Request = class { async loadJSON() { throw new Error('offline preview'); } };
  window.Alert = class {};
  window.Device = { screenSize: () => ({ width: 430, height: 932 }) };
  Object.assign(window, { Color, Size, Point, Rect, LinearGradient, Font, SFSymbol, ListWidget, DrawContext, Path });
  window.__present = (w, family) => { window.__out = render(w, family); };
})();
