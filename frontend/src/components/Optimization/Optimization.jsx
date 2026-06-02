import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getRecommendations, getEOQ, getProducts, getWarehouses } from '../../api/index.js'

const ttStyle   = { background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }
const typeIcon  = { reorder:'🔄', safety_stock:'🛡️', redistribution:'🚚', reduce_reorder:'📉' }
const priColor  = { URGENT:'#ef4444', HIGH:'#f97316', MEDIUM:'#eab308', LOW:'#22c55e' }
const PriTag    = ({ p }) => <span className={`tag tag-${p}`}>{p}</span>

export default function Optimization() {
  const [recs,       setRecs]       = useState([])
  const [summary,    setSummary]    = useState({})
  const [eoqData,    setEoqData]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [eoqLoading, setEoqLoading] = useState(false)
  const [products,   setProducts]   = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [selPid,     setSelPid]     = useState('')
  const [selWid,     setSelWid]     = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const load = () => {
    setLoading(true)
    getRecommendations()
      .then(r => { setRecs(r.data.recommendations || []); setSummary(r.data.summary || {}) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    getProducts().then(r   => { setProducts(r.data.products || []);   setSelPid(r.data.products?.[0]   || '') }).catch(() => {})
    getWarehouses().then(r => { setWarehouses(r.data.warehouses || []); setSelWid(r.data.warehouses?.[0] || '') }).catch(() => {})
  }, [])

  const handleEoq = () => {
    if (!selPid || !selWid) return
    setEoqLoading(true)
    getEOQ({ product_id:selPid, warehouse_id:selWid })
      .then(r => setEoqData(r.data))
      .catch(() => {})
      .finally(() => setEoqLoading(false))
  }

  const types   = ['all', ...new Set(recs.map(r => r.type))]
  const filtered = typeFilter === 'all' ? recs : recs.filter(r => r.type === typeFilter)

  const byType = recs.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc }, {})
  const chartData = Object.entries(byType).map(([t, c]) => ({ type: t.replace(/_/g,' '), count: c }))

  const eoqFields = eoqData ? [
    { label:'EOQ',              value: eoqData.eoq           + ' units', color:'#3b82f6' },
    { label:'Safety Stock',     value: eoqData.safety_stock  + ' units', color:'#22c55e' },
    { label:'Reorder Point',    value: eoqData.reorder_point + ' units', color:'#f59e0b' },
    { label:'Avg Daily Demand', value: eoqData.avg_daily_demand + '/day', color:'#8b5cf6' },
    { label:'Lead Time',        value: eoqData.lead_time_days + ' days', color:'#06b6d4' },
    { label:'Annual Demand',    value: Math.round(eoqData.annual_demand) + ' units', color:'#94a3b8' },
  ] : []

  return (
    <div>
      {/* ── KPIs ── */}
      <div className="kpi-grid">
        {[
          { label:'Total Recs',    value: summary.total  || 0, color:'#3b82f6', icon:'💡' },
          { label:'Urgent',        value: summary.urgent || 0, color:'#ef4444', icon:'🚨' },
          { label:'High Priority', value: summary.high   || 0, color:'#f97316', icon:'⚡' },
          { label:'Medium',        value: summary.medium || 0, color:'#eab308', icon:'📌' },
        ].map((k, i) => (
          <div key={i} className="kpi-card">
            <div style={{ fontSize:22, marginBottom:6 }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid" style={{ marginBottom:18 }}>
        {/* Recs by type */}
        <div className="card">
          <div className="card-title">Recommendations by Type</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} />
              <YAxis type="category" dataKey="type" tick={{ fill:'#94a3b8', fontSize:12 }} tickLine={false} width={110} />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0,5,5,0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* EOQ Calculator */}
        <div className="card">
          <div className="card-title">⚙️ EOQ / Safety Stock Calculator</div>
          <div className="sim-form" style={{ gap:10, marginBottom:12 }}>
            <div className="input-group" style={{ marginBottom:0 }}>
              <label>Product</label>
              <select value={selPid} onChange={e => setSelPid(e.target.value)}>
                {products.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom:0 }}>
              <label>Warehouse</label>
              <select value={selWid} onChange={e => setSelWid(e.target.value)}>
                {warehouses.map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleEoq} disabled={eoqLoading}>
            {eoqLoading ? '⏳ Calculating…' : '⚙️ Calculate EOQ'}
          </button>
          {eoqData && (
            <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {eoqFields.map((m, i) => (
                <div key={i} style={{ background:'#0f172a', borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px' }}>{m.label}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:m.color, marginTop:3 }}>{m.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recs list ── */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <div className="card-title" style={{ marginBottom:0 }}>
            Inventory Recommendations
            {filtered.length > 0 && <span style={{ color:'#64748b', fontWeight:400 }}> ({filtered.length})</span>}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {types.map(t => (
              <button key={t} className={`btn btn-${typeFilter===t?'primary':'outline'}`}
                style={{ fontSize:11, padding:'3px 10px', textTransform:'capitalize' }}
                onClick={() => setTypeFilter(t)}>{t.replace(/_/g,' ')}</button>
            ))}
            <button className="btn btn-outline" style={{ fontSize:11, padding:'3px 10px' }} onClick={load}>↻ Refresh</button>
          </div>
        </div>

        {loading ? <div className="loading">⏳ Generating recommendations…</div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="icon">💡</div><p>No recommendations. Upload data first.</p></div>
            : filtered.slice(0, 30).map((r, i) => (
              <div key={i} style={{
                background:'#0f172a', borderRadius:10, padding:'14px 16px',
                marginBottom:10, borderLeft:`4px solid ${priColor[r.priority] || '#475569'}`
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:18 }}>{typeIcon[r.type] || '💡'}</span>
                  <PriTag p={r.priority} />
                  <span style={{ fontSize:12, color:'#94a3b8', fontWeight:600 }}>{r.product_id} @ {r.warehouse_id}</span>
                  {r.type === 'redistribution' && r.target_warehouse && (
                    <span style={{ fontSize:11, color:'#06b6d4' }}>→ {r.target_warehouse}</span>
                  )}
                  {r.estimated_cost !== 0 && (
                    <span style={{ fontSize:11, color:'#64748b', marginLeft:'auto' }}>
                      Est. cost: <b style={{ color:'#f59e0b' }}>${Math.abs(r.estimated_cost || 0).toFixed(0)}</b>
                    </span>
                  )}
                </div>
                <div style={{ fontSize:13, color:'#cbd5e1', lineHeight:1.6 }}>{r.recommendation}</div>
                {(r.eoq || r.safety_stock || r.rop) && (
                  <div style={{ display:'flex', gap:16, marginTop:8, fontSize:11, color:'#64748b', flexWrap:'wrap' }}>
                    {r.eoq          > 0 && <span>EOQ: <b style={{color:'#3b82f6'}}>{r.eoq}</b></span>}
                    {r.safety_stock > 0 && <span>Safety Stock: <b style={{color:'#22c55e'}}>{r.safety_stock}</b></span>}
                    {r.rop          > 0 && <span>ROP: <b style={{color:'#f59e0b'}}>{r.rop}</b></span>}
                    {r.days_of_stock > 0 && <span>Days of Stock: <b style={{color:'#8b5cf6'}}>{r.days_of_stock?.toFixed(0)}</b></span>}
                  </div>
                )}
              </div>
            ))
        }
      </div>
    </div>
  )
}
