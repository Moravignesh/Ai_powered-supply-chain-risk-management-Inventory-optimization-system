import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import warnings
warnings.filterwarnings('ignore')

def compute_risk_scores(df: pd.DataFrame):
    if df.empty:
        return []
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    results = []
    for pid in df['product_id'].unique():
        for wid in df['warehouse_id'].unique():
            sub = df[(df['product_id']==pid)&(df['warehouse_id']==wid)].sort_values('date')
            if sub.empty: continue
            avg_daily_sales = sub['sales'].tail(30).mean() or 1
            avg_stock       = sub['stock_level'].tail(7).mean() or 0
            current_stock   = float(sub['stock_level'].iloc[-1])
            avg_lead_time   = float(sub['lead_time_days'].mean()) or 7
            std_lead_time   = float(sub['lead_time_days'].std()) or 1
            demand_std      = sub['sales'].tail(30).std() or 0
            demand_recent   = sub['sales'].tail(7).mean()
            demand_baseline = sub['sales'].tail(30).mean() or 1

            # ---- Stockout risk ----
            days_of_stock = current_stock / avg_daily_sales
            stockout_score = max(0.0, min(1.0, 1.0 - days_of_stock/30))
            if days_of_stock < 5:
                stockout_level = "critical"
                stockout_msg   = f"CRITICAL: {pid}@{wid} will stock out in ~{int(days_of_stock)} days!"
            elif days_of_stock < 10:
                stockout_level = "high"
                stockout_msg   = f"HIGH: {pid}@{wid} stock covers only {int(days_of_stock)} days."
            elif days_of_stock < 20:
                stockout_level = "medium"
                stockout_msg   = f"MEDIUM: {pid}@{wid} low stock ({int(days_of_stock)} days)."
            else:
                stockout_level = "low"
                stockout_msg   = f"LOW: {pid}@{wid} stock is adequate ({int(days_of_stock)} days)."

            # ---- Overstock risk ----
            monthly_demand = avg_daily_sales * 30
            overstock_ratio = current_stock / (monthly_demand or 1)
            overstock_score = max(0.0, min(1.0, (overstock_ratio - 2) / 8)) if overstock_ratio > 2 else 0
            if overstock_ratio > 6:
                overstock_level = "high"
                overstock_msg   = f"HIGH: {pid}@{wid} overstocked at {overstock_ratio:.1f}x monthly demand."
            elif overstock_ratio > 3:
                overstock_level = "medium"
                overstock_msg   = f"MEDIUM: {pid}@{wid} excess stock at {overstock_ratio:.1f}x monthly demand."
            else:
                overstock_level = "low"
                overstock_msg   = None

            # ---- Supplier delay risk ----
            cv_lead = std_lead_time / (avg_lead_time or 1)
            delay_score = min(1.0, cv_lead * 2)
            if delay_score > 0.7:
                delay_level = "high"
                delay_msg   = f"HIGH: Supplier for {pid} has high lead-time variability (CV={cv_lead:.2f})."
            elif delay_score > 0.4:
                delay_level = "medium"
                delay_msg   = f"MEDIUM: Moderate delay risk for {pid} supplier."
            else:
                delay_level = "low"
                delay_msg   = None

            # ---- Demand surge risk ----
            surge_ratio = (demand_recent / demand_baseline) if demand_baseline else 1
            surge_score = max(0.0, min(1.0, (surge_ratio - 1.2) / 0.8))
            if surge_ratio > 1.8:
                surge_level = "high"
                surge_msg   = f"HIGH: Demand surge detected for {pid} – {surge_ratio:.1f}x baseline!"
            elif surge_ratio > 1.3:
                surge_level = "medium"
                surge_msg   = f"MEDIUM: Rising demand for {pid} ({surge_ratio:.1f}x)."
            else:
                surge_level = "low"
                surge_msg   = None

            overall_score = max(stockout_score, overstock_score, delay_score, surge_score)

            item = {
                "product_id":    pid,
                "warehouse_id":  wid,
                "overall_risk":  round(overall_score, 3),
                "stockout": {"score": round(stockout_score,3), "level": stockout_level, "days_remaining": round(days_of_stock,1), "message": stockout_msg},
                "overstock": {"score": round(overstock_score,3), "level": overstock_level, "ratio": round(overstock_ratio,2), "message": overstock_msg},
                "supplier_delay": {"score": round(delay_score,3), "level": delay_level, "cv": round(cv_lead,3), "message": delay_msg},
                "demand_surge": {"score": round(surge_score,3), "level": surge_level, "ratio": round(surge_ratio,3), "message": surge_msg},
                "current_stock": current_stock,
                "avg_daily_sales": round(avg_daily_sales,1),
                "avg_lead_time":   round(avg_lead_time,1),
            }
            results.append(item)

    results.sort(key=lambda x: x['overall_risk'], reverse=True)
    return results

def generate_alerts(risk_scores):
    alerts = []
    for r in risk_scores:
        pid, wid = r['product_id'], r['warehouse_id']
        for key in ['stockout','overstock','supplier_delay','demand_surge']:
            section = r[key]
            if section.get('level') in ('high','critical') and section.get('message'):
                alerts.append({
                    "type":    key,
                    "level":   section['level'],
                    "message": section['message'],
                    "score":   section['score'],
                    "product_id":   pid,
                    "warehouse_id": wid,
                })
    return alerts
