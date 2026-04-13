'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE_OVERRIDE || path.join(__dirname, 'data', 'trips.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { trips: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { trips: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// API Routes — Trips
// ---------------------------------------------------------------------------

// List all trips
app.get('/api/trips', (req, res) => {
  const data = loadData();
  const summary = data.trips.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    currency: t.currency,
    participantCount: t.participants.length,
    expenseCount: t.expenses.length,
    totalAmount: t.expenses.reduce((sum, e) => sum + e.amount, 0),
    createdAt: t.createdAt,
  }));
  res.json(summary);
});

// Create a trip
app.post('/api/trips', (req, res) => {
  const { name, description, currency } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Trip name is required' });
  }
  const data = loadData();
  const trip = {
    id: uuidv4(),
    name: name.trim(),
    description: (description || '').trim(),
    currency: (currency || 'USD').trim(),
    participants: [],
    expenses: [],
    createdAt: new Date().toISOString(),
  };
  data.trips.push(trip);
  saveData(data);
  res.status(201).json(trip);
});

// Get a single trip
app.get('/api/trips/:id', (req, res) => {
  const data = loadData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json(trip);
});

// Update a trip's name / description / currency
app.put('/api/trips/:id', (req, res) => {
  const data = loadData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const { name, description, currency } = req.body;
  if (name !== undefined) trip.name = name.trim();
  if (description !== undefined) trip.description = description.trim();
  if (currency !== undefined) trip.currency = currency.trim();
  saveData(data);
  res.json(trip);
});

// Delete a trip
app.delete('/api/trips/:id', (req, res) => {
  const data = loadData();
  const idx = data.trips.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Trip not found' });
  data.trips.splice(idx, 1);
  saveData(data);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// API Routes — Participants
// ---------------------------------------------------------------------------

// Add a participant
app.post('/api/trips/:id/participants', (req, res) => {
  const data = loadData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Participant name is required' });
  }
  const participant = { id: uuidv4(), name: name.trim() };
  trip.participants.push(participant);
  saveData(data);
  res.status(201).json(participant);
});

// Remove a participant (only if they have no expenses)
app.delete('/api/trips/:id/participants/:pid', (req, res) => {
  const data = loadData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const pidx = trip.participants.findIndex((p) => p.id === req.params.pid);
  if (pidx === -1) return res.status(404).json({ error: 'Participant not found' });

  const hasExpenses = trip.expenses.some(
    (e) =>
      e.paidBy === req.params.pid || e.splitBetween.includes(req.params.pid)
  );
  if (hasExpenses) {
    return res.status(400).json({
      error:
        'Cannot remove a participant who is part of one or more expenses. Delete those expenses first.',
    });
  }

  trip.participants.splice(pidx, 1);
  saveData(data);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// API Routes — Expenses
// ---------------------------------------------------------------------------

// Add an expense
app.post('/api/trips/:id/expenses', (req, res) => {
  const data = loadData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const { description, amount, paidBy, splitBetween, date, originalCurrency, originalAmount, convertedAmount } = req.body;

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

  if (originalCurrency && originalCurrency !== trip.currency) {
    expense.originalCurrency = originalCurrency;
    expense.originalAmount = typeof originalAmount === 'number' ? originalAmount : amount;
    expense.convertedAmount = typeof convertedAmount === 'number' ? convertedAmount : amount;
  }
  trip.expenses.push(expense);
  saveData(data);
  res.status(201).json(expense);
});

// Update an expense
app.put('/api/trips/:id/expenses/:eid', (req, res) => {
  const data = loadData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const expense = trip.expenses.find((e) => e.id === req.params.eid);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  const { description, amount, paidBy, splitBetween, date, originalCurrency, originalAmount, convertedAmount } = req.body;
  if (description !== undefined) expense.description = description.trim();
  if (amount !== undefined) {
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    expense.amount = amount;
  }
  if (paidBy !== undefined) {
    if (!trip.participants.find((p) => p.id === paidBy)) {
      return res.status(400).json({ error: 'paidBy must be a valid participant' });
    }
    expense.paidBy = paidBy;
  }
  if (splitBetween !== undefined) {
    if (
      !Array.isArray(splitBetween) ||
      splitBetween.length === 0 ||
      !splitBetween.every((id) => trip.participants.find((p) => p.id === id))
    ) {
      return res.status(400).json({ error: 'splitBetween must list valid participants' });
    }
    expense.splitBetween = splitBetween;
  }
  if (date !== undefined) expense.date = date;

  if (originalCurrency !== undefined) {
    if (originalCurrency && originalCurrency !== trip.currency) {
      expense.originalCurrency = originalCurrency;
      if (typeof originalAmount === 'number') expense.originalAmount = originalAmount;
      if (typeof convertedAmount === 'number') expense.convertedAmount = convertedAmount;
    } else {
      // Currency changed back to trip currency — clear conversion fields
      delete expense.originalCurrency;
      delete expense.originalAmount;
      delete expense.convertedAmount;
    }
  }

  saveData(data);
  res.json(expense);
});

// Delete an expense
app.delete('/api/trips/:id/expenses/:eid', (req, res) => {
  const data = loadData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const eidx = trip.expenses.findIndex((e) => e.id === req.params.eid);
  if (eidx === -1) return res.status(404).json({ error: 'Expense not found' });
  trip.expenses.splice(eidx, 1);
  saveData(data);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// API Routes — Balances
// ---------------------------------------------------------------------------

app.get('/api/trips/:id/balances', (req, res) => {
  const data = loadData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json(calculateBalances(trip));
});

// ---------------------------------------------------------------------------
// API Routes — AI Parse Expense
// ---------------------------------------------------------------------------

// Report whether the AI feature is available
app.get('/api/ai-enabled', (req, res) => {
  res.json({ enabled: !!process.env.OPENAI_API_KEY });
});

// Parse a natural-language message into structured expense(s)
app.post('/api/trips/:id/parse-expense', async (req, res) => {
  const data = loadData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'AI parsing is not configured (no OPENAI_API_KEY set)' });
  }

  const today = new Date().toISOString().split('T')[0];
  const participantNames = trip.participants.map((p) => p.name).join(', ') || 'none';

  const systemPrompt =
    `You are a cost-splitting assistant. Extract expense information from the user's message.\n` +
    `Trip context:\n` +
    `- Participants: ${participantNames}\n` +
    `- Currency: ${trip.currency}\n` +
    `- Today's date: ${today}\n\n` +
    `Return ONLY a JSON array of expense objects. Each object must have:\n` +
    `- description: string (what was bought/paid for)\n` +
    `- amount: number (positive, no currency symbols)\n` +
    `- paidBy: string (name of who paid, must match one of the participants)\n` +
    `- splitBetween: array of strings (participant names sharing this expense)\n` +
    `- date: string (YYYY-MM-DD, use today if not specified)\n\n` +
    `If you cannot confidently parse the expense return an empty array [].\n` +
    `Return only the JSON array, no other text, no markdown fences.`;

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message.trim() },
        ],
        temperature: 0,
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.json().catch(() => ({}));
      return res.status(502).json({ error: errBody.error?.message || 'AI service error' });
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '[]';

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return res.status(422).json({ error: 'AI returned unparseable response', raw: rawContent });
    }

    if (!Array.isArray(parsed)) {
      return res.status(422).json({ error: 'AI returned unexpected format' });
    }

    // Map participant names to IDs (case-insensitive fuzzy match)
    function findParticipant(name) {
      const lower = (name || '').toLowerCase().trim();
      return (
        trip.participants.find((p) => p.name.toLowerCase() === lower) ||
        trip.participants.find((p) => p.name.toLowerCase().startsWith(lower)) ||
        trip.participants.find((p) => lower.startsWith(p.name.toLowerCase())) ||
        null
      );
    }

    const expenses = parsed.map((item) => {
      const payer = findParticipant(item.paidBy);
      const splitParticipants = Array.isArray(item.splitBetween)
        ? item.splitBetween.map(findParticipant).filter(Boolean)
        : [];
      return {
        description: String(item.description || '').trim(),
        amount: Number(item.amount) || 0,
        paidBy: payer ? payer.id : null,
        paidByName: payer ? payer.name : (item.paidBy || null),
        splitBetween: splitParticipants.map((p) => p.id),
        splitBetweenNames: splitParticipants.map((p) => p.name),
        date: item.date || today,
      };
    });

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
  app.listen(PORT, () => {
    console.log(`🍌 banana/splitt is running at http://localhost:${PORT}`);
  });
}

module.exports = { app, calculateBalances };
