import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

SCENARIO_DESCRIPTIONS = {
    "supplier_failure":  "A key supplier is unable to deliver for the specified duration.",
    "demand_surge":      "Demand increases significantly due to promotions, seasonality or events.",
    "shipping_delay":    "Shipping lead times increase due to logistics disruptions.",
    "warehouse_shutdown":"A warehouse is temporarily shut down, forcing redistribution.",
    "fuel_cost_increase":"Rising fuel costs increase delivery and operational costs.",
    "demand_drop":       "Demand drops due to market conditions or competition.",
    "new_supplier":      "Switching to a new supplier with different lead-time profile.",
}

def run_simulation(df: pd.DataFrame, scenario_type: str, magnitude: float, duration_days: int,
                   affected_warehouse=None, affected_supplier=None):
    if df.empty:
        return {"error": "No data available for simulation"}

    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])

    base_sales   = df['sales'].mean()
    base_stock   = df['stock_level'].mean()
    base_revenue = base_sales * df['unit_price'].mean() * 30
    base_cost    = df['ordering_cost'].mean() * (30/df['lead_time_days'].mean())

    np.random.seed(42)
    days = np.arange(duration_days)
    timeline = []

    if scenario_type == "supplier_failure":
        supply_cut = magnitude  # fraction of supply lost 0-1
        daily_demand = base_sales
        stock = base_stock
        for d in days:
            incoming = base_sales * (1 - supply_cut) * (1 + np.random.normal(0,0.05))
            stock = max(0, stock + incoming - daily_demand)
            shortage = max(0, daily_demand - (stock + incoming))
            revenue = (daily_demand - shortage) * df['unit_price'].mean()
            timeline.append({"day":int(d),"stock":round(stock,1),"shortage":round(shortage,1),"revenue":round(revenue,1)})
        total_shortage = sum(t['shortage'] for t in timeline)
        revenue_impact = -round(total_shortage * float(df['unit_price'].mean()), 2)
        stockout_risk  = round(min(1.0, supply_cut * 1.2), 3)
        delivery_delay = int(duration_days * supply_cut * 0.5)
        cost_change    = round(base_cost * supply_cut * 0.3 * duration_days/30, 2)

    elif scenario_type == "demand_surge":
        surge = magnitude  # multiplier e.g. 1.5 = 50% increase
        stock = base_stock
        for d in days:
            demand = base_sales * surge * (1 + np.random.normal(0,0.08))
            shortage = max(0, demand - stock)
            sold = demand - shortage
            stock = max(0, stock - sold + base_sales * 0.8)
            revenue = sold * df['unit_price'].mean()
            timeline.append({"day":int(d),"stock":round(stock,1),"shortage":round(shortage,1),"revenue":round(revenue,1)})
        total_shortage = sum(t['shortage'] for t in timeline)
        extra_revenue  = round((surge-1) * base_sales * float(df['unit_price'].mean()) * duration_days, 2)
        revenue_impact = extra_revenue - round(total_shortage * float(df['unit_price'].mean()),2)
        stockout_risk  = round(min(1.0, max(0, (surge-1)*0.8)), 3)
        delivery_delay = 0
        cost_change    = round(base_cost * (surge-1) * 0.4 * duration_days/30, 2)

    elif scenario_type == "shipping_delay":
        extra_days = int(magnitude)
        new_lead = df['lead_time_days'].mean() + extra_days
        stock = base_stock
        for d in days:
            shortfall = max(0, base_sales * extra_days / (new_lead or 1))
            shortage = max(0, shortfall * 0.3)
            stock = max(0, stock - base_sales + base_sales*0.7)
            revenue = (base_sales - shortage) * df['unit_price'].mean()
            timeline.append({"day":int(d),"stock":round(stock,1),"shortage":round(shortage,1),"revenue":round(revenue,1)})
        revenue_impact = -round(sum(t['shortage'] for t in timeline) * float(df['unit_price'].mean()),2)
        stockout_risk  = round(min(1.0, extra_days / 30), 3)
        delivery_delay = extra_days
        cost_change    = round(base_cost * 0.15 * duration_days/30, 2)

    elif scenario_type == "warehouse_shutdown":
        wh_count = max(1, df['warehouse_id'].nunique())
        lost_fraction = 1.0 / wh_count
        stock = base_stock * (1 - lost_fraction)
        for d in days:
            redistrib_cost = base_cost * 0.3
            shortage = base_sales * lost_fraction * max(0, 1 - d/7)
            stock = max(0, stock - base_sales + base_sales*0.9)
            revenue = (base_sales - shortage) * df['unit_price'].mean()
            timeline.append({"day":int(d),"stock":round(stock,1),"shortage":round(shortage,1),"revenue":round(revenue,1)})
        revenue_impact = -round(sum(t['shortage'] for t in timeline) * float(df['unit_price'].mean()),2)
        stockout_risk  = round(lost_fraction * 0.9, 3)
        delivery_delay = int(duration_days * lost_fraction * 0.4)
        cost_change    = round(base_cost * 0.5 * duration_days/30, 2)

    elif scenario_type == "fuel_cost_increase":
        cost_mult = magnitude
        for d in days:
            stock = base_stock
            timeline.append({"day":int(d),"stock":round(stock,1),"shortage":0,"revenue":round(base_sales*df['unit_price'].mean(),1)})
        revenue_impact = 0
        stockout_risk  = 0.05
        delivery_delay = int(cost_mult * 0.5)
        cost_change    = round(base_cost * (cost_mult-1) * duration_days/30, 2)

    elif scenario_type == "demand_drop":
        drop = magnitude  # e.g. 0.3 = 30% drop
        stock = base_stock
        for d in days:
            demand = base_sales * (1 - drop)
            stock = min(base_stock * 3, stock - demand + base_sales)
            revenue = demand * df['unit_price'].mean()
            timeline.append({"day":int(d),"stock":round(stock,1),"shortage":0,"revenue":round(revenue,1)})
        revenue_impact = -round(drop * base_sales * float(df['unit_price'].mean()) * duration_days,2)
        stockout_risk  = 0.0
        delivery_delay = 0
        cost_change    = -round(base_cost * drop * 0.3 * duration_days/30, 2)

    else:  # generic
        for d in days:
            timeline.append({"day":int(d),"stock":round(base_stock,1),"shortage":0,"revenue":round(base_revenue/30,1)})
        revenue_impact = 0; stockout_risk=0.1; delivery_delay=0; cost_change=0

    # Pick subset of timeline for chart (max 30 points)
    step = max(1, len(timeline)//30)
    chart_data = timeline[::step]

    return {
        "scenario":         scenario_type,
        "description":      SCENARIO_DESCRIPTIONS.get(scenario_type,"Custom scenario"),
        "duration_days":    duration_days,
        "magnitude":        magnitude,
        "summary": {
            "revenue_impact":  revenue_impact,
            "stockout_risk":   stockout_risk,
            "delivery_delay_days": delivery_delay,
            "operational_cost_change": cost_change,
            "total_shortage":  round(sum(t['shortage'] for t in timeline),1),
        },
        "baseline": {
            "daily_revenue": round(float(base_sales * df['unit_price'].mean()),2),
            "avg_stock":     round(float(base_stock),1),
            "monthly_cost":  round(float(base_cost),2),
        },
        "chart_data": chart_data,
        "recommendations": _sim_recommendations(scenario_type, stockout_risk, revenue_impact),
    }

def _sim_recommendations(scenario_type, stockout_risk, revenue_impact):
    recs = []
    if scenario_type == "supplier_failure":
        recs = ["Activate secondary supplier immediately","Increase safety stock by 30%","Expedite pending orders","Review supplier diversification strategy"]
    elif scenario_type == "demand_surge":
        recs = ["Pre-position inventory at key warehouses","Enable dynamic pricing","Alert suppliers for increased production","Review staffing levels"]
    elif scenario_type == "shipping_delay":
        recs = ["Switch to air freight for critical products","Increase safety stock buffer","Notify customers of potential delays","Explore alternative logistics partners"]
    elif scenario_type == "warehouse_shutdown":
        recs = ["Redistribute inventory to nearest warehouses","Activate overflow storage","Update delivery routes","Communicate ETA to customers"]
    elif scenario_type == "fuel_cost_increase":
        recs = ["Optimize delivery routes","Consolidate shipments","Negotiate fuel surcharge contracts","Explore local sourcing"]
    elif scenario_type == "demand_drop":
        recs = ["Pause reorder cycles","Reduce safety stock levels","Launch promotional campaigns","Review slow-moving inventory"]
    return recs
