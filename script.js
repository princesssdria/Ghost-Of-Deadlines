const STORAGE_KEY = 'ghost-of-my-deadlines.assignments.v1';
const GHOST_STATE_KEY = 'ghost-of-my-deadlines.ghost-tier.v1';

const form = document.getElementById('assignment-form');
const taskNameInput = document.getElementById('task-name');
const dueDateInput = document.getElementById('due-date');
const priorityInput = document.getElementById('priority');
const assignmentList = document.getElementById('assignment-list');
const emptyState = document.getElementById('empty-state');
const itemTemplate = document.getElementById('assignment-item-template');
const ghostElement = document.getElementById('ghost');
const ghostTitle = document.getElementById('ghost-title');
const ghostStatus = document.getElementById('ghost-status');

/** @type {{id: string, taskName: string, dueDate: string, priority: 'Low'|'Medium'|'High'}[]} */
let assignments = [];

function loadAssignments() {
  const saved = localStorage.getItem(STORAGE_KEY);
  assignments = saved ? JSON.parse(saved) : [];
}

function saveAssignments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

function saveGhostState(state) {
  localStorage.setItem(GHOST_STATE_KEY, JSON.stringify(state));
}

function parseDateAsLocalMidday(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return date;
}

function computeEffectiveDaysRemaining(assignment) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const due = parseDateAsLocalMidday(assignment.dueDate);
  const rawDiff = Math.floor((due - today) / (1000 * 60 * 60 * 24));
  const priorityPenalty = assignment.priority === 'High' ? 2 : 0;
  return rawDiff - priorityPenalty;
}

function getNearestThreatAssignment() {
  if (assignments.length === 0) {
    return null;
  }

  return assignments
    .map((assignment) => ({
      assignment,
      effectiveDays: computeEffectiveDaysRemaining(assignment),
    }))
    .sort((a, b) => a.effectiveDays - b.effectiveDays)[0];
}

function tierForDays(effectiveDays) {
  if (effectiveDays <= 1) {
    return 4;
  }
  if (effectiveDays >= 2 && effectiveDays <= 5) {
    return 3;
  }
  if (effectiveDays >= 6 && effectiveDays <= 10) {
    return 2;
  }
  return 1;
}

function renderGhost() {
  const threat = getNearestThreatAssignment();

  document.body.classList.remove('tier3-bg', 'tier4-chaos');

  if (!threat) {
    ghostElement.className = 'ghost tier1';
    ghostElement.setAttribute('aria-label', 'Friendly Wisp');
    ghostTitle.textContent = 'The Friendly Wisp';
    ghostStatus.textContent = 'No immediate threats detected.';
    saveGhostState({ tier: 1, nearestAssignmentId: null });
    return;
  }

  const tier = tierForDays(threat.effectiveDays);

  switch (tier) {
    case 1:
      ghostElement.className = 'ghost tier1';
      ghostElement.setAttribute('aria-label', 'Friendly Wisp');
      ghostTitle.textContent = 'The Friendly Wisp';
      ghostStatus.textContent = `${threat.assignment.taskName} is still over 10 days out.`;
      break;
    case 2:
      ghostElement.className = 'ghost tier2';
      ghostElement.setAttribute('aria-label', 'Playful Phantom');
      ghostTitle.textContent = 'The Playful Phantom';
      ghostStatus.textContent = `${threat.assignment.taskName} is coming up soon.`;
      break;
    case 3:
      ghostElement.className = 'ghost tier3';
      ghostElement.setAttribute('aria-label', 'Skeletal Rider');
      ghostTitle.textContent = 'The Skeletal Rider';
      ghostStatus.textContent = `${threat.assignment.taskName} is dangerously close.`;
      document.body.classList.add('tier3-bg');
      break;
    default:
      ghostElement.className = 'ghost tier4';
      ghostElement.setAttribute('aria-label', 'Poltergeist Entity');
      ghostTitle.textContent = 'The Poltergeist Entity';
      ghostStatus.textContent = `${threat.assignment.taskName} is due in <48h or overdue!`;
      document.body.classList.add('tier4-chaos');
      break;
  }

  saveGhostState({ tier, nearestAssignmentId: threat.assignment.id });
}

function renderAssignments() {
  assignmentList.innerHTML = '';

  assignments
    .slice()
    .sort((a, b) => parseDateAsLocalMidday(a.dueDate) - parseDateAsLocalMidday(b.dueDate))
    .forEach((assignment) => {
      const clone = itemTemplate.content.firstElementChild.cloneNode(true);
      clone.dataset.assignmentId = assignment.id;

      const daysRemaining = computeEffectiveDaysRemaining(assignment);

      clone.querySelector('.task-name').textContent = assignment.taskName;
      clone.querySelector('.task-due').textContent = `Due: ${assignment.dueDate} • Effective days left: ${daysRemaining}`;
      clone.querySelector('.task-priority').textContent = `Priority: ${assignment.priority}`;

      if (daysRemaining < 0) {
        clone.classList.add('overdue');
      }

      clone.querySelector('.exorcise-btn').addEventListener('click', () => {
        exorciseAssignment(assignment.id, clone);
      });

      assignmentList.appendChild(clone);
    });

  emptyState.hidden = assignments.length > 0;
}

function exorciseAssignment(id, listItem) {
  listItem.classList.add('fading');

  setTimeout(() => {
    assignments = assignments.filter((assignment) => assignment.id !== id);
    saveAssignments();
    renderAssignments();
    renderGhost();
  }, 700);
}

function addAssignment(event) {
  event.preventDefault();

  const taskName = taskNameInput.value.trim();
  const dueDate = dueDateInput.value;
  const priority = priorityInput.value;

  if (!taskName || !dueDate || !priority) {
    return;
  }

  assignments.push({
    id: crypto.randomUUID(),
    taskName,
    dueDate,
    priority,
  });

  saveAssignments();
  renderAssignments();
  renderGhost();

  form.reset();
}

function initialize() {
  loadAssignments();
  renderAssignments();
  renderGhost();

  form.addEventListener('submit', addAssignment);
}

initialize();
