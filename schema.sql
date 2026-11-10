-- Bunny Budget: Personal Expense Tracking and Analysis System
-- Database schema + sample data
-- Requires MySQL 8.0.16+ (CHECK constraints are enforced from that version)

CREATE DATABASE IF NOT EXISTS expense_tracker
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE expense_tracker;

DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS categories;

-- categories(category_id, category_name)
CREATE TABLE categories (
    category_id   INT          NOT NULL AUTO_INCREMENT,
    category_name VARCHAR(50)  NOT NULL,
    PRIMARY KEY (category_id),
    UNIQUE KEY uq_category_name (category_name)
) ENGINE=InnoDB;

-- expenses(expense_id, expense_date, category_id, amount, description, notes)
CREATE TABLE expenses (
    expense_id     INT           NOT NULL AUTO_INCREMENT,
    expense_date   DATE          NOT NULL,
    category_id    INT           NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    description    VARCHAR(255)  NULL,
    notes          VARCHAR(250)  NULL,
    PRIMARY KEY (expense_id),
    CONSTRAINT fk_expenses_category
        FOREIGN KEY (category_id) REFERENCES categories (category_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    -- Acceptance criterion: amounts must be positive
    CONSTRAINT chk_amount_positive CHECK (amount > 0),
    INDEX idx_expense_date (expense_date),
    INDEX idx_expense_category (category_id)
) ENGINE=InnoDB;

-- budgets(budget_month, amount): one spending limit per month, e.g. '2026-10'
CREATE TABLE budgets (
    budget_month CHAR(7)       NOT NULL,
    amount       DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (budget_month),
    CONSTRAINT chk_budget_nonnegative CHECK (amount >= 0)
) ENGINE=InnoDB;

-- Sample data (fictional). Category order matches the website's drop-down.
INSERT INTO categories (category_name) VALUES
    ('Food'),            -- 1
    ('Travel'),          -- 2
    ('Shopping'),        -- 3
    ('Education'),       -- 4
    ('Bills'),           -- 5
    ('Health'),          -- 6
    ('Entertainment'),   -- 7
    ('Personal Care'),   -- 8
    ('Other');           -- 9  (deliberately has NO expenses: empty-category edge case)

INSERT INTO expenses (expense_date, category_id, amount, description, notes) VALUES
('2026-06-05', 1, 1100.00, 'Groceries',               'Sample demo expense'),
('2026-06-12', 2,  650.00, 'Bus pass',               NULL),
('2026-07-04', 1, 1250.50, 'Groceries',               NULL),
('2026-07-10', 3, 1800.00, 'New shoes',              'Sample demo expense'),
('2026-07-18', 7,  450.00, 'Movie and snacks',       NULL),
('2026-08-03', 1,  950.25, 'Dinner with friends',     NULL),
('2026-08-09', 4, 2500.00, 'Online course fee',      'Python course'),
('2026-08-15', 6,  600.00, 'Pharmacy',               NULL),
('2026-08-22', 2,  400.00, 'Auto-rickshaw rides',    NULL),
('2026-09-02', 1,  198.00, 'Groceries',               NULL),
('2026-09-02', 1,   85.00, 'Lunch',                  'Two expenses on the same day'),
('2026-09-09', 5,  850.00, 'Internet bill',           NULL),
('2026-09-14', 7,  699.00, 'Streaming subscription', NULL),
('2026-09-20', 3,  850.00, NULL,                      'Missing description is allowed'),
('2026-09-28', 8,  500.00, 'Haircut',                NULL),
('2026-10-03', 1,  340.00, 'Groceries',               NULL),
('2026-10-05', 2,  135.00, 'Fuel',                   NULL),
('2026-10-08', 6, 1500.00, 'Dental check-up',        NULL),
('2026-10-12', 7,  250.00, 'Concert ticket',          NULL),
('2026-10-15', 5,  780.00, 'Water and phone bill',    NULL),
('2026-10-20', 3, 1100.00, 'Backpack',               'Sample demo expense');

INSERT INTO budgets (budget_month, amount) VALUES ('2026-10', 15000.00);

CREATE TABLE IF NOT EXISTS users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;