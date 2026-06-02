from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.db_models import InventoryRecord
import pandas as pd, numpy as np

router = APIRouter()

def _load(db):
    records = db.query(InventoryRecord).all()
    if not records: return pd.DataFrame()
    return pd.DataFrame([{c.name:getattr(r,c.name) for c in r.__table__.columns} for r in records])

@router.get("/summary")
def get_summary(db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: return {"error":"No data"}
    df['date'] = pd.to_datetime(df['date'])
    total_sales   = float(df['sales'].sum())
    avg_stock     = float(df['stock_level'].mean())
    total_revenue = float((df['sales']*df['unit_price']).sum())
    recent = df[df['date']>=df['date'].max()-pd.Timedelta(days=30)]
    older  = df[df['date']<df['date'].max()-pd.Timedelta(days=30)]
    sales_trend = ((recent['sales'].mean()-older['sales'].mean())/(older['sales'].mean()+1e-9))*100 if not older.empty else 0
    return {
        "total_records":    int(len(df)),
        "total_sales":      round(total_sales,1),
        "total_revenue":    round(total_revenue,2),
        "avg_stock_level":  round(avg_stock,1),
        "unique_products":  int(df['product_id'].nunique()),
        "unique_warehouses":int(df['warehouse_id'].nunique()),
        "unique_suppliers": int(df['supplier_id'].nunique()),
        "sales_trend_30d":  round(float(sales_trend),2),
        "avg_lead_time":    round(float(df['lead_time_days'].mean()),1),
        "date_range":       {"from":df['date'].min().strftime('%Y-%m-%d'),"to":df['date'].max().strftime('%Y-%m-%d')},
    }

@router.get("/inventory")
def get_inventory(db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: return {"error":"No data"}
    by_wh = df.groupby('warehouse_id').agg(
        avg_stock=('stock_level','mean'),
        total_sales=('sales','sum'),
        products=('product_id','nunique'),
        avg_lead_time=('lead_time_days','mean'),
    ).reset_index()
    by_wh = by_wh.round(2)
    by_prod = df.groupby('product_id').agg(
        total_sales=('sales','sum'),
        avg_stock=('stock_level','mean'),
        avg_price=('unit_price','mean'),
    ).reset_index().sort_values('total_sales',ascending=False).head(10)
    by_prod = by_prod.round(2)
    return {
        "by_warehouse": by_wh.to_dict('records'),
        "top_products": by_prod.to_dict('records'),
    }

@router.get("/supplier")
def get_supplier_analytics(db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: return {"error":"No data"}
    by_sup = df.groupby('supplier_id').agg(
        avg_lead_time=('lead_time_days','mean'),
        std_lead_time=('lead_time_days','std'),
        total_sales=('sales','sum'),
        products=('product_id','nunique'),
    ).reset_index().fillna(0)
    by_sup['reliability_score'] = (1 - by_sup['std_lead_time']/(by_sup['avg_lead_time']+1)).clip(0,1).round(3)
    by_sup = by_sup.round(2).sort_values('total_sales',ascending=False)
    return {"suppliers": by_sup.to_dict('records')}

@router.get("/trends")
def get_trends(granularity: str='month', db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: return {"error":"No data"}
    df['date'] = pd.to_datetime(df['date'])
    if granularity == 'month':
        df['period'] = df['date'].dt.to_period('M').astype(str)
    elif granularity == 'week':
        df['period'] = df['date'].dt.to_period('W').astype(str)
    else:
        df['period'] = df['date'].dt.strftime('%Y-%m-%d')
    grouped = df.groupby('period').agg(
        total_sales=('sales','sum'),
        avg_stock=('stock_level','mean'),
        revenue=('sales','sum'),
    ).reset_index().sort_values('period')
    grouped['revenue'] = (grouped['revenue'] * df['unit_price'].mean()).round(2)
    return {"trends": grouped.tail(24).to_dict('records'), "granularity": granularity}

@router.get("/regional")
def get_regional(db: Session=Depends(get_db)):
    df = _load(db)
    if df.empty: return {"error":"No data"}
    regional = df.groupby('region').agg(
        total_sales=('sales','sum'),
        avg_stock=('stock_level','mean'),
        warehouses=('warehouse_id','nunique'),
    ).reset_index().round(2)
    return {"regional": regional.to_dict('records')}
