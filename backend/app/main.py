from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database import connection
from app.database.indexes import create_indexes
from app.api import (
    health,
    auth,
    market,
    inventory,
    consumption,
    suppliers,
    purchase_orders,
    exchange_rates,
    forecast,
    sourcing,
    procurement,
    scenarios,
    dashboard,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    connection.connect()
    create_indexes()
    yield
    connection.close()


app = FastAPI(title="VELAAN IQ API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(market.router)
app.include_router(inventory.router)
app.include_router(consumption.router)
app.include_router(suppliers.router)
app.include_router(purchase_orders.router)
app.include_router(exchange_rates.router)
app.include_router(forecast.router)
app.include_router(sourcing.router)
app.include_router(procurement.router)
app.include_router(scenarios.router)
app.include_router(dashboard.router)