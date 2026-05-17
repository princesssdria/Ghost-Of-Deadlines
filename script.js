const STORAGE_KEY = 'ghost-of-my-deadlines.state.v3-frankenstein';

const form = document.getElementById('assignment-form');
const app = document.getElementById('app');
const summonButton = document.getElementById('summon-btn');
const taskNameInput = document.getElementById('task-name');
const dueDateInput = document.getElementById('due-date');
const priorityInput = document.getElementById('priority');
const assignmentList = document.getElementById('assignment-list');
const emptyState = document.getElementById('empty-state');
const itemTemplate = document.getElementById('assignment-item-template');
const ghostElement = document.getElementById('ghost');
const ghostTitle = document.getElementById('ghost-title');
const ghostStatus = document.getElementById('ghost-status');
const doomClock = document.getElementById('doom-clock');
const curseMeterFill = document.getElementById('curse-meter-fill');
const curseMeterText = document.getElementById('curse-meter-text');
const ghostChat = document.getElementById('ghost-chat');
const graveyardList = document.getElementById('graveyard-list');
const graveItemTemplate = document.getElementById('grave-item-template');
const fogCanvas = document.getElementById('fog-overlay');
const muteToggle = document.getElementById('mute-toggle');
const muteLabel = document.getElementById('mute-label');

/** @type {{id: string, taskName: string, dueDate: string, priority: 'Low'|'Medium'|'High'}[]} */
let assignments = [];
/** @type {{id: string, taskName: string, completedAt: string}[]} */
let graveyard = [];

let timers = {
  doom: null,
  chat: null,
  chatHide: null,
};

let fogState = {
  particles: [],
  raf: null,
  running: true,
};

let audioState = {
  enabled: false,
  muted: false,
  context: null,
  masterGain: null,
  windNode: null,
};

const chatMessages = [
  'The rider is gaining...',
  'Tick tock, student.',
  'Your syllabus remembers everything.',
  'The moon is full of due dates.',
  'I smell a missed citation.',
  'Paper cuts are only the beginning.',
  'One more tab won\'t save you.',
  'The clock chews on procrastination.',
  'Even your planner is trembling.',
  'A whisper says: submit early.',
  'The phantom adores last-minute panic.',
  'I can hear your notifications crying.',
  'Two days vanish faster than sleep.',
  'The graveyard has room for one more.',
  'Deadlines never blink first.',
];

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    assignments = Array.isArray(parsed.assignments) ? parsed.assignments : [];
    graveyard = Array.isArray(parsed.graveyard) ? parsed.graveyard : [];
    audioState.muted = Boolean(parsed.muted);
  } catch {
    assignments = [];
    graveyard = [];
    audioState.muted = false;
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      assignments,
      graveyard,
      muted: audioState.muted,
      savedAt: new Date().toISOString(),
    }),
  );
}

function parseDateAsLocalMidday(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function computeEffectiveDaysRemaining(assignment) {
  const now = new Date();
  const due = parseDateAsLocalMidday(assignment.dueDate);
  const raw = Math.floor((due - now) / (1000 * 60 * 60 * 24));
  const priorityPenalty = assignment.priority === 'High' ? 2 : 0;
  return raw - priorityPenalty;
}

function getNearestThreatAssignment() {
  if (!assignments.length) return null;

  return assignments
    .map((assignment) => ({
      assignment,
      effectiveDays: computeEffectiveDaysRemaining(assignment),
    }))
    .sort((a, b) => a.effectiveDays - b.effectiveDays)[0];
}

function tierForDays(effectiveDays) {
  if (effectiveDays <= 1) return 4;
  if (effectiveDays <= 5) return 3;
  if (effectiveDays <= 10) return 2;
  return 1;
}

function formatRemainingTime(dueDate) {
  const target = parseDateAsLocalMidday(dueDate);
  const ms = target - new Date();

  if (ms <= 0) return 'OVERDUE';

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

function renderDoomClock() {
  const threat = getNearestThreatAssignment();
  if (!threat) {
    doomClock.textContent = '--d --h --m';
    return;
  }
  doomClock.textContent = formatRemainingTime(threat.assignment.dueDate);
}

function renderCurseMeter() {
  const highCount = assignments.filter((task) => task.priority === 'High').length;
  const ratio = assignments.length ? highCount / assignments.length : 0;
  const percent = Math.min(100, Math.round(ratio * 100));
  curseMeterFill.style.width = `${percent}%`;
  curseMeterText.textContent = `${highCount} high-priority task${highCount === 1 ? '' : 's'}`;

  curseMeterFill.classList.toggle('maxed', percent >= 100 && assignments.length > 0);
}

function renderGhost() {
  const threat = getNearestThreatAssignment();

  document.body.classList.remove('tier3-bg', 'tier4-chaos');

  if (!threat) {
    ghostElement.className = 'ghost tier1';
    ghostElement.setAttribute('aria-label', 'Friendly Wisp');
    ghostTitle.textContent = 'The Friendly Wisp';
    ghostStatus.textContent = 'No immediate threats detected.';
    return;
  }

  const tier = tierForDays(threat.effectiveDays);

  if (tier === 1) {
    ghostElement.className = 'ghost tier1';
    ghostElement.setAttribute('aria-label', 'Friendly Wisp');
    ghostTitle.textContent = 'The Friendly Wisp';
    ghostStatus.textContent = `${threat.assignment.taskName} is still over 10 days out.`;
    return;
  }

  if (tier === 2) {
    ghostElement.className = 'ghost tier2';
    ghostElement.setAttribute('aria-label', 'Playful Phantom');
    ghostTitle.textContent = 'The Playful Phantom';
    ghostStatus.textContent = `${threat.assignment.taskName} is coming up soon.`;
    return;
  }

  if (tier === 3) {
    ghostElement.className = 'ghost tier3';
    ghostElement.setAttribute('aria-label', 'Skeletal Rider');
    ghostTitle.textContent = 'The Skeletal Rider';
    ghostStatus.textContent = `${threat.assignment.taskName} is dangerously close.`;
    document.body.classList.add('tier3-bg');
    return;
  }

  ghostElement.className = 'ghost tier4';
  ghostElement.setAttribute('aria-label', 'Poltergeist Entity');
  ghostTitle.textContent = 'The Poltergeist Entity';
  ghostStatus.textContent = `${threat.assignment.taskName} is due in <48h or overdue!`;
  document.body.classList.add('tier4-chaos');
}

function renderAssignments() {
  assignmentList.innerHTML = '';

  assignments
    .slice()
    .sort((a, b) => parseDateAsLocalMidday(a.dueDate) - parseDateAsLocalMidday(b.dueDate))
    .forEach((assignment) => {
      const item = itemTemplate.content.firstElementChild.cloneNode(true);
      const effectiveDays = computeEffectiveDaysRemaining(assignment);

      item.querySelector('.task-name').textContent = assignment.taskName;
      item.querySelector('.task-due').textContent = `Due: ${assignment.dueDate} • Effective days left: ${effectiveDays}`;
      item.querySelector('.task-priority').textContent = `Priority: ${assignment.priority}`;

      if (effectiveDays < 0) item.classList.add('overdue');

      item.querySelector('.exorcise-btn').addEventListener('click', () => {
        exorciseAssignment(assignment.id, item);
      });

      assignmentList.appendChild(item);
    });

  emptyState.hidden = assignments.length > 0;
}

function renderGraveyard() {
  graveyardList.innerHTML = '';

  graveyard.forEach((entry) => {
    const node = graveItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.epitaph').textContent = entry.taskName;
    node.setAttribute('title', `Epitaph: ${entry.taskName}`);
    graveyardList.appendChild(node);
  });
}

function refreshDerivedUI() {
  renderAssignments();
  renderGhost();
  renderCurseMeter();
  renderDoomClock();
  renderGraveyard();
  retuneFogParticleTarget();
}

function ensureFogLayering() {
  fogCanvas.style.zIndex = '1';
  if (app) {
    app.style.zIndex = '2';
  }
}

function exorciseAssignment(id, listItem) {
  listItem.classList.add('fading');

  setTimeout(() => {
    const index = assignments.findIndex((assignment) => assignment.id === id);
    if (index === -1) return;

    const [completed] = assignments.splice(index, 1);
    graveyard.push({
      id: completed.id,
      taskName: completed.taskName,
      completedAt: new Date().toISOString(),
    });

    saveState();
    refreshDerivedUI();
    playCreak();
  }, 700);
}

function addAssignment(event) {
  event.preventDefault();

  const taskName = taskNameInput.value.trim();
  const dueDate = dueDateInput.value;
  const priority = priorityInput.value;

  if (!taskName || !dueDate || !priority) return;

  assignments.push({
    id: crypto.randomUUID(),
    taskName,
    dueDate,
    priority,
  });

  saveState();
  refreshDerivedUI();
  form.reset();
}

function pickChatMessage() {
  return chatMessages[Math.floor(Math.random() * chatMessages.length)];
}

function showGhostChat() {
  ghostChat.textContent = pickChatMessage();
  ghostChat.classList.add('show');

  clearTimeout(timers.chatHide);
  timers.chatHide = window.setTimeout(() => {
    ghostChat.classList.remove('show');
  }, 5000);
}

function startChatLoop() {
  clearInterval(timers.chat);
  showGhostChat();
  timers.chat = window.setInterval(showGhostChat, 30000);
}

function stopChatLoop() {
  clearInterval(timers.chat);
  clearTimeout(timers.chatHide);
  ghostChat.classList.remove('show');
}

function resizeFogCanvas() {
  fogCanvas.width = window.innerWidth;
  fogCanvas.height = window.innerHeight;
}

function createFogParticle() {
  return {
    x: Math.random() * fogCanvas.width,
    y: Math.random() * fogCanvas.height,
    radius: 50 + Math.random() * 120,
    alpha: 0.025 + Math.random() * 0.06,
    vx: -0.12 + Math.random() * 0.24,
    vy: -0.05 + Math.random() * 0.1,
  };
}

function targetParticleCount() {
  return Math.min(120, 16 + assignments.length * 6);
}

function retuneFogParticleTarget() {
  const target = targetParticleCount();

  while (fogState.particles.length < target) {
    fogState.particles.push(createFogParticle());
  }
  while (fogState.particles.length > target) {
    fogState.particles.pop();
  }
}

function animateFog() {
  if (!fogState.running) return;

  const ctx = fogCanvas.getContext('2d');
  ctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);

  fogState.particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < -p.radius) p.x = fogCanvas.width + p.radius;
    if (p.x > fogCanvas.width + p.radius) p.x = -p.radius;
    if (p.y < -p.radius) p.y = fogCanvas.height + p.radius;
    if (p.y > fogCanvas.height + p.radius) p.y = -p.radius;

    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
    gradient.addColorStop(0, `rgba(190, 210, 235, ${p.alpha})`);
    gradient.addColorStop(1, 'rgba(170, 190, 220, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  fogState.raf = window.requestAnimationFrame(animateFog);
}

function startFog() {
  resizeFogCanvas();
  retuneFogParticleTarget();
  fogState.running = true;
  if (!fogState.raf) {
    fogState.raf = window.requestAnimationFrame(animateFog);
  }
}

function stopFog() {
  fogState.running = false;
  if (fogState.raf) {
    window.cancelAnimationFrame(fogState.raf);
    fogState.raf = null;
  }
}

function setupAudio() {
  if (audioState.context) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const masterGain = context.createGain();
  masterGain.gain.value = audioState.muted ? 0 : 0.06;
  masterGain.connect(context.destination);

  // Low wind loop: filtered noise.
  const bufferSize = 2 * context.sampleRate;
  const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const noiseNode = context.createBufferSource();
  noiseNode.buffer = noiseBuffer;
  noiseNode.loop = true;

  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 260;

  const windGain = context.createGain();
  windGain.gain.value = 0.25;

  noiseNode.connect(lowpass);
  lowpass.connect(windGain);
  windGain.connect(masterGain);
  noiseNode.start();

  audioState.context = context;
  audioState.masterGain = masterGain;
  audioState.windNode = noiseNode;
  audioState.enabled = true;
}

function playCreak() {
  if (!audioState.enabled || !audioState.context || audioState.muted) return;

  const ctx = audioState.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.45);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);

  osc.connect(gain);
  gain.connect(audioState.masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.56);
}

async function enableAudioFromUserGesture() {
  setupAudio();
  if (!audioState.context) return;
  if (audioState.context.state === 'suspended') {
    await audioState.context.resume();
  }
}

function applyMuteState() {
  muteToggle.setAttribute('aria-pressed', String(audioState.muted));
  muteLabel.textContent = audioState.muted ? 'Unmute' : 'Mute';
  if (audioState.masterGain) {
    audioState.masterGain.gain.value = audioState.muted ? 0 : 0.06;
  }
}

function startDoomClockLoop() {
  clearInterval(timers.doom);
  renderDoomClock();
  timers.doom = window.setInterval(renderDoomClock, 1000);
}

function stopDoomClockLoop() {
  clearInterval(timers.doom);
}

function onVisibilityChange() {
  if (document.hidden) {
    stopFog();
    stopChatLoop();
    stopDoomClockLoop();
  } else {
    startFog();
    startChatLoop();
    startDoomClockLoop();
  }
}

function teardown() {
  stopFog();
  stopChatLoop();
  stopDoomClockLoop();
}

function initialize() {
  loadState();
  ensureFogLayering();
  refreshDerivedUI();
  startFog();
  startChatLoop();
  startDoomClockLoop();
  applyMuteState();

  form.addEventListener('submit', addAssignment);
  summonButton.addEventListener('click', enableAudioFromUserGesture, { once: true });

  muteToggle.addEventListener('click', () => {
    audioState.muted = !audioState.muted;
    applyMuteState();
    saveState();
  });

  window.addEventListener('resize', resizeFogCanvas);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', teardown);
}

initialize();
