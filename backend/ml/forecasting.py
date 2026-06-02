import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import xgboost as xgb
import joblib, os, warnings
from datetime import timedelta
from ml.preprocessing import engineer_features, FEATURE_COLS, preprocess

warnings.filterwarnings('ignore')
MODEL_DIR = os.getenv("MODEL_DIR", "./saved_models")

class DemandForecaster:
    def __init__(self):
        self.xgb_model = None
        self.rf_model  = None
        self.feature_cols = []
        self.is_trained = False
        self.last_data  = None

    def train(self, df: pd.DataFrame):
        df = preprocess(df)
        df = engineer_features(df)
        df.dropna(inplace=True)
        avail = [c for c in FEATURE_COLS if c in df.columns]
        X = df[avail].fillna(0)
        y = df['sales']
        self.feature_cols = avail
        self.xgb_model = xgb.XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1)
        self.xgb_model.fit(X, y)
        self.rf_model = RandomForestRegressor(
            n_estimators=150, max_depth=10, min_samples_leaf=2,
            random_state=42, n_jobs=-1)
        self.rf_model.fit(X, y)
        self.is_trained = True
        self.last_data  = df.copy()
        y_pred = (self.xgb_model.predict(X)*0.6 + self.rf_model.predict(X)*0.4)
        mae  = mean_absolute_error(y, y_pred)
        rmse = np.sqrt(mean_squared_error(y, y_pred))
        mape = np.mean(np.abs((y - y_pred) / (y + 1e-9))) * 100
        return {"mae": round(mae,2), "rmse": round(rmse,2), "mape": round(mape,2), "samples": len(df)}

    def _make_future_row(self, next_date, history):
        sales_series = history['sales']
        row = {
            'day_of_week':  next_date.dayofweek,
            'day_of_month': next_date.day,
            'month':        next_date.month,
            'quarter':      (next_date.month-1)//3+1,
            'year':         next_date.year,
            'day_of_year':  next_date.timetuple().tm_yday,
            'week_of_year': next_date.isocalendar()[1],
            'is_month_end': int(next_date.is_month_end),
            'trend':        len(history),
            'lag_1':  float(sales_series.iloc[-1])  if len(sales_series)>=1  else 0,
            'lag_7':  float(sales_series.iloc[-7])  if len(sales_series)>=7  else float(sales_series.mean()),
            'lag_14': float(sales_series.iloc[-14]) if len(sales_series)>=14 else float(sales_series.mean()),
            'lag_30': float(sales_series.iloc[-30]) if len(sales_series)>=30 else float(sales_series.mean()),
            'roll_mean_7':  float(sales_series.tail(7).mean()),
            'roll_mean_14': float(sales_series.tail(14).mean()),
            'roll_mean_30': float(sales_series.tail(30).mean()),
            'roll_mean_90': float(sales_series.tail(90).mean()),
            'roll_std_7':   float(sales_series.tail(7).std())  if len(sales_series)>=2 else 0,
            'roll_std_14':  float(sales_series.tail(14).std()) if len(sales_series)>=2 else 0,
            'roll_std_30':  float(sales_series.tail(30).std()) if len(sales_series)>=2 else 0,
            'roll_max_7':   float(sales_series.tail(7).max()),
            'roll_max_14':  float(sales_series.tail(14).max()),
            'roll_max_30':  float(sales_series.tail(30).max()),
            'promotion':    1 if np.random.random()<0.08 else 0,
            'holiday':      1 if (next_date.month==12 and next_date.day>=20) else 0,
            'is_weekend':   1 if next_date.weekday()>=5 else 0,
        }
        return row

    def predict(self, df: pd.DataFrame, horizon=30, product_id=None, warehouse_id=None):
        if not self.is_trained:
            raise ValueError("Model not trained yet. Call /api/forecast/train first.")
        sub = df.copy()
        if product_id:   sub = sub[sub['product_id']==product_id]
        if warehouse_id: sub = sub[sub['warehouse_id']==warehouse_id]
        if sub.empty:    sub = df.copy()
        sub = preprocess(sub)
        sub = engineer_features(sub)
        last_date = pd.to_datetime(sub['date'].max())
        history   = sub[['date','sales']].copy()
        results   = []
        for i in range(horizon):
            next_date = last_date + timedelta(days=i+1)
            row = self._make_future_row(next_date, history)
            avail_cols = [c for c in self.feature_cols if c in row]
            X_row = pd.DataFrame([{c: row.get(c,0) for c in avail_cols}])
            p_xgb = max(0, float(self.xgb_model.predict(X_row)[0]))
            p_rf  = max(0, float(self.rf_model.predict(X_row)[0]))
            pred  = p_xgb*0.6 + p_rf*0.4
            std   = float(history['sales'].tail(30).std()) if len(history)>=7 else pred*0.15
            results.append({
                'date':             next_date.strftime('%Y-%m-%d'),
                'predicted_demand': round(pred,1),
                'xgb_prediction':   round(p_xgb,1),
                'rf_prediction':    round(p_rf,1),
                'lower_bound':      round(max(0,pred-1.96*std),1),
                'upper_bound':      round(pred+1.96*std,1),
            })
            new_row = pd.DataFrame({'date':[next_date],'sales':[pred]})
            history = pd.concat([history, new_row], ignore_index=True)
        return results

forecaster = DemandForecaster()
