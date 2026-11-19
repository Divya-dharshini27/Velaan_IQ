from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.logic.landed_cost import Incoterm


class ProcurementRequest(BaseModel):
    planning_horizon_days: int = Field(default=30, ge=0, le=365)
    service_level: float = Field(default=0.95, ge=0.5, lt=1)
    fixed_safety_stock_mt: Decimal | None = Field(default=None, ge=0)
    strategic_stock_mt: Decimal = Field(default=Decimal("0"), ge=0)
    budget_inr: Decimal | None = Field(default=None, gt=0)
    incoterm: Incoterm = Incoterm.FOB                 # what the international quote includes
    customs_duty_rate: Decimal | None = Field(default=None, ge=0, le=1)   # fraction, no default: must be supplied
    non_recoverable_tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    recoverable_tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    consumption_days: int = Field(default=30, ge=7, le=365)
    max_data_age_days: int = Field(default=7, ge=1, le=60)


class ProcurementResponse(BaseModel):
    decision_id: str
    decision: str
    sourcing_route: str | None
    recommended_quantity_mt: Decimal
    shortfall_mt: Decimal
    expected_landed_cost_per_mt: Decimal | None
    total_cost_inr: Decimal
    allocations: list[dict[str, Any]]
    inventory: dict[str, Any]
    market: dict[str, Any]
    forecast: dict[str, Any] | None
    reasoning: list[str]
    triggers: list[str]
    rejected_alternatives: list[str]
    warnings: list[str]
    data_quality_status: str
    decision_timestamp: datetime
    calculation_version: str
    inputs: dict[str, Any]


class DecisionSummary(BaseModel):
    id: str
    decision_date: datetime
    action: str
    sourcing_route: str | None
    recommended_quantity_mt: Decimal
    inventory_coverage_days: Decimal | None
    data_quality_status: str
    reasoning: list[str]