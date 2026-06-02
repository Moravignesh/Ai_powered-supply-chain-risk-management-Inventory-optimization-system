from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from models.db_models import InventoryRecord, ModelMetrics
from models.schemas import ForecastRequest
from ml.preprocessing import load_data_from_db, preprocess
from ml.forecasting import forecaster
import pandas as pd

router = APIRouter()
_training_status = {"status": "idle", "message": "", "metrics": {}}

def _train_task(db_url):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    engine = create_engine(db_url, connect_args={"check_same_thread":False})
    Session = sessionmaker(bind=engine)
    db = Session()
    global _training_status
    try:
        _training_status = {"status":"training","message":"Loading data...","metrics":{}}
        records = db.query(InventoryRecord).all()
        data = [{c.name:getattr(r,c.name) for c in r.__table__.columns} for r in records]
        df = pd.DataFrame(data)
        _training_status["message"] = "Training models..."
        metrics = forecaster.train(df)
        _training_status = {"status":"completed","message":"Training complete","metrics":metrics}
    except Exception as e:
        _training_status = {"status":"error","message":str(e),"metrics":{}}
    finally:
        db.close()

@router.post("/train")
def train_models(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    count = db.query(InventoryRecord).count()
    if count == 0:
        raise HTTPException(400,"No data available. Upload data first.")
    import os
    db_url = os.getenv("DATABASE_URL","sqlite:///./supply_chain.db")
    background_tasks.add_task(_train_task, db_url)
    return {"message":"Model training started in background","status":"training"}

@router.get("/train/status")
def train_status():
    return _training_status

@router.post("/predict")
def get_forecast(req: ForecastRequest, db: Session = Depends(get_db)):
    records = db.query(InventoryRecord).all()
    if not records:
        raise HTTPException(400,"No data available.")
    df = pd.DataFrame([{c.name:getattr(r,c.name) for c in r.__table__.columns} for r in records])
    if not forecaster.is_trained:
        metrics = forecaster.train(df)
    preds = forecaster.predict(df, horizon=req.horizon,
                                product_id=req.product_id,
                                warehouse_id=req.warehouse_id)
    return {"predictions":preds,"horizon":req.horizon,
            "product_id":req.product_id,"warehouse_id":req.warehouse_id,
            "model":req.model,"count":len(preds)}

@router.get("/products")
def list_products(db: Session = Depends(get_db)):
    rows = db.query(InventoryRecord.product_id).distinct().all()
    return {"products":[r[0] for r in rows]}

@router.get("/warehouses")
def list_warehouses(db: Session = Depends(get_db)):
    rows = db.query(InventoryRecord.warehouse_id).distinct().all()
    return {"warehouses":[r[0] for r in rows]}

@router.get("/historical")
def get_historical(product_id: str = None, warehouse_id: str = None,
                   limit: int = 90, db: Session = Depends(get_db)):
    q = db.query(InventoryRecord)
    if product_id:   q = q.filter(InventoryRecord.product_id==product_id)
    if warehouse_id: q = q.filter(InventoryRecord.warehouse_id==warehouse_id)
    records = q.order_by(InventoryRecord.date.desc()).limit(limit).all()
    records.reverse()
    data = [{"date":r.date,"sales":r.sales,"stock_level":r.stock_level,
             "product_id":r.product_id,"warehouse_id":r.warehouse_id} for r in records]
    return {"data":data,"count":len(data)}
