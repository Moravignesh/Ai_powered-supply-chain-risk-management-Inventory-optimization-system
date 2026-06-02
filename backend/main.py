from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn, os

from database import engine, Base
from routers import upload, forecast, risk, optimization, simulation, anomaly, analytics

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Supply Chain AI Platform Starting...")
    os.makedirs("saved_models", exist_ok=True)
    yield

app = FastAPI(
    title="Supply Chain AI Platform",
    description="AI-Powered Supply Chain Risk Prediction & Inventory Optimization",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,       prefix="/api/upload",       tags=["Upload"])
app.include_router(forecast.router,     prefix="/api/forecast",     tags=["Forecasting"])
app.include_router(risk.router,         prefix="/api/risk",         tags=["Risk"])
app.include_router(optimization.router, prefix="/api/optimization", tags=["Optimization"])
app.include_router(simulation.router,   prefix="/api/simulation",   tags=["Simulation"])
app.include_router(anomaly.router,      prefix="/api/anomaly",      tags=["Anomaly"])
app.include_router(analytics.router,    prefix="/api/analytics",    tags=["Analytics"])

@app.get("/")
async def root():
    return {"message":"Supply Chain AI Platform","version":"1.0.0","status":"running"}

@app.get("/health")
async def health():
    return {"status":"healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
