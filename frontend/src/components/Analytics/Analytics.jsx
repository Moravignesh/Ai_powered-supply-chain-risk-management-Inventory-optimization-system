import React, { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie, AreaChart, Area
} from 'recharts'
import {
  getAnalyticsSummary, getInventoryAnalytics, getSupplierAnalytics,
  getTrends, getRegional
} from '../../api/index.js'

const COLORS  = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']
const ttStyle = { background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }

export default function Analytics() {
  const [summary,   setSummary]   = useState(null)
  const [inventory, setInventory] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [trends,    setTrends]    = useState([])
  const [regional,  setRegional]  = useState([])
  const [gran,      setGran]      = useState('month')
  const [loading,   setLoading]   = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      getAnalyticsSummary().then(r    => setSummary(r.data)).catch(() => {}),
      getInventoryAnalytics().then(r  => setInventory(r.data)).catch(() => {}),
      getSupplierAnalytics().then(r   => setSuppliers(r.data.suppliers || [])).catch(() => {}),
      getTrends(gran).then(r          => setTrends(r.data.trends || [])).catch(() => {}),
      getRegional().then(r            => setRegional(r.data.regional || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [gran])

  const whData   = inventory?.by_warehouse || []
  const prodData = inventory?.top_products  || []
  const maxWh    = Math.max(...whData.map(w => w.total_sales), 1)

  return (
    <div>
      {/* ── KPI strip ── */}
      <div className="kpi-grid">
        {[
          { label:'Total Records',   value:(summary?.total_records||0).toLocaleString(),              icon:'📦', color:'#3b82f6' },
          { label:'Total Revenue',   value:'$'+((summary?.total_revenue||0)/1000).toFixed(1)+'K',     icon:'💰', color:'#22c55e' },
          { label:'Unique Products', value: summary?.unique_products  || 0,                           icon:'🏷️', color:'#f59e0b' },
          { label:'Warehouses',      value: summary?.unique_warehouses || 0,                           icon:'🏭', color:'#8b5cf6' },
          { label:'Suppliers',       value: summary?.unique_suppliers  || 0,                           icon:'🚛', color:'#06b6d4' },
          { label:'Avg Lead Time',   value: (summary?.avg_lead_time||0).toFixed(1)+' d',               icon:'⏱️', color:'#94a3b8' },
        ].map((k, i) => (
          <div key={i} className="kpi-card">
            <div style={{ fontSize:22, marginBottom:6 }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:22 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Granularity + Refresh ── */}
      <div style={{ display:'flex', gap:10, marginBottom:18, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ color:'#64748b', fontSize:12, fontWeight:600 }}>GRANULARITY:</span>
        {['month','week','day'].map(g => (
          <button key={g} className={`btn btn-${gran===g?'primary':'outline'}`}
            style={{ fontSize:11, padding:'3px 12px', textTransform:'capitalize' }}
            onClick={() => setGran(g)}>{g}</button>
        ))}
        <button className="btn btn-outline" style={{ fontSize:11, padding:'3px 12px', marginLeft:'auto' }} onClick={load}>
          ↻ Refresh
        </button>
      </div>

      {loading ? <div className="loading">⏳ Loading analytics…</div> : (
        <>
          {/* ── Trends area chart ── */}
          <div className="card" style={{ marginBottom:18 }}>
            <div className="card-title">Sales &amp; Revenue Trends</div>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" tick={{ fill:'#64748b', fontSize:10 }} tickLine={false}
                  interval={Math.max(1, Math.floor(trends.length/10))} />
                <YAxis yAxisId="l" tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={ttStyle} />
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                <Area yAxisId="l" type="monotone" dataKey="total_sales" stroke="#3b82f6" fill="url(#salesGrad)" strokeWidth={2}   name="Total Sales" />
                <Area yAxisId="r" type="monotone" dataKey="revenue"     stroke="#22c55e" fill="url(#revGrad)"  strokeWidth={2}   name="Revenue ($)" />
                <Line yAxisId="l" type="monotone" dataKey="avg_stock"   stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Avg Stock" strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Row 2 charts ── */}
          <div className="charts-grid" style={{ marginBottom:18 }}>
            {/* Top products */}
            <div className="card">
              <div className="card-title">Top Products by Total Sales</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={prodData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} />
                  <YAxis type="category" dataKey="product_id" tick={{ fill:'#94a3b8', fontSize:12 }}
                    tickLine={false} width={50} />
                  <Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="total_sales" name="Total Sales" radius={[0,5,5,0]}>
                    {prodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Regional pie */}
            <div className="card">
              <div className="card-title">Regional Sales Distribution</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={regional} dataKey="total_sales" nameKey="region"
                    cx="50%" cy="50%" outerRadius={85} innerRadius={35}
                    label={({ region, percent }) => `${region} ${(percent*100).toFixed(0)}%`}
                    labelLine={false} fontSize={11}>
                    {regional.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={ttStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Warehouse table ── */}
          <div className="card" style={{ marginBottom:18 }}>
            <div className="card-title">Warehouse Performance</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Warehouse</th><th>Avg Stock</th><th>Total Sales</th>
                    <th>Products</th><th>Avg Lead Time</th><th>Utilisation</th>
                  </tr>
                </thead>
                <tbody>
                  {whData.map((w, i) => {
                    const util = ((w.total_sales / maxWh) * 100).toFixed(0)
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight:800, color: COLORS[i % COLORS.length] }}>{w.warehouse_id}</td>
                        <td>{(w.avg_stock||0).toFixed(0)}</td>
                        <td style={{ fontWeight:600 }}>{(w.total_sales||0).toFixed(0)}</td>
                        <td>{w.products}</td>
                        <td>{(w.avg_lead_time||0).toFixed(1)} d</td>
                        <td style={{ minWidth:130 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div className="risk-bar" style={{ flex:1 }}>
                              <div className="risk-fill" style={{ width:`${util}%`, background: COLORS[i%COLORS.length] }} />
                            </div>
                            <span style={{ fontSize:11, color:'#94a3b8', width:32 }}>{util}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Supplier table ── */}
          <div className="card">
            <div className="card-title">Supplier Performance Analytics</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th><th>Avg Lead Time</th><th>Std Dev</th>
                    <th>Total Sales</th><th>Products</th><th>Reliability Score</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s, i) => {
                    const rel = (s.reliability_score || 0)
                    const relPct = (rel * 100).toFixed(0)
                    const relCol = rel > 0.8 ? '#22c55e' : rel > 0.6 ? '#f59e0b' : '#ef4444'
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight:700 }}>{s.supplier_id}</td>
                        <td>{(s.avg_lead_time||0).toFixed(1)} d</td>
                        <td style={{ color: s.std_lead_time > 3 ? '#ef4444':'#22c55e' }}>
                          {(s.std_lead_time||0).toFixed(2)}
                        </td>
                        <td style={{ fontWeight:600 }}>{(s.total_sales||0).toFixed(0)}</td>
                        <td>{s.products}</td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div className="risk-bar" style={{ width:90 }}>
                              <div className="risk-fill" style={{ width:`${relPct}%`, background:relCol }} />
                            </div>
                            <span style={{ color:relCol, fontWeight:800, fontSize:12, width:36 }}>
                              {relPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
