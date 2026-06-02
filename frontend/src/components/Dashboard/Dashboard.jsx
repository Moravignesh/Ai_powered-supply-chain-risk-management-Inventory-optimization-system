import React, { useState, useEffect, useRef } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import {
  getAnalyticsSummary, getInventoryAnalytics, getTrends,
  getRiskSummary, uploadData, getUploadStatus, trainModels
} from '../../api/index.js'

const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

const TT = ({ contentStyle }) => null
const ttStyle = { background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }

export default function Dashboard() {
  const [summary,    setSummary]    = useState(null)
  const [inventory,  setInventory]  = useState(null)
  const [trends,     setTrends]     = useState([])
  const [riskSum,    setRiskSum]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [training,   setTraining]   = useState(false)
  const [msg,        setMsg]        = useState('')
  const [dataStatus, setDataStatus] = useState(null)
  const fileRef = useRef()

  const load = () => {
    setLoading(true)
    Promise.all([
      getAnalyticsSummary().then(r => setSummary(r.data)).catch(() => {}),
      getInventoryAnalytics().then(r => setInventory(r.data)).catch(() => {}),
      getTrends('month').then(r => setTrends(r.data.trends || [])).catch(() => {}),
      getRiskSummary().then(r => setRiskSum(r.data)).catch(() => {}),
      getUploadStatus().then(r => setDataStatus(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (e) => {
    const f = e.target.files[0]; if (!f) return
    setUploading(true); setMsg('')
    try {
      const r = await uploadData(f)
      setMsg(`✅ ${r.data.message} — ${r.data.rows} rows, ${r.data.products} products`)
      load()
    } catch (err) {
      setMsg('❌ Upload failed: ' + (err.response?.data?.detail || err.message))
    } finally { setUploading(false); e.target.value = '' }
  }

  const handleTrain = async () => {
    setTraining(true); setMsg('')
    try {
      await trainModels()
      setMsg('🚀 Model training started! Check Forecasting tab for progress.')
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.detail || err.message))
    } finally { setTraining(false) }
  }

  const hasData     = dataStatus?.status === 'loaded'
  const warehouseData = inventory?.by_warehouse || []
  const pieData     = warehouseData.map(w => ({ name: w.warehouse_id, value: Math.round(w.total_sales) }))
  const maxWh       = Math.max(...warehouseData.map(w => w.total_sales), 1)

  return (
    <div>
      {/* ── Upload / Train bar ── */}
      <div className="card" style={{ marginBottom: 18, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleUpload} />
        <button className="btn btn-primary" onClick={() => fileRef.current.click()} disabled={uploading}>
          {uploading ? '⏳ Uploading…' : '📂 Upload CSV Data'}
        </button>
        <button className="btn btn-success" onClick={handleTrain} disabled={training || !hasData}>
          {training ? '⏳ Training…' : '🧠 Train AI Models'}
        </button>
        <span style={{ fontSize:12, color:'#64748b' }}>
          Sample data: <code style={{color:'#38bdf8'}}>backend/data/sample_data.csv</code>
        </span>
        {msg && (
          <span style={{ fontSize:12, color: msg.startsWith('✅')||msg.startsWith('🚀') ? '#22c55e' : '#ef4444', marginLeft:'auto' }}>
            {msg}
          </span>
        )}
        {!hasData && !msg && (
          <span style={{ fontSize:11, color:'#f97316', marginLeft:'auto' }}>
            ⚠ No data — upload sample_data.csv to get started
          </span>
        )}
      </div>

      {loading ? (
        <div className="loading">⏳ Loading dashboard…</div>
      ) : (
        <>
          {/* ── KPI Row ── */}
          <div className="kpi-grid">
            {[
              { label:'Total Records',    value: (summary?.total_records || 0).toLocaleString(), icon:'📦', sub:'data points' },
              { label:'Total Revenue',    value: '$'+((summary?.total_revenue || 0)/1000).toFixed(1)+'K', icon:'💰', sub:'all time' },
              { label:'Avg Stock Level',  value: Math.round(summary?.avg_stock_level || 0), icon:'🏭', sub:'units/product' },
              { label:'Sales Trend 30d',  value: (summary?.sales_trend_30d || 0).toFixed(1)+'%', icon:'📈',
                sub: 'vs prev period', cls: (summary?.sales_trend_30d||0) > 0 ? 'kpi-up' : 'kpi-down' },
              { label:'Avg Lead Time',    value: (summary?.avg_lead_time||0).toFixed(1)+' d', icon:'🚚', sub:'supplier delivery' },
              { label:'Critical Alerts',  value: (riskSum?.critical_stockouts||0)+(riskSum?.demand_surges||0),
                icon:'⚠️', sub:'needs attention', cls:'kpi-down' },
            ].map((k, i) => (
              <div key={i} className="kpi-card">
                <div style={{ fontSize:22, marginBottom:6 }}>{k.icon}</div>
                <div className="kpi-label">{k.label}</div>
                <div className={`kpi-value ${k.cls||''}`}>{k.value}</div>
                <div className={`kpi-sub ${k.cls||'kpi-neutral'}`}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Charts Row 1 ── */}
          <div className="charts-grid">
            <div className="card">
              <div className="card-title">Monthly Sales Trend</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="period" tick={{ fill:'#64748b', fontSize:10 }} tickLine={false}
                    interval={Math.max(1, Math.floor(trends.length/8))} />
                  <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                  <Line type="monotone" dataKey="total_sales" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Sales" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-title">Sales by Warehouse</div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={78} innerRadius={32}
                      dataKey="value" fontSize={10}
                      label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={ttStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1 }}>
                  {warehouseData.map((w, i) => (
                    <div key={w.warehouse_id} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                        <span style={{ color: COLORS[i % COLORS.length], fontWeight:700 }}>{w.warehouse_id}</span>
                        <span style={{ color:'#94a3b8' }}>{Math.round(w.total_sales).toLocaleString()}</span>
                      </div>
                      <div className="risk-bar">
                        <div className="risk-fill"
                          style={{ width:`${(w.total_sales/maxWh*100).toFixed(1)}%`, background: COLORS[i%COLORS.length] }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Revenue + Stock bar chart ── */}
          <div className="card">
            <div className="card-title">Monthly Revenue & Avg Stock</div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={trends.slice(-12)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" tick={{ fill:'#64748b', fontSize:10 }} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={ttStyle} />
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                <Bar yAxisId="l" dataKey="revenue"   fill="#3b82f6" name="Revenue ($)" radius={[3,3,0,0]} />
                <Bar yAxisId="r" dataKey="avg_stock" fill="#22c55e" name="Avg Stock"   radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
