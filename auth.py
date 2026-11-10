"""Login system for Bunny Budget: sign up, log in, guest access and log out.

Passwords are never stored as plain text. Only a secure hash is saved.
"""
import os
import re

from flask import jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from db import DatabaseError, execute, fetch_one

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Pages anyone can open without logging in.
OPEN_ENDPOINTS = {"index", "login", "signup", "guest", "static"}

CREATE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB
"""


def start_session(user_id, name, guest):
    session.clear()
    session["user"] = {"id": user_id, "name": name, "guest": guest}


def init_auth(app):
    app.secret_key = os.environ.get("SECRET_KEY", "bunny-budget-dev-key-change-me")

    try:
        execute(CREATE_USERS)
    except DatabaseError as e:
        print(f"\nWARNING: could not create the users table: {e}\n")

    @app.context_processor
    def inject_user():
        return {"current_user": session.get("user")}

    @app.before_request
    def require_login():
        # request.endpoint is None for unknown URLs, so the 404 page still works.
        if request.endpoint is None or request.endpoint in OPEN_ENDPOINTS:
            return None
        if "user" in session:
            return None
        if request.path.startswith("/api/"):
            return jsonify({"error": "Please log in first."}), 401
        return redirect(url_for("login"))

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "GET" and "user" in session:
            return redirect(url_for("app_page"))

        error, email = None, ""
        if request.method == "POST":
            email = request.form.get("email", "").strip().lower()
            password = request.form.get("password", "")
            try:
                user = fetch_one(
                    "SELECT user_id, password_hash FROM users WHERE email = %s",
                    (email,),
                )
                if user and check_password_hash(user["password_hash"], password):
                    start_session(user["user_id"], email.split("@")[0], False)
                    return redirect(url_for("app_page"))
                error = "Wrong email or password."
            except DatabaseError:
                error = "Cannot reach the database. Start MySQL and try again."
        return render_template("auth.html", mode="login", error=error, email=email)

    @app.route("/signup", methods=["GET", "POST"])
    def signup():
        if request.method == "GET" and "user" in session:
            return redirect(url_for("app_page"))

        error, email = None, ""
        if request.method == "POST":
            email = request.form.get("email", "").strip().lower()
            password = request.form.get("password", "")
            confirm = request.form.get("confirm", "")

            if not EMAIL_PATTERN.match(email) or len(email) > 120:
                error = "Enter a valid email address."
            elif len(password) < 6:
                error = "Password must be at least 6 characters."
            elif password != confirm:
                error = "The two passwords do not match."
            else:
                try:
                    if fetch_one("SELECT user_id FROM users WHERE email = %s", (email,)):
                        error = "This email is already registered. Please log in."
                    else:
                        user_id, _ = execute(
                            "INSERT INTO users (email, password_hash) VALUES (%s, %s)",
                            (email, generate_password_hash(password)),
                        )
                        start_session(user_id, email.split("@")[0], False)
                        return redirect(url_for("app_page"))
                except DatabaseError:
                    error = "Cannot reach the database. Start MySQL and try again."
        return render_template("auth.html", mode="signup", error=error, email=email)

    @app.post("/guest")
    def guest():
        start_session(None, "Guest", True)
        return redirect(url_for("app_page"))

    @app.route("/logout")
    def logout():
        session.clear()
        return redirect(url_for("index"))
