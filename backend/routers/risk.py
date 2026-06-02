from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.db_models import InventoryRecord
from ml.risk_prediction import compute_risk_scores, generate_alerts
import pandas as pd

router = APIRouter()

def _load(db):
    records = db.query(InventoryRecord).all()
    if not records: return pd.DataFrame()
    return pd.DataFrame([{c.name:getattr(r,c.name) for c in r.__table__.columns} for r in records])

@router.get("/predict")
def predict_risk(product_id: str=None, warehouse_id: str=None, db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: raise HTTPException(400,"No data available.")
    if product_id:   df = df[df['product_id']==product_id]
    if warehouse_id: df = df[df['warehouse_id']==warehouse_id]
    scores = compute_risk_scores(df)
    return {"risks":scores,"count":len(scores)}

@router.get("/alerts")
def get_alerts(db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: raise HTTPException(400,"No data available.")
    scores = compute_risk_scores(df)
    alerts = generate_alerts(scores)
    critical = [a for a in alerts if a['level']=='critical']
    high     = [a for a in alerts if a['level']=='high']
    return {"alerts":alerts,"summary":{"total":len(alerts),"critical":len(critical),"high":len(high)}}

@router.get("/summary")
def risk_summary(db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: return {"error":"No data"}
    scores = compute_risk_scores(df)
    if not scores: return {"error":"No risk scores computed"}
    avg_risk = sum(s['overall_risk'] for s in scores)/len(scores)
    return {
        "average_risk_score": round(avg_risk,3),
        "high_risk_products":  [s for s in scores if s['overall_risk']>0.6],
        "total_products":      len(scores),
        "critical_stockouts":  sum(1 for s in scores if s['stockout']['level']=='critical'),
        "high_delay_risk":     sum(1 for s in scores if s['supplier_delay']['level']=='high'),
        "demand_surges":       sum(1 for s in scores if s['demand_surge']['level'] in ('high','critical')),
    }
