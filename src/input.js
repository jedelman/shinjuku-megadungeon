// Keyboard + mouse, gamepad (standard mapping), and touch (left: stick, right: look, button: act).
export class Input {
  constructor(el) {
    this.keys = new Set();
    this.move = [0, 0];      // x right, y forward, -1..1
    this.look = [0, 0];      // per-frame camera delta (radians-ish)
    this.run = false;
    this.act = false;        // edge-triggered
    this.restart = false;
    this.any = false;        // any input this frame (title screen)
    this.mode = 'keys';
    this._act = false;
    this._drag = null;
    this._stick = null;
    this._lookTouch = null;

    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.code)) {
        if (['KeyE', 'Enter', 'Space'].includes(e.code)) this._act = true;
        if (e.code === 'KeyR') this.restart = true;
      }
      this.keys.add(e.code);
      this.any = true; this.mode = 'keys';
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    el.addEventListener('mousedown', (e) => { this._drag = [e.clientX, e.clientY]; this.any = true; });
    addEventListener('mouseup', () => (this._drag = null));
    addEventListener('mousemove', (e) => {
      if (!this._drag) return;
      this.look[0] += (e.clientX - this._drag[0]) * 0.006;
      this.look[1] += (e.clientY - this._drag[1]) * 0.004;
      this._drag = [e.clientX, e.clientY];
    });

    const opt = { passive: false };
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.any = true; this.mode = 'touch';
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && !this._stick) this._stick = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
        else if (!this._lookTouch) this._lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }, opt);
    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this._stick && t.identifier === this._stick.id) { this._stick.x = t.clientX; this._stick.y = t.clientY; }
        if (this._lookTouch && t.identifier === this._lookTouch.id) {
          this.look[0] += (t.clientX - this._lookTouch.x) * 0.008;
          this.look[1] += (t.clientY - this._lookTouch.y) * 0.005;
          this._lookTouch.x = t.clientX; this._lookTouch.y = t.clientY;
        }
      }
    }, opt);
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (this._stick && t.identifier === this._stick.id) this._stick = null;
        if (this._lookTouch && t.identifier === this._lookTouch.id) this._lookTouch = null;
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  pressAct() { this._act = true; }

  // call once per frame
  poll() {
    const k = this.keys;
    let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let my = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (k.has('KeyQ')) this.look[0] -= 0.035;
    if (k.has('KeyC')) this.look[0] += 0.035;
    this.run = k.has('ShiftLeft') || k.has('ShiftRight');

    if (this._stick) {
      const dx = this._stick.x - this._stick.x0, dy = this._stick.y - this._stick.y0;
      const r = Math.min(1, Math.hypot(dx, dy) / 60);
      const a = Math.atan2(dy, dx);
      mx = Math.cos(a) * r; my = -Math.sin(a) * r;
      this.run = r > 0.95;
    }

    for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (!gp || !gp.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
      const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
      const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      if (lx || ly || rx || ry || gp.buttons.some((b) => b.pressed)) { this.any = true; this.mode = 'pad'; }
      if (lx || ly) { mx = lx; my = -ly; }
      this.look[0] += rx * 0.05; this.look[1] += ry * 0.03;
      const btn = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      if (btn(1) || btn(7) || Math.hypot(lx, ly) > 0.97) this.run = true;
      const a = btn(0);
      if (a && !this._padA) this._act = true;
      this._padA = a;
      const st = btn(9);
      if (st && !this._padStart) this.restart = true;
      this._padStart = st;
    }

    const m = Math.hypot(mx, my);
    this.move = m > 1 ? [mx / m, my / m] : [mx, my];
    this.act = this._act; this._act = false;
  }

  endFrame() {
    this.look[0] = 0; this.look[1] = 0;
    this.restart = false; this.any = false;
  }
}
