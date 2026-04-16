/* ============================================================
   banana/splitt — frontend application
   ============================================================ */
'use strict';

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Unknown error');
  return json;
}

const get  = (path)        => api('GET',    path);
const post = (path, body)  => api('POST',   path, body);
const put  = (path, body)  => api('PUT',    path, body);
const del  = (path)        => api('DELETE', path);

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------

function toast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast${type !== 'default' ? ' ' + type : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const overlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');

function openModal(html) {
  modalContent.innerHTML = html;
  overlay.classList.remove('hidden');
  const first = modalContent.querySelector('input, select, textarea');
  if (first) first.focus();
}

function closeModal() {
  overlay.classList.add('hidden');
  modalContent.innerHTML = '';
}

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ---------------------------------------------------------------------------
// Router (hash-based)
// ---------------------------------------------------------------------------

let currentTripId = null;

function navigate(hash) {
  location.hash = hash;
}

window.addEventListener('hashchange', render);
window.addEventListener('load', render);

function render() {
  const hash = location.hash.replace('#', '');
  if (hash.startsWith('trip/')) {
    const id = hash.replace('trip/', '');
    currentTripId = id;
    renderTripDetail(id);
  } else {
    currentTripId = null;
    renderHome();
  }
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function setBreadcrumb(items) {
  const el = document.getElementById('breadcrumb');
  el.innerHTML = items
    .map((item, i) =>
      i < items.length - 1
        ? `<a href="${item.href}">${item.label}</a><span>/</span>`
        : `<span>${item.label}</span>`
    )
    .join('');
}

// Logo click → home
document.getElementById('logo-home').addEventListener('click', () => navigate(''));

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function cloneTemplate(id) {
  return document.importNode(document.getElementById(id).content, true);
}

function fmt(amount, currency) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

function findDuplicate(candidate, expenses, opts = {}) {
  const { excludeId = null } = opts;
  const amount = Number(candidate?.amount);
  const date = candidate?.date || '';
  const descLower = (candidate?.description || '').trim().toLowerCase();
  if (!descLower || !Number.isFinite(amount) || amount <= 0 || !date) return null;

  return expenses.find((e) => {
    if (excludeId !== null && e.id === excludeId) return false;
    const existingAmount = Number(e.amount);
    const existingDesc = (e.description || '').toLowerCase();
    if (!Number.isFinite(existingAmount) || existingAmount <= 0 || !existingDesc) return false;
    return (
      Math.abs(existingAmount - amount) / Math.max(existingAmount, amount) < 0.05 &&
      e.date === date &&
      (existingDesc.includes(descLower) || descLower.includes(existingDesc))
    );
  }) || null;
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Avatar colour palette (deterministic from name)
const PALETTE = [
  ['#FEF3C7','#78350f'], ['#D1FAE5','#065f46'], ['#DBEAFE','#1e3a8a'],
  ['#FCE7F3','#831843'], ['#EDE9FE','#4c1d95'], ['#FEE2E2','#7f1d1d'],
];
function avatarStyle(name) {
  const idx = (name.charCodeAt(0) || 0) % PALETTE.length;
  const [bg, color] = PALETTE[idx];
  return `background:${bg};color:${color}`;
}

// ---------------------------------------------------------------------------
// Expense categorizer
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: 'Food & Drink',  icon: '🍽️', color: '#F97316', keywords: ['dinner','lunch','breakfast','restaurant','cafe','coffee','bar','beer','wine','groceries','food','pizza','sushi','burger','snack','drink','brunch','bakery','meal','drinks','takeaway','takeout'] },
  { name: 'Transport',     icon: '🚗', color: '#3B82F6', keywords: ['taxi','uber','lyft','bus','train','metro','flight','gas','parking','car','fuel','subway','tram','ferry','bike','scooter','transport','transit','toll','rental','airport'] },
  { name: 'Accommodation', icon: '🏨', color: '#8B5CF6', keywords: ['hotel','hostel','airbnb','accommodation','motel','resort','apartment','lodge','inn','stay','room','villa'] },
  { name: 'Activities',    icon: '🎯', color: '#10B981', keywords: ['tour','ticket','museum','concert','show','activity','sport','game','park','attraction','event','festival','class','lesson','excursion','entrance','adventure','theatre','theater','cinema','movie'] },
  { name: 'Shopping',      icon: '🛍️', color: '#EC4899', keywords: ['shopping','shop','store','market','mall','souvenir','clothes','clothing','gift','buy','purchase','supermarket'] },
  { name: 'Other',         icon: '📦', color: '#9CA3AF', keywords: [] },
];

function categorize(description) {
  const lower = (description || '').toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) return cat.name;
  }
  return 'Other';
}

function categoryIcon(name) {
  return CATEGORIES.find((c) => c.name === name)?.icon || '📦';
}

function categoryColor(name) {
  return CATEGORIES.find((c) => c.name === name)?.color || '#9CA3AF';
}

// ---------------------------------------------------------------------------
// HOME PAGE
// ---------------------------------------------------------------------------

async function renderHome() {
  setBreadcrumb([{ label: 'Trips', href: '#' }]);
  const tpl = cloneTemplate('tpl-home');
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  main.appendChild(tpl);

  document.getElementById('btn-new-trip').addEventListener('click', showNewTripModal);

  try {
    const trips = await get('/trips');
    const grid = document.getElementById('trips-grid');
    const empty = document.getElementById('trips-empty');

    if (trips.length === 0) {
      empty.classList.remove('hidden');
      document.getElementById('btn-new-trip-empty').addEventListener('click', showNewTripModal);
    } else {
      for (const trip of trips) {
        const card = renderTripCard(trip);
        grid.appendChild(card);
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderTripCard(trip) {
  const frag = cloneTemplate('tpl-trip-card');
  const card = frag.querySelector('.trip-card');
  card.dataset.tripId = trip.id;
  card.querySelector('.trip-card-name').textContent = trip.name;
  card.querySelector('.trip-card-desc').textContent = trip.description || '\u00a0';
  card.querySelector('.members-count').textContent  = trip.participantCount;
  card.querySelector('.expenses-count').textContent = trip.expenseCount;
  card.querySelector('.total-amount').textContent   = fmt(trip.totalAmount || 0, trip.currency);
  card.querySelector('.total-label').textContent    = trip.currency || 'total';

  card.querySelector('.open-trip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    navigate(`trip/${trip.id}`);
  });
  card.addEventListener('click', () => navigate(`trip/${trip.id}`));

  card.querySelector('.delete-trip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    confirmDeleteTrip(trip);
  });

  return frag;
}

function showNewTripModal() {
  openModal(`
    <h2 class="modal-title">New Trip</h2>
    <form id="new-trip-form">
      <div class="form-group">
        <label for="trip-name">Trip Name *</label>
        <input id="trip-name" type="text" placeholder="e.g. Paris Summer 2024" required maxlength="80" />
      </div>
      <div class="form-group">
        <label for="trip-desc">Description</label>
        <input id="trip-desc" type="text" placeholder="Optional description" maxlength="160" />
      </div>
      <div class="form-group">
        <label for="trip-currency">Currency</label>
        <select id="trip-currency">
          ${CURRENCIES.map((c) => `<option value="${c.code}">${c.code} — ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="trip-start-date">Start Date</label>
          <input id="trip-start-date" type="date" />
        </div>
        <div class="form-group">
          <label for="trip-end-date">End Date</label>
          <input id="trip-end-date" type="date" />
        </div>
      </div>
      <div class="form-group">
        <label for="trip-budget">Budget (optional)</label>
        <input id="trip-budget" type="number" step="0.01" min="0.01" placeholder="e.g. 2500.00" />
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Trip</button>
      </div>
    </form>
  `);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('new-trip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name      = document.getElementById('trip-name').value.trim();
    const desc      = document.getElementById('trip-desc').value.trim();
    const currency  = document.getElementById('trip-currency').value;
    const startDate = document.getElementById('trip-start-date').value || null;
    const endDate   = document.getElementById('trip-end-date').value || null;
    const budgetVal = document.getElementById('trip-budget').value;
    const parsedBudget = parseFloat(budgetVal);
    const budget    = Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : null;
    try {
      await post('/trips', { name, description: desc, currency, startDate, endDate, budget });
      closeModal();
      toast('Trip created! 🎉', 'success');
      renderHome();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function confirmDeleteTrip(trip) {
  openModal(`
    <h2 class="modal-title">Delete Trip?</h2>
    <p>Are you sure you want to delete <strong>${escHtml(trip.name)}</strong>?
    This will permanently remove all expenses and data for this trip.</p>
    <div class="form-actions" style="margin-top:1rem">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
    </div>
  `);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    try {
      await del(`/trips/${trip.id}`);
      closeModal();
      toast('Trip deleted', 'default');
      renderHome();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function showTripSettingsModal(trip, onSuccess) {
  openModal(`
    <h2 class="modal-title">Trip Settings</h2>
    <form id="trip-settings-form">
      <div class="form-group">
        <label for="settings-name">Trip Name *</label>
        <input id="settings-name" type="text" value="${escAttr(trip.name)}" required maxlength="80" />
      </div>
      <div class="form-group">
        <label for="settings-desc">Description</label>
        <input id="settings-desc" type="text" value="${escAttr(trip.description || '')}" maxlength="160" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="settings-start-date">Start Date</label>
          <input id="settings-start-date" type="date" value="${escAttr(trip.startDate || '')}" />
        </div>
        <div class="form-group">
          <label for="settings-end-date">End Date</label>
          <input id="settings-end-date" type="date" value="${escAttr(trip.endDate || '')}" />
        </div>
      </div>
      <div class="form-group">
        <label for="settings-budget">Budget (${escHtml(trip.currency)})</label>
        <input id="settings-budget" type="number" step="0.01" min="0.01"
          value="${trip.budget ? trip.budget : ''}" placeholder="e.g. 2500.00" />
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </div>
    </form>
  `);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('trip-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name      = document.getElementById('settings-name').value.trim();
    const desc      = document.getElementById('settings-desc').value.trim();
    const startDate = document.getElementById('settings-start-date').value || null;
    const endDate   = document.getElementById('settings-end-date').value || null;
    const budgetVal    = document.getElementById('settings-budget').value;
    const parsedBudget = parseFloat(budgetVal);
    const budget       = Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : null;
    try {
      await put(`/trips/${trip.id}`, { name, description: desc, startDate, endDate, budget });
      closeModal();
      toast('Settings saved ✅', 'success');
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// TRIP DETAIL PAGE
// ---------------------------------------------------------------------------

let tripCache = null; // cached trip data for the active trip detail view

async function renderTripDetail(tripId) {
  const tpl = cloneTemplate('tpl-trip-detail');
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  main.appendChild(tpl);

  try {
    const trip = await get(`/trips/${tripId}`);
    tripCache = trip;
    setBreadcrumb([
      { label: 'Trips', href: '#' },
      { label: trip.name, href: `#trip/${trip.id}` },
    ]);

    main.querySelector('.trip-title').textContent = trip.name;
    main.querySelector('.trip-subtitle').textContent =
      [trip.description, trip.currency].filter(Boolean).join(' · ');

    // Tabs
    main.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Add expense button
    main.querySelector('#btn-add-expense').addEventListener('click', () =>
      showAddExpenseModal(trip, () => renderTripDetail(tripId))
    );

    // Trip settings button
    main.querySelector('#btn-trip-settings').addEventListener('click', () =>
      showTripSettingsModal(trip, () => renderTripDetail(tripId))
    );

    // Add member button
    main.querySelector('#btn-add-member').addEventListener('click', () =>
      showAddMemberModal(trip, () => renderTripDetail(tripId))
    );

    // Share balances button
    main.querySelector('#btn-share-balances').addEventListener('click', () =>
      shareBalancesSummary(tripId, trip)
    );

    // Generate summary button
    main.querySelector('#btn-generate-summary').addEventListener('click', () =>
      shareTripSummary(tripId, trip)
    );

    renderExpensesTab(trip, tripId);
    renderMembersTab(trip, tripId);
    renderDashboard(trip);
    await renderBalancesTab(tripId, trip.currency, trip);
    await initAiChat(trip, tripId);
  } catch (err) {
    toast(err.message, 'error');
    navigate('');
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((t) => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive);
  });
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('hidden', p.id !== `tab-${tabName}`);
  });
}

// ---- Expenses tab ----

function renderExpensesTab(trip, tripId) {
  const list  = document.getElementById('expenses-list');
  const empty = document.getElementById('expenses-empty');
  list.innerHTML = '';

  if (trip.expenses.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Sort by date desc
  const sorted = [...trip.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const renderedItemsById = new Map();
  for (const expense of sorted) {
    const payer = trip.participants.find((p) => p.id === expense.paidBy);
    const splitNames = expense.splitBetween
      .map((id) => trip.participants.find((p) => p.id === id)?.name || '?')
      .join(', ');

    const catName = expense.category || categorize(expense.description);
    const item = document.createElement('div');
    item.className = 'expense-item';

    // Determine whether to show dual-currency display safely via DOM (not innerHTML)
    const showConversion = expense.originalCurrency
      && expense.originalCurrency !== trip.currency
      && typeof expense.originalAmount === 'number';

    // Use a placeholder token that we'll replace via DOM after setting innerHTML
    item.innerHTML = `
      <div class="expense-icon">${categoryIcon(catName)}</div>
      <div class="expense-body">
        <div class="expense-desc">${escHtml(expense.description)}</div>
        <div class="expense-meta">
          Paid by <strong>${escHtml(payer?.name || '?')}</strong>
          · Split: ${escHtml(splitNames)}
          · <time>${expense.date}</time>
        </div>
      </div>
      <div class="expense-amount"></div>
      <div class="expense-actions">
        <button class="btn btn-ghost btn-sm edit-expense-btn" aria-label="Edit expense" title="Edit">✏️</button>
        <button class="btn btn-ghost btn-sm delete-expense-btn" aria-label="Delete expense" title="Delete">🗑️</button>
      </div>
    `;

    // Populate amount cell with safe DOM nodes to avoid Intl.NumberFormat throws and XSS
    const amountCell = item.querySelector('.expense-amount');
    if (showConversion) {
      let origText, convText;
      try { origText = fmt(expense.originalAmount, expense.originalCurrency); } catch { origText = String(expense.originalAmount); }
      try { convText = fmt(expense.amount, trip.currency); } catch { convText = String(expense.amount); }
      amountCell.appendChild(document.createTextNode(origText));
      const note = document.createElement('span');
      note.className = 'conversion-note';
      note.textContent = `(≈ ${convText})`;
      amountCell.appendChild(note);
    } else {
      let mainText;
      try { mainText = fmt(expense.amount, trip.currency); } catch { mainText = String(expense.amount); }
      amountCell.textContent = mainText;
    }
    item.querySelector('.edit-expense-btn').addEventListener('click', () =>
      showEditExpenseModal(trip, expense, () => renderTripDetail(tripId))
    );
    item.querySelector('.delete-expense-btn').addEventListener('click', () =>
      confirmDeleteExpense(trip, expense, () => renderTripDetail(tripId))
    );
    list.appendChild(item);
    renderedItemsById.set(expense.id, item);
  }

  const expensesByDate = new Map();
  for (const expense of sorted) {
    const amount = Number(expense.amount);
    if (!expense.date || !Number.isFinite(amount) || amount <= 0) continue;
    if (!expensesByDate.has(expense.date)) expensesByDate.set(expense.date, []);
    expensesByDate.get(expense.date).push(expense);
  }
  for (const sameDateExpenses of expensesByDate.values()) {
    sameDateExpenses.sort((a, b) => Number(a.amount) - Number(b.amount));
  }
  const DUPLICATE_MIN_AMOUNT_FACTOR = 0.95;
  const DUPLICATE_MAX_AMOUNT_FACTOR = 1 / DUPLICATE_MIN_AMOUNT_FACTOR;
  const firstIndexAtOrAboveAmount = (arr, target) => {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (Number(arr[mid].amount) < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  for (const expense of sorted) {
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !expense.date) continue;
    const sameDateExpenses = expensesByDate.get(expense.date);
    if (!sameDateExpenses || sameDateExpenses.length < 2) continue;
    const minAmount = amount * DUPLICATE_MIN_AMOUNT_FACTOR;
    const maxAmount = amount * DUPLICATE_MAX_AMOUNT_FACTOR;
    const start = firstIndexAtOrAboveAmount(sameDateExpenses, minAmount);
    const end = firstIndexAtOrAboveAmount(sameDateExpenses, maxAmount);
    const candidates = sameDateExpenses.slice(start, end);
    const dup = findDuplicate(expense, candidates, { excludeId: expense.id });
    if (!dup) continue;
    const item = renderedItemsById.get(expense.id);
    if (!item) continue;
    const body = item.querySelector('.expense-body');
    if (!body) continue;
    const badge = document.createElement('div');
    badge.className = 'duplicate-badge';
    badge.innerHTML = `⚠️ Possible duplicate of "${escHtml(dup.description)}" (${escHtml(fmt(dup.amount, trip.currency))})`;
    body.appendChild(badge);
  }
}

// ---- Dashboard + Pie chart ----

const PIE_COLORS = [
  '#FBBF24', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6',
  '#F97316', '#EC4899', '#14B8A6', '#6366F1', '#F59E0B',
  '#06B6D4', '#84CC16', '#E11D48', '#A855F7', '#22D3EE',
];

function renderDashboard(trip) {
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const memberCount = trip.participants.length;
  document.getElementById('dash-total').textContent = fmt(total, trip.currency);
  document.getElementById('dash-expense-count').textContent = trip.expenses.length;
  document.getElementById('dash-member-count').textContent = memberCount;
  document.getElementById('dash-avg').textContent =
    memberCount > 0 ? fmt(total / memberCount, trip.currency) : fmt(0, trip.currency);

  renderForecast(trip, total, memberCount);

  // Spending per member (who paid)
  const spentByPayer = {};
  for (const p of trip.participants) spentByPayer[p.id] = { name: p.name, amount: 0 };
  for (const e of trip.expenses) {
    if (spentByPayer[e.paidBy]) spentByPayer[e.paidBy].amount += e.amount;
  }

  const slices = Object.values(spentByPayer)
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const chartSection = document.getElementById('chart-section');
  if (slices.length === 0) {
    chartSection.classList.add('hidden');
    return;
  }
  chartSection.classList.remove('hidden');

  const canvas          = document.getElementById('pie-chart');
  const legendEl        = document.getElementById('chart-legend');
  const pieContainer    = document.getElementById('pie-chart-container');
  const barContainer    = document.getElementById('bar-chart-container');
  const barCanvas       = document.getElementById('bar-chart');
  const exportBtn       = document.getElementById('chart-export');
  const togglePayer     = document.getElementById('chart-toggle-payer');
  const toggleCat       = document.getElementById('chart-toggle-category');
  const toggleTime      = document.getElementById('chart-toggle-time');
  const toggleMember    = document.getElementById('chart-toggle-member');

  const allToggles = [togglePayer, toggleCat, toggleTime, toggleMember];

  function setActiveToggle(btn) {
    allToggles.forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
  }

  function showPieView() {
    pieContainer.classList.remove('hidden');
    barContainer.classList.add('hidden');
  }

  function showBarView() {
    pieContainer.classList.add('hidden');
    barContainer.classList.remove('hidden');
  }

  function showPayerChart() {
    setActiveToggle(togglePayer);
    showPieView();
    drawPieChart(canvas, slices, trip.currency);
    renderChartLegend(legendEl, slices, total, trip.currency);
    exportBtn.onclick = () => exportCanvasPng(canvas, `banana-splitt-${sanitizeFilename(trip.name)}-by-payer.png`);
  }

  function showCategoryChart() {
    setActiveToggle(toggleCat);
    showPieView();
    renderCategoryChart(canvas, legendEl, trip);
    exportBtn.onclick = () => exportCanvasPng(canvas, `banana-splitt-${sanitizeFilename(trip.name)}-by-category.png`);
  }

  function showTimeChart() {
    setActiveToggle(toggleTime);
    showBarView();
    // Build spending-over-time data
    const byDate = {};
    for (const e of trip.expenses) {
      byDate[e.date] = (byDate[e.date] || 0) + e.amount;
    }
    const bars = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ label: formatShortDate(date), amount }));
    drawBarChart(barCanvas, bars, trip.currency);
    exportBtn.onclick = () => exportCanvasPng(barCanvas, `banana-splitt-${sanitizeFilename(trip.name)}-over-time.png`);
  }

  function showMemberChart() {
    setActiveToggle(toggleMember);
    showBarView();
    // Build per-member data using a single pass over expenses
    const amountByPayerId = {};
    for (const e of trip.expenses) {
      amountByPayerId[e.paidBy] = (amountByPayerId[e.paidBy] || 0) + e.amount;
    }
    const bars = trip.participants.map((p, i) => ({
      name: p.name,
      amount: amountByPayerId[p.id] || 0,
      color: PIE_COLORS[i % PIE_COLORS.length],
    })).filter((b) => b.amount > 0).sort((a, b) => b.amount - a.amount);
    drawHorizontalBarChart(barCanvas, bars, trip.currency);
    exportBtn.onclick = () => exportCanvasPng(barCanvas, `banana-splitt-${sanitizeFilename(trip.name)}-by-member.png`);
  }

  togglePayer.addEventListener('click', showPayerChart);
  toggleCat.addEventListener('click', showCategoryChart);
  toggleTime.addEventListener('click', showTimeChart);
  toggleMember.addEventListener('click', showMemberChart);

  showPayerChart();
}

function renderCategoryChart(canvas, legendContainer, trip) {
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = {};
  for (const e of trip.expenses) {
    const catName = e.category || categorize(e.description);
    byCategory[catName] = (byCategory[catName] || 0) + e.amount;
  }

  const slices = CATEGORIES
    .filter((cat) => byCategory[cat.name] > 0)
    .map((cat) => ({
      name: `${cat.icon} ${cat.name}`,
      amount: byCategory[cat.name],
      color: cat.color,
    }))
    .sort((a, b) => b.amount - a.amount);

  drawPieChart(canvas, slices, trip.currency);
  renderChartLegend(legendContainer, slices, total, trip.currency);
}

function renderForecast(trip, total, memberCount) {
  const section = document.getElementById('forecast-section');
  if (!trip.startDate || !trip.endDate) {
    section.classList.add('hidden');
    return;
  }

  const now   = new Date();
  const start = new Date(trip.startDate);
  const end   = new Date(trip.endDate);

  // Normalise to midnight local time for clean day arithmetic
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  // Guard against invalid or reversed dates
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    section.classList.add('hidden');
    return;
  }

  const MS_PER_DAY  = 1000 * 60 * 60 * 24;
  const totalDays   = Math.round((end - start) / MS_PER_DAY) + 1;
  const daysElapsed = Math.round((now - start) / MS_PER_DAY) + 1;

  if (totalDays < 1) {
    section.classList.add('hidden');
    return;
  }

  const iconEl   = document.getElementById('forecast-icon');
  const textEl   = document.getElementById('forecast-text');
  const barWrap  = document.getElementById('forecast-bar-wrap');
  const barFill  = document.getElementById('forecast-bar-fill');
  const barLabel = document.getElementById('forecast-bar-label');
  const card     = document.getElementById('forecast-card');

  section.classList.remove('hidden');

  // Trip hasn't started yet
  if (daysElapsed < 1) {
    iconEl.textContent = '📅';
    textEl.textContent = `trip starts on ${trip.startDate} — no forecast yet.`;
    barWrap.classList.add('hidden');
    card.className = 'forecast-card';
    return;
  }

  // Trip has ended
  if (daysElapsed > totalDays) {
    const perPerson = memberCount > 0 ? fmt(total / memberCount, trip.currency) : null;
    iconEl.textContent = '🏁';
    textEl.textContent = `trip ended — final total: ${fmt(total, trip.currency)}${perPerson ? ` (${perPerson}/person)` : ''}.`;
    // Still show budget bar if budget is set
    if (trip.budget) {
      const pct = Math.min((total / trip.budget) * 100, 100);
      barWrap.classList.remove('hidden');
      barFill.style.width = pct + '%';
      barLabel.textContent = `${fmt(total, trip.currency)} of ${fmt(trip.budget, trip.currency)} budget`;
      const colorClass = total > trip.budget ? 'over' : pct >= 80 ? 'warn' : 'ok';
      card.className = `forecast-card forecast-${colorClass}`;
      barFill.className = `forecast-bar-fill fill-${colorClass}`;
    } else {
      barWrap.classList.add('hidden');
      card.className = 'forecast-card';
    }
    return;
  }

  // Trip in progress — project spending
  const projected = daysElapsed > 0 ? (total / daysElapsed) * totalDays : 0;
  const perPerson = memberCount > 0 ? fmt(projected / memberCount, trip.currency) : null;

  let colorClass = 'ok';
  let icon = '✅';
  let msg  = `Day ${daysElapsed} of ${totalDays} — on pace to spend ${fmt(projected, trip.currency)} total`;
  if (perPerson) msg += ` (${perPerson}/person)`;

  if (trip.budget) {
    const ratio = projected / trip.budget;
    if (ratio > 1) {
      colorClass = 'over';
      icon = '⚠️';
      msg = `Day ${daysElapsed} of ${totalDays} — ⚠️ over budget pace — projected ${fmt(projected, trip.currency)} vs ${fmt(trip.budget, trip.currency)} budget`;
    } else if (ratio >= 0.8) {
      colorClass = 'warn';
      icon = '🟡';
      msg = `Day ${daysElapsed} of ${totalDays} — projected ${fmt(projected, trip.currency)} vs ${fmt(trip.budget, trip.currency)} budget`;
    } else {
      msg = `Day ${daysElapsed} of ${totalDays} — ✅ under budget — projected ${fmt(projected, trip.currency)} vs ${fmt(trip.budget, trip.currency)} budget`;
    }
  }

  iconEl.textContent = icon;
  textEl.textContent = msg;
  card.className = `forecast-card forecast-${colorClass}`;

  if (trip.budget) {
    const pct = Math.min((total / trip.budget) * 100, 100);
    barWrap.classList.remove('hidden');
    barFill.style.width = pct + '%';
    barFill.className = `forecast-bar-fill fill-${colorClass}`;
    barLabel.textContent = `${fmt(total, trip.currency)} spent of ${fmt(trip.budget, trip.currency)} budget (${pct.toFixed(1)}%)`;
  } else {
    barWrap.classList.add('hidden');
  }
}

function drawPieChart(canvas, slices, currency) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 260;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const radius = 110;
  const innerRadius = 60;
  const total = slices.reduce((s, sl) => s + sl.amount, 0);

  let startAngle = -Math.PI / 2;
  slices.forEach((slice, i) => {
    const sliceAngle = (slice.amount / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color || PIE_COLORS[i % PIE_COLORS.length];
    ctx.fill();

    // Subtle separator
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle = endAngle;
  });

  // Center label
  ctx.fillStyle = '#111827';
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Total', cx, cy - 10);
  ctx.font = '800 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(fmt(total, currency), cx, cy + 12);
}

function renderChartLegend(container, slices, total, currency) {
  container.innerHTML = '';
  slices.forEach((slice, i) => {
    const pct = ((slice.amount / total) * 100).toFixed(1);
    const color = slice.color || PIE_COLORS[i % PIE_COLORS.length];
    const div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      <span class="legend-name">${escHtml(slice.name)}</span>
      <span class="legend-value">${fmt(slice.amount, currency)}</span>
      <span class="legend-pct">${pct}%</span>
    `;
    container.appendChild(div);
  });
}

// ---- Analytics charts ----

function formatShortDate(isoDate) {
  // isoDate is 'YYYY-MM-DD'
  const parts = isoDate ? isoDate.split('-') : [];
  if (parts.length !== 3) return isoDate || '';
  const [, m, d] = parts;
  // Use Intl.DateTimeFormat formatToParts to reliably detect day-first vs month-first
  const locale = navigator.language || 'en';
  const testDate = new Date(2013, 0, 2); // Jan 2 — unambiguous day vs month
  const formatter = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' });
  const dateParts = typeof formatter.formatToParts === 'function'
    ? formatter.formatToParts(testDate)
    : [];
  const dayIndex = dateParts.findIndex((p) => p.type === 'day');
  const monthIndex = dateParts.findIndex((p) => p.type === 'month');
  const dayFirst = dayIndex !== -1 && monthIndex !== -1 ? dayIndex < monthIndex : false;
  return dayFirst ? `${d}/${m}` : `${m}/${d}`;
}

function drawBarChart(canvas, bars, currency) {
  if (!bars || bars.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const barGap    = 4;
  const minBarW   = 20;
  const padTop    = 16;
  const padBottom = 36;
  const padLeft   = 12;
  const padRight  = 12;
  const H = 200;
  // Expand canvas width if needed to maintain minimum bar width.
  // Layout: gap | bar | gap | bar | ... | bar | gap  → n bars with (n+1) gaps
  const n = bars.length;
  const minW = padLeft + padRight + barGap * (n + 1) + minBarW * n;
  const W = Math.max(500, minW);
  const chartW    = W - padLeft - padRight;
  const chartH    = H - padTop - padBottom;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const maxAmount = Math.max(...bars.map((b) => b.amount));
  if (maxAmount === 0) return;

  const barW = Math.floor((chartW - barGap * (n + 1)) / n);

  // Gridlines
  const gridLines = 4;
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= gridLines; i++) {
    const y = padTop + chartH - (i / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(W - padRight, y);
    ctx.stroke();
  }

  // Bars
  bars.forEach((bar, i) => {
    const x = padLeft + barGap + i * (barW + barGap);
    const barHeight = (bar.amount / maxAmount) * chartH;
    const y = padTop + chartH - barHeight;

    ctx.fillStyle = PIE_COLORS[0];
    const r = Math.min(4, barW / 2);
    ctx.beginPath();
    ctx.moveTo(x, y + barHeight);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + barW - r, y);
    ctx.arcTo(x + barW, y, x + barW, y + r, r);
    ctx.lineTo(x + barW, y + barHeight);
    ctx.closePath();
    ctx.fill();

    // X-axis label
    ctx.fillStyle = '#6b7280';
    ctx.font = `600 ${Math.min(11, Math.max(9, barW - 2))}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(bar.label, x + barW / 2, padTop + chartH + 6);
  });
}

function drawHorizontalBarChart(canvas, bars, currency) {
  if (!bars || bars.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const W   = 400;
  const rowH = 40;
  const H   = bars.length * rowH + 40;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const nameW   = 90;
  const amtW    = 80;
  const padV    = 8;
  const barAreaW = W - nameW - amtW - 16;

  const maxAmount = Math.max(...bars.map((b) => b.amount));

  bars.forEach((bar, i) => {
    const y = 20 + i * rowH;

    // Bar geometry — computed first so name/amount labels can share the same y-centre
    const barH   = rowH - padV * 2;
    const barLen = maxAmount > 0 ? (bar.amount / maxAmount) * barAreaW : 0;
    const bx     = nameW + 4;
    const by     = y + padV;
    const r      = Math.min(4, barH / 2);

    // Member name
    ctx.fillStyle = '#111827';
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    // Truncate long names
    let name = bar.name;
    while (name.length > 1 && ctx.measureText(name).width > nameW - 8) {
      name = name.slice(0, -1);
    }
    if (name !== bar.name) name += '…';
    ctx.fillText(name, nameW - 4, by + barH / 2);

    // Bar
    ctx.fillStyle = (/^#[0-9a-fA-F]{3,8}$/.test(bar.color) ? bar.color : null) || PIE_COLORS[i % PIE_COLORS.length];
    if (barLen > 0) {
      const effectiveR = Math.min(r, barLen / 2);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + barLen - effectiveR, by);
      ctx.arcTo(bx + barLen, by, bx + barLen, by + effectiveR, effectiveR);
      ctx.lineTo(bx + barLen, by + barH - effectiveR);
      ctx.arcTo(bx + barLen, by + barH, bx + barLen - effectiveR, by + barH, effectiveR);
      ctx.lineTo(bx, by + barH);
      ctx.closePath();
      ctx.fill();
    }

    // Amount label
    ctx.fillStyle = '#111827';
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    let amtStr;
    try { amtStr = fmt(bar.amount, currency); } catch { amtStr = String(bar.amount); }
    ctx.fillText(amtStr, nameW + 4 + barAreaW + amtW - 4, by + barH / 2);
  });
}

function sanitizeFilename(name) {
  const safe = (name || 'trip').replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
  return safe || 'trip';
}

function exportCanvasPng(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename || 'chart.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ---- Balances tab ----

async function renderBalancesTab(tripId, currency, trip) {
  try {
    const { balances, settlements } = await get(`/trips/${tripId}/balances`);
    const balList = document.getElementById('balances-list');
    const setList = document.getElementById('settlements-list');
    const setEmpty = document.getElementById('settlements-empty');

    balList.innerHTML = '';
    setList.innerHTML = '';

    for (const b of balances) {
      const cls = b.balance > 0.005 ? 'positive' : b.balance < -0.005 ? 'negative' : 'neutral';
      const label = b.balance > 0.005 ? 'gets back' : b.balance < -0.005 ? 'owes' : 'settled';
      const div = document.createElement('div');
      div.className = `balance-item ${cls}`;
      div.innerHTML = `
        <div class="balance-avatar" style="${avatarStyle(b.name)}">${initials(b.name)}</div>
        <span class="balance-name">${escHtml(b.name)}</span>
        <span class="balance-amount">${fmt(Math.abs(b.balance), currency)}</span>
        <span class="balance-label">${label}</span>
      `;
      balList.appendChild(div);
    }

    if (settlements.length === 0) {
      setEmpty.classList.remove('hidden');
    } else {
      setEmpty.classList.add('hidden');
      for (const s of settlements) {
        const div = document.createElement('div');
        div.className = 'settlement-item';
        div.innerHTML = `
          <span class="settlement-from">${escHtml(s.fromName)}</span>
          <span class="settlement-arrow">→</span>
          pays
          <span class="settlement-amount">${fmt(s.amount, currency)}</span>
          <span class="settlement-arrow">→</span>
          to
          <span class="settlement-to">${escHtml(s.toName)}</span>
          <button class="btn btn-ghost btn-sm settlement-remind-btn" title="Send payment reminder">📩 Remind</button>
        `;
        div.querySelector('.settlement-remind-btn').addEventListener('click', () =>
          showReminderModal(trip, s, currency)
        );
        setList.appendChild(div);
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---- Share balances ----

async function shareBalancesSummary(tripId, trip) {
  try {
    const { balances, settlements } = await get(`/trips/${tripId}/balances`);
    let text = `🍌 ${trip.name} — Balance Summary\n`;
    text += '━'.repeat(30) + '\n\n';

    text += '⚖️ Balances:\n';
    for (const b of balances) {
      const sign = b.balance > 0.005 ? '+' : '';
      text += `  ${b.name}: ${sign}${fmt(Math.abs(b.balance), trip.currency)}`;
      if (b.balance > 0.005) text += ' (gets back)';
      else if (b.balance < -0.005) text += ' (owes)';
      else text += ' (settled)';
      text += '\n';
    }

    if (settlements.length > 0) {
      text += '\n💸 Payments needed:\n';
      for (const s of settlements) {
        text += `  ${s.fromName} → pays ${fmt(s.amount, trip.currency)} → ${s.toName}\n`;
      }
    } else {
      text += '\n🎉 All settled up!\n';
    }

    if (navigator.share) {
      await navigator.share({ title: `${trip.name} — Balances`, text });
    } else {
      await navigator.clipboard.writeText(text);
      toast('Summary copied to clipboard!', 'success');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast(err.message, 'error');
    }
  }
}

// ---- Payment reminder modal ----

function showReminderModal(trip, settlement, currency) {
  const message = `Hey ${settlement.fromName}! 👋 Quick reminder from our ${trip.name} trip — you owe ${settlement.toName} ${fmt(settlement.amount, currency)}. No rush, just keeping track with banana/splitt 🍌`;

  openModal(`
    <h2 class="modal-title">📩 Payment Reminder</h2>
    <p class="reminder-subtitle">Edit the message below before sending.</p>
    <div class="form-group">
      <textarea id="reminder-message" class="reminder-textarea" rows="5"></textarea>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" id="reminder-cancel">Cancel</button>
      ${navigator.share ? `<button type="button" class="btn btn-secondary" id="reminder-share">📤 Share</button>` : ''}
      <button type="button" class="btn btn-primary" id="reminder-copy">📋 Copy</button>
    </div>
  `);

  document.getElementById('reminder-message').value = message;
  document.getElementById('reminder-cancel').addEventListener('click', closeModal);

  document.getElementById('reminder-copy').addEventListener('click', async () => {
    const text = document.getElementById('reminder-message').value;
    try {
      await navigator.clipboard.writeText(text);
      toast('Message copied to clipboard!', 'success');
      closeModal();
    } catch {
      toast('Could not copy to clipboard.', 'error');
    }
  });

  if (navigator.share) {
    document.getElementById('reminder-share').addEventListener('click', async () => {
      const text = document.getElementById('reminder-message').value;
      try {
        await navigator.share({ title: `Payment reminder — ${trip.name}`, text });
      } catch (err) {
        if (err.name !== 'AbortError') toast(err.message, 'error');
      }
    });
  }
}

// ---- Narrative trip summary ----

function generateTripSummary(trip, balances, settlements) {
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const count = trip.expenses.length;
  const memberCount = trip.participants.length;

  // Top payer by amount paid
  const paidByPerson = {};
  for (const e of trip.expenses) {
    if (!paidByPerson[e.paidBy]) {
      const p = trip.participants.find((p) => p.id === e.paidBy);
      paidByPerson[e.paidBy] = { name: p ? p.name : '?', amount: 0 };
    }
    paidByPerson[e.paidBy].amount += e.amount;
  }
  const topPayer = Object.values(paidByPerson).sort((a, b) => b.amount - a.amount)[0];

  // Biggest single expense
  const biggest = count > 0
    ? trip.expenses.reduce((max, e) => (e.amount > max.amount ? e : max), trip.expenses[0])
    : null;

  // Top category (if any expenses have a category field)
  const hasCats = trip.expenses.some((e) => e.category);
  let topCatLine = '';
  if (hasCats) {
    const catTotals = {};
    for (const e of trip.expenses) {
      const cat = e.category || 'Other';
      catTotals[cat] = (catTotals[cat] || 0) + e.amount;
    }
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      const pct = total > 0 ? Math.round((topCat[1] / total) * 100) : 0;
      topCatLine = ` ${topCat[0]} was the biggest category at ${pct}% (${fmt(topCat[1], trip.currency)}).`;
    }
  }

  // Date range
  let dateLine = '';
  if (count > 0) {
    const dates = trip.expenses.map((e) => e.date).sort();
    if (dates[0] === dates[dates.length - 1]) {
      dateLine = ` on ${dates[0]}`;
    } else {
      dateLine = ` from ${dates[0]} to ${dates[dates.length - 1]}`;
    }
  }

  let text = `🍌 ${trip.name} Summary\n`;
  text += '━'.repeat(30) + '\n\n';

  if (count === 0) {
    text += `No expenses recorded yet for this trip.`;
    return text;
  }

  text += `The group spent ${fmt(total, trip.currency)} across ${count} expense${count !== 1 ? 's' : ''} with ${memberCount} member${memberCount !== 1 ? 's' : ''}${dateLine}.`;

  if (topPayer && topPayer.amount > 0) {
    text += ` ${topPayer.name} covered the most (${fmt(topPayer.amount, trip.currency)}).`;
  }

  if (biggest) {
    text += ` The biggest single expense was "${biggest.description}" at ${fmt(biggest.amount, trip.currency)}.`;
  }

  if (topCatLine) text += topCatLine;

  text += '\n\n';

  if (settlements.length > 0) {
    text += '💸 To settle up:\n';
    for (const s of settlements) {
      text += `  ${s.fromName} pays ${fmt(s.amount, trip.currency)} to ${s.toName}\n`;
    }
  } else {
    text += '🎉 All settled up! No payments needed.';
  }

  return text;
}

async function shareTripSummary(tripId, trip) {
  try {
    const { balances, settlements } = await get(`/trips/${tripId}/balances`);
    const text = generateTripSummary(trip, balances, settlements);

    if (navigator.share) {
      await navigator.share({ title: `🍌 ${trip.name} Summary`, text });
    } else {
      await navigator.clipboard.writeText(text);
      toast('Trip summary copied to clipboard!', 'success');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast(err.message, 'error');
    }
  }
}

// ---- Members tab ----

function renderMembersTab(trip, tripId) {
  const list  = document.getElementById('members-list');
  const empty = document.getElementById('members-empty');
  list.innerHTML = '';

  if (trip.participants.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  for (const p of trip.participants) {
    const item = document.createElement('div');
    item.className = 'member-item';
    item.innerHTML = `
      <div class="member-avatar" style="${avatarStyle(p.name)}">${initials(p.name)}</div>
      <span class="member-name">${escHtml(p.name)}</span>
      <div class="member-actions">
        <button class="btn btn-ghost btn-sm remove-member-btn" aria-label="Remove member" title="Remove">🗑️</button>
      </div>
    `;
    item.querySelector('.remove-member-btn').addEventListener('click', () =>
      confirmRemoveMember(trip, p, () => renderTripDetail(tripId))
    );
    list.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// MODALS — Add / Edit Expense
// ---------------------------------------------------------------------------

function expenseModalHTML(trip, expense, prefill = null) {
  const participants = trip.participants;
  const today = new Date().toISOString().split('T')[0];

  // `vals` provides default values: editing an existing expense takes priority,
  // then AI-prefilled data, then blank.
  const vals = expense || prefill;
  const splitIds = vals?.splitBetween || participants.map((p) => p.id);

  // When editing, show original amount if a foreign currency was used
  const displayAmount = expense?.originalAmount ?? (expense ? expense.amount : (vals?.amount || ''));
  const expCurrency = expense?.originalCurrency || trip.currency;
  const currentCat = expense?.category || categorize(vals?.description || '');

  return `
    <h2 class="modal-title">${expense ? 'Edit Expense' : 'Add Expense'}</h2>
    <form id="expense-form">
      <div class="form-group">
        <label for="exp-desc">Description *</label>
        <input id="exp-desc" type="text" placeholder="e.g. Hotel, Dinner, Taxi…"
          value="${escAttr(vals?.description || '')}" required maxlength="120" />
      </div>
      <div class="form-group">
        <label for="exp-amount">Amount *</label>
        <div style="display:flex;gap:.5rem;align-items:center">
          <input id="exp-amount" type="number" step="0.01" min="0.01"
            value="${escAttr(String(displayAmount))}" required placeholder="0.00" style="flex:1" />
          <select id="exp-currency" style="width:7rem">
            ${CURRENCIES.map((c) =>
              `<option value="${c.code}"${c.code === expCurrency ? ' selected' : ''}>${c.code}</option>`
            ).join('')}
          </select>
        </div>
        <div id="conversion-preview" style="font-size:.8rem;color:var(--text-muted);margin-top:.25rem;min-height:1.2em"></div>
      </div>
      <div class="form-group">
        <label for="exp-category">Category</label>
        <select id="exp-category">
          ${CATEGORIES.map((c) => `<option value="${escAttr(c.name)}"${currentCat === c.name ? ' selected' : ''}>${c.icon} ${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="exp-date">Date</label>
        <input id="exp-date" type="date" value="${vals?.date || today}" />
      </div>
      <div class="form-group">
        <label for="exp-paidby">Paid by *</label>
        <select id="exp-paidby">
          ${participants.map((p) =>
            `<option value="${p.id}" ${vals?.paidBy === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Split between
          <button type="button" class="split-all-btn" id="split-all-btn">select all</button>
        </label>
        <div class="split-checkboxes" id="split-checkboxes">
          ${participants.map((p) => `
            <label class="split-checkbox-label">
              <input type="checkbox" name="split" value="${p.id}"
                ${splitIds.includes(p.id) ? 'checked' : ''} />
              ${escHtml(p.name)}
            </label>
          `).join('')}
        </div>
        <div id="split-hint" class="split-hint hidden"></div>
      </div>
      <div class="form-warning hidden" id="expense-warning" role="alert">
        <span class="form-warning-text" id="expense-warning-text"></span>
        <button type="button" class="form-warning-dismiss" id="expense-warning-dismiss" aria-label="Dismiss warning">×</button>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${expense ? 'Save Changes' : 'Add Expense'}</button>
      </div>
    </form>
  `;
}

function showAddExpenseModal(trip, onSuccess, prefill = null) {
  if (trip.participants.length === 0) {
    toast('Add members to the trip before adding expenses.', 'error');
    return;
  }
  openModal(expenseModalHTML(trip, null, prefill));
  attachExpenseFormHandlers(trip, null, onSuccess);
}

function showEditExpenseModal(trip, expense, onSuccess) {
  openModal(expenseModalHTML(trip, expense));
  attachExpenseFormHandlers(trip, expense, onSuccess);
}

// Maps category names (from CATEGORIES) to split hint messages.
// Reuses the same keyword system so both features stay in sync automatically.
const SPLIT_HINT_BY_CATEGORY = {
  'Accommodation': 'This looks like accommodation — consider splitting between specific people only?',
  'Transport':     'This looks like transport — consider splitting between specific people only?',
};

function getSplitHint(cat) {
  return SPLIT_HINT_BY_CATEGORY[cat] || null;
}

function attachExpenseFormHandlers(trip, expense, onSuccess) {
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('split-all-btn').addEventListener('click', () => {
    document.querySelectorAll('#split-checkboxes input[type=checkbox]').forEach((cb) => {
      cb.checked = true;
    });
  });

  const descInput = document.getElementById('exp-desc');
  const hintEl    = document.getElementById('split-hint');
  function onDescInput() {
    const desc = descInput.value.trim();
    const cat  = categorize(desc);

    // Update split hint
    const hint = getSplitHint(cat);
    if (hint) {
      hintEl.textContent = '💡 ' + hint;
      hintEl.classList.remove('hidden');
    } else {
      hintEl.textContent = '';
      hintEl.classList.add('hidden');
    }

    // Auto-categorize (only for new expenses)
    if (!expense) {
      document.getElementById('exp-category').value = cat;
    }
  }
  descInput.addEventListener('input', onDescInput);
  // Evaluate immediately for pre-filled descriptions (edit flow)
  onDescInput();

  // Live conversion preview
  let conversionRate = null;
  let lastConvertedAmount = null;
  let conversionTimeout = null;

  async function updateConversionPreview() {
    const amountVal = parseFloat(document.getElementById('exp-amount').value);
    const expCurrency = document.getElementById('exp-currency').value;
    const dateVal = document.getElementById('exp-date').value;
    const preview = document.getElementById('conversion-preview');

    if (expCurrency === trip.currency || !amountVal || amountVal <= 0) {
      preview.textContent = '';
      conversionRate = null;
      lastConvertedAmount = null;
      return;
    }

    preview.textContent = 'Fetching rate…';
    try {
      const date = dateVal || new Date().toISOString().split('T')[0];
      const url = `https://api.frankfurter.dev/v1/${date}?from=${expCurrency}&to=${trip.currency}&amount=${amountVal}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Rate unavailable');
      const data = await res.json();
      const converted = data.rates[trip.currency];
      if (typeof converted !== 'number') throw new Error('Rate unavailable');
      conversionRate = converted / amountVal;
      lastConvertedAmount = Math.round(converted * 100) / 100;
      preview.textContent = `≈ ${fmt(lastConvertedAmount, trip.currency)} at ${conversionRate.toFixed(4)} rate`;
    } catch {
      conversionRate = null;
      lastConvertedAmount = null;
      preview.textContent = 'Could not fetch rate — will use 1:1';
    }
    // Re-run duplicate/anomaly checks now that lastConvertedAmount is up to date
    runChecks();
  }

  function schedulePreviewUpdate() {
    clearTimeout(conversionTimeout);
    conversionTimeout = setTimeout(updateConversionPreview, 500);
  }

  document.getElementById('exp-amount').addEventListener('input', schedulePreviewUpdate);
  document.getElementById('exp-currency').addEventListener('change', updateConversionPreview);
  document.getElementById('exp-date').addEventListener('change', updateConversionPreview);

  // Show initial preview if editing a foreign-currency expense
  if (expense?.originalCurrency && expense.originalCurrency !== trip.currency) {
    const preview = document.getElementById('conversion-preview');
    const rate = expense.originalAmount > 0
      ? (expense.convertedAmount / expense.originalAmount).toFixed(4)
      : '1.0000';
    preview.textContent = `≈ ${fmt(expense.convertedAmount, trip.currency)} at ${rate} rate`;
    // Initialise lastConvertedAmount so runChecks can use the correct trip-currency amount
    // before the user triggers a live rate fetch
    lastConvertedAmount = expense.convertedAmount;
  }

  // Duplicate & anomaly detection — cache stable DOM refs once
  const amountEl      = document.getElementById('exp-amount');
  const descEl        = document.getElementById('exp-desc');
  const dateEl        = document.getElementById('exp-date');
  const warningEl     = document.getElementById('expense-warning');
  const warningTextEl = document.getElementById('expense-warning-text');

  const runChecks = () => {
    const amount = parseFloat(amountEl.value);
    const desc   = descEl.value.trim();
    const date   = dateEl.value;

    if (isNaN(amount) || amount <= 0) {
      warningEl.classList.add('hidden');
      return;
    }

    // Use the trip-currency amount for comparisons (post-conversion when a foreign currency is selected).
    // Fallback chain: live conversion → saved expense conversion → raw input amount.
    const expCurrency = document.getElementById('exp-currency').value;
    const isForeignCurrency = expCurrency && expCurrency !== trip.currency;
    const savedConvertedAmount = expense && typeof expense.convertedAmount === 'number'
      ? expense.convertedAmount
      : null;
    let compareAmount = amount;
    if (isForeignCurrency) {
      if (lastConvertedAmount !== null) {
        compareAmount = lastConvertedAmount;
      } else if (savedConvertedAmount !== null) {
        compareAmount = savedConvertedAmount;
      }
    }

    const comparisons = expense
      ? trip.expenses.filter((e) => e.id !== expense.id)
      : trip.expenses;

    // Duplicate check: same amount ±5%, same date, bidirectional description substring match
    if (desc.length > 0) {
      const dup = findDuplicate({ description: desc, amount: compareAmount, date }, comparisons);
      if (dup) {
        warningTextEl.textContent =
          `⚠️ This looks similar to "${dup.description}" (${fmt(dup.amount, trip.currency)}) added on ${dup.date}`;
        warningEl.classList.remove('hidden');
        return;
      }
    }

    // Anomaly check: compareAmount > 5× average of existing expenses (trip-currency amounts)
    if (comparisons.length > 0) {
      const avg = comparisons.reduce((s, e) => s + e.amount, 0) / comparisons.length;
      if (compareAmount > avg * 5) {
        warningTextEl.textContent =
          `⚠️ This is much larger than your average expense (${fmt(avg, trip.currency)}). Double-check the amount.`;
        warningEl.classList.remove('hidden');
        return;
      }
    }

    warningEl.classList.add('hidden');
  };

  amountEl.addEventListener('blur', runChecks);
  amountEl.addEventListener('input', runChecks);
  descEl.addEventListener('input', runChecks);
  dateEl.addEventListener('change', runChecks);
  document.getElementById('expense-warning-dismiss').addEventListener('click', () => {
    warningEl.classList.add('hidden');
  });

  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = document.getElementById('exp-desc').value.trim();
    const date        = document.getElementById('exp-date').value;
    const paidBy      = document.getElementById('exp-paidby').value;
    const expCurrency = document.getElementById('exp-currency').value;
    const rawAmount   = parseFloat(document.getElementById('exp-amount').value);
    const category    = document.getElementById('exp-category').value;
    const splitBetween = [...document.querySelectorAll('#split-checkboxes input:checked')]
      .map((cb) => cb.value);

    if (splitBetween.length === 0) {
      toast('Select at least one person to split with.', 'error');
      return;
    }

    // Determine final amount in trip currency and optional conversion fields
    let amount = rawAmount;
    let extraFields = {};

    if (expCurrency !== trip.currency) {
      if (conversionRate !== null) {
        // Use lastConvertedAmount when amount matches the preview, else reapply rate
        const previewAmount = parseFloat(document.getElementById('exp-amount').value);
        amount = lastConvertedAmount !== null && previewAmount === rawAmount
          ? lastConvertedAmount
          : Math.round(rawAmount * conversionRate * 100) / 100;
      } else {
        // Fallback: try one more fetch; if fails, use 1:1
        try {
          const date2 = date || new Date().toISOString().split('T')[0];
          const url = `https://api.frankfurter.dev/v1/${date2}?from=${expCurrency}&to=${trip.currency}&amount=${rawAmount}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('rate fetch failed');
          const data = await res.json();
          const converted = data.rates?.[trip.currency];
          if (typeof converted !== 'number') throw new Error('rate missing');
          amount = Math.round(converted * 100) / 100;
        } catch {
          toast('Exchange rate unavailable — using 1:1 conversion', 'error');
        }
      }
      extraFields = {
        originalCurrency: expCurrency,
        originalAmount: rawAmount,
        convertedAmount: amount,
      };
    } else {
      // Same currency — clear any previous conversion data when editing
      if (expense?.originalCurrency) {
        extraFields = { originalCurrency: trip.currency };
      }
    }

    try {
      if (expense) {
        await put(`/trips/${trip.id}/expenses/${expense.id}`, {
          description, amount, date, paidBy, splitBetween, category, ...extraFields,
        });
        toast('Expense updated', 'success');
      } else {
        await post(`/trips/${trip.id}/expenses`, {
          description, amount, date, paidBy, splitBetween, category, ...extraFields,
        });
        toast('Expense added 💸', 'success');
      }
      closeModal();
      await checkAndUpdateTripDates(trip, date, expense?.id, onSuccess);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/**
 * Show a styled confirmation modal asking whether to update a trip date boundary.
 * Resolves true (update) or false (keep current) regardless of how the modal is closed.
 */
function dateUpdatePrompt(label, current, proposed) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(val);
    };

    const labelCap   = label === 'start' ? 'Start' : 'End';
    const direction  = label === 'start' ? 'before' : 'after';

    openModal(`
      <h2 class="modal-title">Update Trip ${escHtml(labelCap)} Date?</h2>
      <p>This expense date (<strong>${escHtml(proposed)}</strong>) is
      ${direction} the trip ${escHtml(label)} date
      (<strong>${escHtml(current)}</strong>).</p>
      <p style="margin-top:.5rem">Update the trip ${escHtml(label)} date to
      <strong>${escHtml(proposed)}</strong>?</p>
      <div class="form-actions" style="margin-top:1rem">
        <button class="btn btn-secondary" id="date-no-btn">Keep ${escHtml(current)}</button>
        <button class="btn btn-primary" id="date-yes-btn">Update to ${escHtml(proposed)}</button>
      </div>
    `);

    document.getElementById('date-no-btn').addEventListener('click', () => finish(false));
    document.getElementById('date-yes-btn').addEventListener('click', () => finish(true));

    // Resolve false if modal is closed via X button, Escape, or overlay click
    const obs = new MutationObserver(() => {
      if (overlay.classList.contains('hidden')) { obs.disconnect(); finish(false); }
    });
    obs.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  });
}

/**
 * Returns the min and max ISO date strings across all saved expenses (excluding the one
 * currently being edited) plus the new expenseDate being saved.
 */
function expenseDateRange(trip, expenseDate, editingExpenseId) {
  const allDates = trip.expenses
    .filter(e => e.id !== editingExpenseId)
    .map(e => e.date)
    .filter(Boolean);
  allDates.push(expenseDate);
  allDates.sort();
  return { minDate: allDates[0], maxDate: allDates[allDates.length - 1] };
}

/**
 * After an expense is saved, check whether the trip's date range should be updated:
 * - No dates set: silently auto-set start/end from all expense dates.
 * - startDate set but no endDate: auto-derive endDate; also prompt if expense predates startDate.
 * - endDate set but no startDate: auto-derive startDate; also prompt if expense postdates endDate.
 * - Both dates set, expense outside range: prompt the user.
 * The expense is already saved regardless of the user's choice. onSuccess() is called at the end.
 *
 * NOTE: date comparisons use ISO string comparison ("YYYY-MM-DD" < "YYYY-MM-DD") intentionally —
 * do NOT convert to Date objects here as that causes UTC timezone bugs (midnight UTC parses as
 * the previous day in behind-UTC timezones). See .github/skills/trip-dates/SKILL.md.
 */
async function checkAndUpdateTripDates(trip, expenseDate, editingExpenseId, onSuccess) {
  if (!expenseDate) { onSuccess(); return; }

  const noStart = !trip.startDate;
  const noEnd   = !trip.endDate;

  if (noStart && noEnd) {
    // Auto-set trip dates silently from all expense dates (including the new/edited one)
    const { minDate, maxDate } = expenseDateRange(trip, expenseDate, editingExpenseId);
    try {
      await put(`/trips/${trip.id}`, { startDate: minDate, endDate: maxDate });
    } catch (_) { /* silently ignore — forecast is non-critical */ }
    onSuccess();
    return;
  }

  // startDate is set but endDate is missing — auto-derive endDate; also prompt if expense
  // predates the existing startDate so the range doesn't end up inverted.
  if (!noStart && noEnd) {
    const { minDate, maxDate } = expenseDateRange(trip, expenseDate, editingExpenseId);
    let effectiveStart = trip.startDate;
    const update = {};

    if (minDate < trip.startDate) {
      const ok = await dateUpdatePrompt('start', trip.startDate, minDate);
      if (ok) {
        effectiveStart = minDate;
        update.startDate = minDate;
      }
    }

    if (maxDate >= effectiveStart) update.endDate = maxDate;

    if (Object.keys(update).length) {
      try {
        await put(`/trips/${trip.id}`, update);
      } catch (_) { /* silently ignore — forecast is non-critical */ }
    }
    onSuccess();
    return;
  }

  // endDate is set but startDate is missing — auto-derive startDate; also prompt if expense
  // postdates the existing endDate so the range doesn't end up inverted.
  if (noStart && !noEnd) {
    const { minDate, maxDate } = expenseDateRange(trip, expenseDate, editingExpenseId);
    let effectiveEnd = trip.endDate;
    const update = {};

    if (maxDate > trip.endDate) {
      const ok = await dateUpdatePrompt('end', trip.endDate, maxDate);
      if (ok) {
        effectiveEnd = maxDate;
        update.endDate = maxDate;
      }
    }

    if (minDate <= effectiveEnd) update.startDate = minDate;

    if (Object.keys(update).length) {
      try {
        await put(`/trips/${trip.id}`, update);
      } catch (_) { /* silently ignore — forecast is non-critical */ }
    }
    onSuccess();
    return;
  }

  if (expenseDate < trip.startDate) {
    const ok = await dateUpdatePrompt('start', trip.startDate, expenseDate);
    if (ok) {
      try {
        await put(`/trips/${trip.id}`, { startDate: expenseDate });
      } catch (err) { toast(err.message, 'error'); }
    }
  }

  if (expenseDate > trip.endDate) {
    const ok = await dateUpdatePrompt('end', trip.endDate, expenseDate);
    if (ok) {
      try {
        await put(`/trips/${trip.id}`, { endDate: expenseDate });
      } catch (err) { toast(err.message, 'error'); }
    }
  }

  onSuccess();
}


async function confirmDeleteExpense(trip, expense, onSuccess) {
  openModal(`
    <h2 class="modal-title">Delete Expense?</h2>
    <p>Delete <strong>${escHtml(expense.description)}</strong>
    (${fmt(expense.amount, trip.currency)})?</p>
    <div class="form-actions" style="margin-top:1rem">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
    </div>
  `);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    try {
      await del(`/trips/${trip.id}/expenses/${expense.id}`);
      closeModal();
      toast('Expense deleted', 'default');
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// MODALS — Members
// ---------------------------------------------------------------------------

function showAddMemberModal(trip, onSuccess) {
  openModal(`
    <h2 class="modal-title">Add Member</h2>
    <form id="add-member-form">
      <div class="form-group">
        <label for="member-name">Name *</label>
        <input id="member-name" type="text" placeholder="e.g. Alice" required maxlength="60" />
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Member</button>
      </div>
    </form>
  `);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('add-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('member-name').value.trim();
    try {
      await post(`/trips/${trip.id}/participants`, { name });
      closeModal();
      toast(`${name} added 👋`, 'success');
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function confirmRemoveMember(trip, participant, onSuccess) {
  openModal(`
    <h2 class="modal-title">Remove Member?</h2>
    <p>Remove <strong>${escHtml(participant.name)}</strong> from this trip?</p>
    <p style="margin-top:.5rem;color:var(--text-muted);font-size:.85rem">
      Members with associated expenses cannot be removed.</p>
    <div class="form-actions" style="margin-top:1rem">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-danger" id="confirm-remove-btn">Remove</button>
    </div>
  `);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('confirm-remove-btn').addEventListener('click', async () => {
    try {
      await del(`/trips/${trip.id}/participants/${participant.id}`);
      closeModal();
      toast(`${participant.name} removed`, 'default');
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// AI CHAT — Natural language expense entry
// ---------------------------------------------------------------------------

async function initAiChat(trip, tripId) {
  const chatBar = document.getElementById('ai-chat-bar');
  if (!chatBar) return;

  try {
    const { enabled } = await get('/ai-enabled');
    if (!enabled) return;
  } catch {
    return;
  }

  chatBar.classList.remove('hidden');

  const form    = document.getElementById('ai-chat-form');
  const input   = document.getElementById('ai-chat-input');
  const results = document.getElementById('ai-parsed-results');
  const sendBtn = form.querySelector('.ai-chat-send');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    sendBtn.disabled = true;
    sendBtn.textContent = '…';
    results.innerHTML = '';

    try {
      const { expenses } = await post(`/trips/${tripId}/parse-expense`, { message });

      if (!expenses || expenses.length === 0) {
        toast('Could not parse any expenses. Try being more specific or use the form.', 'error');
        return;
      }

      input.value = '';
      for (const expense of expenses) {
        results.appendChild(renderAiExpenseCard(trip, expense, tripId, expenses));
      }
    } catch {
      toast('Could not parse the message — try the form instead.', 'error');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
  });
}

function renderAiExpenseCard(trip, parsed, tripId, aiBatchExpenses = []) {
  const card = document.createElement('div');
  card.className = 'ai-expense-card';
  const fxRateCache = new Map();

  const payerName      = parsed.paidByName || '?';
  const splitNames     = parsed.splitBetweenNames?.join(', ') || '?';
  // Validate parsed currency (must be a 3-letter ISO code present in the known list); fall back to trip currency
  const parsedCurrency = (parsed.currency && /^[A-Z]{3}$/.test(parsed.currency)) ? parsed.currency : null;
  const displayCurrency = parsedCurrency || trip.currency;
  const currencyMismatch = parsedCurrency && parsedCurrency !== trip.currency;

  card.innerHTML = `
    <div class="ai-expense-card-body">
      <div class="ai-expense-card-desc">${escHtml(parsed.description || 'Untitled')}</div>
      <div class="ai-expense-card-meta">
        Paid by <strong>${escHtml(payerName)}</strong>
        · Split: ${escHtml(splitNames)}
        · <time>${escHtml(parsed.date || '')}</time>
        ${currencyMismatch ? `· <span class="ai-currency-warning">⚠ Currency: ${escHtml(parsed.currency)} (trip uses ${escHtml(trip.currency)})</span>` : ''}
      </div>
    </div>
    <div class="ai-expense-card-amount">${fmt(parsed.amount || 0, displayCurrency)}</div>
    <div class="ai-expense-card-actions">
      <button class="btn btn-primary btn-sm ai-add-btn">Add</button>
      <button class="btn btn-secondary btn-sm ai-edit-btn">Edit</button>
      <button class="btn btn-ghost btn-sm ai-dismiss-btn" aria-label="Dismiss">✕</button>
    </div>
  `;

  card.querySelector('.ai-add-btn').addEventListener('click', async () => {
    if (!parsed.paidBy || !parsed.splitBetween?.length) {
      toast('Could not match all participant names — use Edit to fill in manually.', 'error');
      return;
    }
    const btn = card.querySelector('.ai-add-btn');
    btn.disabled = true;
    btn.textContent = '…';
    try {
      const convertedAmountCache = new WeakMap();

      async function getComparableAmountAndFields(expenseLike) {
        const expenseCurrency = (expenseLike.currency && /^[A-Z]{3}$/.test(expenseLike.currency))
          ? expenseLike.currency
          : null;
        const needsConversion = expenseCurrency && expenseCurrency !== trip.currency;
        let amount = Number(expenseLike.amount);
        const extraFields = {};

        if (needsConversion) {
          if (convertedAmountCache.has(expenseLike)) {
            amount = convertedAmountCache.get(expenseLike);
          } else {
            const date = expenseLike.date || new Date().toISOString().split('T')[0];
            const rateCacheKey = `${date}:${expenseCurrency}:${trip.currency}`;
            let rate = fxRateCache.get(rateCacheKey);
            if (typeof rate !== 'number') {
              const convUrl = new URL(`https://api.frankfurter.dev/v1/${encodeURIComponent(date)}`);
              convUrl.searchParams.set('from', expenseCurrency);
              convUrl.searchParams.set('to', trip.currency);
              const convRes = await fetch(convUrl);
              if (!convRes.ok) throw new Error('Could not fetch currency conversion');
              const convData = await convRes.json();
              rate = convData.rates?.[trip.currency];
              if (typeof rate !== 'number' || !Number.isFinite(rate)) {
                throw new Error(`Could not convert ${expenseCurrency} to ${trip.currency}`);
              }
              fxRateCache.set(rateCacheKey, rate);
            }
            amount = Math.round(Number(expenseLike.amount) * rate * 100) / 100;
            convertedAmountCache.set(expenseLike, amount);
          }
          extraFields.originalCurrency = expenseCurrency;
          extraFields.originalAmount   = expenseLike.amount;
          extraFields.convertedAmount  = amount;
        } else if (Number.isFinite(amount)) {
          convertedAmountCache.set(expenseLike, amount);
        }

        return { amount, extraFields };
      }

      const { amount, extraFields } = await getComparableAmountAndFields(parsed);
      const comparisons = [...trip.expenses];
      for (const [peerIndex, peer] of aiBatchExpenses.entries()) {
        if (peer === parsed) continue;
        const { amount: peerAmount } = await getComparableAmountAndFields(peer);
        comparisons.push({
          id: `ai-${peerIndex}`,
          amount: peerAmount,
          description: peer.description || '',
          date: peer.date || '',
        });
      }
      const dup = findDuplicate(
        { description: parsed.description || '', amount, date: parsed.date || '' },
        comparisons
      );
      if (dup && card.dataset.dupDismissed !== 'true') {
        let warning = card.querySelector('.ai-dup-warning');
        if (!warning) {
          warning = document.createElement('div');
          warning.className = 'ai-dup-warning';
          card.querySelector('.ai-expense-card-actions').before(warning);
        }
        warning.innerHTML =
          `⚠️ This looks similar to "${escHtml(dup.description)}" (${escHtml(fmt(dup.amount, trip.currency))}) added on ${escHtml(dup.date)}`;
        card.dataset.dupDismissed = 'true';
        btn.disabled = false;
        btn.textContent = 'Add Anyway';
        return;
      }

      await post(`/trips/${tripId}/expenses`, {
        description:   parsed.description,
        amount,
        paidBy:        parsed.paidBy,
        splitBetween:  parsed.splitBetween,
        date:          parsed.date,
        ...extraFields,
      });
      toast('Expense added 💸', 'success');
      card.remove();
      renderTripDetail(tripId);
    } catch (err) {
      toast(err.message || 'Could not add expense', 'error');
      btn.disabled = false;
      btn.textContent = 'Add';
    }
  });

  card.querySelector('.ai-edit-btn').addEventListener('click', async () => {
    // Re-fetch the trip so the edit modal sees any participants that were auto-created during parsing
    let latestTrip = trip;
    try { latestTrip = await get(`/trips/${tripId}`); } catch { /* fall back to current trip */ }
    showAddExpenseModal(latestTrip, () => {
      card.remove();
      renderTripDetail(tripId);
    }, parsed);
  });

  card.querySelector('.ai-dismiss-btn').addEventListener('click', () => card.remove());

  return card;
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Currency list
// ---------------------------------------------------------------------------

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'DKK', name: 'Danish Krone' },
];
