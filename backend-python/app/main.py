"""MerPrest - Servicio de reportes y análisis (FastAPI)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import close_pool, init_pool
from .routers import reports


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    init_pool(settings.database_url)
    print(f"[merprest-python] Conectado a PostgreSQL (pool listo)")
    yield
    close_pool()


app = FastAPI(
    title="MerPrest - Reportes API",
    description="Servicio de reportes y análisis financiero del portafolio de préstamos.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
