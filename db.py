"""Capa de acceso a datos: PostgreSQL (producción/Vercel) o SQLite (local)."""
import os
import sqlite3

DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")


def connect():
    if DATABASE_URL:
        return _Pg(DATABASE_URL)
    return _Sqlite()


class _Sqlite:
    def __init__(self):
        base = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(base, "data", "merprest.db")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.con = sqlite3.connect(path)
        self.con.row_factory = sqlite3.Row
        self.con.execute("PRAGMA foreign_keys = ON")

    def execute(self, sql, params=()):
        return self.con.execute(sql.replace("%s", "?"), params)

    def executescript(self, sql):
        return self.con.executescript(sql.replace("%s", "?"))

    def commit(self):
        self.con.commit()

    def close(self):
        self.con.close()


class _Pg:
    def __init__(self, url):
        import psycopg
        from psycopg.rows import dict_row

        self.con = psycopg.connect(url, row_factory=dict_row, connect_timeout=15)

    def execute(self, sql, params=()):
        return self.con.execute(sql, params)

    def executescript(self, sql):
        cur = self.con.cursor()
        for stmt in sql.split(";"):
            if stmt.strip():
                cur.execute(stmt)

    def commit(self):
        self.con.commit()

    def close(self):
        self.con.close()
