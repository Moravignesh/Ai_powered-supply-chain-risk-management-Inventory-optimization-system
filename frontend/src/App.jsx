import React, { useState, useEffect } from 'react'
import { getUploadStatus } from './api/index.js'
import Dashboard        from './components/Dashboard/Dashboard.jsx'
import Forecasting      from './components/Forecasting/Forecasting.jsx'
import RiskPrediction   from './components/Risk/RiskPrediction.jsx'
import Optimization     from './components/Optimization/Optimization.jsx'
import Simulation       from './components/Simulation/Simulation.jsx'
import AnomalyDetection from './components/Anomaly/AnomalyDetection.jsx'
import Analytics        from './components/Analytics/Analytics.jsx'

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',          icon: '📊' },
  { id: 'forecast',     label: 'Demand Forecast',     icon: '📈' },
  { id: 'risk',         label: 'Risk Prediction',     icon: '⚠️'  },
  { id: 'optimization', label: 'Optimization',        icon: '⚙️'  },
  { id: 'simulation',   label: 'Simulation',          icon: '🎯' },
  { id: 'anomaly',      label: 'Anomaly Detection',   icon: '🔍' },
  { id: 'analytics',    label: 'Analytics',           icon: '📉' },
]

const PAGES = {
  dashboard:    <Dashboard />,
  forecast:     <Forecasting />,
  risk:         <RiskPrediction />,
  optimization: <Optimization />,
  simulation:   <Simulation />,
  anomaly:      <AnomalyDetection />,
  analytics:    <Analytics />,
}

export default function App() {
  const [active, setActive]         = useState('dashboard')
  const [dataStatus, setDataStatus] = useState(null)

  useEffect(() => {
    const fetch = () => getUploadStatus().then(r => setDataStatus(r.data)).catch(() => {})
    fetch()
    const iv = setInterval(fetch, 30000)
    return () => clearInterval(iv)
  }, [])

  const current = NAV.find(n => n.id === active)

  return (
    <div className="app-layout">
      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>⛓ Supply Chain AI</h2>
          <p>Risk & Optimization Platform</p>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-item${active === n.id ? ' active' : ''}`}
              onClick={() => setActive(n.id)}
            >
              <span className="icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {dataStatus?.status === 'loaded' ? (
            <span style={{ color: '#22c55e', fontSize: 11 }}>
              ● {dataStatus.records?.toLocaleString()} records loaded
            </span>
          ) : (
            <span style={{ color: '#f97316', fontSize: 11 }}>
              ● Upload data to begin
            </span>
          )}
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="main-content">
        <header className="topbar">
          <h1>{current?.icon}&nbsp;&nbsp;{current?.label}</h1>
          <div style={{ fontSize: 11, color: '#475569' }}>
            Supply Chain AI Platform&nbsp;v1.0
          </div>
        </header>

        <main className="page-content">
          {PAGES[active] ?? <Dashboard />}
        </main>
      </div>
    </div>
  )
}
