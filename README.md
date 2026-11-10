# Bunny Budget - Personal Expense Tracking and Analysis System

Flask + MySQL expense tracker with a slide-based dashboard (Chart.js charts).

## Folder structure
```
expense_tracker/
├── app.py            Flask routes / REST API
├── db.py             MySQL connection helpers + "python db.py" setup command
├── config.py         reads database settings from .env
├── schema.sql        tables + sample data (run by db.py)
├── test_db.py        database test cases
├── requirements.txt
├── .env.example      copy to .env and add your MySQL password
├── templates/index.html
└── static/           style.css, script.js (slide navigation), app.js (data + charts), rabbit.png
```

## Setup (VS Code terminal)
```bash
python -m venv venv
venv\Scripts\activate            # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
```
1. Copy `.env.example` to `.env` and set `DB_PASSWORD` to your MySQL password.
2. Create the database, tables and sample data (also resets them): `python db.py`
3. Run the database tests: `python test_db.py`
4. Start the website: `python app.py` then open http://127.0.0.1:5000

Requires MySQL 8.0.16+ (older versions ignore the CHECK constraints).

## Database schema
| Table | Columns |
|---|---|
| categories | category_id (PK), category_name (unique) |
| expenses | expense_id (PK), expense_date, category_id (FK), amount (> 0), description, notes |
| budgets | budget_month (PK, 'YYYY-MM'), amount (>= 0) |

`categories (1) ──< expenses (many)`. A category that still has expenses cannot be deleted.

## API endpoints
| Method | URL | Purpose |
|---|---|---|
| GET | /api/health | database connection check |
| GET | /api/categories | list categories |
| GET | /api/expenses | list; filters `month`, `category`, `search`, `from`, `to` |
| POST | /api/expenses | add (amount must be > 0) |
| PUT | /api/expenses/<id> | edit |
| DELETE | /api/expenses/<id> | delete |
| GET | /api/budgets | all monthly budgets |
| PUT | /api/budgets/<YYYY-MM> | set budget (0 removes it) |
| GET | /api/summary?month=YYYY-MM | month total, count, all-time total, per-category totals |
| GET | /api/export.csv | download all expenses as CSV |

## Limitations
Single-user learning project with fictional sample data. Not a banking or financial-advice system.
