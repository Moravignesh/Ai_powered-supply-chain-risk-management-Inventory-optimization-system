from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.db_models import InventoryRecord
from models.schemas import SimulationRequest
from ml.simulation_engine import run_simulation
import pandas as pd

router = APIRouter()

@router.post("/run")
def run_scenario(req: SimulationRequest, db: Session=Depends(get_db)):
    records = db.query(InventoryRecord).all()
    if not records: raise HTTPException(400,"No data available.")
    df = pd.DataFrame([{c.name:getattr(r,c.name) for c in r.__table__.columns} for r in records])
    result = run_simulation(df, req.scenario_type, req.magnitude, req.duration_days,
                            req.affected_warehouse, req.affected_supplier)
    return result

@router.get("/scenarios")
def list_scenarios():
    return {"scenarios":[
        {"id":"supplier_failure",  "label":"Supplier Failure",    "description":"Key supplier unable to deliver","unit":"fraction (0-1)","default":0.5},
        {"id":"demand_surge",      "label":"Demand Surge",        "description":"Demand increases significantly","unit":"multiplier (e.g. 1.5)","default":1.5},
        {"id":"shipping_delay",    "label":"Shipping Delay",      "description":"Increased shipping lead times","unit":"extra days","default":5},
        {"id":"warehouse_shutdown","label":"Warehouse Shutdown",   "description":"Temporary warehouse closure","unit":"fraction affected (0-1)","default":0.5},
        {"id":"fuel_cost_increase","label":"Fuel Cost Increase",   "description":"Rising fuel / logistics costs","unit":"cost multiplier","default":1.3},
        {"id":"demand_drop",       "label":"Demand Drop",         "description":"Demand decreases due to market conditions","unit":"fraction drop (0-1)","default":0.3},
    ]}
