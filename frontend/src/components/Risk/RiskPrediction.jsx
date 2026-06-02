import React, { useState, useEffect } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'
import { getRiskScores, getRiskAlerts, getRiskSummary } from '../../api/index.js'

const ttStyle     = { background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }
const lvlColor    = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' }
const LevelBadge  = ({ level }) => <span className={`alert-badge badge-${level}`}>{level?.toUpperCase()}</span>

export default function RiskPrediction() {
  const [risks,   setRisks]   = useState([])
  const [alerts,  setAlerts]  = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sFilter, setSFilter] = useState('all')  // severity filter

  const load = () => {
    setLoading(true)
    Promise.all([
      getRiskScores().then(r  => setRisks(r.data.risks || [])).catch(() => {}),
      getRiskAlerts().then(r  => setAlerts(r.data.alerts || [])).catch(() => {}),
      getRiskSummary().then(r => setSummary(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filteredAlerts = sFilter === 'all' ? alerts
    : alerts.filter(a => a.level === sFilter)

  /* Radar data for top 1 product */
  const top = risks[0]
  const radarData = top ? [
    { axis:'Stockout',  score: Math.round((top.stockout?.score    || 0)*100) },
    { axis:'Overstock', score: Math.round((top.overstock?.score   || 0)*100) },
    { axis:'Delay',     score: Math.round((top.supplier_delay?.score||0)*100) },
    { axis:'Surge',     score: Math.round((top.demand_surge?.score || 0)*100) },
  ] : []

  /* bar chart */
  const barData = risks.slice(0, 14).map(r => ({
    name:  r.product_id + '/' + r.warehouse_id,
    score: Math.round(r.overall_risk * 100),
    level: r.overall_risk > 0.6 ? 'critical' : r.overall_risk > 0.3 ? 'high' : 'low',
  }))

  return (
    <div>
      {/* ── KPI row ── */}
      <div className="kpi-grid">
        {[
          { label:'Products Analysed',  value: risks.length,                             color:'#3b82f6', icon:'📦' },
          { label:'Critical Stockouts', value: summary?.critical_stockouts || 0,          color:'#ef4444', icon:'🚨' },
          { label:'High Delay Risk',    value: summary?.high_delay_risk || 0,             color:'#f97316', icon:'🚚' },
          { label:'Demand Surges',      value: summary?.demand_surges || 0,               color:'#eab308', icon:'📈' },
          { label:'Avg Risk Score',     value: ((summary?.average_risk_score||0)*100).toFixed(0)+'%', color:'#8b5cf6', icon:'🎯' },
          { label:'Total Alerts',       value: alerts.length,                             color:'#ef4444', icon:'⚠️' },
        ].map((k, i) => (
          <div key={i} className="kpi-card">
            <div style={{ fontSize:22, marginBottom:6 }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:24 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Alert feed ── */}
      <div className="card" style={{ marginBottom:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div className="card-title" style={{ marginBottom:0 }}>Live Risk Alerts</div>
          <div style={{ display:'flex', gap:8 }}>
            {['all','critical','high','medium'].map(f => (
              <button key={f} className={`btn btn-${sFilter===f?'primary':'outline'}`}
                style={{ fontSize:11, padding:'3px 10px', textTransform:'capitalize' }}
                onClick={() => setSFilter(f)}>{f}</button>
            ))}
            <button className="btn btn-outline" style={{ fontSize:11, padding:'3px 10px' }} onClick={load}>↻</button>
          </div>
        </div>
        {loading ? <div className="loading">⏳ Analysing supply chain risks…</div>
          : filteredAlerts.length === 0
            ? <div style={{ textAlign:'center', padding:24, color:'#64748b' }}>✅ No alerts for selected severity</div>
            : filteredAlerts.slice(0,15).map((a, i) => (
              <div key={i} className={`alert-item alert-${a.level}`}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                    <LevelBadge level={a.level} />
                    <span style={{ fontSize:12, fontWeight:700, color:'#f1f5f9' }}>{a.product_id} @ {a.warehouse_id}</span>
                    <span style={{ fontSize:11, color:'#64748b', marginLeft:'auto' }}>{a.type?.replace(/_/g,' ')}</span>
                  </div>
                  <div style={{ fontSize:13, color:'#cbd5e1' }}>{a.message}</div>
                  <div className="risk-bar" style={{ marginTop:8 }}>
                    <div className="risk-fill" style={{ width:`${Math.round((a.score||0)*100)}%`, background: lvlColor[a.level] }} />
                  </div>
                </div>
              </div>
            ))
        }
      </div>

      {/* ── Charts ── */}
      <div className="charts-grid" style={{ marginBottom:18 }}>
        <div className="card">
          <div className="card-title">Risk Radar — {top ? `${top.product_id} / ${top.warehouse_id}` : 'Top Product'}</div>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="axis" tick={{ fill:'#94a3b8', fontSize:12 }} />
                <PolarRadiusAxis angle={30} domain={[0,100]} tick={{ fill:'#64748b', fontSize:10 }} />
                <Radar name="Risk %" dataKey="score" stroke="#ef4444" fill="#ef4444" fillOpacity={0.35} />
                <Tooltip contentStyle={ttStyle} formatter={v => [v+'%','Risk']} />
              </RadarChart>
            </ResponsiveContainer>
          ) : <div className="loading">No data</div>}
        </div>

        <div className="card">
          <div className="card-title">Overall Risk Scores (Top 14)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" domain={[0,100]} tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }} tickLine={false} width={90} />
              <Tooltip contentStyle={ttStyle} formatter={v => [v+'%','Risk Score']} />
              <Bar dataKey="score" radius={[0,4,4,0]}>
                {barData.map((r, i) => <Cell key={i} fill={lvlColor[r.level]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Detail table ── */}
      <div className="card">
        <div className="card-title">Risk Details — All Products</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Warehouse</th><th>Overall</th>
                <th>Stockout</th><th>Days Left</th><th>Overstock</th>
                <th>Delay Risk</th><th>Demand Surge</th><th>Avg Daily Sales</th>
              </tr>
            </thead>
            <tbody>
              {risks.slice(0,25).map((r, i) => {
                const pct = (r.overall_risk*100).toFixed(0)
                const col = r.overall_risk>0.6?'#ef4444':r.overall_risk>0.3?'#f97316':'#22c55e'
                return (
                  <tr key={i}>
                    <td style={{ fontWeight:700 }}>{r.product_id}</td>
                    <td>{r.warehouse_id}</td>
                    <td>
                      <span style={{ color:col, fontWeight:800 }}>{pct}%</span>
                      <div className="risk-bar" style={{ marginTop:3, width:60 }}>
                        <div className="risk-fill" style={{ width:`${pct}%`, background:col }} />
                      </div>
                    </td>
                    <td><LevelBadge level={r.stockout?.level} /></td>
                    <td style={{ color: r.stockout?.days_remaining < 10 ? '#ef4444':'#94a3b8', fontWeight:r.stockout?.days_remaining<10?700:400 }}>
                      {r.stockout?.days_remaining?.toFixed(0)} d
                    </td>
                    <td><LevelBadge level={r.overstock?.level} /></td>
                    <td><LevelBadge level={r.supplier_delay?.level} /></td>
                    <td><LevelBadge level={r.demand_surge?.level} /></td>
                    <td style={{ color:'#94a3b8' }}>{r.avg_daily_sales?.toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
