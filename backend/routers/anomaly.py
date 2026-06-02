from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.db_models import InventoryRecord
from ml.anomaly_detection import detect_anomalies
import pandas as pd

router = APIRouter()

@router.get("/detect")
def detect(db: Session=Depends(get_db)):
    records = db.query(InventoryRecord).all()
    if not records: raise HTTPException(400,"No data available.")
    df = pd.DataFrame([{c.name:getattr(r,c.name) for c in r.__table__.columns} for r in records])
    anomalies, summary = detect_anomalies(df)
    return {"anomalies":anomalies[:100],"summary":summary}

@router.get("/timeline")
def anomaly_timeline(db: Session=Depends(get_db)):
    records = db.query(InventoryRecord).all()
    if not records: raise HTTPException(400,"No data available.")
    df = pd.DataFrame([{c.name:getattr(r,c.name) for c in r.__table__.columns} for r in records])
    anomalies, summary = detect_anomalies(df)
    # Group by date for timeline
    from collections import defaultdict
    by_date = defaultdict(list)
    for a in anomalies:
        by_date[a['date']].append(a)
    timeline = [{"date":d,"count":len(v),"max_severity":max(a['severity'] for a in v),
                 "types":list(set(a['type'] for a in v))} for d,v in sorted(by_date.items())]
    return {"timeline":timeline[-60:],"summary":summary}
