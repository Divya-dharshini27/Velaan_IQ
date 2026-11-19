from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.procurement import ProcurementRequest, ProcurementResponse


class ScenarioOverrides(BaseModel):
    domestic_price_change_pct: Decimal = Field(default=Decimal("0"), ge=-90, le=500)
    international_price_change_pct: Decimal = Field(default=Decimal("0"), ge=-90, le=500)
    usd_inr_change_pct: Decimal = Field(default=Decimal("0"), ge=-50, le=100)
    freight_change_pct: Decimal = Field(default=Decimal("0"), ge=-90, le=500)
    consumption_change_pct: Decimal = Field(default=Decimal("0"), ge=-90, le=500)
    inventory_change_mt: Decimal = Field(default=Decimal("0"), ge=-1000000, le=1000000)
    lead_time_change_days: int = Field(default=0, ge=-60, le=180)


class ScenarioRequest(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    overrides: ScenarioOverrides = Field(default_factory=ScenarioOverrides)
    procurement: ProcurementRequest = Field(default_factory=ProcurementRequest)


class ScenarioChange(BaseModel):
    metric: str
    baseline: str | None
    simulated: str | None
    changed: bool


class ScenarioResponse(BaseModel):
    scenario_id: str
    name: str | None
    overrides: ScenarioOverrides
    decision_changed: bool
    changes: list[ScenarioChange]
    baseline: ProcurementResponse
    simulated: ProcurementResponse
    calculation_version: str
    created_at: datetime


class ScenarioSummary(BaseModel):
    id: str
    name: str | None
    created_at: datetime
    baseline_decision: str
    simulated_decision: str
    overrides: dict[str, Any]