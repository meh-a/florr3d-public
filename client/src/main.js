import * as THREE from 'three';
import { createWorld } from './world.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Effects } from './effects.js';
import { EntitySync } from './entities.js';
import { Arrows } from './arrows.js';
import { Net } from './net.js';
import { preloadMobModels } from './mobmodels.js';
import { makeMinimap } from './minimap.js';
import { setupMobileControls, joyWorldOffset } from './mobile.js';
import { MOB_TYPES, CHAT_MAX_LEN, NAME_MAX_LEN } from '../../shared/config.js';
import { initQualityToggle } from './settings.js';
import { restrictToAscii } from './utils.js';

const INPUT_RATE = 1 / 30;

const container = document.getElementById('app');
const { scene, camera, renderer, updateCamera } = createWorld(container);

const game = { scene, camera, renderer, fpsMode: false };
window.game = game;
game.input = new Input(renderer.domElement, camera);
game.ui = new UI(game);
game.effects = new Effects(game);
initQualityToggle();
preloadMobModels([...Object.keys(MOB_TYPES), 'hornetmissile']);

Promise.all([
  document.fonts.load('bold 52px Ubuntu'),
  document.fonts.load('bold 40px Ubuntu'),
]).catch(() => {}).then(() => {
  game.entities = new EntitySync(game);
  game.arrows = new Arrows(game);
  const priv = { inventory: [], xp: 0, xpNext: 60 };
  game.net = new Net({
    onState: (state) => {
      const me = state.players.find((p) => p.id === state.you);
      if (!me) {
        game.entities.apply(state);
        return;
      }
      if (state.inventory) priv.inventory = state.inventory;
      else state.inventory = priv.inventory;
      if (typeof state.xp === 'number') { priv.xp = state.xp; priv.xpNext = state.xpNext; }
      state.player = { ...me, xp: priv.xp, xpNext: priv.xpNext };
      state.petals = me.petals;
      game.entities.apply(state);
      game.arrows.setTargets(state.others);
      game.ui.applyState(state);
    },
    onStatus: (mode) => {
      if ((mode === 'online' || mode === 'local') && chosenName) {
        game.net.sendJoin(chosenName);
      }
      if (mode === 'blocked') gate.classList.remove('hidden');
      if (mode === 'full' && chosenName) {
        setTimeout(() => {
          if (chosenName && game.entities.state?.you == null) {
            game.net.sendJoin(chosenName);
          }
        }, 8000);
      }
      game.ui.toast({
        online: 'Connected',
        offline: 'Connection lost — retrying…',
        local: 'No server found — running locally',
        updating: 'Updating…',
        full: 'Server is packed right now — you\'re in line, hang tight…',
        blocked: 'Couldn\'t verify you\'re human — disable ad blockers for this site, or log in with Discord to skip this check, and hit Play again',
      }[mode]);
    },
  });

  const gate = document.getElementById('namegate');
  const nameInput = document.getElementById('nameinput');
  const playBtn = document.getElementById('playbtn');
  let chosenName = null;
  let joining = false;
  nameInput.value = localStorage.getItem('playerName') || '';
  nameInput.focus();
  restrictToAscii(nameInput, NAME_MAX_LEN);
  const submitName = async () => {
    if (joining) return;
    joining = true;
    chosenName = nameInput.value.trim().slice(0, 16) || 'Guest';
    localStorage.setItem('playerName', chosenName);
    playBtn.disabled = true;
    playBtn.textContent = 'Verifying…';
    nameInput.blur();
    const ok = await game.net.sendJoin(chosenName);
    joining = false;
    if (ok) {
      gate.classList.add('hidden');
    } else {
      playBtn.disabled = false;
      playBtn.textContent = 'Play';
    }
  };
  playBtn.addEventListener('click', submitName);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitName(); });

  const loginBtn = document.getElementById('loginbtn');
  const authState = document.getElementById('authstate');
  fetch('/auth/me').then((r) => (r.ok ? r.json() : null)).then((me) => {
    if (!me) return;
    if (!me.loggedIn) {
      loginBtn.classList.remove('hidden');
      document.getElementById('loginnudge').classList.remove('hidden');
      return;
    }
    authState.textContent = `Signed in as ${me.username}`;
    const logout = document.createElement('a');
    logout.id = 'logoutbtn';
    logout.href = '/auth/logout';
    logout.textContent = 'log out';
    authState.append(logout);
    if (!nameInput.value) nameInput.value = me.username.slice(0, 16);
  }).catch(() => {});

  const touch = matchMedia('(pointer: coarse)').matches;
  const toggleCamera = () => {
    game.fpsMode = !game.fpsMode;
    if (game.fpsMode) {
      const facing = game.entities.state?.player?.facing ?? 0;
      game.input.look.yaw = facing + Math.PI;
      game.input.look.pitch = 0;
      if (!touch) game.input.lockPointer();
      game.ui.toast(touch
        ? 'First person — joystick to move, drag to look'
        : 'First person — WASD to move, F to exit');
    } else {
      if (!touch) game.input.unlockPointer();
      game.ui.toast('Top-down view');
    }
  };
  game.input.on('f', toggleCamera);
  setupMobileControls(game, toggleCamera);
  game.input.on('v', () => {
    game.ui.toast(game.arrows.toggle() ? 'Player arrows on' : 'Player arrows off');
  });
  const CHAT_MUTE_KEY = 'florr3d-chatmuted';
  const mutechatBtn = document.getElementById('mutechat');
  const renderMuteBtn = () => { mutechatBtn.textContent = `Chat: ${game.entities.chatMuted ? 'Muted' : 'On'}`; };
  let chatMuted = false;
  try { chatMuted = localStorage.getItem(CHAT_MUTE_KEY) === '1'; } catch {}
  game.entities.setChatMuted(chatMuted);
  renderMuteBtn();
  mutechatBtn.onclick = () => {
    game.entities.setChatMuted(!game.entities.chatMuted);
    try { localStorage.setItem(CHAT_MUTE_KEY, game.entities.chatMuted ? '1' : '0'); } catch {}
    renderMuteBtn();
  };
  const chatBox = document.getElementById('chatbox');
  const chatInput = document.getElementById('chatinput');
  restrictToAscii(chatInput, CHAT_MAX_LEN);
  let chatRelockFps = false;
  const closeChat = () => {
    chatBox.classList.remove('show');
    chatInput.blur();
    if (chatRelockFps) { chatRelockFps = false; if (!touch) game.input.lockPointer(); }
  };
  game.input.on('enter', () => {
    if (!chosenName || chatBox.classList.contains('show')) return;
    chatBox.classList.add('show');
    chatInput.value = '';
    chatInput.focus();
    if (game.fpsMode && !touch) { chatRelockFps = true; game.input.unlockPointer(); }
  });
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = chatInput.value.trim();
      if (text) game.net.send({ t: 'chat', text });
      closeChat();
    } else if (e.key === 'Escape') {
      closeChat();
    }
  });
  game.input.on('r', () => game.net.send({ t: 'swapRows' }));
  game.input.on('q', () => game.net.send({ t: 'rotSpeed', delta: -0.175 }));
  game.input.on('e', () => game.net.send({ t: 'rotSpeed', delta: +0.175 }));
  for (let i = 1; i <= 5; i++) {
    game.input.on(String(i), () => game.net.send({ t: 'swapSlot', i: i - 1 }));
  }

  let inputAccum = 0;
  function sendInput(dt) {
    if (!chosenName) return;
    inputAccum += dt;
    if (inputAccum < INPUT_RATE) return;
    inputAccum = 0;
    let target = game.input.cursorWorld();
    let axes = game.input.moveAxes();
    const joy = game.input.joy;
    if (joy) {
      if (game.fpsMode) {
        axes = { x: joy.x, z: -joy.y };
      } else {
        const p = game.entities.playerPos();
        const off = joy.active ? joyWorldOffset(game.camera, joy) : { x: 0, z: 0 };
        target = { x: p.x + off.x, z: p.z + off.z };
      }
    }
    game.net.send({
      t: 'input',
      tx: Math.round(target.x * 100) / 100,
      tz: Math.round(target.z * 100) / 100,
      ax: axes.x, az: axes.z,
      fps: game.fpsMode,
      yaw: game.input.look.yaw,
      pitch: game.input.aimPitch(game.fpsMode),
      atk: game.input.attackHeld(),
      def: game.input.defendHeld(),
    });
  }

  const updateMinimap = makeMinimap(document.getElementById('hud'));

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    sendInput(dt);
    game.entities.update(dt);
    game.effects.update(dt);

    updateCamera(dt, game.entities.playerPos(), game.fpsMode ? game.input.look : null);
    game.arrows.update();
    updateMinimap(game.entities.playerPos());
    renderer.render(scene, camera);
  }
  loop();
});
