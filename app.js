// Enhanced controller visualization + DualSense/Xbox HID parsing for battery/IMU/trigger telemetry
// Branch: gh-pages-visualizer

const gpListEl = document.getElementById('gamepad-list');
const diag = {
  connected: document.getElementById('diag-connected'),
  id: document.getElementById('diag-id'),
  index: document.getElementById('diag-index'),
  mapping: document.getElementById('diag-mapping'),
  timestamp: document.getElementById('diag-timestamp'),
  battery: document.getElementById('diag-battery'),
  rumble: document.getElementById('diag-rumble'),
  triggers: document.getElementById('diag-triggers'),
  gyro: document.getElementById('diag-gyro'),
  accel: document.getElementById('diag-accel'),
  hidNotes: document.getElementById('diag-hid-notes')
};
const axesEl = document.getElementById('axes');
const buttonsEl = document.getElementById('buttons');

const psSvg = document.getElementById('ps-svg');
const xboxSvg = document.getElementById('xbox-svg');

let activeGamepad = null;
let raf = null;

// smoothing state for sticks
const stickState = { ps: { lx:0, ly:0, rx:0, ry:0 }, x: { lx:0, ly:0, rx:0, ry:0 } };
const SMOOTHING = 0.18; // light smoothing

// Keep track of last parsed HID telemetry
const hidTelemetry = { vendor: null, product: null, battery: null, triggers: null, gyro: null, accel: null };

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

function startLoop(){ if (!raf) raf = requestAnimationFrame(loop); }
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
    // no active controller: dim both
    psSvg.classList.add('inactive'); xboxSvg.classList.add('inactive');
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

  // display latest HID telemetry if available
  if (hidTelemetry.battery !== null) diag.battery.textContent = hidTelemetry.battery + '% (HID)';
  if (hidTelemetry.triggers) diag.triggers.textContent = `${hidTelemetry.triggers.l2.toFixed(2)} / ${hidTelemetry.triggers.r2.toFixed(2)}`;
  if (hidTelemetry.gyro) diag.gyro.textContent = `gx:${hidTelemetry.gyro.x.toFixed(2)}, gy:${hidTelemetry.gyro.y.toFixed(2)}, gz:${hidTelemetry.gyro.z.toFixed(2)}`;
  if (hidTelemetry.accel) diag.accel.textContent = `ax:${hidTelemetry.accel.x.toFixed(2)}, ay:${hidTelemetry.accel.y.toFixed(2)}, az:${hidTelemetry.accel.z.toFixed(2)}`;

  if (isPSController(gp)) showPSHighlight(gp);
  else if (isXboxController(gp)) showXboxHighlight(gp);
  else { psSvg.classList.remove('inactive'); xboxSvg.classList.remove('inactive'); }
}

function isPSController(gp){ const id = (gp.id||'').toLowerCase(); return id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense') || id.includes('sony'); }
function isXboxController(gp){ const id = (gp.id||'').toLowerCase(); return id.includes('xbox') || id.includes('x-box') || id.includes('microsoft'); }

function showControllerSVG(gp){ psSvg.classList.remove('inactive'); xboxSvg.classList.remove('inactive'); if (isPSController(gp)) { psSvg.classList.remove('inactive'); xboxSvg.classList.add('inactive'); } else if (isXboxController(gp)) { xboxSvg.classList.remove('inactive'); psSvg.classList.add('inactive'); } }

// helper to lerp
function lerp(a,b,t){ return a + (b-a)*t; }

function showPSHighlight(gp){
  psSvg.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));
  const map = { cross:0, circle:1, square:2, triangle:3, l1:4, r1:5, l2:6, r2:7, ls:10, rs:11, dUp:12, dDown:13, dLeft:14, dRight:15 };
  [['ps-btn-cross',map.cross],['ps-btn-circle',map.circle],['ps-btn-square',map.square],['ps-btn-triangle',map.triangle]].forEach(([id,idx])=>{ const b = gp.buttons[idx]; if (b && b.pressed) { const el = psSvg.querySelector('#'+id); if (el) el.classList.add('pressed'); } });
  [['ps-dpad-up',map.dUp],['ps-dpad-down',map.dDown],['ps-dpad-left',map.dLeft],['ps-dpad-right',map.dRight]].forEach(([id,idx])=>{ const el = psSvg.querySelector('#'+id); if (!el) return; if (gp.buttons[idx]?.pressed) el.classList.add('pressed'); else el.classList.remove('pressed'); });

  const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0, rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
  const s = stickState.ps;
  s.lx = lerp(s.lx, lx, SMOOTHING); s.ly = lerp(s.ly, ly, SMOOTHING); s.rx = lerp(s.rx, rx, SMOOTHING); s.ry = lerp(s.ry, ry, SMOOTHING);
  const lsKnob = psSvg.querySelector('#ps-ls-knob');
  const rsKnob = psSvg.querySelector('#ps-rs-knob');
  if (lsKnob) lsKnob.style.transform = `translate(${s.lx*12}px, ${s.ly*12}px)`;
  if (rsKnob) rsKnob.style.transform = `translate(${s.rx*12}px, ${s.ry*12}px)`;

  ['ps-btn-cross','ps-btn-circle','ps-btn-square','ps-btn-triangle'].forEach((id,i)=>{
    const b = gp.buttons[i]; const el = psSvg.querySelector('#'+id); if (!el||!b) return; const v = b.value||0; el.style.opacity = 0.58 + v*0.5; if (b.pressed) el.classList.add('highlight'); else el.classList.remove('highlight');
  });
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
  if (lsKnob) lsKnob.style.transform = `translate(${s.lx*12}px, ${s.ly*12}px)`;
  if (rsKnob) rsKnob.style.transform = `translate(${s.rx*12}px, ${s.ry*12}px)`;

  ['x-btn-a','x-btn-b','x-btn-x','x-btn-y'].forEach((id,i)=>{
    const b = gp.buttons[i]; const el = xboxSvg.querySelector('#'+id); if (!el||!b) return; const v = b.value||0; el.style.opacity = 0.58 + v*0.5; if (b.pressed) el.classList.add('highlight'); else el.classList.remove('highlight');
  });
}

// --- Web Bluetooth battery read (unchanged) ---
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

// --- WebHID with DualSense/Xbox specialized parsing ---
async function requestHID(){
  if (!navigator.hid) { alert('WebHID not supported in this browser.'); return; }
  try {
    const filters = [{ vendorId: 0x054C }, { vendorId: 0x045E }];
    const devices = await navigator.hid.requestDevice({ filters });
    if (devices.length === 0) return;
    const dev = devices[0];
    await dev.open();
    console.log('HID opened', dev);
    hidTelemetry.vendor = dev.vendorId; hidTelemetry.product = dev.productId;
    diag.hidNotes.textContent = `Opened HID device vendor=0x${dev.vendorId.toString(16)} product=0x${dev.productId.toString(16)}`;

    dev.addEventListener('inputreport', (ev) => {
      const { data, reportId } = ev;
      const bytes = new Uint8Array(data.buffer);
      // parse based on vendor
      try {
        if (dev.vendorId === 0x054C) { // Sony - DualShock / DualSense
          const parsed = parseDualSense(bytes, reportId);
          if (parsed) applyHIDTelemetry(parsed);
        } else if (dev.vendorId === 0x045E) { // Microsoft - Xbox
          const parsed = parseXbox(bytes, reportId);
          if (parsed) applyHIDTelemetry(parsed);
        } else {
          console.log('HID inputreport (unknown vendor)', dev.vendorId, reportId, bytes);
          diag.hidNotes.textContent = `Raw HID report id=${reportId} len=${bytes.length}`;
        }
      } catch (e) {
        console.error('Error parsing HID report', e);
      }
    });

    alert('HID device opened. Check console for parsed telemetry.');
  } catch (err) { console.error('HID error', err); alert('Could not open HID: ' + (err.message||err)); }
}

function applyHIDTelemetry(parsed){
  if (!parsed) return;
  if (parsed.battery != null) { hidTelemetry.battery = parsed.battery; diag.battery.textContent = `${parsed.battery}% (HID)`; }
  if (parsed.triggers) { hidTelemetry.triggers = parsed.triggers; diag.triggers.textContent = `${(parsed.triggers.l2||0).toFixed(2)} / ${(parsed.triggers.r2||0).toFixed(2)}`; }
  if (parsed.gyro) { hidTelemetry.gyro = parsed.gyro; diag.gyro.textContent = `gx:${parsed.gyro.x.toFixed(2)} gy:${parsed.gyro.y.toFixed(2)} gz:${parsed.gyro.z.toFixed(2)}`; }
  if (parsed.accel) { hidTelemetry.accel = parsed.accel; diag.accel.textContent = `ax:${parsed.accel.x.toFixed(2)} ay:${parsed.accel.y.toFixed(2)} az:${parsed.accel.z.toFixed(2)}`; }
  diag.hidNotes.textContent = `Parsed HID: ${parsed.source || 'unknown'}`;
}

// Heuristic and known-structure parsers
function parseDualSense(bytes, reportId){
  // DualSense/DS4 USB input reports vary by firmware. We'll attempt best-effort parsing.
  // Common: analog triggers and buttons early in the report; battery sometimes near the end.
  const out = { source: 'dualsense' };
  // search for a plausible battery byte (0-100) near the tail
  for (let i = Math.max(0, bytes.length-40); i < bytes.length; i++){
    const v = bytes[i]; if (v >= 0 && v <= 100) { out.battery = v; break; }
  }

  // triggers: look for bytes in 0..255 that change frequently — many DS reports include L2/R2 as bytes 8/9 or 4/5
  const triggerCandidates = [];
  [4,5,6,7,8,9,10,11].forEach(i=>{ if (i < bytes.length) triggerCandidates.push({i, v: bytes[i]}); });
  // pick two candidate bytes with large values (>0) as L2,R2
  const nonzero = triggerCandidates.filter(c=>c.v>0).slice(0,2);
  if (nonzero.length>=2) {
    out.triggers = { l2: nonzero[0].v/255, r2: nonzero[1].v/255 };
  } else if (triggerCandidates.length>=2) {
    out.triggers = { l2: triggerCandidates[0].v/255, r2: triggerCandidates[1].v/255 };
  }

  // IMU: attempt to find sequences of 6 or 12 bytes representing int16 pairs -> gyro/accel
  const int16s = new Int16Array(bytes.buffer);
  if (int16s.length >= 6){
    // heuristically treat first 3 as gyro and next 3 as accel if values look plausible
    const gx = int16s[0], gy = int16s[1], gz = int16s[2];
    const ax = int16s[3], ay = int16s[4], az = int16s[5];
    // check plausibility
    if (Math.abs(gx) < 5000 && Math.abs(gy) < 5000 && Math.abs(gz) < 5000){
      out.gyro = { x: gx/16384, y: gy/16384, z: gz/16384 };
    }
    if (Math.abs(ax) < 50000 && Math.abs(ay) < 50000 && Math.abs(az) < 50000){
      out.accel = { x: ax/8192, y: ay/8192, z: az/8192 };
    }
  }
  return out;
}

function parseXbox(bytes, reportId){
  const out = { source: 'xbox' };
  // Xbox controllers often place analog triggers (0-255) and battery info in predictable spots for certain models.
  // attempt common layouts: report lengths 20..80
  if (bytes.length >= 8){
    // common: axes/triggers near bytes 2..5
    const l2 = bytes[2] / 255; const r2 = bytes[3] / 255; out.triggers = { l2, r2 };
  }
  // battery: search for 0..100 byte near tail
  for (let i = Math.max(0, bytes.length-32); i < bytes.length; i++){
    const v = bytes[i]; if (v >= 0 && v <= 100) { out.battery = v; break; }
  }

  // IMU: Xbox controllers rarely expose IMU over standard HID; still attempt heuristic parse
  const int16s = new Int16Array(bytes.buffer);
  if (int16s.length >= 6){
    const gx = int16s[0], gy = int16s[1], gz = int16s[2];
    const ax = int16s[3], ay = int16s[4], az = int16s[5];
    if (Math.abs(gx) < 5000) out.gyro = { x: gx/16384, y: gy/16384, z: gz/16384 };
    if (Math.abs(ax) < 50000) out.accel = { x: ax/8192, y: ay/8192, z: az/8192 };
  }
  return out;
}

// init
updateList(); startLoop();
