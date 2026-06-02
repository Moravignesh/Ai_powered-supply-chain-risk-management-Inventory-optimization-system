from pydantic import BaseModel
from typing import Optional

class ForecastRequest(BaseModel):
    product_id:   Optional[str] = None
    warehouse_id: Optional[str] = None
    horizon:      int = 30
    model:        str = "ensemble"

class RiskRequest(BaseModel):
    product_id:   Optional[str] = None
    warehouse_id: Optional[str] = None

class SimulationRequest(BaseModel):
    scenario_type:      str
    magnitude:          float = 1.0
    duration_days:      int   = 30
    affected_warehouse: Optional[str] = None
    affected_supplier:  Optional[str] = None

class OptimizationRequest(BaseModel):
    product_id:   Optional[str] = None
    warehouse_id: Optional[str] = None
