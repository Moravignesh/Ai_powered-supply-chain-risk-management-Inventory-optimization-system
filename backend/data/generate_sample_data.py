#!/usr/bin/env python3
"""Generate realistic sample supply chain data"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

def generate(output_path="sample_data.csv", n_days=730, seed=42):
    np.random.seed(seed)
    products   = [f"P{str(i).zfill(3)}" for i in range(1,11)]
    warehouses = ["WH001","WH002","WH003"]
    regions    = {"WH001":"North","WH002":"South","WH003":"East"}
    suppliers  = {"P001":"S001","P002":"S001","P003":"S002","P004":"S002","P005":"S003",
                  "P006":"S003","P007":"S004","P008":"S004","P009":"S005","P010":"S005"}
    base_demand= {"P001":120,"P002":80,"P003":200,"P004":60,"P005":150,
                  "P006":90,"P007":180,"P008":45,"P009":110,"P010":75}
    unit_prices= {"P001":25.0,"P002":45.0,"P003":12.0,"P004":80.0,"P005":18.0,
                  "P006":35.0,"P007":22.0,"P008":95.0,"P009":28.0,"P010":55.0}
    wh_factor  = {"WH001":1.0,"WH002":0.8,"WH003":1.2}

    start_date = datetime(2022,1,1)
    records    = []

    for d in range(n_days):
        date = start_date + timedelta(days=d)
        doy  = date.timetuple().tm_yday
        # Seasonal factor (peak in Dec, trough in Feb)
        seasonal = 1.0 + 0.35*np.sin(2*np.pi*(doy-80)/365)
        # Weekly pattern
        weekly   = 1.15 if date.weekday()>=5 else 1.0
        # Holiday bump
        holiday  = 1 if (date.month==12 and date.day>=20) or (date.month==1 and date.day<=3) else 0
        holiday_f= 1.6 if holiday else 1.0
        # Promo random
        promo    = 1 if np.random.random()<0.08 else 0
        promo_f  = 1.3 if promo else 1.0

        for pid in products:
            for wid in warehouses:
                bd   = base_demand[pid] * wh_factor[wid]
                noise= np.random.normal(1.0, 0.12)
                sales= max(0, int(bd * seasonal * weekly * holiday_f * promo_f * noise))

                # Stock: start high, decrease with sales, replenish randomly
                base_stock = bd * 15
                stock_noise= np.random.uniform(0.6, 1.4)
                # Simulate depletion over time with lead-time replenishment
                stock_level= max(10, int(base_stock * stock_noise - sales * 0.3))
                lead_time  = int(np.clip(np.random.normal(7, 2), 2, 14))
                reorder_pt = int(bd * lead_time * 1.2)
                ordering_c = 50.0 + np.random.uniform(-5, 5)
                holding_c  = max(0.5, unit_prices[pid] * 0.02)

                records.append({
                    "date":          date.strftime("%Y-%m-%d"),
                    "product_id":    pid,
                    "warehouse_id":  wid,
                    "region":        regions[wid],
                    "supplier_id":   suppliers[pid],
                    "sales":         sales,
                    "stock_level":   stock_level,
                    "lead_time_days":lead_time,
                    "reorder_point": reorder_pt,
                    "promotion":     promo,
                    "holiday":       holiday,
                    "is_weekend":    1 if date.weekday()>=5 else 0,
                    "unit_price":    round(unit_prices[pid] * np.random.uniform(0.95,1.05), 2),
                    "ordering_cost": round(ordering_c, 2),
                    "holding_cost":  round(holding_c, 2),
                })

    df = pd.DataFrame(records)
    df.to_csv(output_path, index=False)
    print(f"Generated {len(df):,} records -> {output_path}")
    print(f"  Products: {df['product_id'].nunique()}, Warehouses: {df['warehouse_id'].nunique()}")
    print(f"  Date range: {df['date'].min()} to {df['date'].max()}")
    return df

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "sample_data.csv")
    generate(out)
