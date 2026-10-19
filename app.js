// Basic controller diagnostics and SVG highlights using Gamepad API + optional WebBluetooth & WebHID.
// Works on localhost or HTTPS. Best in Chrome/Edge.

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

window.addEventListener('gamepadconnected', (e) => {
  console.log('gamepadconnected', e.gamepad);
  startLoop();
});
window.addEventListener('gamepaddisconnected', (e) => {
  console.log('gamepaddisconnected', e.gamepad);
  if (activeGamepad && activeGamepad.index === e.gamepad.index) {
    activeGamepad = null;
  }
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
  if (!raf) {
    raf = requestAnimationFrame(loop);
  }
}

function loop(){
  updateList();
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  if (activeGamepad === null) {
    // auto-select first connected
    for (const gp of gps) {
      if (gp && gp.connected) { activeGamepad = gp; showControllerSVG(gp); break; }
    }
  }
  if (activeGamepad) {
    // update from latest gamepad index
    const gp = navigator.getGamepads()[activeGamepad.index];
    if (gp) {
      renderGamepad(gp);
      activeGamepad = gp; // refresh reference
    }
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

  // Visual highlight mapping
  if (isPSController(gp)) {
    showPSHighlight(gp);
  } else if (isXboxController(gp)) {
    showXboxHighlight(gp);
  } else {
    psSvg.style.display = 'none';
    xboxSvg.style.display = 'none';
  }
}

function isPSController(gp){
  const id = gp.id.toLowerCase();
  return id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense') || id.includes('sony');
}
function isXboxController(gp){
  const id = gp.id.toLowerCase();
  return id.includes('xbox') || id.includes('x-box') || id.includes('microsoft');
}

function showControllerSVG(gp){
  if (isPSController(gp)) {
    psSvg.style.display = 'block';
    xboxSvg.style.display = 'none';
  } else if (isXboxController(gp)) {
    xboxSvg.style.display = 'block';
    psSvg.style.display = 'none';
  } else {
    psSvg.style.display = 'none';
    xboxSvg.style.display = 'none';
  }
}

// PS mapping: Common standard mapping -> indices: 0:cross,1:circle,2:square,3:triangle in some controllers
function showPSHighlight(gp){
  // clear highlights
  psSvg.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
  // index mapping is device-dependent; try common mapping:
  const mapping = {
    cross: 0, circle: 1, square: 2, triangle: 3,
    ls: 10, rs: 11, dpadUp:12, dpadDown:13, dpadLeft:14, dpadRight:15
  };
  // highlight face buttons
  highlightSVG(psSvg, 'btn-cross', gp.buttons[mapping.cross]?.pressed);
  highlightSVG(psSvg, 'btn-circle', gp.buttons[mapping.circle]?.pressed);
  highlightSVG(psSvg, 'btn-square', gp.buttons[mapping.square]?.pressed);
  highlightSVG(psSvg, 'btn-triangle', gp.buttons[mapping.triangle]?.pressed);
  // dpad
  highlightSVG(psSvg, 'dpad-up', gp.buttons[mapping.dpadUp]?.pressed);
  highlightSVG(psSvg, 'dpad-down', gp.buttons[mapping.dpadDown]?.pressed);
  highlightSVG(psSvg, 'dpad-left', gp.buttons[mapping.dpadLeft]?.pressed);
  highlightSVG(psSvg, 'dpad-right', gp.buttons[mapping.dpadRight]?.pressed);
  // sticks show axis position by translation
  // left stick axes 0,1 ; right stick 2,3 (standard mapping)
  const lsEl = psSvg.getElementById ? psSvg.getElementById('ls') : psSvg.querySelector('#ls');
  const rsEl = psSvg.getElementById ? psSvg.getElementById('rs') : psSvg.querySelector('#rs');
  try {
    const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0;
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    if (lsEl) lsEl.setAttribute('transform', `translate(${lx*8}, ${ly*8})`);
    if (rsEl) rsEl.setAttribute('transform', `translate(${rx*8}, ${ry*8})`);
  } catch (e) { /* ignore */ }

  // simple rumble demo: if both triggers are pressed strongly, rumble
  if (gp.vibrationActuator && (gp.buttons[6]?.value > 0.9 || gp.buttons[7]?.value > 0.9)) {
    try {
      gp.vibrationActuator.playEffect('dual-rumble', {duration: 100, strongMagnitude: 0.6, weakMagnitude: 0.6});
    } catch(e){}
  }
}

function showXboxHighlight(gp){
  xboxSvg.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
  const mapping = { a:0, b:1, x:2, y:3, dUp:12, dDown:13, dLeft:14, dRight:15 };
  highlightSVG(xboxSvg, 'x-btn-a', gp.buttons[mapping.a]?.pressed);
  highlightSVG(xboxSvg, 'x-btn-b', gp.buttons[mapping.b]?.pressed);
  highlightSVG(xboxSvg, 'x-btn-x', gp.buttons[mapping.x]?.pressed);
  highlightSVG(xboxSvg, 'x-btn-y', gp.buttons[mapping.y]?.pressed);
  highlightSVG(xboxSvg, 'x-dpad-up', gp.buttons[mapping.dUp]?.pressed);
  highlightSVG(xboxSvg, 'x-dpad-down', gp.buttons[mapping.dDown]?.pressed);
  highlightSVG(xboxSvg, 'x-dpad-left', gp.buttons[mapping.dLeft]?.pressed);
  highlightSVG(xboxSvg, 'x-dpad-right', gp.buttons[mapping.dRight]?.pressed);
  // sticks
  const lsEl = xboxSvg.getElementById ? xboxSvg.getElementById('x-ls') : xboxSvg.querySelector('#x-ls');
  const rsEl = xboxSvg.getElementById ? xboxSvg.getElementById('x-rs') : xboxSvg.querySelector('#x-rs');
  try {
    const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0;
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    if (lsEl) lsEl.setAttribute('transform', `translate(${lx*8}, ${ly*8})`);
    if (rsEl) rsEl.setAttribute('transform', `translate(${rx*8}, ${ry*8})`);
  } catch(e){}
}

function highlightSVG(svgEl, selectorId, condition){
  try {
    const el = svgEl.querySelector('#' + selectorId);
    if (!el) return;
    if (condition) el.classList.add('highlight'); else el.classList.remove('highlight');
  } catch(e){}
}

// --- Optional: Web Bluetooth Battery read (requires controller to expose battery_service) ---
async function requestBluetoothBattery(){
  if (!navigator.bluetooth) {
    alert('Web Bluetooth not supported in this browser.');
    return;
  }
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['battery_service'] }]
      // some controllers don't advertise; you may need to select the device from the list or pair at OS level first
    });
    const server = await device.gatt.connect();
    const batteryService = await server.getPrimaryService('battery_service');
    const batteryLevel = await batteryService.getCharacteristic('battery_level');
    const value = await batteryLevel.readValue();
    const percent = value.getUint8(0);
    diag.battery.textContent = percent + '% (via Bluetooth)';
  } catch (err) {
    console.error('Bluetooth error', err);
    alert('Could not read battery over Bluetooth: ' + err.message);
  }
}

// --- Optional: WebHID request and inputreport handler (Chrome/Edge) ---
async function requestHID(){
  if (!navigator.hid) {
    alert('WebHID not supported in this browser.');
    return;
  }
  try {
    const filters = [
      { vendorId: 0x054C }, // Sony
      { vendorId: 0x045E }  // Microsoft
    ];
    const devices = await navigator.hid.requestDevice({ filters });
    if (devices.length === 0) return;
    const dev = devices[0];
    await dev.open();
    console.log('HID opened', dev);
    dev.addEventListener('inputreport', (ev) => {
      const { data, reportId } = ev;
      // Raw bytes from controller; parsing is device-specific.
      console.log('inputreport', reportId, new Uint8Array(data.buffer));
      // You can parse feature reports or vendor-specific reports here for advanced diagnostics.
    });
    alert('HID device opened. Check console for reports.');
  } catch (err) {
    console.error('HID error', err);
    alert('Could not open HID: ' + err.message);
  }
}

// Start by populating list and loop
updateList();
startLoop();
