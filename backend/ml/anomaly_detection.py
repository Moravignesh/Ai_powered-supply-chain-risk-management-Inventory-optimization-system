import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

def detect_anomalies(df: pd.DataFrame):
    if df.empty or len(df) < 20:
        return [], []
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])

    all_anomalies = []
    summary = {}

    # --- Z-Score on daily aggregated sales ---
    daily = df.groupby('date')['sales'].sum().reset_index().sort_values('date')
    daily['z_score'] = (daily['sales'] - daily['sales'].mean()) / (daily['sales'].std() or 1)
    daily['rolling_mean'] = daily['sales'].rolling(7, min_periods=1).mean()
    daily['rolling_std']  = daily['sales'].rolling(7, min_periods=1).std().fillna(1)
    daily['dev_from_roll'] = (daily['sales'] - daily['rolling_mean']) / daily['rolling_std']

    for _, row in daily.iterrows():
        z = abs(row['z_score'])
        dev = abs(row.get('dev_from_roll', 0))
        if z > 2.5 or dev > 3:
            severity = "critical" if z > 3.5 else "high" if z > 2.5 else "medium"
            direction = "spike" if row['sales'] > row['rolling_mean'] else "drop"
            all_anomalies.append({
                "date":        row['date'].strftime('%Y-%m-%d'),
                "type":        f"sales_{direction}",
                "severity":    severity,
                "metric":      "daily_sales",
                "actual":      round(float(row['sales']),1),
                "expected":    round(float(row['rolling_mean']),1),
                "z_score":     round(float(row['z_score']),2),
                "description": f"Unusual sales {direction} on {row['date'].date()}: {row['sales']:.0f} vs expected {row['rolling_mean']:.0f}",
                "product_id":  "ALL",
                "warehouse_id":"ALL",
            })

    # --- Isolation Forest on multi-feature set ---
    features_df = df.groupby('date').agg(
        total_sales=('sales','sum'),
        avg_stock=('stock_level','mean'),
        std_sales=('sales','std'),
        n_products=('product_id','nunique'),
    ).reset_index().fillna(0)

    if len(features_df) >= 20:
        scaler = StandardScaler()
        feat_matrix = scaler.fit_transform(features_df[['total_sales','avg_stock','std_sales','n_products']])
        iso = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
        labels = iso.fit_predict(feat_matrix)
        scores = iso.score_samples(feat_matrix)
        for i, (_, row) in enumerate(features_df.iterrows()):
            if labels[i] == -1:
                severity = "high" if scores[i] < -0.2 else "medium"
                all_anomalies.append({
                    "date":        row['date'].strftime('%Y-%m-%d'),
                    "type":        "multivariate_anomaly",
                    "severity":    severity,
                    "metric":      "multi_feature",
                    "actual":      round(float(row['total_sales']),1),
                    "expected":    round(float(features_df['total_sales'].median()),1),
                    "z_score":     round(float(scores[i]),3),
                    "description": f"Isolation Forest detected anomaly on {row['date'].date()} – score={scores[i]:.3f}",
                    "product_id":  "ALL",
                    "warehouse_id":"ALL",
                })

    # --- Per-product Isolation Forest ---
    for pid in df['product_id'].unique()[:5]:
        sub = df[df['product_id']==pid].groupby('date')['sales'].sum().reset_index()
        if len(sub) < 30: continue
        scaler2 = StandardScaler()
        x2 = scaler2.fit_transform(sub[['sales']])
        iso2 = IsolationForest(contamination=0.05, random_state=42)
        lbl2 = iso2.fit_predict(x2)
        sc2  = iso2.score_samples(x2)
        for i, (_, row) in enumerate(sub.iterrows()):
            if lbl2[i] == -1:
                all_anomalies.append({
                    "date":        row['date'].strftime('%Y-%m-%d') if hasattr(row['date'],'strftime') else str(row['date']),
                    "type":        "product_anomaly",
                    "severity":    "medium",
                    "metric":      f"sales_{pid}",
                    "actual":      round(float(row['sales']),1),
                    "expected":    round(float(sub['sales'].median()),1),
                    "z_score":     round(float(sc2[i]),3),
                    "description": f"Anomalous sales for {pid} on {str(row['date'])[:10]}",
                    "product_id":  pid,
                    "warehouse_id":"ALL",
                })

    # Deduplicate by date+type
    seen = set()
    unique = []
    for a in all_anomalies:
        key = (a['date'], a['type'], a.get('product_id',''))
        if key not in seen:
            seen.add(key)
            unique.append(a)

    unique.sort(key=lambda x: x['date'], reverse=True)

    summary = {
        "total_anomalies": len(unique),
        "critical": sum(1 for a in unique if a['severity']=='critical'),
        "high":     sum(1 for a in unique if a['severity']=='high'),
        "medium":   sum(1 for a in unique if a['severity']=='medium'),
        "types":    list(set(a['type'] for a in unique)),
    }
    return unique, summary
