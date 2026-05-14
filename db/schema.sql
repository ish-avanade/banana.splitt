-- Schema for banana.splitt on Azure SQL Database
-- Run once to initialize the database.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'trips')
CREATE TABLE trips (
  id           NVARCHAR(36)   PRIMARY KEY,
  name         NVARCHAR(255)  NOT NULL,
  description  NVARCHAR(1000) NOT NULL DEFAULT '',
  currency     NVARCHAR(10)   NOT NULL DEFAULT 'USD',
  startDate    NVARCHAR(10)   NULL,
  endDate      NVARCHAR(10)   NULL,
  budget       FLOAT          NULL,
  createdAt    NVARCHAR(30)   NOT NULL
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'participants')
CREATE TABLE participants (
  id      NVARCHAR(36)   PRIMARY KEY,
  tripId  NVARCHAR(36)   NOT NULL,
  name    NVARCHAR(255)  NOT NULL,
  CONSTRAINT FK_participants_trip FOREIGN KEY (tripId) REFERENCES trips(id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'expenses')
CREATE TABLE expenses (
  id                NVARCHAR(36)   PRIMARY KEY,
  tripId            NVARCHAR(36)   NOT NULL,
  description       NVARCHAR(1000) NOT NULL,
  amount            FLOAT          NOT NULL,
  paidBy            NVARCHAR(36)   NOT NULL,
  date              NVARCHAR(10)   NOT NULL,
  category          NVARCHAR(255)  NULL,
  originalCurrency  NVARCHAR(10)   NULL,
  originalAmount    FLOAT          NULL,
  convertedAmount   FLOAT          NULL,
  createdAt         NVARCHAR(30)   NOT NULL,
  CONSTRAINT FK_expenses_trip FOREIGN KEY (tripId) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT FK_expenses_paidBy FOREIGN KEY (paidBy) REFERENCES participants(id)
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'expense_splits')
CREATE TABLE expense_splits (
  expenseId      NVARCHAR(36)  NOT NULL,
  participantId  NVARCHAR(36)  NOT NULL,
  PRIMARY KEY (expenseId, participantId),
  CONSTRAINT FK_splits_expense FOREIGN KEY (expenseId) REFERENCES expenses(id) ON DELETE CASCADE,
  CONSTRAINT FK_splits_participant FOREIGN KEY (participantId) REFERENCES participants(id)
);

-- Indexes for common queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_participants_tripId')
  CREATE INDEX IX_participants_tripId ON participants(tripId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_expenses_tripId')
  CREATE INDEX IX_expenses_tripId ON expenses(tripId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_expense_splits_expenseId')
  CREATE INDEX IX_expense_splits_expenseId ON expense_splits(expenseId);
