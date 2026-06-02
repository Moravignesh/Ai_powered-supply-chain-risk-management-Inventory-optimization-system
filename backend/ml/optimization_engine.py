import pandas as pd
import numpy as np

def calc_eoq(annual_demand, ordering_cost, holding_cost_per_unit):
    if holding_cost_per_unit <= 0: holding_cost_per_unit = 1
    return max(1, int(np.sqrt(2 * annual_demand * ordering_cost / holding_cost_per_unit)))

def calc_safety_stock(std_demand, lead_time, service_level=0.95):
    z = {0.90:1.28,0.95:1.645,0.99:2.326}.get(service_level, 1.645)
    return max(0, int(z * std_demand * np.sqrt(lead_time)))

def calc_reorder_point(avg_daily_demand, lead_time, safety_stock):
    return max(0, int(avg_daily_demand * lead_time + safety_stock))

def generate_recommendations(df: pd.DataFrame):
    if df.empty: return []
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    recommendations = []

    # Warehouse level totals
    wh_stocks = df.groupby('warehouse_id')['stock_level'].mean()
    wh_sales  = df.groupby('warehouse_id')['sales'].mean()

    for pid in df['product_id'].unique():
        for wid in df['warehouse_id'].unique():
            sub = df[(df['product_id']==pid)&(df['warehouse_id']==wid)].sort_values('date')
            if len(sub) < 14: continue

            avg_daily  = sub['sales'].tail(30).mean() or 1
            std_demand = sub['sales'].tail(30).std() or 0
            lead_time  = int(sub['lead_time_days'].mean() or 7)
            curr_stock = float(sub['stock_level'].iloc[-1])
            unit_price = float(sub['unit_price'].mean() or 10)
            ordering_c = float(sub['ordering_cost'].mean() or 50)
            holding_c  = float(sub['holding_cost'].mean() or 2)
            annual_dem = avg_daily * 365

            eoq     = calc_eoq(annual_dem, ordering_c, holding_c)
            ss      = calc_safety_stock(std_demand, lead_time)
            rop     = calc_reorder_point(avg_daily, lead_time, ss)
            days_of_stock = curr_stock / avg_daily

            # Reorder recommendation
            if curr_stock <= rop:
                priority = "URGENT" if curr_stock <= ss else "HIGH"
                recommendations.append({
                    "product_id": pid, "warehouse_id": wid,
                    "type": "reorder",
                    "priority": priority,
                    "recommendation": f"Place reorder for {pid}@{wid}: Order {eoq} units (EOQ). Current stock {int(curr_stock)} ≤ ROP {rop}.",
                    "quantity": eoq, "rop": rop, "safety_stock": ss, "eoq": eoq,
                    "estimated_cost": round(eoq*unit_price,2),
                    "days_of_stock": round(days_of_stock,1),
                })
            # Safety stock adjustment
            curr_ss = int(curr_stock * 0.1)
            if abs(curr_ss - ss) > 20:
                action = "Increase" if ss > curr_ss else "Reduce"
                recommendations.append({
                    "product_id": pid, "warehouse_id": wid,
                    "type": "safety_stock",
                    "priority": "MEDIUM",
                    "recommendation": f"{action} safety stock for {pid}@{wid} from ~{curr_ss} to {ss} units.",
                    "quantity": ss, "rop": rop, "safety_stock": ss, "eoq": eoq,
                    "estimated_cost": round((ss-curr_ss)*holding_c,2),
                    "days_of_stock": round(days_of_stock,1),
                })
            # Overstock reduction
            monthly_demand = avg_daily * 30
            if curr_stock > 4 * monthly_demand:
                excess = int(curr_stock - 2*monthly_demand)
                # Find a warehouse with low stock for same product
                other_wh_low = [
                    w for w in df['warehouse_id'].unique()
                    if w != wid and
                    float(df[(df['product_id']==pid)&(df['warehouse_id']==w)]['stock_level'].mean() or 0)
                    < monthly_demand
                ]
                if other_wh_low:
                    target = other_wh_low[0]
                    recommendations.append({
                        "product_id": pid, "warehouse_id": wid,
                        "type": "redistribution",
                        "priority": "MEDIUM",
                        "recommendation": f"Transfer {excess} units of {pid} from {wid} to {target} to balance stock.",
                        "quantity": excess, "target_warehouse": target,
                        "estimated_cost": round(excess*0.5,2),
                        "days_of_stock": round(days_of_stock,1),
                        "rop": rop, "safety_stock": ss, "eoq": eoq,
                    })
                else:
                    recommendations.append({
                        "product_id": pid, "warehouse_id": wid,
                        "type": "reduce_reorder",
                        "priority": "LOW",
                        "recommendation": f"Reduce reorder frequency for {pid}@{wid} – overstocked at {curr_stock:.0f} vs {monthly_demand:.0f}/month demand.",
                        "quantity": 0, "rop": rop, "safety_stock": ss, "eoq": eoq,
                        "estimated_cost": 0, "days_of_stock": round(days_of_stock,1),
                    })

    priority_order = {"URGENT":0,"HIGH":1,"MEDIUM":2,"LOW":3}
    recommendations.sort(key=lambda x: priority_order.get(x['priority'],4))
    return recommendations
