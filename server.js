'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Persistence mode — SQL when SQL_CONNECTION_STRING is set, JSON otherwise
// ---------------------------------------------------------------------------
const useSQL = !!process.env.SQL_CONNECTION_STRING;
let db;

if (useSQL) {
  db = require('./db');
} else {
  // JSON file persistence (local dev)
  const DATA_FILE = process.env.DATA_FILE_OVERRIDE || path.join(__dirname, 'data', 'trips.json');
  if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  }

  function loadData() {
    if (!fs.existsSync(DATA_FILE)) return { trips: [] };
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { return { trips: [] }; }
  }
  function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  // Wrap JSON persistence in the same async interface as db module
  db = {
    init: async () => {},
    close: async () => {},
    listTrips: async () => {
      const data = loadData();
      return data.trips.map((t) => ({
        id: t.id, name: t.name, description: t.description, currency: t.currency,
        startDate: t.startDate ?? null, endDate: t.endDate ?? null, budget: t.budget ?? null,
        participantCount: t.participants.length, expenseCount: t.expenses.length,
        totalAmount: t.expenses.reduce((sum, e) => sum + e.amount, 0), createdAt: t.createdAt,
      }));
    },
    getTrip: async (id) => {
      const data = loadData();
      return data.trips.find((t) => t.id === id) || null;
    },
    createTrip: async (trip) => {
      const data = loadData();
      trip.participants = []; trip.expenses = [];
      data.trips.push(trip);
      saveData(data);
      return trip;
    },
    updateTrip: async (id, fields) => {
      const data = loadData();
      const trip = data.trips.find((t) => t.id === id);
      if (!trip) return null;
      Object.assign(trip, fields);
      saveData(data);
      return trip;
    },
    deleteTrip: async (id) => {
      const data = loadData();
      const idx = data.trips.findIndex((t) => t.id === id);
      if (idx === -1) return false;
      data.trips.splice(idx, 1);
      saveData(data);
      return true;
    },
    addParticipant: async (tripId, participant) => {
      const data = loadData();
      const trip = data.trips.find((t) => t.id === tripId);
      if (!trip) return null;
      trip.participants.push(participant);
      saveData(data);
      return participant;
    },
    removeParticipant: async (tripId, pid) => {
      const data = loadData();
      const trip = data.trips.find((t) => t.id === tripId);
      if (!trip) return { error: 'Trip not found' };
      const pidx = trip.participants.findIndex((p) => p.id === pid);
      if (pidx === -1) return { error: 'Participant not found' };
      const hasExpenses = trip.expenses.some(
        (e) => e.paidBy === pid || e.splitBetween.includes(pid)
      );
      if (hasExpenses) return { error: 'Cannot remove a participant who is part of one or more expenses. Delete those expenses first.' };
      trip.participants.splice(pidx, 1);
      saveData(data);
      return true;
    },
    addExpense: async (tripId, expense) => {
      const data = loadData();
      const trip = data.trips.find((t) => t.id === tripId);
      if (!trip) return null;
      trip.expenses.push(expense);
      saveData(data);
      return expense;
    },
    updateExpense: async (tripId, expenseId, fields) => {
      const data = loadData();
      const trip = data.trips.find((t) => t.id === tripId);
      if (!trip) return null;
      const expense = trip.expenses.find((e) => e.id === expenseId);
      if (!expense) return null;
      if (fields.description !== undefined) expense.description = fields.description;
      if (fields.amount !== undefined) expense.amount = fields.amount;
      if (fields.paidBy !== undefined) expense.paidBy = fields.paidBy;
      if (fields.splitBetween !== undefined) expense.splitBetween = fields.splitBetween;
      if (fields.date !== undefined) expense.date = fields.date;
      if (fields.category !== undefined) expense.category = String(fields.category).trim();
      if (fields.originalCurrency !== undefined) {
        if (fields.originalCurrency && fields.originalCurrency !== trip.currency) {
          expense.originalCurrency = fields.originalCurrency;
          if (typeof fields.originalAmount === 'number') expense.originalAmount = fields.originalAmount;
          if (typeof fields.convertedAmount === 'number') expense.convertedAmount = fields.convertedAmount;
        } else {
          delete expense.originalCurrency;
          delete expense.originalAmount;
          delete expense.convertedAmount;
        }
      }
      saveData(data);
      return expense;
    },
    deleteExpense: async (tripId, expenseId) => {
      const data = loadData();
      const trip = data.trips.find((t) => t.id === tripId);
      if (!trip) return false;
      const eidx = trip.expenses.findIndex((e) => e.id === expenseId);
      if (eidx === -1) return false;
      trip.expenses.splice(eidx, 1);
      saveData(data);
      return true;
    },
    // For AI parse-expense: save full data object after modifying trip in-place
    _saveTrip: async (tripId) => {
      // no-op; JSON db.addParticipant already saves.
    },
    _getLoadSave: () => {
      return { loadData, saveData };
    },
  };
}

// ---------------------------------------------------------------------------
// Balance calculation
// ---------------------------------------------------------------------------

/**
 * Given a trip, return per-person net balances and optimised settlement plan.
 * Positive balance  → person is owed money.
 * Negative balance  → person owes money.
 */
function calculateBalances(trip) {
  const participantMap = Object.fromEntries(
    trip.participants.map((p) => [p.id, p.name])
  );

  // Net balance per participant (positive = owed, negative = owes)
  const balances = {};
  for (const p of trip.participants) {
    balances[p.id] = 0;
  }

  for (const expense of trip.expenses) {
    const splitCount = expense.splitBetween.length;
    if (splitCount === 0) continue;
    const share = expense.amount / splitCount;

    // The payer gets credited the full amount
    balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;

    // Each person in the split is debited their share
    for (const pid of expense.splitBetween) {
      balances[pid] = (balances[pid] || 0) - share;
    }
  }

  // Build settlement transactions using a greedy algorithm
  const creditors = [];
  const debtors = [];

  for (const [id, balance] of Object.entries(balances)) {
    if (balance > 0.005) creditors.push({ id, amount: balance });
    else if (balance < -0.005) debtors.push({ id, amount: -balance });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, debtors[di].amount);
    settlements.push({
      from: debtors[di].id,
      fromName: participantMap[debtors[di].id] || debtors[di].id,
      to: creditors[ci].id,
      toName: participantMap[creditors[ci].id] || creditors[ci].id,
      amount: Math.round(transfer * 100) / 100,
    });
    creditors[ci].amount -= transfer;
    debtors[di].amount -= transfer;
    if (creditors[ci].amount < 0.005) ci++;
    if (debtors[di].amount < 0.005) di++;
  }

  const result = [];
  for (const p of trip.participants) {
    result.push({
      id: p.id,
      name: p.name,
      balance: Math.round((balances[p.id] || 0) * 100) / 100,
    });
  }

  return { balances: result, settlements };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '10kb' }));

// Security headers — must be before express.static so headers are sent on all responses
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '0');
  if (process.env.NODE_ENV === 'production' || process.env.WEBSITE_SITE_NAME) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// GitHub OAuth + JWT auth
// ---------------------------------------------------------------------------
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const AUTH_ENABLED = !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);

if (AUTH_ENABLED && JWT_SECRET === 'dev-secret-change-me') {
  console.error('FATAL: JWT_SECRET must be explicitly set when auth is enabled. Refusing to start.');
  process.exit(1);
}
const COOKIE_NAME = 'bs_token';
const AUTH_STATE_COOKIE = 'bs_auth_state';
const isSecureCookie = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod' || !!process.env.WEBSITE_SITE_NAME;

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

function setAuthStateCookie(res, state) {
  res.cookie(AUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/',
  });
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach((c) => {
    const [k, ...v] = c.split('=');
    if (!k) return;
    const value = v.join('=').trim();
    try {
      cookies[k.trim()] = decodeURIComponent(value);
    } catch {
      // Ignore malformed cookie values so they can't break auth parsing.
    }
  });
  return cookies;
}

function requireAuth(req, res, next) {
  if (!AUTH_ENABLED) return next(); // no OAuth configured — open access
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Auth status endpoint (always public)
app.get('/auth/me', (req, res) => {
  if (!AUTH_ENABLED) return res.json({ authenticated: true, authEnabled: false });
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return res.json({ authenticated: false, authEnabled: true, clientId: GITHUB_CLIENT_ID });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    return res.json({ authenticated: true, authEnabled: true, user });
  } catch {
    return res.json({ authenticated: false, authEnabled: true, clientId: GITHUB_CLIENT_ID });
  }
});

app.get('/auth/github', (req, res) => {
  if (!AUTH_ENABLED) return res.redirect('/');
  const state = crypto.randomBytes(32).toString('hex');
  setAuthStateCookie(res, state);
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/github/callback`;
  const ghUrl = `https://github.com/login/oauth/authorize?${new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
  }).toString()}`;
  return res.redirect(ghUrl);
});

// GitHub OAuth callback
app.get('/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code parameter');
  const cookies = parseCookies(req);
  const expectedState = cookies[AUTH_STATE_COOKIE];
  res.clearCookie(AUTH_STATE_COOKIE, { path: '/' });
  if (!state || !expectedState || state !== expectedState) {
    return res.status(400).send('Invalid auth state');
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error('GitHub OAuth token error:', tokenData);
      return res.status(401).send('GitHub authentication failed');
    }

    // Get user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'banana-splitt' },
    });
    const ghUser = await userRes.json();

    const jwtPayload = {
      id: String(ghUser.id),
      login: ghUser.login,
      name: ghUser.name || ghUser.login,
      avatar: ghUser.avatar_url,
    };
    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);
    res.redirect('/');
  } catch (err) {
    console.error('GitHub OAuth error:', err);
    res.status(500).send('Authentication failed');
  }
});

// Logout
app.post('/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// Protect all API routes
app.use('/api', requireAuth);

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate optional date fields startDate/endDate.
 * Returns an error string if invalid, null if valid.
 */
function validateDates(startDate, endDate) {
  if (startDate != null) {
    if (typeof startDate !== 'string' || !DATE_RE.test(startDate)) {
      return 'startDate must be a date in YYYY-MM-DD format';
    }
  }
  if (endDate != null) {
    if (typeof endDate !== 'string' || !DATE_RE.test(endDate)) {
      return 'endDate must be a date in YYYY-MM-DD format';
    }
  }
  if (startDate && endDate && endDate < startDate) {
    return 'endDate must be on or after startDate';
  }
  return null;
}

// ---------------------------------------------------------------------------
// API Routes — Trips
// ---------------------------------------------------------------------------

// List all trips
app.get('/api/trips', async (req, res) => {
  try {
    const summary = await db.listTrips();
    res.json(summary);
  } catch (err) {
    console.error('GET /api/trips error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a trip
app.post('/api/trips', async (req, res) => {
  const { name, description, currency, startDate, endDate, budget } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Trip name is required' });
  }
  const dateError = validateDates(startDate ?? null, endDate ?? null);
  if (dateError) return res.status(400).json({ error: dateError });
  try {
    const trip = await db.createTrip({
      id: uuidv4(),
      name: name.trim(),
      description: (description || '').trim(),
      currency: (currency || 'USD').trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      budget: typeof budget === 'number' && budget > 0 ? budget : null,
      participants: [],
      expenses: [],
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(trip);
  } catch (err) {
    console.error('POST /api/trips error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single trip
app.get('/api/trips/:id', async (req, res) => {
  try {
    const trip = await db.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    console.error('GET /api/trips/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a trip's name / description / currency / dates / budget
app.put('/api/trips/:id', async (req, res) => {
  try {
    const trip = await db.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { name, description, currency, startDate, endDate, budget } = req.body;
    const newStart = startDate !== undefined ? (startDate || null) : trip.startDate;
    const newEnd   = endDate   !== undefined ? (endDate   || null) : trip.endDate;
    const dateError = validateDates(newStart, newEnd);
    if (dateError) return res.status(400).json({ error: dateError });
    const fields = {};
    if (name !== undefined) fields.name = name.trim();
    if (description !== undefined) fields.description = description.trim();
    if (currency !== undefined) fields.currency = currency.trim();
    if (startDate !== undefined) fields.startDate = startDate || null;
    if (endDate !== undefined) fields.endDate = endDate || null;
    if (budget !== undefined) fields.budget = typeof budget === 'number' && budget > 0 ? budget : null;
    const updated = await db.updateTrip(req.params.id, fields);
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/trips/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a trip
app.delete('/api/trips/:id', async (req, res) => {
  try {
    const deleted = await db.deleteTrip(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Trip not found' });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/trips/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Participants
// ---------------------------------------------------------------------------

// Add a participant
app.post('/api/trips/:id/participants', async (req, res) => {
  try {
    const trip = await db.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Participant name is required' });
    }
    const participant = await db.addParticipant(req.params.id, { id: uuidv4(), name: name.trim() });
    res.status(201).json(participant);
  } catch (err) {
    console.error('POST /api/trips/:id/participants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove a participant (only if they have no expenses)
app.delete('/api/trips/:id/participants/:pid', async (req, res) => {
  try {
    const trip = await db.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const result = await db.removeParticipant(req.params.id, req.params.pid);
    if (result === true) return res.status(204).end();
    if (result && result.error) {
      const status = result.error.includes('Cannot remove') ? 400 : 404;
      return res.status(status).json({ error: result.error });
    }
    res.status(404).json({ error: 'Participant not found' });
  } catch (err) {
    console.error('DELETE /api/trips/:id/participants/:pid error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Expenses
// ---------------------------------------------------------------------------

// Add an expense
app.post('/api/trips/:id/expenses', async (req, res) => {
  try {
    const trip = await db.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { description, amount, paidBy, splitBetween, date, category, originalCurrency, originalAmount, convertedAmount } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Expense description is required' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (!trip.participants.find((p) => p.id === paidBy)) {
      return res.status(400).json({ error: 'paidBy must be a valid participant' });
    }
    if (
      !Array.isArray(splitBetween) ||
      splitBetween.length === 0 ||
      !splitBetween.every((id) => trip.participants.find((p) => p.id === id))
    ) {
      return res.status(400).json({ error: 'splitBetween must list valid participants' });
    }

    const expense = {
      id: uuidv4(),
      description: description.trim(),
      amount,
      paidBy,
      splitBetween,
      date: date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    if (category !== undefined) expense.category = String(category).trim();

    if (originalCurrency && originalCurrency !== trip.currency) {
      expense.originalCurrency = originalCurrency;
      expense.originalAmount = typeof originalAmount === 'number' ? originalAmount : amount;
      expense.convertedAmount = typeof convertedAmount === 'number' ? convertedAmount : amount;
    }
    const created = await db.addExpense(req.params.id, expense);
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/trips/:id/expenses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an expense
app.put('/api/trips/:id/expenses/:eid', async (req, res) => {
  try {
    const trip = await db.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { description, amount, paidBy, splitBetween, date, category, originalCurrency, originalAmount, convertedAmount } = req.body;

    // Validate fields if provided
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (paidBy !== undefined && !trip.participants.find((p) => p.id === paidBy)) {
      return res.status(400).json({ error: 'paidBy must be a valid participant' });
    }
    if (splitBetween !== undefined) {
      if (!Array.isArray(splitBetween) || splitBetween.length === 0 ||
          !splitBetween.every((id) => trip.participants.find((p) => p.id === id))) {
        return res.status(400).json({ error: 'splitBetween must list valid participants' });
      }
    }

    const fields = {};
    if (description !== undefined) fields.description = description.trim();
    if (amount !== undefined) fields.amount = amount;
    if (paidBy !== undefined) fields.paidBy = paidBy;
    if (splitBetween !== undefined) fields.splitBetween = splitBetween;
    if (date !== undefined) fields.date = date;
    if (category !== undefined) fields.category = String(category).trim();
    if (originalCurrency !== undefined) {
      fields.originalCurrency = originalCurrency;
      fields.originalAmount = originalAmount;
      fields.convertedAmount = convertedAmount;
    }

    const updated = await db.updateExpense(req.params.id, req.params.eid, fields);
    if (!updated) return res.status(404).json({ error: 'Expense not found' });
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/trips/:id/expenses/:eid error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an expense
app.delete('/api/trips/:id/expenses/:eid', async (req, res) => {
  try {
    const deleted = await db.deleteExpense(req.params.id, req.params.eid);
    if (!deleted) return res.status(404).json({ error: 'Expense not found' });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/trips/:id/expenses/:eid error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Balances
// ---------------------------------------------------------------------------

app.get('/api/trips/:id/balances', async (req, res) => {
  try {
    const trip = await db.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(calculateBalances(trip));
  } catch (err) {
    console.error('GET /api/trips/:id/balances error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// API Routes — AI Parse Expense
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AI provider helpers
// ---------------------------------------------------------------------------

function isAiConfigured() {
  return !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT)
    || !!process.env.OPENAI_API_KEY;
}

function buildAiRequest(systemPrompt, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // Azure OpenAI
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '');
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
    return {
      url: `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({ messages, temperature: 0 }),
    };
  }

  // Direct OpenAI
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0,
    }),
  };
}

// Report whether the AI feature is available
app.get('/api/ai-enabled', (req, res) => {
  res.json({ enabled: isAiConfigured() || !!process.env.MOCK_AI_RESPONSE });
});

// Parse a natural-language message into structured expense(s)
app.post('/api/trips/:id/parse-expense', async (req, res) => {
  const trip = await db.getTrip(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: 'message must be 500 characters or fewer' });
  }

  if (!isAiConfigured() && !process.env.MOCK_AI_RESPONSE) {
    return res.status(503).json({ error: 'AI parsing is not configured. Set AZURE_OPENAI_* or OPENAI_API_KEY env vars.' });
  }

  const today = new Date().toISOString().split('T')[0];
  // Build participant name list used in the prompt (may be empty on a brand-new trip)
  const participantNames = trip.participants.map((p) => p.name).join(', ');

  // Default date: most recent valid expense date, or today if none exist
  const lastExpenseDate = (trip.expenses || []).reduce((latest, expense) => {
    const expenseDate =
      typeof expense?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expense.date)
        ? expense.date
        : null;
    if (!expenseDate) return latest;
    if (!latest || expenseDate > latest) return expenseDate;
    return latest;
  }, null) || today;
  const systemPrompt =
    `You are a cost-splitting assistant. Extract expense information from the user's message.\n` +
    `Trip context:\n` +
    `- Participants: ${participantNames || 'none yet'}\n` +
    `- Trip currency: ${trip.currency}\n` +
    `- Default date (if not specified): ${lastExpenseDate}\n\n` +
    `Return ONLY a JSON array of expense objects. Each object must have:\n` +
    `- description: string (what was bought/paid for)\n` +
    `- amount: number (positive, no currency symbols)\n` +
    `- paidBy: string (name of who paid — may be a new person not in the participants list)\n` +
    `- splitBetween: array of strings (participant names sharing this expense${participantNames ? `; if not specified use ALL participants: ${participantNames}` : ''})\n` +
    `- date: string (YYYY-MM-DD; use the default date above if not specified)\n` +
    `- currency: string (ISO currency code — interpret written names: "euros"→EUR, "dollars"→USD, "pounds"→GBP, "yen"→JPY, "rupees"→INR; default to ${trip.currency} if not mentioned)\n\n` +
    `Rules:\n` +
    `- The payer may be someone not yet in the participants list — include their name anyway.\n` +
    `- Only return [] if the message is clearly not an expense (e.g. a greeting). If you can extract a description and amount, return a result using reasonable defaults.\n` +
    `Return only the JSON array, no other text, no markdown fences.`;

  try {
    let rawContent;
    if (process.env.MOCK_AI_RESPONSE) {
      rawContent = process.env.MOCK_AI_RESPONSE;
    } else {
      const aiReq = buildAiRequest(systemPrompt, message.trim());
      const aiRes = await fetch(aiReq.url, {
        method: 'POST',
        headers: aiReq.headers,
        body: aiReq.body,
      });

      if (!aiRes.ok) {
        const errBody = await aiRes.json().catch(() => ({}));
        return res.status(502).json({ error: errBody.error?.message || 'AI service error' });
      }

      const aiData = await aiRes.json();
      rawContent = aiData.choices?.[0]?.message?.content || '[]';
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return res.status(422).json({ error: 'AI returned unparseable response', raw: rawContent });
    }

    if (!Array.isArray(parsed)) {
      return res.status(422).json({ error: 'AI returned unexpected format' });
    }

    // Map participant names to IDs (case-insensitive fuzzy match), auto-creating if not found.

    function findParticipant(name) {
      const lower = (name || '').toLowerCase().trim();
      return (
        trip.participants.find((p) => p.name.toLowerCase() === lower) ||
        trip.participants.find((p) => p.name.toLowerCase().startsWith(lower)) ||
        trip.participants.find((p) => lower.startsWith(p.name.toLowerCase())) ||
        null
      );
    }

    async function findOrCreateParticipant(name) {
      const trimmed = (name || '').trim();
      if (!trimmed) return null;
      const existing = findParticipant(trimmed);
      if (existing) return existing;
      const newParticipant = { id: uuidv4(), name: trimmed };
      const participant = await db.addParticipant(req.params.id, newParticipant);
      if (!participant) {
        console.error(`Failed to persist parsed participant "${trimmed}" for trip ${req.params.id}`);
        return null;
      }
      trip.participants.push(participant);
      return participant;
    }

    const expenses = [];
    for (const item of parsed) {
      const payer = await findOrCreateParticipant(item.paidBy);
      // Default to ALL current participants (including any newly created payer) when omitted
      const splitParticipants = [];
      if (Array.isArray(item.splitBetween) && item.splitBetween.length > 0) {
        for (const n of item.splitBetween) {
          const p = await findOrCreateParticipant(n);
          if (p) splitParticipants.push(p);
        }
      } else {
        splitParticipants.push(...trip.participants.slice());
      }
      // Normalize and validate currency; fall back to trip currency if invalid
      const rawCurrency = (item.currency || '').trim().toUpperCase();
      const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : trip.currency;
      expenses.push({
        description: String(item.description || '').trim(),
        amount: Number(item.amount) || 0,
        paidBy: payer ? payer.id : null,
        paidByName: payer ? payer.name : (item.paidBy || null),
        splitBetween: splitParticipants.map((p) => p.id),
        splitBetweenNames: splitParticipants.map((p) => p.name),
        date: item.date || lastExpenseDate,
        currency,
      });
    }

    res.json({ expenses });
  } catch (err) {
    console.error('AI parse-expense error:', err);
    res.status(502).json({ error: 'Failed to reach AI service' });
  }
});

// ---------------------------------------------------------------------------
// SPA fallback – serve index.html for any non-API route
// ---------------------------------------------------------------------------
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Start (only when run directly, not when required as a module)
// ---------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    await db.init();
    app.listen(PORT, () => {
      console.log(`🍌 banana/splitt is running at http://localhost:${PORT}`);
    });
  })();
}

module.exports = { app, calculateBalances, db };
