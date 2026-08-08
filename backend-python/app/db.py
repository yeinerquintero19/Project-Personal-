"""Pool de conexiones a PostgreSQL usando psycopg 3."""

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None


def init_pool(database_url: str) -> ConnectionPool:
    """Crea el pool y verifica que la base de datos responda."""
    global _pool
    _pool = ConnectionPool(
        database_url,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row},
    )
    # Falla rápido si la base de datos no está disponible
    _pool.wait(timeout=15)
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_conn() -> psycopg.Connection:
    """Devuelve una conexión del pool (usar como context manager)."""
    if _pool is None:
        raise RuntimeError("El pool de base de datos no está inicializado")
    return _pool.connection()
