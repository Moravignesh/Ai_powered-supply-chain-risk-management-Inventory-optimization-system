import React, { useState, useEffect } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import { runSimulation, getScenarios } from '../../api/index.js'

const ttStyle    = { background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }
const impactCol  = v => (v < 0 ? '#ef4444' : '#22c55e')

export default function Simulation() {
  const [scenarios, setScenarios] = useState([])
  const [form,      setForm]      = useState({
    scenario_type: 'supplier_failure', magnitude: 0.5,
    duration_days: 30, affected_warehouse: '', affected_supplier: ''
  })
  const [result,   setResult]  = useState(null)
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState('')
  const [history,  setHistory] = useState([])

  useEffect(() => {
    getScenarios().then(r => setScenarios(r.data.scenarios || [])).catch(() => {})
  }, [])

  const curScenario = scenarios.find(s => s.id === form.scenario_type)

  const handleRun = async () => {
    setLoading(true); setError('')
    try {
      const r = await runSimulation(form)
      setResult(r.data)
      setHistory(h => [{ ...r.data, ts: new Date().toLocaleTimeString() }, ...h.slice(0, 4)])
    } catch (e) {
      setError('Simulation failed: ' + (e.response?.data?.detail || e.message))
    } finally { setLoading(false) }
  }

  const sum  = result?.summary
  const base = result?.baseline

  const kpis = result ? [
    { label:'Revenue Impact',       value:'$'+(sum.revenue_impact||0).toLocaleString(),             raw: sum.revenue_impact,                 icon:'💰' },
    { label:'Stockout Risk',        value:((sum.stockout_risk||0)*100).toFixed(0)+'%',             raw: -(sum.stockout_risk||0),             icon:'📦' },
    { label:'Delivery Delay',       value:(sum.delivery_delay_days||0)+' extra days',             raw: -(sum.delivery_delay_days||0),       icon:'🚚' },
    { label:'Operational Cost Δ',   value:'$'+(sum.operational_cost_change||0).toFixed(0),        raw: -(sum.operational_cost_change||0),   icon:'⚙️'  },
    { label:'Total Shortage',       value:(sum.total_shortage||0).toFixed(0)+' units',            raw: -(sum.total_shortage||0),            icon:'⚠️'  },
    { label:'Baseline Daily Rev.',  value:'$'+(base?.daily_revenue||0).toFixed(0),                raw: 1,                                   icon:'📊' },
  ] : []

  return (
    <div>
      {/* ── Config form ── */}
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-title">Configure Scenario</div>
        <div className="sim-form">
          <div className="input-group">
            <label>Scenario Type</label>
            <select value={form.scenario_type} onChange={e => setForm(f => ({ ...f, scenario_type:e.target.value }))}>
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {curScenario && (
              <small style={{ color:'#64748b', fontSize:11, marginTop:5, display:'block' }}>
                {curScenario.description}
              </small>
            )}
          </div>

          <div className="input-group">
            <label>Magnitude ({curScenario?.unit || 'value'})</label>
            <input type="number" value={form.magnitude} step="0.1" min="0" max="10"
              onChange={e => setForm(f => ({ ...f, magnitude: parseFloat(e.target.value) || 0 }))} />
            {curScenario && (
              <small style={{ color:'#64748b', fontSize:11, marginTop:5, display:'block' }}>
                Suggested default: <b style={{color:'#f59e0b'}}>{curScenario.default}</b>
              </small>
            )}
          </div>

          <div className="input-group">
            <label>Duration (days)</label>
            <input type="number" value={form.duration_days} min="7" max="365"
              onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) || 30 }))} />
          </div>

          <div className="input-group">
            <label>Affected Warehouse (optional)</label>
            <input value={form.affected_warehouse} placeholder="e.g. WH001"
              onChange={e => setForm(f => ({ ...f, affected_warehouse: e.target.value }))} />
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleRun} disabled={loading} style={{ marginTop:4 }}>
          {loading ? '⏳ Simulating…' : '🎯 Run Simulation'}
        </button>
        {error && <div className="error-msg" style={{ marginTop:12 }}>{error}</div>}
      </div>

      {/* ── Results ── */}
      {result && (
        <>
          {/* KPI impact row */}
          <div className="kpi-grid" style={{ marginBottom:18 }}>
            {kpis.map((k, i) => (
              <div key={i} className="kpi-card">
                <div style={{ fontSize:22, marginBottom:6 }}>{k.icon}</div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ color: impactCol(k.raw), fontSize:20 }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Chart row */}
          <div className="charts-grid" style={{ marginBottom:18 }}>
            <div className="card">
              <div className="card-title">Stock Level Simulation</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={result.chart_data}>
                  <defs>
                    <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} label={{ value:'Day', position:'insideBottomRight', fill:'#64748b', fontSize:10 }} />
                  <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                  <Area  type="monotone" dataKey="stock"    stroke="#3b82f6" fill="url(#sGrad)" name="Stock Level" />
                  <Line  type="monotone" dataKey="shortage" stroke="#ef4444" strokeWidth={2}   dot={false} name="Daily Shortage" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-title">Daily Revenue Impact</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={result.chart_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} />
                  <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={ttStyle} formatter={v => ['$'+v.toFixed(0), 'Revenue']} />
                  {base?.daily_revenue && (
                    <ReferenceLine y={base.daily_revenue} stroke="#22c55e" strokeDasharray="5 3"
                      label={{ value:'Baseline', fill:'#22c55e', fontSize:10 }} />
                  )}
                  <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5} dot={false} name="Simulated Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="card" style={{ marginBottom:18 }}>
            <div className="card-title">🤖 AI Recommendations for "{result.scenario?.replace(/_/g,' ')}"</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px,1fr))', gap:10 }}>
              {(result.recommendations || []).map((rec, i) => (
                <div key={i} style={{
                  background:'#0f172a', borderRadius:8, padding:'12px 14px',
                  borderLeft:'3px solid #3b82f6', fontSize:13, color:'#cbd5e1', lineHeight:1.5
                }}>
                  <span style={{ color:'#3b82f6', fontWeight:800, marginRight:8 }}>{i+1}.</span>{rec}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── History table ── */}
      {history.length > 0 && (
        <div className="card" style={{ marginBottom:18 }}>
          <div className="card-title">Simulation History</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Scenario</th><th>Magnitude</th><th>Duration</th><th>Revenue Impact</th><th>Stockout Risk</th><th>Shortage</th></tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td style={{ color:'#64748b' }}>{h.ts}</td>
                    <td style={{ fontWeight:600, textTransform:'capitalize' }}>{h.scenario?.replace(/_/g,' ')}</td>
                    <td>{h.magnitude}</td>
                    <td>{h.duration_days} d</td>
                    <td style={{ color: impactCol(h.summary?.revenue_impact), fontWeight:700 }}>
                      ${(h.summary?.revenue_impact || 0).toLocaleString()}
                    </td>
                    <td style={{ color:'#ef4444' }}>{((h.summary?.stockout_risk||0)*100).toFixed(0)}%</td>
                    <td>{(h.summary?.total_shortage||0).toFixed(0)} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="empty-state">
          <div className="icon">🎯</div>
          <p>Configure a scenario above and click <b style={{color:'#3b82f6'}}>Run Simulation</b> to model the impact on your supply chain.</p>
        </div>
      )}
    </div>
  )
}
