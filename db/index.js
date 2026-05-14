'use strict';

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

let pool = null;

/**
 * Initialise the SQL connection pool and run the schema migration.
 * Call once at startup.
 */
async function init() {
  const connStr = process.env.SQL_CONNECTION_STRING;
  if (!connStr) throw new Error('SQL_CONNECTION_STRING env var is required');

  pool = await sql.connect(connStr);

  // Run schema migration
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Split on GO-like boundaries (each IF NOT EXISTS block) isn't needed —
  // mssql driver handles multiple statements in one batch.
  await pool.request().query(schema);
}

/**
 * Close the connection pool gracefully.
 */
async function close() {
  if (pool) await pool.close();
  pool = null;
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

async function listTrips() {
  const result = await pool.request().query(`
    SELECT t.id, t.name, t.description, t.currency,
           t.startDate, t.endDate, t.budget, t.createdAt,
           (SELECT COUNT(*) FROM participants p WHERE p.tripId = t.id) AS participantCount,
           (SELECT COUNT(*) FROM expenses e WHERE e.tripId = t.id) AS expenseCount,
           ISNULL((SELECT SUM(e.amount) FROM expenses e WHERE e.tripId = t.id), 0) AS totalAmount
    FROM trips t
    ORDER BY t.createdAt DESC
  `);
  return result.recordset.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    currency: r.currency,
    startDate: r.startDate || null,
    endDate: r.endDate || null,
    budget: r.budget || null,
    participantCount: r.participantCount,
    expenseCount: r.expenseCount,
    totalAmount: r.totalAmount,
    createdAt: r.createdAt,
  }));
}

async function getTrip(id) {
  const tripResult = await pool.request()
    .input('id', sql.NVarChar, id)
    .query('SELECT * FROM trips WHERE id = @id');
  if (tripResult.recordset.length === 0) return null;
  const trip = tripResult.recordset[0];

  const participants = await pool.request()
    .input('tripId', sql.NVarChar, id)
    .query('SELECT id, name FROM participants WHERE tripId = @tripId');

  const expenses = await pool.request()
    .input('tripId', sql.NVarChar, id)
    .query('SELECT * FROM expenses WHERE tripId = @tripId ORDER BY date, createdAt');

  const splits = await pool.request()
    .input('tripId', sql.NVarChar, id)
    .query(`
      SELECT es.expenseId, es.participantId
      FROM expense_splits es
      INNER JOIN expenses e ON e.id = es.expenseId
      WHERE e.tripId = @tripId
    `);

  const splitMap = {};
  for (const s of splits.recordset) {
    if (!splitMap[s.expenseId]) splitMap[s.expenseId] = [];
    splitMap[s.expenseId].push(s.participantId);
  }

  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    currency: trip.currency,
    startDate: trip.startDate || null,
    endDate: trip.endDate || null,
    budget: trip.budget || null,
    createdAt: trip.createdAt,
    participants: participants.recordset.map(p => ({ id: p.id, name: p.name })),
    expenses: expenses.recordset.map(e => {
      const exp = {
        id: e.id,
        description: e.description,
        amount: e.amount,
        paidBy: e.paidBy,
        splitBetween: splitMap[e.id] || [],
        date: e.date,
        createdAt: e.createdAt,
      };
      if (e.category) exp.category = e.category;
      if (e.originalCurrency) {
        exp.originalCurrency = e.originalCurrency;
        exp.originalAmount = e.originalAmount;
        exp.convertedAmount = e.convertedAmount;
      }
      return exp;
    }),
  };
}

async function createTrip(trip) {
  await pool.request()
    .input('id', sql.NVarChar, trip.id)
    .input('name', sql.NVarChar, trip.name)
    .input('description', sql.NVarChar, trip.description)
    .input('currency', sql.NVarChar, trip.currency)
    .input('startDate', sql.NVarChar, trip.startDate)
    .input('endDate', sql.NVarChar, trip.endDate)
    .input('budget', sql.Float, trip.budget)
    .input('createdAt', sql.NVarChar, trip.createdAt)
    .query(`INSERT INTO trips (id, name, description, currency, startDate, endDate, budget, createdAt)
            VALUES (@id, @name, @description, @currency, @startDate, @endDate, @budget, @createdAt)`);
  return trip;
}

async function updateTrip(id, fields) {
  const trip = await getTrip(id);
  if (!trip) return null;

  const updated = { ...trip, ...fields };
  await pool.request()
    .input('id', sql.NVarChar, id)
    .input('name', sql.NVarChar, updated.name)
    .input('description', sql.NVarChar, updated.description)
    .input('currency', sql.NVarChar, updated.currency)
    .input('startDate', sql.NVarChar, updated.startDate)
    .input('endDate', sql.NVarChar, updated.endDate)
    .input('budget', sql.Float, updated.budget)
    .query(`UPDATE trips SET name=@name, description=@description, currency=@currency,
            startDate=@startDate, endDate=@endDate, budget=@budget WHERE id=@id`);
  return getTrip(id);
}

async function deleteTrip(id) {
  const result = await pool.request()
    .input('id', sql.NVarChar, id)
    .query('DELETE FROM trips WHERE id = @id');
  return result.rowsAffected[0] > 0;
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

async function addParticipant(tripId, participant) {
  await pool.request()
    .input('id', sql.NVarChar, participant.id)
    .input('tripId', sql.NVarChar, tripId)
    .input('name', sql.NVarChar, participant.name)
    .query('INSERT INTO participants (id, tripId, name) VALUES (@id, @tripId, @name)');
  return participant;
}

async function removeParticipant(tripId, participantId) {
  // Check for expenses referencing this participant
  const expCheck = await pool.request()
    .input('pid', sql.NVarChar, participantId)
    .input('tripId', sql.NVarChar, tripId)
    .query(`
      SELECT COUNT(*) AS cnt FROM expenses WHERE tripId = @tripId AND paidBy = @pid
      UNION ALL
      SELECT COUNT(*) AS cnt FROM expense_splits es
      INNER JOIN expenses e ON e.id = es.expenseId
      WHERE e.tripId = @tripId AND es.participantId = @pid
    `);
  const total = expCheck.recordset.reduce((sum, r) => sum + r.cnt, 0);
  if (total > 0) {
    return { error: 'Cannot remove a participant who is part of one or more expenses. Delete those expenses first.' };
  }

  const result = await pool.request()
    .input('id', sql.NVarChar, participantId)
    .input('tripId', sql.NVarChar, tripId)
    .query('DELETE FROM participants WHERE id = @id AND tripId = @tripId');
  return result.rowsAffected[0] > 0 ? true : { error: 'Participant not found' };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

async function addExpense(tripId, expense) {
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    await transaction.request()
      .input('id', sql.NVarChar, expense.id)
      .input('tripId', sql.NVarChar, tripId)
      .input('description', sql.NVarChar, expense.description)
      .input('amount', sql.Float, expense.amount)
      .input('paidBy', sql.NVarChar, expense.paidBy)
      .input('date', sql.NVarChar, expense.date)
      .input('category', sql.NVarChar, expense.category || null)
      .input('originalCurrency', sql.NVarChar, expense.originalCurrency || null)
      .input('originalAmount', sql.Float, expense.originalAmount || null)
      .input('convertedAmount', sql.Float, expense.convertedAmount || null)
      .input('createdAt', sql.NVarChar, expense.createdAt)
      .query(`INSERT INTO expenses (id, tripId, description, amount, paidBy, date, category,
              originalCurrency, originalAmount, convertedAmount, createdAt)
              VALUES (@id, @tripId, @description, @amount, @paidBy, @date, @category,
              @originalCurrency, @originalAmount, @convertedAmount, @createdAt)`);

    for (const pid of expense.splitBetween) {
      await transaction.request()
        .input('expenseId', sql.NVarChar, expense.id)
        .input('participantId', sql.NVarChar, pid)
        .query('INSERT INTO expense_splits (expenseId, participantId) VALUES (@expenseId, @participantId)');
    }

    await transaction.commit();
    return expense;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function updateExpense(tripId, expenseId, fields) {
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    // Get current expense
    const current = await transaction.request()
      .input('id', sql.NVarChar, expenseId)
      .input('tripId', sql.NVarChar, tripId)
      .query('SELECT * FROM expenses WHERE id = @id AND tripId = @tripId');
    if (current.recordset.length === 0) {
      await transaction.rollback();
      return null;
    }
    const existing = current.recordset[0];

    const updated = {
      description: fields.description !== undefined ? fields.description : existing.description,
      amount: fields.amount !== undefined ? fields.amount : existing.amount,
      paidBy: fields.paidBy !== undefined ? fields.paidBy : existing.paidBy,
      date: fields.date !== undefined ? fields.date : existing.date,
      category: fields.category !== undefined ? fields.category : existing.category,
      originalCurrency: existing.originalCurrency,
      originalAmount: existing.originalAmount,
      convertedAmount: existing.convertedAmount,
    };

    if (fields.originalCurrency !== undefined) {
      if (fields.originalCurrency) {
        updated.originalCurrency = fields.originalCurrency;
        if (typeof fields.originalAmount === 'number') updated.originalAmount = fields.originalAmount;
        if (typeof fields.convertedAmount === 'number') updated.convertedAmount = fields.convertedAmount;
      } else {
        updated.originalCurrency = null;
        updated.originalAmount = null;
        updated.convertedAmount = null;
      }
    }

    await transaction.request()
      .input('id', sql.NVarChar, expenseId)
      .input('tripId', sql.NVarChar, tripId)
      .input('description', sql.NVarChar, updated.description)
      .input('amount', sql.Float, updated.amount)
      .input('paidBy', sql.NVarChar, updated.paidBy)
      .input('date', sql.NVarChar, updated.date)
      .input('category', sql.NVarChar, updated.category)
      .input('originalCurrency', sql.NVarChar, updated.originalCurrency)
      .input('originalAmount', sql.Float, updated.originalAmount)
      .input('convertedAmount', sql.Float, updated.convertedAmount)
      .query(`UPDATE expenses SET description=@description, amount=@amount, paidBy=@paidBy,
              date=@date, category=@category, originalCurrency=@originalCurrency,
              originalAmount=@originalAmount, convertedAmount=@convertedAmount
              WHERE id=@id AND tripId=@tripId`);

    if (fields.splitBetween !== undefined) {
      await transaction.request()
        .input('expenseId', sql.NVarChar, expenseId)
        .query('DELETE FROM expense_splits WHERE expenseId = @expenseId');
      for (const pid of fields.splitBetween) {
        await transaction.request()
          .input('expenseId', sql.NVarChar, expenseId)
          .input('participantId', sql.NVarChar, pid)
          .query('INSERT INTO expense_splits (expenseId, participantId) VALUES (@expenseId, @participantId)');
      }
    }

    await transaction.commit();

    // Return the updated expense in the same shape as the JSON version
    const splitResult = await pool.request()
      .input('expenseId', sql.NVarChar, expenseId)
      .query('SELECT participantId FROM expense_splits WHERE expenseId = @expenseId');
    const splitBetween = splitResult.recordset.map(r => r.participantId);

    const exp = {
      id: expenseId,
      description: updated.description,
      amount: updated.amount,
      paidBy: updated.paidBy,
      splitBetween,
      date: updated.date,
      createdAt: existing.createdAt,
    };
    if (updated.category) exp.category = updated.category;
    if (updated.originalCurrency) {
      exp.originalCurrency = updated.originalCurrency;
      exp.originalAmount = updated.originalAmount;
      exp.convertedAmount = updated.convertedAmount;
    }
    return exp;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function deleteExpense(tripId, expenseId) {
  const result = await pool.request()
    .input('id', sql.NVarChar, expenseId)
    .input('tripId', sql.NVarChar, tripId)
    .query('DELETE FROM expenses WHERE id = @id AND tripId = @tripId');
  return result.rowsAffected[0] > 0;
}

module.exports = {
  init,
  close,
  listTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  addParticipant,
  removeParticipant,
  addExpense,
  updateExpense,
  deleteExpense,
};
