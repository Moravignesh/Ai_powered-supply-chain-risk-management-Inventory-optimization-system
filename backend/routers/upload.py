from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.db_models import InventoryRecord
import pandas as pd, io, os

router = APIRouter()

REQUIRED_COLS = {'date','product_id','warehouse_id','sales','stock_level'}

@router.post("/data")
async def upload_data(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Only CSV files are supported")
    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))
    except Exception as e:
        raise HTTPException(400, f"Error reading CSV: {str(e)}")
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise HTTPException(400, f"Missing required columns: {missing}")
    df = df.fillna(0)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    # Clear existing and insert
    db.query(InventoryRecord).delete()
    for _, row in df.iterrows():
        rec = InventoryRecord(
            date=str(row.get('date','')),
            product_id=str(row.get('product_id','')),
            warehouse_id=str(row.get('warehouse_id','')),
            region=str(row.get('region','')),
            supplier_id=str(row.get('supplier_id','')),
            sales=float(row.get('sales',0)),
            stock_level=float(row.get('stock_level',0)),
            lead_time_days=int(row.get('lead_time_days',7)),
            reorder_point=float(row.get('reorder_point',0)),
            promotion=int(row.get('promotion',0)),
            holiday=int(row.get('holiday',0)),
            is_weekend=int(row.get('is_weekend',0)),
            unit_price=float(row.get('unit_price',10)),
            ordering_cost=float(row.get('ordering_cost',50)),
            holding_cost=float(row.get('holding_cost',2)),
        )
        db.add(rec)
    db.commit()
    return {"message":"Data uploaded successfully","rows":len(df),
            "products":int(df['product_id'].nunique()),
            "warehouses":int(df['warehouse_id'].nunique()),
            "date_range":f"{df['date'].min()} to {df['date'].max()}"}

@router.get("/status")
def upload_status(db: Session = Depends(get_db)):
    count = db.query(InventoryRecord).count()
    if count == 0:
        return {"status":"empty","records":0,"message":"No data loaded. Upload a CSV first."}
    from sqlalchemy import func
    sample = db.query(InventoryRecord).first()
    dates = db.query(func.min(InventoryRecord.date), func.max(InventoryRecord.date)).first()
    products   = db.query(InventoryRecord.product_id).distinct().count()
    warehouses = db.query(InventoryRecord.warehouse_id).distinct().count()
    return {"status":"loaded","records":count,"products":products,"warehouses":warehouses,
            "date_range":f"{dates[0]} to {dates[1]}"}

@router.delete("/clear")
def clear_data(db: Session = Depends(get_db)):
    db.query(InventoryRecord).delete()
    db.commit()
    return {"message":"Data cleared"}
