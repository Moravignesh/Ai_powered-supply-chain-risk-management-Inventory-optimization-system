from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func
from database import Base

class InventoryRecord(Base):
    __tablename__ = "inventory_records"
    id            = Column(Integer, primary_key=True, index=True)
    date          = Column(String, index=True)
    product_id    = Column(String, index=True)
    warehouse_id  = Column(String, index=True)
    region        = Column(String)
    supplier_id   = Column(String)
    sales         = Column(Float)
    stock_level   = Column(Float)
    lead_time_days= Column(Integer)
    reorder_point = Column(Float)
    promotion     = Column(Integer, default=0)
    holiday       = Column(Integer, default=0)
    is_weekend    = Column(Integer, default=0)
    unit_price    = Column(Float, default=10.0)
    ordering_cost = Column(Float, default=50.0)
    holding_cost  = Column(Float, default=2.0)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

class ModelMetrics(Base):
    __tablename__ = "model_metrics"
    id         = Column(Integer, primary_key=True, index=True)
    model_name = Column(String)
    product_id = Column(String)
    mae        = Column(Float)
    rmse       = Column(Float)
    mape       = Column(Float)
    samples    = Column(Integer)
    trained_at = Column(DateTime(timezone=True), server_default=func.now())
