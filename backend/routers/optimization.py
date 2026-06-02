from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.db_models import InventoryRecord
from ml.optimization_engine import generate_recommendations, calc_eoq, calc_safety_stock, calc_reorder_point
import pandas as pd

router = APIRouter()

def _load(db):
    records = db.query(InventoryRecord).all()
    if not records: return pd.DataFrame()
    return pd.DataFrame([{c.name:getattr(r,c.name) for c in r.__table__.columns} for r in records])

@router.get("/recommendations")
def get_recommendations(product_id: str=None, warehouse_id: str=None, db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: raise HTTPException(400,"No data available.")
    if product_id:   df = df[df['product_id']==product_id]
    if warehouse_id: df = df[df['warehouse_id']==warehouse_id]
    recs = generate_recommendations(df)
    urgent  = [r for r in recs if r['priority']=='URGENT']
    high    = [r for r in recs if r['priority']=='HIGH']
    medium  = [r for r in recs if r['priority']=='MEDIUM']
    return {"recommendations":recs,"summary":{"total":len(recs),"urgent":len(urgent),"high":len(high),"medium":len(medium)}}

@router.get("/eoq")
def get_eoq(product_id: str, warehouse_id: str, db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: raise HTTPException(400,"No data.")
    sub = df[(df['product_id']==product_id)&(df['warehouse_id']==warehouse_id)]
    if sub.empty: raise HTTPException(404,"Product/Warehouse not found.")
    avg_daily = float(sub['sales'].mean())
    annual    = avg_daily * 365
    oc        = float(sub['ordering_cost'].mean())
    hc        = float(sub['holding_cost'].mean())
    lt        = float(sub['lead_time_days'].mean())
    std_d     = float(sub['sales'].std() or 0)
    eoq = calc_eoq(annual, oc, hc)
    ss  = calc_safety_stock(std_d, lt)
    rop = calc_reorder_point(avg_daily, lt, ss)
    return {"product_id":product_id,"warehouse_id":warehouse_id,"eoq":eoq,"safety_stock":ss,
            "reorder_point":rop,"annual_demand":round(annual,1),"avg_daily_demand":round(avg_daily,1),
            "lead_time_days":round(lt,1),"ordering_cost":oc,"holding_cost_per_unit":hc}

@router.get("/summary")
def optimization_summary(db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: return {"error":"No data"}
    recs = generate_recommendations(df)
    return {
        "total_recommendations": len(recs),
        "by_type":   {t: sum(1 for r in recs if r['type']==t) for t in set(r['type'] for r in recs)},
        "by_priority":{p: sum(1 for r in recs if r['priority']==p) for p in ['URGENT','HIGH','MEDIUM','LOW']},
        "estimated_savings": round(sum(abs(r.get('estimated_cost',0)) for r in recs if r['type']=='reduce_reorder'),2),
    }
