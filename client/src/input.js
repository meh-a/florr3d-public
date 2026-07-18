import * as THREE from 'three';
import { PITCH_LIMIT } from '../../shared/config.js';

const MAX_MOVE_PX = 250;

export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.mouseNDC = new THREE.Vector2(0, 0);
    this.attack = false;
    this.defend = false;
    this.keys = new Set();
    this.handlers = {};

    this.look = { yaw: 0, pitch: 0 };
    this.lookSensitivity = 0.0024;
    this.wantLock = false;

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.groundPoint = new THREE.Vector3();

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        const dx = Math.max(-MAX_MOVE_PX, Math.min(MAX_MOVE_PX, e.movementX));
        const dy = Math.max(-MAX_MOVE_PX, Math.min(MAX_MOVE_PX, e.movementY));
        this.look.yaw -= dx * this.lookSensitivity;
        this.look.pitch -= dy * this.lookSensitivity;
        this.look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.look.pitch));
        return;
      }
      this.mouseNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.wantLock && document.pointerLockElement !== canvas) canvas.requestPointerLock();
      if (e.button === 0) this.attack = true;
      if (e.button === 2) this.defend = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.attack = false;
      if (e.button === 2) this.defend = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === ' ') e.preventDefault();
      this.keys.add(k);
      if (!e.repeat && this.handlers[k]) this.handlers[k]();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  on(key, fn) { this.handlers[key] = fn; }

  attackHeld() { return this.attack || this.keys.has(' '); }
  defendHeld() { return this.defend || this.keys.has('shift'); }

  lockPointer() {
    this.wantLock = true;
    this.canvas.requestPointerLock();
  }

  unlockPointer() {
    this.wantLock = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  moveAxes() {
    const x = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    const z = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0);
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
  }

  cursorWorld() {
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, this.groundPoint);
    return this.groundPoint;
  }

  aimPitch(fps) {
    return fps ? this.look.pitch : this.mouseNDC.y * PITCH_LIMIT;
  }
}
