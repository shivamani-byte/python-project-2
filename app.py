"""
Bunny Budget - Flask backend (MySQL)
Serves the website and stores expenses and budgets in a MySQL database.

Run:
    pip install -r requirements.txt
    python db.py        (one time: creates the database, tables and sample data)
    python app.py
Then open http://127.0.0.1:5000
"""

import calendar
import csv
import io
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from auth import init_auth

from flask import Flask, Response, jsonify, render_template, request

from db import DatabaseError, execute, fetch_all, fetch_one, health_check

app = Flask(__name__)
init_auth(app)

MAX_AMOUNT = Decimal("99999999.99")  # DECIMAL(10,2) limit
MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


# ===== HELPERS =====
def error(message, status=400):
    return jsonify({"error": message}), status


def month_range(month):
    """'2026-10' -> ('2026-10-01', '2026-10-31')"""
    year, number = (int(part) for part in month.split("-"))
    last_day = calendar.monthrange(year, number)[1]
    return f"{month}-01", f"{month}-{last_day:02d}"


def parse_amount(value, allow_zero=False):
    """Return a Decimal rounded to 2 places, or raise ValueError."""
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("Amount must be a number.")
    if not amount.is_finite():
        raise ValueError("Amount must be a number.")
    if amount < 0:
        raise ValueError("Amount cannot be negative.")
    if amount == 0 and not allow_zero:
        raise ValueError("Amount must be greater than 0.")
    if amount > MAX_AMOUNT:
        raise ValueError("Amount is too large.")
    return amount


EXPENSE_SELECT = """
    SELECT e.expense_id, e.expense_date, e.description, e.amount, e.notes,
           c.category_name
    FROM expenses e
    JOIN categories c ON c.category_id = e.category_id
"""


def row_to_expense(row):
    return {
        "id": row["expense_id"],
        "description": row["description"] or "",
        "amount": float(row["amount"]),
        "category": row["category_name"],
        "date": row["expense_date"].isoformat(),
        "notes": row["notes"] or "",
    }


def get_expense(expense_id):
    row = fetch_one(EXPENSE_SELECT + " WHERE e.expense_id = %s", (expense_id,))
    return row_to_expense(row) if row else None


# ===== VALIDATION =====
def validate_expense(data):
    """Return (clean_data, error_message)."""
    if not isinstance(data, dict):
        return None, "Send the expense as JSON."

    description = str(data.get("description") or "").strip()
    category = str(data.get("category") or "").strip()
    notes = str(data.get("notes") or "").strip()
    expense_date = str(data.get("date") or "").strip()

    try:
        amount = parse_amount(data.get("amount"))
    except ValueError as e:
        return None, str(e)

    if not description:
        return None, "Description is required."
    if len(description) > 100:
        return None, "Description must be 100 characters or fewer."
    if len(notes) > 250:
        return None, "Notes must be 250 characters or fewer."
    try:
        date.fromisoformat(expense_date)
    except ValueError:
        return None, "Date must be in YYYY-MM-DD format."

    row = fetch_one("SELECT category_id FROM categories WHERE category_name = %s", (category,))
    if row is None:
        return None, "Please choose a valid category."

    return {
        "description": description,
        "amount": amount,
        "category_id": row["category_id"],
        "date": expense_date,
        "notes": notes or None,
    }, None


# ===== PAGES =====
@app.route("/")
def index():
    return render_template("landing.html")


@app.route("/app")
def app_page():
    return render_template("index.html")


@app.get("/api/health")
def health():
    ok = health_check()
    return jsonify({"status": "ok" if ok else "database unavailable"}), (200 if ok else 503)


# ===== EXPENSE API =====
@app.get("/api/categories")
def list_categories():
    rows = fetch_all("SELECT category_name FROM categories ORDER BY category_id")
    return jsonify([r["category_name"] for r in rows])


@app.get("/api/expenses")
def list_expenses():
    """List expenses. Optional filters: ?month=YYYY-MM&category=...&search=...&from=...&to=..."""
    where, params = [], []

    month = request.args.get("month", "").strip()
    category = request.args.get("category", "").strip()
    search = request.args.get("search", "").strip()
    date_from = request.args.get("from", "").strip()
    date_to = request.args.get("to", "").strip()

    if month:
        if not MONTH_PATTERN.match(month):
            return error("Month must be in YYYY-MM format.")
        first, last = month_range(month)
        where.append("e.expense_date BETWEEN %s AND %s")
        params += [first, last]
    if category:
        where.append("c.category_name = %s")
        params.append(category)
    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        where.append("(e.description LIKE %s OR e.notes LIKE %s)")
        params += [f"%{escaped}%", f"%{escaped}%"]
    for label, value, op in (("from", date_from, ">="), ("to", date_to, "<=")):
        if value:
            try:
                date.fromisoformat(value)
            except ValueError:
                return error(f"'{label}' must be a valid date (YYYY-MM-DD).")
            where.append(f"e.expense_date {op} %s")
            params.append(value)

    query = EXPENSE_SELECT
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY e.expense_date DESC, e.expense_id DESC"

    rows = fetch_all(query, tuple(params))
    return jsonify([row_to_expense(r) for r in rows])


@app.post("/api/expenses")
def create_expense():
    clean, message = validate_expense(request.get_json(silent=True))
    if message:
        return error(message)

    new_id, _ = execute(
        "INSERT INTO expenses (expense_date, category_id, amount, description, notes) "
        "VALUES (%s, %s, %s, %s, %s)",
        (clean["date"], clean["category_id"], clean["amount"],
         clean["description"], clean["notes"]),
    )
    return jsonify(get_expense(new_id)), 201


@app.put("/api/expenses/<int:expense_id>")
def update_expense(expense_id):
    if get_expense(expense_id) is None:
        return error("Expense not found.", 404)
    clean, message = validate_expense(request.get_json(silent=True))
    if message:
        return error(message)

    execute(
        "UPDATE expenses SET expense_date = %s, category_id = %s, amount = %s, "
        "description = %s, notes = %s WHERE expense_id = %s",
        (clean["date"], clean["category_id"], clean["amount"],
         clean["description"], clean["notes"], expense_id),
    )
    return jsonify(get_expense(expense_id))


@app.delete("/api/expenses/<int:expense_id>")
def delete_expense(expense_id):
    if get_expense(expense_id) is None:
        return error("Expense not found.", 404)
    execute("DELETE FROM expenses WHERE expense_id = %s", (expense_id,))
    return jsonify({"deleted": expense_id})


# ===== BUDGET API =====
@app.get("/api/budgets")
def list_budgets():
    rows = fetch_all("SELECT budget_month, amount FROM budgets")
    return jsonify({r["budget_month"]: float(r["amount"]) for r in rows})


@app.put("/api/budgets/<month>")
def set_budget(month):
    if not MONTH_PATTERN.match(month):
        return error("Month must be in YYYY-MM format.")

    data = request.get_json(silent=True) or {}
    try:
        amount = parse_amount(data.get("amount", 0), allow_zero=True)
    except ValueError as e:
        return error(str(e).replace("Amount", "Budget"))

    if amount == 0:
        execute("DELETE FROM budgets WHERE budget_month = %s", (month,))
    else:
        execute(
            "INSERT INTO budgets (budget_month, amount) VALUES (%s, %s) "
            "ON DUPLICATE KEY UPDATE amount = VALUES(amount)",
            (month, amount),
        )
    return jsonify({"month": month, "amount": float(amount)})


# ===== REPORTS =====
@app.get("/api/summary")
def summary():
    """Totals for one month: ?month=YYYY-MM (defaults to this month)."""
    month = request.args.get("month") or date.today().strftime("%Y-%m")
    if not MONTH_PATTERN.match(month):
        return error("Month must be in YYYY-MM format.")
    first, last = month_range(month)

    month_row = fetch_one(
        "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt FROM expenses "
        "WHERE expense_date BETWEEN %s AND %s", (first, last))
    all_time = fetch_one("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses")
    by_category = fetch_all(
        "SELECT c.category_name, SUM(e.amount) AS total FROM expenses e "
        "JOIN categories c ON c.category_id = e.category_id "
        "WHERE e.expense_date BETWEEN %s AND %s "
        "GROUP BY c.category_name ORDER BY total DESC", (first, last))
    budget = fetch_one("SELECT amount FROM budgets WHERE budget_month = %s", (month,))

    return jsonify({
        "month": month,
        "month_total": float(month_row["total"]),
        "transaction_count": month_row["cnt"],
        "all_time_total": float(all_time["total"]),
        "budget": float(budget["amount"]) if budget else 0,
        "by_category": [{"category": r["category_name"], "total": float(r["total"])}
                        for r in by_category],
    })


@app.get("/api/export.csv")
def export_csv():
    rows = fetch_all(EXPENSE_SELECT + " ORDER BY e.expense_date, e.expense_id")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Description", "Category", "Amount (INR)", "Notes"])
    for r in rows:
        writer.writerow([r["expense_date"].isoformat(), r["description"] or "",
                         r["category_name"], f"{float(r['amount']):.2f}", r["notes"] or ""])

    filename = f"bunny-budget-{date.today().isoformat()}.csv"
    return Response(
        "\ufeff" + output.getvalue(),  # BOM so Excel shows the rupee sign correctly
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ===== ERRORS =====
@app.errorhandler(DatabaseError)
def handle_database_error(e):
    app.logger.error("Database error: %s", e)
    return error("The database is unavailable or rejected the request. "
                 "Check that MySQL is running and your .env is correct.", 503)


@app.errorhandler(404)
def handle_404(_e):
    return error("Not found.", 404)


@app.errorhandler(405)
def handle_405(_e):
    return error("Method not allowed.", 405)


# ===== START =====
if __name__ == "__main__":
    if not health_check():
        print("\nWARNING: cannot reach the MySQL database. Start MySQL, check .env, "
              "and run 'python db.py' once to create the tables.\n")
    app.run(debug=True)
