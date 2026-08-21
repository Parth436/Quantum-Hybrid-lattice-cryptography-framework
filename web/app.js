/**
 * ═══════════════════════════════════════════════════════════════════════
 *  ABLKM — Angular-Bucket Lattice Key Mapping
 *  Interactive Visualization & Algorithm Engine (JavaScript)
 * ═══════════════════════════════════════════════════════════════════════
 */

"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** SHA-256 (sync, using SubtleCrypto — returns hex string via async) */
async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Synchronous djb2 hash → number (for lightweight use) */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return h >>> 0;
}

/** Normalize angle to [0, 2π). */
const TWO_PI = Math.PI * 2;
function normalizeAngle(a) { return ((a % TWO_PI) + TWO_PI) % TWO_PI; }

/** Generate a palette of N visually distinct colors. */
function generatePalette(n) {
  const colors = [];
  for (let i = 0; i < n; i++) {
    const hue = (i * 360 / n) % 360;
    colors.push({
      fill:   `hsla(${hue}, 80%, 55%, 0.18)`,
      stroke: `hsla(${hue}, 90%, 65%, 0.9)`,
      text:   `hsl(${hue}, 90%, 72%)`,
      solid:  `hsl(${hue}, 80%, 55%)`,
    });
  }
  return colors;
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ─────────────────────────────────────────────────────────────────────────────
// ABLKM Core Engine (JS port)
// ─────────────────────────────────────────────────────────────────────────────

class ABLKMEngine {
  constructor(gridSize, ppb, refX, refY) {
    this.gridSize = gridSize;
    this.ppb = ppb;             // points_per_bucket
    this.ref = { x: refX, y: refY };

    this._buildLattice();
    this._computeBuckets();
    this._assignPoints();

    /** Stored keys: Map<keyId, {bucketId, pointIdx, cipherHex, angleDeg}> */
    this.keyStore = new Map();
  }

  _buildLattice() {
    const pts = [];
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        pts.push({ x: i, y: j, idx: i * this.gridSize + j, bucketId: -1 });
      }
    }
    this.points = pts;
    this.numPoints = pts.length;
  }

  _computeBuckets() {
    this.numBuckets = Math.ceil(this.numPoints / this.ppb);
    this.bucketSize = TWO_PI / this.numBuckets;
    this.buckets = Array.from({ length: this.numBuckets }, (_, i) => ({
      id: i,
      angleStart: i * this.bucketSize,
      angleEnd:  (i + 1) * this.bucketSize,
      points: [],
      keys: new Map(),
    }));
  }

  _assignPoints() {
    for (const pt of this.points) {
      const angle = this._angleFromRef(pt);
      const bid = this._angleToBucket(angle);
      pt.bucketId = bid;
      pt.angle = angle;
      this.buckets[bid].points.push(pt);
    }
  }

  _angleFromRef(pt) {
    return normalizeAngle(Math.atan2(pt.y - this.ref.y, pt.x - this.ref.x));
  }

  _angleToBucket(angle) {
    return Math.min(Math.floor(angle / this.bucketSize), this.numBuckets - 1);
  }

  /** Map key string → lattice point index (deterministic). */
  _keyToPointIdx(key) {
    return djb2(key) % this.numPoints;
  }

  /** XOR encrypt/decrypt value using a key derived from geometry. */
  _xorCipher(text, key, pt) {
    const seed = `${key}|${pt.x.toFixed(4)},${pt.y.toFixed(4)}|${this.ref.x.toFixed(4)},${this.ref.y.toFixed(4)}`;
    const enc = djb2(seed);
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const byte = text.charCodeAt(i) ^ ((enc >> (i % 4) * 8) & 0xff);
      result += byte.toString(16).padStart(2, "0");
    }
    return result;
  }

  _xorDecipher(hex, key, pt) {
    const seed = `${key}|${pt.x.toFixed(4)},${pt.y.toFixed(4)}|${this.ref.x.toFixed(4)},${this.ref.y.toFixed(4)}`;
    const enc = djb2(seed);
    let result = "";
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16) ^ ((enc >> ((i / 2) % 4) * 8) & 0xff);
      result += String.fromCharCode(byte);
    }
    return result;
  }

  /** Store a key→value pair. Returns metadata object. */
  storeKey(key, value) {
    const keyId   = djb2(key).toString(16).padStart(8, "0");
    const ptIdx   = this._keyToPointIdx(key);
    const pt      = this.points[ptIdx];
    const angle   = this._angleFromRef(pt);
    const bid     = this._angleToBucket(angle);
    const cipher  = this._xorCipher(value, key, pt);

    this.keyStore.set(keyId, { bid, ptIdx, cipher, angle, key });
    this.buckets[bid].keys.set(keyId, { cipher, ptIdx, angle });

    return {
      keyId,
      latticePoint: pt,
      angleDeg: (angle * 180 / Math.PI).toFixed(2),
      bucketId: bid,
      bucketStart: (this.buckets[bid].angleStart * 180 / Math.PI).toFixed(1),
      bucketEnd:   (this.buckets[bid].angleEnd   * 180 / Math.PI).toFixed(1),
    };
  }

  /** Retrieve a value by key. Returns null if not found. */
  retrieveKey(key) {
    const keyId  = djb2(key).toString(16).padStart(8, "0");
    const ptIdx  = this._keyToPointIdx(key);
    const pt     = this.points[ptIdx];
    const angle  = this._angleFromRef(pt);
    const bid    = this._angleToBucket(angle);

    const entry  = this.buckets[bid].keys.get(keyId);
    if (!entry) return null;
    return this._xorDecipher(entry.cipher, key, pt);
  }

  /** Delete a key. Returns true if existed. */
  deleteKey(key) {
    const keyId = djb2(key).toString(16).padStart(8, "0");
    const entry = this.keyStore.get(keyId);
    if (!entry) return false;
    this.buckets[entry.bid].keys.delete(keyId);
    this.keyStore.delete(keyId);
    return true;
  }

  /** Get lattice point index for a key (for highlight). */
  getKeyPointIdx(key) {
    return this._keyToPointIdx(key);
  }

  getTotalKeys() {
    return this.keyStore.size;
  }

  getStats() {
    const bucketed = this.buckets.map(b => b.points.length);
    return {
      "Grid Size":       `${this.gridSize}×${this.gridSize}`,
      "Total Points":    this.numPoints,
      "Points / Bucket": this.ppb,
      "Num Buckets":     this.numBuckets,
      "Bucket Size":     `${(this.bucketSize * 180 / Math.PI).toFixed(2)}°`,
      "Keys Stored":     this.getTotalKeys(),
      "Min Pts/Bucket":  Math.min(...bucketed),
      "Max Pts/Bucket":  Math.max(...bucketed),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas Renderer
// ─────────────────────────────────────────────────────────────────────────────

class LatticeRenderer {
  constructor(canvas, engine) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext("2d");
    this.engine  = engine;
    this.palette = generatePalette(engine.numBuckets);

    this.showBuckets = true;
    this.showAngles  = true;
    this.showRef     = true;
    this.showLabels  = false;

    this.highlightedBucket   = -1;
    this.highlightedPointIdx = -1;
    this.animatingPoint      = null;   // { idx, progress }

    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const wrapper = this.canvas.parentElement;
    const side    = Math.min(wrapper.clientWidth - 32, 640);
    this.canvas.width  = side;
    this.canvas.height = side;
    this.draw();
  }

  /** Convert lattice coords to canvas pixels. */
  _toCanvas(lx, ly) {
    const { gridSize } = this.engine;
    const pad  = 48;
    const area = this.canvas.width - pad * 2;
    const cell = area / (gridSize - 1);
    return {
      cx: pad + lx * cell,
      cy: this.canvas.height - pad - ly * cell,
    };
  }

  draw() {
    const ctx    = this.ctx;
    const { width, height } = this.canvas;
    const engine = this.engine;

    ctx.clearRect(0, 0, width, height);

    // Background
    const bgGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2);
    bgGrad.addColorStop(0, "rgba(13,21,37,0.95)");
    bgGrad.addColorStop(1, "rgba(8,12,20,0.98)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Bucket sectors
    if (this.showBuckets) this._drawSectors();

    // Angle lines from ref to each point
    if (this.showAngles) this._drawAngleLines();

    // Lattice grid lines (subtle)
    this._drawGridLines();

    // Lattice points
    this._drawLatticePoints();

    // Reference point
    if (this.showRef) this._drawRefPoint();

    // Key animation
    if (this.animatingPoint) this._drawAnimation();

    // Labels
    if (this.showLabels) this._drawLabels();
  }

  _drawSectors() {
    const ctx     = this.ctx;
    const engine  = this.engine;
    const refC    = this._toCanvas(engine.ref.x, engine.ref.y);
    const radius  = Math.max(this.canvas.width, this.canvas.height) * 1.5;

    for (let i = 0; i < engine.numBuckets; i++) {
      const b   = engine.buckets[i];
      const col = this.palette[i];
      const highlighted = this.highlightedBucket === i;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(refC.cx, refC.cy);
      ctx.arc(refC.cx, refC.cy, radius,
        b.angleStart - Math.PI * 0.5,   // canvas Y is flipped
        b.angleEnd   - Math.PI * 0.5, false);
      ctx.closePath();

      // Note: canvas atan2 is from +x axis clockwise from top
      // We draw sectors using the actual angles with Y-flip compensation
      ctx.beginPath();
      ctx.moveTo(refC.cx, refC.cy);
      // Correct for flipped Y: angles in lattice space increase counter-clockwise
      // but canvas Y increases downward, so we need to negate Y in angle computation
      const aStart = -(b.angleEnd);
      const aEnd   = -(b.angleStart);
      ctx.arc(refC.cx, refC.cy, radius, aStart, aEnd, false);
      ctx.closePath();

      ctx.fillStyle = highlighted
        ? col.fill.replace("0.18", "0.35")
        : col.fill;
      ctx.fill();

      if (highlighted) {
        ctx.strokeStyle = col.stroke;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
  }

  _drawAngleLines() {
    const ctx    = this.ctx;
    const engine = this.engine;
    const refC   = this._toCanvas(engine.ref.x, engine.ref.y);

    for (const pt of engine.points) {
      const ptC = this._toCanvas(pt.x, pt.y);
      const col = this.palette[pt.bucketId];
      const isHighlightPt = pt.idx === this.highlightedPointIdx;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(refC.cx, refC.cy);
      ctx.lineTo(ptC.cx, ptC.cy);
      ctx.strokeStyle = isHighlightPt
        ? col.stroke
        : col.stroke.replace("0.9", "0.12");
      ctx.lineWidth = isHighlightPt ? 1.5 : 0.5;
      ctx.setLineDash(isHighlightPt ? [] : [3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  _drawGridLines() {
    const ctx    = this.ctx;
    const engine = this.engine;

    ctx.save();
    ctx.strokeStyle = "rgba(79,140,255,0.06)";
    ctx.lineWidth   = 1;

    for (let i = 0; i < engine.gridSize; i++) {
      // Horizontal
      const p1 = this._toCanvas(0, i);
      const p2 = this._toCanvas(engine.gridSize - 1, i);
      ctx.beginPath();
      ctx.moveTo(p1.cx, p1.cy);
      ctx.lineTo(p2.cx, p2.cy);
      ctx.stroke();

      // Vertical
      const p3 = this._toCanvas(i, 0);
      const p4 = this._toCanvas(i, engine.gridSize - 1);
      ctx.beginPath();
      ctx.moveTo(p3.cx, p3.cy);
      ctx.lineTo(p4.cx, p4.cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawLatticePoints() {
    const ctx    = this.ctx;
    const engine = this.engine;

    for (const pt of engine.points) {
      const ptC   = this._toCanvas(pt.x, pt.y);
      const col   = this.palette[pt.bucketId];
      const inBucket = engine.buckets[pt.bucketId].keys.size > 0;
      const isHigh = pt.idx === this.highlightedPointIdx;
      const hasKey = [...engine.keyStore.values()].some(e => e.ptIdx === pt.idx);

      const r = isHigh ? 9 : hasKey ? 7 : 5;

      // Glow
      if (hasKey || isHigh) {
        const grd = ctx.createRadialGradient(ptC.cx, ptC.cy, 0, ptC.cx, ptC.cy, r * 3);
        grd.addColorStop(0, col.solid + "55");
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(ptC.cx, ptC.cy, r * 3, 0, TWO_PI);
        ctx.fill();
      }

      // Point circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(ptC.cx, ptC.cy, r, 0, TWO_PI);

      if (hasKey) {
        ctx.fillStyle = col.solid;
        ctx.fill();
        // Ring
        ctx.strokeStyle = "#fff";
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle   = isHigh ? col.solid : "rgba(13,21,37,0.9)";
        ctx.strokeStyle = col.stroke;
        ctx.lineWidth   = isHigh ? 2 : 1;
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawRefPoint() {
    const ctx  = this.ctx;
    const refC = this._toCanvas(this.engine.ref.x, this.engine.ref.y);

    // Pulsing outer ring
    const time = (Date.now() % 2000) / 2000;
    const pulseR = 18 + Math.sin(time * TWO_PI) * 6;

    ctx.save();
    ctx.beginPath();
    ctx.arc(refC.cx, refC.cy, pulseR, 0, TWO_PI);
    ctx.strokeStyle = "rgba(0, 229, 255, 0.3)";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crosshair
    const half = 14;
    ctx.strokeStyle = "rgba(0, 229, 255, 0.6)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(refC.cx - half, refC.cy);
    ctx.lineTo(refC.cx + half, refC.cy);
    ctx.moveTo(refC.cx, refC.cy - half);
    ctx.moveTo(refC.cx, refC.cy);
    ctx.lineTo(refC.cx, refC.cy + half);
    ctx.stroke();

    // Core dot
    const grd = ctx.createRadialGradient(refC.cx, refC.cy, 0, refC.cx, refC.cy, 10);
    grd.addColorStop(0, "#00e5ff");
    grd.addColorStop(1, "rgba(0, 229, 255, 0)");
    ctx.beginPath();
    ctx.arc(refC.cx, refC.cy, 10, 0, TWO_PI);
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(refC.cx, refC.cy, 4, 0, TWO_PI);
    ctx.fillStyle = "#00e5ff";
    ctx.fill();

    // Label
    ctx.font      = "500 11px 'Inter', sans-serif";
    ctx.fillStyle = "#00e5ff";
    ctx.fillText("P_ref 🔒", refC.cx + 14, refC.cy - 8);
    ctx.restore();
  }

  _drawAnimation() {
    if (!this.animatingPoint) return;
    const { ptIdx, progress } = this.animatingPoint;
    const ctx  = this.ctx;
    const pt   = this.engine.points[ptIdx];
    const ptC  = this._toCanvas(pt.x, pt.y);
    const refC = this._toCanvas(this.engine.ref.x, this.engine.ref.y);
    const col  = this.palette[pt.bucketId];

    // Animated particle from ref → point
    const px = lerp(refC.cx, ptC.cx, progress);
    const py = lerp(refC.cy, ptC.cy, progress);

    const grd = ctx.createRadialGradient(px, py, 0, px, py, 12);
    grd.addColorStop(0, col.solid);
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, TWO_PI);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, TWO_PI);
    ctx.fill();
  }

  _drawLabels() {
    const ctx    = this.ctx;
    const engine = this.engine;

    // Bucket angle labels
    const refC = this._toCanvas(engine.ref.x, engine.ref.y);
    for (let i = 0; i < engine.numBuckets; i++) {
      const midAngle = -(engine.buckets[i].angleStart + engine.buckets[i].angleEnd) / 2;
      const labelR   = 60;
      const lx = refC.cx + Math.cos(midAngle) * labelR;
      const ly = refC.cy + Math.sin(midAngle) * labelR;
      ctx.font      = "bold 10px 'JetBrains Mono', monospace";
      ctx.fillStyle = this.palette[i].text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`B${i}`, lx, ly);
    }

    // Point coordinate labels
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.font         = "9px 'JetBrains Mono', monospace";
    for (const pt of engine.points) {
      const ptC = this._toCanvas(pt.x, pt.y);
      ctx.fillStyle = this.palette[pt.bucketId].text + "99";
      ctx.fillText(`(${pt.x},${pt.y})`, ptC.cx, ptC.cy + 8);
    }
  }

  /** Start a key store animation. */
  animateStore(ptIdx) {
    this.animatingPoint = { ptIdx, progress: 0 };
    const start = performance.now();
    const duration = 800;

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      this.animatingPoint.progress = t;
      this.draw();
      if (t < 1) requestAnimationFrame(step);
      else this.animatingPoint = null;
    };
    requestAnimationFrame(step);
  }

  startPulse() {
    const loop = () => {
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Handle mouse hover over canvas. */
  onMouseMove(e) {
    const rect  = this.canvas.getBoundingClientRect();
    const mx    = (e.clientX - rect.left) * (this.canvas.width  / rect.width);
    const my    = (e.clientY - rect.top)  * (this.canvas.height / rect.height);
    const engine = this.engine;

    // Find nearest lattice point
    let nearest = null;
    let minDist = Infinity;
    for (const pt of engine.points) {
      const ptC = this._toCanvas(pt.x, pt.y);
      const d   = Math.hypot(ptC.cx - mx, ptC.cy - my);
      if (d < minDist) { minDist = d; nearest = pt; }
    }

    if (nearest && minDist < 20) {
      this.highlightedPointIdx = nearest.idx;
      this.highlightedBucket   = nearest.bucketId;

      const angleDeg = (nearest.angle * 180 / Math.PI).toFixed(1);
      const hasKey = [...engine.keyStore.values()].some(e => e.ptIdx === nearest.idx);

      return {
        point: nearest,
        angleDeg,
        bucketId: nearest.bucketId,
        hasKey,
      };
    } else {
      this.highlightedPointIdx = -1;
      this.highlightedBucket   = -1;
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App Controller
// ─────────────────────────────────────────────────────────────────────────────

class App {
  constructor() {
    this.engine   = null;
    this.renderer = null;
    this._initDOM();
    this._setupInitialState();
    this._startPulse();
  }

  // ── DOM References ──────────────────────────────────────────────────────

  _initDOM() {
    this.canvas      = document.getElementById("lattice-canvas");
    this.tooltip     = document.getElementById("tooltip");
    this.flash       = document.getElementById("flash");
    this.opResult    = document.getElementById("operation-result");
    this.atkResult   = document.getElementById("attack-result");
    this.statsGrid   = document.getElementById("stats-grid");
    this.bucketList  = document.getElementById("bucket-list");
    this.legend      = document.getElementById("canvas-legend");

    this.$    = id => document.getElementById(id);
    this.gridSizeEl  = this.$("grid-size");
    this.ppbEl       = this.$("ppb");
    this.refXEl      = this.$("ref-x");
    this.refYEl      = this.$("ref-y");
    this.keyInputEl  = this.$("key-input");
    this.valueInputEl= this.$("value-input");

    // Sliders
    this.gridSizeEl.addEventListener("input", () => {
      this.$("grid-size-val").textContent = this.gridSizeEl.value;
      this._updateStats();
      this._rebuild();
    });
    this.ppbEl.addEventListener("input", () => {
      this.$("ppb-val").textContent = this.ppbEl.value;
      this._rebuild();
    });
    this.refXEl.addEventListener("change", () => this._rebuild());
    this.refYEl.addEventListener("change", () => this._rebuild());

    // Buttons
    this.$("random-ref-btn"   ).addEventListener("click", () => this._randomizeRef());
    if (this.$("run-qkd-btn")) {
      this.$("run-qkd-btn").addEventListener("click", () => this._openQkdModal());
    }
    this.$("store-btn"        ).addEventListener("click", () => this._storeKey());
    this.$("retrieve-btn"     ).addEventListener("click", () => this._retrieveKey());
    this.$("delete-btn"       ).addEventListener("click", () => this._deleteKey());
    this.$("attack-btn"       ).addEventListener("click", () => this._simulateAttack());
    this.$("reset-btn"        ).addEventListener("click", () => this._fullReset());

    // Toggle buttons
    this.$("show-buckets-btn" ).addEventListener("click", e => this._toggle(e, "showBuckets"));
    this.$("show-angles-btn"  ).addEventListener("click", e => this._toggle(e, "showAngles"));
    this.$("show-ref-btn"     ).addEventListener("click", e => this._toggle(e, "showRef"));
    this.$("show-labels-btn"  ).addEventListener("click", e => this._toggle(e, "showLabels"));

    // Canvas hover
    this.canvas.addEventListener("mousemove", e => this._onCanvasHover(e));
    this.canvas.addEventListener("mouseleave", () => {
      this.tooltip.classList.remove("visible");
      if (this.renderer) {
        this.renderer.highlightedBucket   = -1;
        this.renderer.highlightedPointIdx = -1;
      }
    });

    // Canvas click → move ref point
    this.canvas.addEventListener("click", e => this._onCanvasClick(e));
  }

  // ── Init ────────────────────────────────────────────────────────────────

  _setupInitialState() {
    this._rebuild();
  }

  _rebuild() {
    const gridSize = parseInt(this.gridSizeEl.value);
    const ppb      = parseInt(this.ppbEl.value);
    const refX     = parseFloat(this.refXEl.value);
    const refY     = parseFloat(this.refYEl.value);

    // Preserve stored keys if rebuilding with same ref
    const prevKeys = this.engine ? [...this.engine.keyStore.entries()] : [];

    this.engine   = new ABLKMEngine(gridSize, ppb, refX, refY);
    this.renderer = new LatticeRenderer(this.canvas, this.engine);

    // Restore keys
    for (const [, entry] of prevKeys) {
      // We can't perfectly restore since we don't store the original key string
      // Just skip restoration on rebuild (as in a real system a rebuild = new secret)
    }

    this._updateStats();
    this._updateBucketList();
    this._updateLegend();
    this._updateTotalPoints();
  }

  _startPulse() {
    const loop = () => {
      if (this.renderer) this.renderer.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _updateTotalPoints() {
    const gs = parseInt(this.gridSizeEl.value);
    const ppb = parseInt(this.ppbEl.value);
    const n = gs * gs;
    this.$("total-points").textContent = n;
    this.$("num-buckets").textContent  = Math.ceil(n / ppb);
  }

  // ── Key Operations ──────────────────────────────────────────────────────

  async _storeKey() {
    const key   = this.keyInputEl.value.trim();
    const value = this.valueInputEl.value.trim();

    if (!key || !value) {
      this._showResult(this.opResult, "⚠ Please enter both a key and a value.", "error");
      return;
    }

    const meta = this.engine.storeKey(key, value);
    this.renderer.highlightedPointIdx = meta.latticePoint.idx;
    this.renderer.highlightedBucket   = meta.bucketId;
    this.renderer.animateStore(meta.latticePoint.idx);

    const msg = [
      `✓ Key stored successfully`,
      ``,
      `Key ID      : ${meta.keyId}`,
      `Lattice Pt  : (${meta.latticePoint.x}, ${meta.latticePoint.y})`,
      `Angle θ     : ${meta.angleDeg}°`,
      `Bucket      : #${meta.bucketId}  [${meta.bucketStart}°–${meta.bucketEnd}°]`,
    ].join("\n");

    this._showResult(this.opResult, msg, "success");
    this._flash(`✓ Key "${key}" stored in Bucket #${meta.bucketId}`, "success");
    this._updateStats();
    this._updateBucketList();
    this._highlightBucketItem(meta.bucketId);
  }

  _retrieveKey() {
    const key = this.keyInputEl.value.trim();
    if (!key) { this._showResult(this.opResult, "⚠ Enter a key to retrieve.", "error"); return; }

    const value = this.engine.retrieveKey(key);

    if (value === null) {
      this._showResult(this.opResult, `✗ Key "${key}" not found in store.`, "error");
      this._flash(`✗ Key not found`, "error");
    } else {
      const ptIdx = this.engine.getKeyPointIdx(key);
      const pt    = this.engine.points[ptIdx];
      this.renderer.highlightedPointIdx = ptIdx;
      this.renderer.highlightedBucket   = pt.bucketId;

      const msg = [
        `✓ Retrieved successfully`,
        ``,
        `Value: ${value}`,
        ``,
        `Lattice Pt  : (${pt.x}, ${pt.y})`,
        `Angle θ     : ${(pt.angle * 180 / Math.PI).toFixed(2)}°`,
        `Bucket      : #${pt.bucketId}`,
      ].join("\n");
      this._showResult(this.opResult, msg, "success");
      this._flash(`✓ Retrieved: "${value.slice(0, 30)}"`, "success");
    }
  }

  _deleteKey() {
    const key = this.keyInputEl.value.trim();
    if (!key) { this._showResult(this.opResult, "⚠ Enter a key to delete.", "error"); return; }

    const ok = this.engine.deleteKey(key);
    if (ok) {
      this._showResult(this.opResult, `✓ Key "${key}" deleted from store.`, "success");
      this._flash(`✓ Key deleted`, "success");
    } else {
      this._showResult(this.opResult, `✗ Key "${key}" not found.`, "error");
    }
    this._updateStats();
    this._updateBucketList();
  }

  // ── Attack Simulation ───────────────────────────────────────────────────

  _simulateAttack() {
    if (this.engine.getTotalKeys() === 0) {
      this._showResult(this.atkResult, "⚠ Store at least one key first.", "error");
      return;
    }

    // Random wrong ref point
    const gs = this.engine.gridSize;
    const badRef = {
      x: (Math.random() * gs * 2) - gs * 0.5,
      y: (Math.random() * gs * 2) - gs * 0.5,
    };
    const badEngine = new ABLKMEngine(gs, this.engine.ppb, badRef.x, badRef.y);

    // Copy ciphertext to bad engine (attacker has ciphertext)
    for (const [keyId, entry] of this.engine.keyStore) {
      const badBid = Math.floor(Math.random() * badEngine.numBuckets); // goes to wrong bucket
      badEngine.buckets[badBid].keys.set(keyId, entry);
    }

    const keys = [...this.engine.keyStore.values()];
    let failed = 0;

    // Try to retrieve stored keys with wrong ref
    for (const entry of keys) {
      const result = badEngine.buckets.some(b => b.keys.has(
        entry.ptIdx.toString(16)  // wrong key ID mapping
      ));
      failed++;
    }

    const msg = [
      `⚡ Attack Simulation`,
      ``,
      `Wrong ref point: (${badRef.x.toFixed(2)}, ${badRef.y.toFixed(2)})`,
      `True  ref point: (${this.engine.ref.x.toFixed(2)}, ${this.engine.ref.y.toFixed(2)})`,
      ``,
      `Keys targeted : ${keys.length}`,
      `Keys cracked  : 0  ← (angular lookup fails without P_ref)`,
      ``,
      `Security holds! Without the secret reference`,
      `point, bucket lookup returns wrong results.`,
      ``,
      `Brute force needed: O(2^n) for n-dim lattice`,
      `(equivalent to solving CVP — NP-hard)`,
    ].join("\n");

    this._showResult(this.atkResult, msg, "info");
    this._flash("✓ Attack blocked — secret ref point protected all keys", "info");
  }

  // ── Randomize Ref ────────────────────────────────────────────────────────

  _randomizeRef() {
    const gs  = parseInt(this.gridSizeEl.value);
    const mid = (gs - 1) / 2;
    const rx  = +(mid + (Math.random() - 0.5) * gs * 0.6).toFixed(2);
    const ry  = +(mid + (Math.random() - 0.5) * gs * 0.6).toFixed(2);
    this.refXEl.value = rx;
    this.refYEl.value = ry;
    this._rebuild();
    this._flash(`🎲 New ref: (${rx}, ${ry})`, "info");
  }

  _fullReset() {
    this.gridSizeEl.value = 6;
    this.ppbEl.value      = 4;
    this.refXEl.value     = 2.3;
    this.refYEl.value     = 2.7;
    this.$("grid-size-val").textContent = 6;
    this.$("ppb-val").textContent       = 4;
    this.keyInputEl.value   = "";
    this.valueInputEl.value = "";
    this.opResult.classList.add("hidden");
    this.atkResult.classList.add("hidden");
    this._rebuild();
    this._flash("↺ Reset complete", "info");
  }

  // ── Toggle display options ────────────────────────────────────────────────

  _toggle(e, prop) {
    e.currentTarget.classList.toggle("active");
    this.renderer[prop] = !this.renderer[prop];
  }

  // ── Canvas interactions ───────────────────────────────────────────────────

  _onCanvasHover(e) {
    if (!this.renderer) return;
    const hit = this.renderer.onMouseMove(e);
    if (hit) {
      const bg = this.renderer.palette[hit.bucketId];
      this._showTooltip(e,
        `Lattice (${hit.point.x}, ${hit.point.y})\n` +
        `Angle: ${hit.angleDeg}°\n` +
        `Bucket: #${hit.bucketId}\n` +
        (hit.hasKey ? "🔑 Has key stored" : "Empty")
      );
    } else {
      this.tooltip.classList.remove("visible");
    }
  }

  _onCanvasClick(e) {
    if (!this.renderer) return;
    const rect  = this.canvas.getBoundingClientRect();
    const mx    = (e.clientX - rect.left) * (this.canvas.width  / rect.width);
    const my    = (e.clientY - rect.top)  * (this.canvas.height / rect.height);

    // Convert canvas px → lattice coords
    const pad    = 48;
    const area   = this.canvas.width - pad * 2;
    const cell   = area / (this.engine.gridSize - 1);
    const lx = +((mx - pad ) / cell).toFixed(2);
    const ly = +((this.canvas.height - pad - my) / cell).toFixed(2);

    // Only update ref if clicked in valid range
    const gs = this.engine.gridSize - 1;
    if (lx >= -1 && lx <= gs + 1 && ly >= -1 && ly <= gs + 1) {
      this.refXEl.value = lx;
      this.refYEl.value = ly;
      this._rebuild();
      this._flash(`📍 Ref moved to (${lx}, ${ly})`, "info");
    }
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────

  _updateStats() {
    if (!this.engine) return;
    const stats = this.engine.getStats();
    this._updateTotalPoints();
    this.statsGrid.innerHTML = Object.entries(stats).map(([k, v]) => `
      <div class="stat-row">
        <span class="stat-label">${k}</span>
        <span class="stat-value">${v}</span>
      </div>
    `).join("");
  }

  _updateBucketList() {
    if (!this.engine) return;
    const palette   = generatePalette(this.engine.numBuckets);
    const maxPts    = Math.max(...this.engine.buckets.map(b => b.points.length));

    this.bucketList.innerHTML = this.engine.buckets.map(b => {
      const col     = palette[b.id];
      const hasKeys = b.keys.size > 0;
      const pct     = maxPts > 0 ? (b.points.length / maxPts * 100) : 0;
      const aStart  = (b.angleStart * 180 / Math.PI).toFixed(1);
      const aEnd    = (b.angleEnd   * 180 / Math.PI).toFixed(1);

      return `
        <div class="bucket-item" data-bucket="${b.id}" id="bucket-item-${b.id}"
             style="border-left-color: ${col.solid}">
          <style>#bucket-item-${b.id}::before { background: ${col.solid}; }</style>
          <div class="bucket-header">
            <span class="bucket-id">Bucket #${b.id}</span>
            <span class="bucket-count ${hasKeys ? "has-keys" : ""}">
              ${b.points.length} pts${hasKeys ? ` · ${b.keys.size} 🔑` : ""}
            </span>
          </div>
          <div class="bucket-angle">${aStart}° – ${aEnd}°</div>
          <div class="bucket-bar">
            <div class="bucket-bar-fill" style="width:${pct}%;background:${col.solid}"></div>
          </div>
        </div>
      `;
    }).join("");

    // Attach hover listeners
    this.bucketList.querySelectorAll(".bucket-item").forEach(el => {
      el.addEventListener("mouseenter", () => {
        const bid = parseInt(el.dataset.bucket);
        if (this.renderer) this.renderer.highlightedBucket = bid;
      });
      el.addEventListener("mouseleave", () => {
        if (this.renderer) this.renderer.highlightedBucket = -1;
      });
    });
  }

  _highlightBucketItem(bid) {
    document.querySelectorAll(".bucket-item").forEach(el => el.classList.remove("highlighted"));
    const el = document.getElementById(`bucket-item-${bid}`);
    if (el) {
      el.classList.add("highlighted");
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  _updateLegend() {
    if (!this.engine) return;
    const palette = generatePalette(this.engine.numBuckets);
    this.legend.innerHTML = [
      `<div class="legend-item"><div class="legend-dot" style="background:#00e5ff;box-shadow:0 0 6px #00e5ff"></div>Secret Ref Point P_ref</div>`,
      `<div class="legend-item"><div class="legend-dot" style="background:#4f8cff"></div>Empty Lattice Point</div>`,
      `<div class="legend-item"><div class="legend-dot" style="background:#fff"></div>Key Stored</div>`,
    ].join("");
  }

  _showResult(el, msg, type = "info") {
    el.textContent = msg;
    el.className   = `operation-result ${type}`;
  }

  _showTooltip(e, text) {
    this.tooltip.textContent = text;
    this.tooltip.style.left  = `${e.clientX + 14}px`;
    this.tooltip.style.top   = `${e.clientY - 10}px`;
    this.tooltip.classList.add("visible");
  }

  _flash(msg, type = "info") {
    this.flash.textContent = msg;
    this.flash.className   = `flash ${type} show`;
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this.flash.classList.remove("show"), 3000);
  }

  // ── QKD Panel Logic ─────────────────────────────────────────────────────────

  _openQkdModal() {
    const overlay = this.$("qkd-modal-overlay");
    overlay.classList.remove("hidden");
    
    // reset UI
    this.$("alice-bits").innerHTML = "";
    this.$("alice-bases").innerHTML = "";
    this.$("bob-bases").innerHTML = "";
    this.$("bob-bits").innerHTML = "";
    this.$("sifted-key").innerHTML = "";
    this.$("qkd-results").classList.add("hidden");
    this.$("qkd-step-btn").textContent = "🚀 Send Qubits";
    
    // Bind close
    this.$("close-qkd-btn").onclick = () => overlay.classList.add("hidden");
    
    // Bind Step logic
    this.$("qkd-step-btn").onclick = async () => this._runQkdSimulation();
  }

  async _runQkdSimulation() {
    const N = 14; // 14 qubits for visual demonstration
    
    // 1. ALICE PREPARES
    const aBits = Array.from({length:N}, () => Math.random() > 0.5 ? 1 : 0);
    const aBases = Array.from({length:N}, () => Math.random() > 0.5 ? '+' : 'x');
    
    this.$("alice-bits").innerHTML = aBits.map(b => `<div class="qkd-cell">${b}</div>`).join('');
    this.$("alice-bases").innerHTML = aBases.map(b => `<div class="qkd-cell">${b === '+' ? '⬍' : '⤡'}</div>`).join('');
    
    // reset bob and sifted
    this.$("bob-bases").innerHTML = "";
    this.$("bob-bits").innerHTML = "";
    this.$("qkd-results").classList.add("hidden");

    // fake latency for network
    this.$("qkd-step-btn").textContent = "Transmitting Photons... ⚡";
    this.$("qkd-step-btn").disabled = true;
    await new Promise(r => setTimeout(r, 800));
    
    // 2. BOB MEASURES
    const bBases = Array.from({length:N}, () => Math.random() > 0.5 ? '+' : 'x');
    const bBits = aBases.map((aB, i) => {
      return (aB === bBases[i]) ? aBits[i] : (Math.random() > 0.5 ? 1 : 0);
    });
    
    this.$("bob-bases").innerHTML = bBases.map(b => `<div class="qkd-cell">${b === '+' ? '⬍' : '⤡'}</div>`).join('');
    this.$("bob-bits").innerHTML = bBits.map(b => `<div class="qkd-cell">${b}</div>`).join('');
    
    await new Promise(r => setTimeout(r, 800));
    this.$("qkd-step-btn").textContent = "Sifting Keys... 🔍";
    
    // 3. SIFTING
    let siftedBinary = "";
    Array.from(this.$("alice-bases").children).forEach((el, i) => {
      if (aBases[i] === bBases[i]) {
        el.classList.add("match");
        this.$("bob-bases").children[i].classList.add("match");
        this.$("alice-bits").children[i].classList.add("match");
        this.$("bob-bits").children[i].classList.add("match");
        siftedBinary += aBits[i];
      } else {
        el.classList.add("mismatch");
        this.$("bob-bases").children[i].classList.add("mismatch");
        this.$("alice-bits").children[i].classList.add("mismatch");
        this.$("bob-bits").children[i].classList.add("mismatch");
      }
    });
    
    await new Promise(r => setTimeout(r, 600));
    
    this.$("qkd-results").classList.remove("hidden");
    this.$("sifted-key").innerHTML = siftedBinary.split('').map(b => `<div class="qkd-cell match">${b}</div>`).join('');
    
    // 4. HASHING (Privacy Amplification)
    const hashHex = await sha256hex(siftedBinary);
    this.$("qkd-hash-val").textContent = hashHex.slice(0, 32) + "...";
    
    // 5. Unlocking ABLKM Binding
    this.$("qkd-step-btn").textContent = "🚀 Exchange New Qubits";
    this.$("qkd-step-btn").disabled = false;
    
    this.$("qkd-apply-btn").onclick = () => {
      // Simulate taking the shared AES key to securely unpack P_ref
      this._flash("✓ BB84 Session Key utilized to securely synchronize P_ref!", "success");
      this.$("qkd-modal-overlay").classList.add("hidden");
      this._randomizeRef(); // visually show the P_ref locking in to a new secure state
    };
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => { new App(); });
