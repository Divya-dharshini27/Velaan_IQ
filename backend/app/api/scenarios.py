from fastapi import APIRouter, Depends, Query

from app.api.auth import get_current_user
from app.database.connection import get_db
from app.schemas.common import Page
from app.schemas.scenarios import ScenarioRequest, ScenarioResponse, ScenarioSummary
from app.services import scenario_service

router = APIRouter(prefix="/api/v1/scenarios", tags=["scenarios"])


@router.post("/simulate", response_model=ScenarioResponse)
def simulate(body: ScenarioRequest, user: dict = Depends(get_current_user)):
    return scenario_service.run_scenario(get_db(), body, str(user["_id"]))


@router.get("", response_model=Page[ScenarioSummary])
def list_runs(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
              user: dict = Depends(get_current_user)):
    items, total = scenario_service.list_scenarios(get_db(), page, page_size)
    return Page[ScenarioSummary](items=items, total=total, page=page, page_size=page_size)