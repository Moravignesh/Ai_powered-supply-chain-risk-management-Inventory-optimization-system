# ⛓ Supply Chain AI Platform
### AI-Powered Supply Chain Risk Prediction & Inventory Optimization

---

## 🚀 Quick Start

### 1 — Backend (Python + FastAPI)
```bash
cd supply-chain-ai/backend

# Create & activate virtual environment
python -m venv venv
# Windows:   venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt
python main.py
# → http://localhost:8000   |   Swagger: http://localhost:8000/docs
```

### 2 — Frontend (React + Vite)
```bash
cd supply-chain-ai/frontend
npm install
npm run dev          # ← command is "npm run dev"
# → http://localhost:3000
```

### 3 — Load Sample Data
1. Open **http://localhost:3000**
2. Click **📂 Upload CSV Data** → select `backend/data/sample_data.csv`
3. Click **🧠 Train AI Models**
4. Explore all 7 pages!

---

## 🗂 Project Structure
```
supply-chain-ai/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── database.py                # SQLAlchemy / SQLite setup
│   ├── requirements.txt
│   ├── models/
│   │   ├── db_models.py           # SQLAlchemy ORM models
│   │   └── schemas.py             # Pydantic request schemas
│   ├── routers/                   # 7 API route modules
│   │   ├── upload.py   forecast.py   risk.py
│   │   ├── optimization.py   simulation.py
│   │   ├── anomaly.py   analytics.py
│   ├── ml/                        # Machine learning modules
│   │   ├── preprocessing.py       # Feature engineering
│   │   ├── forecasting.py         # XGBoost + Random Forest
│   │   ├── risk_prediction.py     # Risk scoring engine
│   │   ├── optimization_engine.py # EOQ / Safety Stock / ROP
│   │   ├── anomaly_detection.py   # Isolation Forest + Z-Score
│   │   └── simulation_engine.py  # Monte Carlo simulation
│   └── data/
│       └── sample_data.csv        # 21,900 rows pre-generated
└── frontend/                      # React 18 + Vite
    ├── index.html                 # Vite HTML entry
    ├── vite.config.js             # Vite config + proxy
    ├── package.json               # npm run dev
    └── src/
        ├── main.jsx               # ReactDOM entry
        ├── App.jsx                # Root component + sidebar nav
        ├── App.css                # Global dark-theme styles
        ├── api/index.js           # Axios API service
        └── components/
            ├── Dashboard/Dashboard.jsx
            ├── Forecasting/Forecasting.jsx
            ├── Risk/RiskPrediction.jsx
            ├── Optimization/Optimization.jsx
            ├── Simulation/Simulation.jsx
            ├── Anomaly/AnomalyDetection.jsx
            └── Analytics/Analytics.jsx
```

---

## 📊 Dataset — sample_data.csv
| Column | Type | Description |
|--------|------|-------------|
| date | YYYY-MM-DD | Daily record |
| product_id | P001–P010 | Product identifier |
| warehouse_id | WH001–WH003 | Warehouse |
| region | North/South/East | Geographic region |
| supplier_id | S001–S005 | Supplier |
| sales | int | Units sold |
| stock_level | int | Current stock |
| lead_time_days | int | Supplier lead time |
| reorder_point | int | Reorder threshold |
| promotion | 0/1 | Promotion flag |
| holiday | 0/1 | Holiday flag |
| is_weekend | 0/1 | Weekend flag |
| unit_price | float | Price per unit |
| ordering_cost | float | Fixed order cost ($) |
| holding_cost | float | Holding cost/unit/day ($) |

---

## 🤖 ML Methodology

| Module | Algorithm | Details |
|--------|-----------|---------|
| **Forecasting** | XGBoost 60% + RF 40% | Lag features (1,7,14,30d), rolling stats, date features |
| **Risk** | Rule-based + ML scoring | Stockout, overstock, supplier delay, demand surge |
| **Optimization** | EOQ + Safety Stock | √(2DS/H), Z×σ×√LT, redistribution logic |
| **Anomaly** | Isolation Forest + Z-Score | contamination=0.05, Z threshold=2.5 |
| **Simulation** | Monte Carlo | Daily stock depletion model, 6 scenario types |

---

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/upload/data | Upload CSV |
| GET  | /api/upload/status | Data status |
| POST | /api/forecast/train | Train XGBoost + RF |
| POST | /api/forecast/predict | Get forecasts |
| GET  | /api/forecast/historical | Historical data |
| GET  | /api/risk/predict | Risk scores |
| GET  | /api/risk/alerts | Active alerts |
| GET  | /api/risk/summary | Risk summary |
| GET  | /api/optimization/recommendations | Recs list |
| GET  | /api/optimization/eoq | EOQ calculator |
| POST | /api/simulation/run | Run scenario |
| GET  | /api/simulation/scenarios | Available scenarios |
| GET  | /api/anomaly/detect | Detect anomalies |
| GET  | /api/anomaly/timeline | Anomaly timeline |
| GET  | /api/analytics/summary | Dashboard stats |
| GET  | /api/analytics/inventory | Warehouse analytics |
| GET  | /api/analytics/supplier | Supplier analytics |
| GET  | /api/analytics/trends | Sales trends |
| GET  | /api/analytics/regional | Regional breakdown |

---

## 🛠 Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend API | Python 3.9+, FastAPI, Uvicorn |
| ORM / DB | SQLAlchemy, SQLite |
| ML | XGBoost, Scikit-learn, NumPy, Pandas |
| Simulation | NumPy Monte Carlo |
| Frontend | React 18, Vite 5 |
| Charts | Recharts (Line, Bar, Area, Pie, Scatter, Radar) |
| HTTP Client | Axios (with Vite proxy) |

---

*Supply Chain AI Platform — Full-Stack ML Assignment*
