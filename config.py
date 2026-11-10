"""Database configuration.

Credentials are read from environment variables (loaded from a local
.env file that is excluded from version control). Nothing is hard-coded.
"""
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME", "expense_tracker"),
}


def validate_config():
    """Fail early with a clear message if required settings are missing."""
    if DB_CONFIG["password"] is None:
        raise RuntimeError(
            "DB_PASSWORD is not set. Copy .env.example to .env and fill in "
            "your MySQL credentials."
        )
