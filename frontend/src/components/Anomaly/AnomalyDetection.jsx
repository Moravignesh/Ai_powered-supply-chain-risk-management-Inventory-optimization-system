import React, { useState, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line,
  ReferenceLine, Legend
} from 'recharts'
import { detectAnomalies, getAnomalyTimeline } from '../../api/index.js'

const ttStyle  = { background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }
const sevColor = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' }
const SevBadge = ({ s }) => <span className={`alert-badge badge-${s}`}>{s?.toUpperCase()}</span>

export default function AnomalyDetection() {
  const [anomalies, setAnomalies] = useState([])
  const [timeline,  setTimeline]  = useState([])
  const [summary,   setSummary]   = useState({})
  const [loading,   setLoading]   = useState(false)
  const [sevFilter, setSevFilter] = useState('all')
  const [typFilter, setTypFilter] = useState('all')

  const load = () => {
    setLoading(true)
    Promise.all([
      detectAnomalies().then(r  => { setAnomalies(r.data.anomalies || []); setSummary(r.data.summary || {}) }).catch(() => {}),
      getAnomalyTimeline().then(r => setTimeline(r.data.timeline || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const allTypes  = ['all', ...new Set(anomalies.map(a => a.type))]
  const filtered  = anomalies.filter(a =>
    (sevFilter === 'all' || a.severity === sevFilter) &&
    (typFilter === 'all' || a.type     === typFilter)
  )

  // Scatter: actual vs expected
  const scatterPts = anomalies.slice(0, 100).map(a => ({
    x: parseFloat(a.expected) || 0,
    y: parseFloat(a.actual)   || 0,
    s: a.severity,
  }))
  const maxXY = Math.max(...scatterPts.map(p => Math.max(p.x, p.y)), 1)

  // Severity bar distribution
  const sevDist = ['critical','high','medium','low'].map(s => ({
    severity: s, count: anomalies.filter(a => a.severity === s).length
  }))

  return (
    <div>
      {/* ── KPI row ── */}
      <div className="kpi-grid">
        {[
          { label:'Total Anomalies', value: summary.total_anomalies || 0, color:'#3b82f6', icon:'🔍' },
          { label:'Critical',        value: summary.critical || 0,         color:'#ef4444', icon:'🚨' },
          { label:'High',            value: summary.high     || 0,         color:'#f97316', icon:'⚡' },
          { label:'Medium',          value: summary.medium   || 0,         color:'#eab308', icon:'⚠️'  },
        ].map((k, i) => (
          <div key={i} className="kpi-card">
            <div style={{ fontSize:22, marginBottom:6 }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ color:'#64748b', fontSize:12, fontWeight:600 }}>SEVERITY:</span>
        {['all','critical','high','medium'].map(f => (
          <button key={f} className={`btn btn-${sevFilter===f?'primary':'outline'}`}
            style={{ fontSize:11, padding:'3px 10px', textTransform:'capitalize' }}
            onClick={() => setSevFilter(f)}>{f}</button>
        ))}
        <span style={{ color:'#64748b', fontSize:12, fontWeight:600, marginLeft:8 }}>TYPE:</span>
        <select value={typFilter} onChange={e => setTypFilter(e.target.value)}
          style={{ background:'#0f172a', border:'1px solid #334155', color:'#e2e8f0',
                   borderRadius:6, padding:'4px 10px', fontSize:12 }}>
          {allTypes.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
        <button className="btn btn-outline" style={{ fontSize:11, padding:'3px 10px', marginLeft:'auto' }} onClick={load}>
          ↻ Re-detect
        </button>
      </div>

      {loading ? <div className="loading">⏳ Running Isolation Forest &amp; Z-Score algorithms…</div> : (
        <>
          {/* ── Charts row 1 ── */}
          <div className="charts-grid" style={{ marginBottom:18 }}>
            {/* Anomaly timeline bar */}
            <div className="card">
              <div className="card-title">Anomaly Timeline (last 30 periods)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timeline.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill:'#64748b', fontSize:9 }} tickLine={false}
                    interval={Math.max(1, Math.floor(timeline.slice(-30).length / 6))} />
                  <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="count" name="Anomalies" radius={[3,3,0,0]}>
                    {timeline.slice(-30).map((t, i) => (
                      <Cell key={i}
                        fill={t.max_severity==='critical'?'#ef4444':t.max_severity==='high'?'#f97316':'#eab308'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Actual vs Expected scatter */}
            <div className="card">
              <div className="card-title">Actual vs Expected — Anomaly Points</div>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="x" name="Expected"
                    tick={{ fill:'#64748b', fontSize:11 }} tickLine={false}
                    label={{ value:'Expected', position:'insideBottomRight', fill:'#64748b', fontSize:10 }} />
                  <YAxis type="number" dataKey="y" name="Actual"
                    tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} />
                  <Tooltip contentStyle={ttStyle}
                    formatter={(v, n) => [v?.toFixed(1), n]} />
                  {/* 45° reference line (expected = actual) */}
                  <ReferenceLine
                    segment={[{x:0,y:0},{x:maxXY,y:maxXY}]}
                    stroke="#22c55e" strokeDasharray="5 3" />
                  <Scatter data={scatterPts.filter(p=>p.s==='critical')} fill="#ef4444" fillOpacity={0.8} name="Critical" />
                  <Scatter data={scatterPts.filter(p=>p.s==='high')}     fill="#f97316" fillOpacity={0.8} name="High" />
                  <Scatter data={scatterPts.filter(p=>p.s==='medium')}   fill="#eab308" fillOpacity={0.7} name="Medium" />
                  <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Severity distribution ── */}
          <div className="card" style={{ marginBottom:18 }}>
            <div className="card-title">Anomaly Severity Distribution</div>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={sevDist} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} />
                <YAxis type="category" dataKey="severity" tick={{ fill:'#94a3b8', fontSize:12 }}
                  tickLine={false} width={65} />
                <Tooltip contentStyle={ttStyle} />
                <Bar dataKey="count" radius={[0,5,5,0]} name="Count">
                  {sevDist.map((s, i) => <Cell key={i} fill={sevColor[s.severity]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Anomaly details table ── */}
          <div className="card">
            <div className="card-title">
              Detected Anomalies
              <span style={{ color:'#64748b', fontWeight:400 }}> ({filtered.length} shown)</span>
            </div>
            <div className="table-wrap" style={{ maxHeight:380, overflowY:'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Severity</th><th>Type</th>
                    <th>Product</th><th>Actual</th><th>Expected</th>
                    <th>Z-Score</th><th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 60).map((a, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace:'nowrap', color:'#94a3b8' }}>{a.date}</td>
                      <td><SevBadge s={a.severity} /></td>
                      <td style={{ fontSize:11, color:'#64748b' }}>{a.type?.replace(/_/g,' ')}</td>
                      <td style={{ color:'#94a3b8' }}>{a.product_id}</td>
                      <td style={{ color: sevColor[a.severity], fontWeight:700 }}>
                        {parseFloat(a.actual)?.toFixed(1)}
                      </td>
                      <td style={{ color:'#64748b' }}>{parseFloat(a.expected)?.toFixed(1)}</td>
                      <td style={{ color: Math.abs(a.z_score||0)>3 ? '#ef4444':'#94a3b8', fontWeight: Math.abs(a.z_score||0)>3?700:400 }}>
                        {parseFloat(a.z_score)?.toFixed(2)}
                      </td>
                      <td style={{ fontSize:11, color:'#64748b', maxWidth:260, overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {a.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
