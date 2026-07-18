import { DeltaAssembler, encodeCmd } from '../../shared/protocol.js';
import { getTurnstileToken } from './turnstile.js';

const DEDICATED_URL = import.meta.env.VITE_WS_URL;

export class Net {
  constructor({ onState, onStatus }) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.ws = null;
    this.worker = null;
    this.everConnected = false;
    this.updating = false;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(DEDICATED_URL || `${proto}://${location.host}/ws`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    const assembler = new DeltaAssembler();
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.everConnected = true;
      if (this.updating) { location.reload(); return; }
      this.onStatus?.('online');
    };
    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        try { this.onState(assembler.apply(ev.data)); } catch (err) { console.error('bad state frame', err); }
        return;
      }
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'state') this.onState(msg);
      else if (msg.t === 'update') {
        this.updating = true;
        this.onStatus?.('updating');
      } else if (msg.t === 'full') {
        this.onStatus?.('full');
      }
    };
    ws.onclose = () => {
      this.ws = null;
      if (!this.everConnected && !DEDICATED_URL) {
        this.startWorker();
        return;
      }
      if (opened) this.onStatus?.('offline');
      setTimeout(() => this.connect(), 1000);
    };
  }

  startWorker() {
    this.worker = new Worker(
      new URL('../../server/worker.js', import.meta.url),
      { type: 'module' }
    );
    this.worker.onmessage = (ev) => this.onState(ev.data);
    this.onStatus?.('local');
  }

  send(obj) {
    if (this.worker) this.worker.postMessage(obj);
    else if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encodeCmd(obj));
  }

  async sendJoin(name) {
    let token = '';
    if (!this.worker) {
      try {
        let res = await fetch('/join-token', { credentials: 'same-origin' });
        if (res.status === 403) {
          const turnstile = await getTurnstileToken();
          res = await fetch(`/join-token?turnstile=${encodeURIComponent(turnstile)}`, { credentials: 'same-origin' });
          if (!res.ok) { this.onStatus?.('blocked'); return false; }
        }
        if (res.ok) ({ token } = await res.json());
      } catch { }
    }
    this.send({ t: 'join', name, token });
    return true;
  }
}
