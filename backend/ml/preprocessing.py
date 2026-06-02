import pandas as pd
import numpy as np
from datetime import datetime

def load_data_from_db(db, model):
    records = db.query(model).all()
    if not records:
        return pd.DataFrame()
    data = [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in records]
    return pd.DataFrame(data)

def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    for col in ['sales','stock_level','lead_time_days','reorder_point','unit_price','ordering_cost','holding_cost']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    return df

def engineer_features(df: pd.DataFrame, target='sales') -> pd.DataFrame:
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    df['day_of_week']  = df['date'].dt.dayofweek
    df['day_of_month'] = df['date'].dt.day
    df['month']        = df['date'].dt.month
    df['quarter']      = df['date'].dt.quarter
    df['year']         = df['date'].dt.year
    df['day_of_year']  = df['date'].dt.dayofyear
    df['week_of_year'] = df['date'].dt.isocalendar().week.astype(int)
    df['is_month_end'] = df['date'].dt.is_month_end.astype(int)
    df['trend']        = range(len(df))
    for lag in [1, 7, 14, 30]:
        df[f'lag_{lag}'] = df[target].shift(lag)
    for w in [7, 14, 30]:
        df[f'roll_mean_{w}'] = df[target].rolling(w, min_periods=1).mean()
        df[f'roll_std_{w}']  = df[target].rolling(w, min_periods=1).std().fillna(0)
        df[f'roll_max_{w}']  = df[target].rolling(w, min_periods=1).max()
    df['roll_mean_90'] = df[target].rolling(90, min_periods=1).mean()
    df = df.bfill().fillna(0)
    return df

FEATURE_COLS = [
    'day_of_week','day_of_month','month','quarter','year','day_of_year',
    'week_of_year','is_month_end','trend',
    'lag_1','lag_7','lag_14','lag_30',
    'roll_mean_7','roll_mean_14','roll_mean_30','roll_mean_90',
    'roll_std_7','roll_std_14','roll_std_30',
    'roll_max_7','roll_max_14','roll_max_30',
    'promotion','holiday','is_weekend'
]
