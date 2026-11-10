"""MySQL connection layer for the Expense Tracker.

Other team members import from this file:
    from db import fetch_all, fetch_one, execute, get_connection, DatabaseError

All SQL must be parameterized, e.g.
    fetch_all("SELECT * FROM expenses WHERE category_id = %s", (3,))
"""
import os
import mysql.connector
from mysql.connector import Error

from config import DB_CONFIG, validate_config


class DatabaseError(Exception):
    """Raised for any database problem, with a readable message."""


def get_connection(use_database=True):
    """Open a new MySQL connection. Caller is responsible for closing it."""
    validate_config()
    cfg = dict(DB_CONFIG)
    if not use_database:
        cfg.pop("database")
    try:
        return mysql.connector.connect(**cfg)
    except Error as e:
        raise DatabaseError(f"Could not connect to MySQL: {e}") from e


def fetch_all(query, params=None):
    """Run a SELECT and return all rows as a list of dicts."""
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(query, params or ())
        return cur.fetchall()
    except Error as e:
        raise DatabaseError(f"Query failed: {e}") from e
    finally:
        conn.close()


def fetch_one(query, params=None):
    """Run a SELECT and return a single row (dict) or None."""
    rows = fetch_all(query, params)
    return rows[0] if rows else None


def execute(query, params=None):
    """Run INSERT / UPDATE / DELETE. Returns (last_insert_id, rows_affected).

    Commits on success, rolls back on failure.
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(query, params or ())
        conn.commit()
        return cur.lastrowid, cur.rowcount
    except Error as e:
        conn.rollback()
        raise DatabaseError(f"Statement failed: {e}") from e
    finally:
        conn.close()


def health_check():
    """Return True if the database is reachable (use in a /health route)."""
    try:
        return fetch_one("SELECT 1 AS ok")["ok"] == 1
    except DatabaseError:
        return False


def init_db(schema_path=None):
    """Create the database, tables and sample data from schema.sql."""
    schema_path = schema_path or os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, encoding="utf-8") as f:
        script = f.read()

    # Strip full-line and trailing "--" comments, then split into statements
    lines = []
    for line in script.splitlines():
        line = line.split("--")[0].rstrip()
        if line.strip():
            lines.append(line)
    statements = [s.strip() for s in "\n".join(lines).split(";") if s.strip()]

    conn = get_connection(use_database=False)
    try:
        cur = conn.cursor()
        for stmt in statements:
            cur.execute(stmt)
        conn.commit()
        print(f"Database initialised ({len(statements)} statements executed).")
    except Error as e:
        conn.rollback()
        raise DatabaseError(f"Schema setup failed: {e}") from e
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    print("Health check:", "OK" if health_check() else "FAILED")
