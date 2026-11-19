from app.core.utils import utc_now
from app.schemas.scenarios import (
    ScenarioChange, ScenarioRequest, ScenarioResponse, ScenarioSummary,
)
from app.services import procurement_service
from app.services.procurement_service import CALC_VERSION, _safe


def _s(v):
    return None if v is None else str(v)


def _changes(b, s) -> list[ScenarioChange]:
    rows = [
        ("decision", b.decision, s.decision),
        ("sourcing_route", b.sourcing_route, s.sourcing_route),
        ("recommended_quantity_mt", b.recommended_quantity_mt, s.recommended_quantity_mt),
        ("inventory_status", b.inventory.get("inventory_status"), s.inventory.get("inventory_status")),
        ("coverage_days", b.inventory.get("coverage_days"), s.inventory.get("coverage_days")),
        ("reorder_point_mt", b.inventory.get("reorder_point_mt"), s.inventory.get("reorder_point_mt")),
        ("required_replenishment_mt", b.inventory.get("required_replenishment_mt"),
         s.inventory.get("required_replenishment_mt")),
        ("domestic_landed_cost_per_mt", b.market.get("domestic_landed_cost_per_mt"),
         s.market.get("domestic_landed_cost_per_mt")),
        ("international_landed_cost_per_mt", b.market.get("international_landed_cost_per_mt"),
         s.market.get("international_landed_cost_per_mt")),
        ("cheaper_route", b.market.get("cheaper_route"), s.market.get("cheaper_route")),
    ]
    return [ScenarioChange(metric=m, baseline=_s(x), simulated=_s(y), changed=_s(x) != _s(y))
            for m, x, y in rows]


def run_scenario(db, body: ScenarioRequest, user_id: str) -> ScenarioResponse:
    # both runs use persist=False: nothing touches market, inventory or decision records
    baseline = procurement_service.recommend(db, body.procurement, user_id, None, persist=False)
    simulated = procurement_service.recommend(db, body.procurement, user_id, body.overrides, persist=False)
    now = utc_now()

    doc = {
        "name": body.name,
        "user_id": user_id,
        "created_at": now,
        "calculation_version": CALC_VERSION,
        "baseline_input_snapshot": _safe({"inventory": baseline.inventory, "market": baseline.market,
                                          "inputs": baseline.inputs}),
        "scenario_overrides": body.overrides.model_dump(mode="json"),
        "result_snapshot": _safe(simulated.model_dump(mode="json")),
        "baseline_decision": baseline.decision,
        "simulated_decision": simulated.decision,
    }
    scenario_id = str(db.scenario_runs.insert_one(doc).inserted_id)
    return ScenarioResponse(
        scenario_id=scenario_id, name=body.name, overrides=body.overrides,
        decision_changed=baseline.decision != simulated.decision,
        changes=_changes(baseline, simulated), baseline=baseline, simulated=simulated,
        calculation_version=CALC_VERSION, created_at=now,
    )


def list_scenarios(db, page: int, page_size: int):
    total = db.scenario_runs.count_documents({})
    cursor = db.scenario_runs.find().sort("created_at", -1).skip((page - 1) * page_size).limit(page_size)
    items = [ScenarioSummary(id=str(d["_id"]), name=d.get("name"), created_at=d["created_at"],
                             baseline_decision=d["baseline_decision"],
                             simulated_decision=d["simulated_decision"],
                             overrides=d["scenario_overrides"]) for d in cursor]
    return items, total