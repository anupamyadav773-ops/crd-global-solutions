"""
database.py — Quick connection test script (development only).

Credentials are loaded from backend/.env — never hardcode them here.
Run this file directly to verify the database connection:
    python database.py
"""

import os
import mysql.connector


def load_local_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


load_local_env()

try:
    port = int(os.getenv("CRD_DB_PORT", "3306"))
    use_ssl = os.getenv("CRD_DB_USE_SSL", "false").lower() == "true"
    conn_kwargs = {
        "host": os.getenv("CRD_DB_HOST", "localhost"),
        "port": port,
        "user": os.getenv("CRD_DB_USER", "root"),
        "password": os.getenv("CRD_DB_PASSWORD", ""),
        "database": os.getenv("CRD_DB_NAME", "crd_global_solutions"),
    }
    if use_ssl:
        conn_kwargs["ssl_disabled"] = False
        conn_kwargs["ssl_verify_cert"] = os.getenv("CRD_DB_SSL_VERIFY", "false").lower() == "true"

    connection = mysql.connector.connect(**conn_kwargs)
    if connection.is_connected():
        print("Database Connected Successfully")
    connection.close()
except Exception as e:
    print(e)
