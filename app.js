// Enhanced controller visualization + smoothing + mapping integration
// Branch: gh-pages-visualizer

const gpListEl = document.getElementById('gamepad-list');
const diag = {
  connected: document.getElementById('diag-connected'),
  id: document.getElementById('diag-id'),
  index: document.getElementById('diag-index'),
  mapping: document.getElementById('diag-mapping'),
  timestamp: document.getElementById('diag-timestamp'),
  battery: document.getElementById('diag-battery'),
  rumble: document.getElementById('diag-rumble')
};
const axesEl = document.getElementById('axes');
const buttonsEl = document.getElementById('buttons');

const psSvg = document.getElementById('ps-svg');
const xboxSvg = document.getElementById('xbox-svg');

let activeGamepad = null;
let raf = null;

// smoothing state for sticks
const stickState = {
  ps: { lx:0, ly:0, rx:0, ry:0 },
  x: { lx:0, ly:0, rx:0, ry:0 }
};
const SMOOTHING = 0.18; // light smoothing

window.addEventListener('gamepadconnected', (e) => {
  console.log('gamepadconnected', e.gamepad);
  activeGamepad = e.gamepad;
  showControllerSVG(e.gamepad);
  startLoop();
});
window.addEventListener('gamepaddisconnected', (e) => {
  console.log('gamepaddisconnected', e.gamepad);
  if (activeGamepad && activeGamepad.index === e.gamepad.index) activeGamepad = null;
  updateList();
});

document.getElementById('btn-request-battery').addEventListener('click', requestBluetoothBattery);
document.getElementById('btn-request-hid').addEventListener('click', requestHID);

function updateList(){
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  gpListEl.innerHTML = '';
  for (const gp of gps) {
    if (!gp) continue;
    const li = document.createElement('li');
    li.textContent = `#${gp.index} — ${gp.id} (${gp.connected ? 'connected' : 'disconnected'})`;
    li.onclick = () => { activeGamepad = gp; showControllerSVG(gp); };
    gpListEl.appendChild(li);
  }
  if (!gpListEl.hasChildNodes()) {
    const li = document.createElement('li');
    li.textContent = 'No controllers detected. Connect one or press a button.';
    gpListEl.appendChild(li);
  }
}

function startLoop(){
  if (!raf) raf = requestAnimationFrame(loop);
}
function loop(){
  updateList();
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  if (activeGamepad === null) {
    for (const gp of gps) { if (gp && gp.connected) { activeGamepad = gp; showControllerSVG(gp); break; } }
  }
  if (activeGamepad) {
    const gp = navigator.getGamepads()[activeGamepad.index];
    if (gp) { renderGamepad(gp); activeGamepad = gp; }
  } else {
    // no active controller: show both SVGs dimmed
    psSvg.classList.add('inactive');
    xboxSvg.classList.add('inactive');
  }
  raf = requestAnimationFrame(loop);
}

function renderGamepad(gp){
  diag.connected.textContent = gp.connected;
  diag.id.textContent = gp.id;
  diag.index.textContent = gp.index;
  diag.mapping.textContent = gp.mapping || '—';
  diag.timestamp.textContent = new Date(gp.timestamp || Date.now()).toLocaleTimeString();
  diag.rumble.textContent = !!(gp.vibrationActuator) ? 'yes' : 'no';

  axesEl.innerHTML = '<strong>Axes</strong><br/>' + gp.axes.map((v,i)=>`[${i}]: ${v.toFixed(3)}`).join('<br/>');
  buttonsEl.innerHTML = '<strong>Buttons</strong><br/>' + gp.buttons.map((b,i)=>`[${i}]: ${b.pressed ? 'P' : '-'} ${b.value.toFixed(3)}`).join('<br/>');

  // highlight & animate
  if (isPSController(gp)) showPSHighlight(gp);
  else if (isXboxController(gp)) showXboxHighlight(gp);
  else { psSvg.classList.remove('inactive'); xboxSvg.classList.remove('inactive'); }
}

function isPSController(gp){
  const id = (gp.id||'').toLowerCase();
  return id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense') || id.includes('sony');
}
function isXboxController(gp){
  const id = (gp.id||'').toLowerCase();
  return id.includes('xbox') || id.includes('x-box') || id.includes('microsoft');
}

function showControllerSVG(gp){
  // keep both visible, dim inactive one
  psSvg.classList.remove('inactive');
  xboxSvg.classList.remove('inactive');
  if (isPSController(gp)) { psSvg.classList.remove('inactive'); xboxSvg.classList.add('inactive'); }
  else if (isXboxController(gp)) { xboxSvg.classList.remove('inactive'); psSvg.classList.add('inactive'); }
}

// helper to lerp
function lerp(a,b,t){ return a + (b-a)*t; }

function showPSHighlight(gp){
  // clear previous pressed classes
  psSvg.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));
  // mapping (most controllers follow standard mapping)
  const map = { cross:0, circle:1, square:2, triangle:3, l1:4, r1:5, l2:6, r2:7, ls:10, rs:11, dUp:12, dDown:13, dLeft:14, dRight:15 };
  const pressMap = [ ['ps-btn-cross', map.cross], ['ps-btn-circle', map.circle], ['ps-btn-square', map.square], ['ps-btn-triangle', map.triangle] ];
  pressMap.forEach(([id,idx])=>{ const b = gp.buttons[idx]; if (b && b.pressed) { const el = psSvg.querySelector('#'+id); if (el) el.classList.add('pressed'); } });

  // dpad
  [['ps-dpad-up',map.dUp],['ps-dpad-down',map.dDown],['ps-dpad-left',map.dLeft],['ps-dpad-right',map.dRight]].forEach(([id,idx])=>{ const el = psSvg.querySelector('#'+id); if (!el) return; if (gp.buttons[idx]?.pressed) el.classList.add('pressed'); else el.classList.remove('pressed'); });

  // sticks: axes 0,1 left. 2,3 right (standard)
  const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0, rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
  const s = stickState.ps;
  s.lx = lerp(s.lx, lx, SMOOTHING); s.ly = lerp(s.ly, ly, SMOOTHING); s.rx = lerp(s.rx, rx, SMOOTHING); s.ry = lerp(s.ry, ry, SMOOTHING);
  const lsKnob = psSvg.querySelector('#ps-ls-knob');
  const rsKnob = psSvg.querySelector('#ps-rs-knob');
  if (lsKnob) lsKnob.style.transform = `translate(${s.lx*10}px, ${s.ly*10}px)`;
  if (rsKnob) rsKnob.style.transform = `translate(${s.rx*10}px, ${s.ry*10}px)`;

  // button pressure visualization (scale by value)
  ['ps-btn-cross','ps-btn-circle','ps-btn-square','ps-btn-triangle'].forEach((id,i)=>{
    const b = gp.buttons[i]; const el = psSvg.querySelector('#'+id); if (!el||!b) return; const v = b.value||0; el.style.opacity = 0.6 + v*0.4; if (b.pressed) el.classList.add('highlight'); else el.classList.remove('highlight');
  });

  // triggers: show pressed state on L1/R1
  const l1 = gp.buttons[4], r1 = gp.buttons[5]; ['ps-l1','ps-r1'].forEach((id, idx)=>{ const b = idx===0?l1:r1; const el = psSvg.querySelector('#'+id); if (!el) return; if (b && b.value>0.05) { el.classList.add('highlight'); } else el.classList.remove('highlight'); });

  // simple rumble demo
  if (gp.vibrationActuator && ((gp.buttons[6]?.value||0) > 0.9 || (gp.buttons[7]?.value||0) > 0.9)) {
    try { gp.vibrationActuator.playEffect('dual-rumble', {duration: 120, strongMagnitude: 0.6, weakMagnitude: 0.6}); } catch(e){}
  }
}

function showXboxHighlight(gp){
  xboxSvg.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));
  const map = { a:0, b:1, x:2, y:3, l1:4, r1:5, l2:6, r2:7, ls:10, rs:11, dUp:12, dDown:13, dLeft:14, dRight:15 };
  [['x-btn-a',map.a],['x-btn-b',map.b],['x-btn-x',map.x],['x-btn-y',map.y]].forEach(([id,idx])=>{ const b = gp.buttons[idx]; if (b && b.pressed) { const el = xboxSvg.querySelector('#'+id); if (el) el.classList.add('pressed'); } });
  [['x-dpad-up',map.dUp],['x-dpad-down',map.dDown],['x-dpad-left',map.dLeft],['x-dpad-right',map.dRight]].forEach(([id,idx])=>{ const el = xboxSvg.querySelector('#'+id); if (!el) return; if (gp.buttons[idx]?.pressed) el.classList.add('pressed'); else el.classList.remove('pressed'); });

  const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0, rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
  const s = stickState.x;
  s.lx = lerp(s.lx, lx, SMOOTHING); s.ly = lerp(s.ly, ly, SMOOTHING); s.rx = lerp(s.rx, rx, SMOOTHING); s.ry = lerp(s.ry, ry, SMOOTHING);
  const lsKnob = xboxSvg.querySelector('#x-ls-knob');
  const rsKnob = xboxSvg.querySelector('#x-rs-knob');
  if (lsKnob) lsKnob.style.transform = `translate(${s.lx*10}px, ${s.ly*10}px)`;
  if (rsKnob) rsKnob.style.transform = `translate(${s.rx*10}px, ${s.ry*10}px)`;

  ['x-btn-a','x-btn-b','x-btn-x','x-btn-y'].forEach((id,i)=>{
    const b = gp.buttons[i]; const el = xboxSvg.querySelector('#'+id); if (!el||!b) return; const v = b.value||0; el.style.opacity = 0.6 + v*0.4; if (b.pressed) el.classList.add('highlight'); else el.classList.remove('highlight');
  });
}

// Web Bluetooth battery read
async function requestBluetoothBattery(){
  if (!navigator.bluetooth) { alert('Web Bluetooth not supported in this browser.'); return; }
  try {
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['battery_service'] }] });
    const server = await device.gatt.connect();
    const batteryService = await server.getPrimaryService('battery_service');
    const batteryLevel = await batteryService.getCharacteristic('battery_level');
    const value = await batteryLevel.readValue();
    const percent = value.getUint8(0);
    diag.battery.textContent = percent + '% (via Bluetooth)';
  } catch (err) { console.error('Bluetooth error', err); alert('Could not read battery over Bluetooth: ' + (err.message||err)); }
}

// WebHID request
async function requestHID(){
  if (!navigator.hid) { alert('WebHID not supported in this browser.'); return; }
  try {
    const filters = [{ vendorId: 0x054C }, { vendorId: 0x045E }];
    const devices = await navigator.hid.requestDevice({ filters });
    if (devices.length === 0) return;
    const dev = devices[0]; await dev.open(); console.log('HID opened', dev);
    dev.addEventListener('inputreport', (ev) => {
      const { data, reportId } = ev; console.log('inputreport', reportId, new Uint8Array(data.buffer));
    });
    alert('HID device opened. Check console for reports.');
  } catch (err) { console.error('HID error', err); alert('Could not open HID: ' + (err.message||err)); }
}

// init
updateList();
startLoop();
