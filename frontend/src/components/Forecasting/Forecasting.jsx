import React, { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'
import {
  getProducts, getWarehouses, getForecast,
  getHistorical, trainModels, getTrainStatus
} from '../../api/index.js'

const ttStyle = { background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }

export default function Forecasting() {
  const [products,   setProducts]    = useState([])
  const [warehouses, setWarehouses]  = useState([])
  const [pid,        setPid]         = useState('')
  const [wid,        setWid]         = useState('')
  const [horizon,    setHorizon]     = useState(30)
  const [chartData,  setChartData]   = useState([])
  const [loading,    setLoading]     = useState(false)
  const [training,   setTraining]    = useState(false)
  const [trainStatus,setTrainStatus] = useState(null)
  const [error,      setError]       = useState('')

  useEffect(() => {
    getProducts().then(r => { setProducts(r.data.products || []); setPid(r.data.products?.[0] || '') }).catch(() => {})
    getWarehouses().then(r => { setWarehouses(r.data.warehouses || []); setWid(r.data.warehouses?.[0] || '') }).catch(() => {})
  }, [])

  /* poll training status every 3 s until done */
  const pollTraining = async () => {
    for (let i = 0; i < 80; i++) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const r = await getTrainStatus()
        setTrainStatus(r.data)
        if (r.data.status === 'completed' || r.data.status === 'error') { setTraining(false); return }
      } catch { break }
    }
    setTraining(false)
  }

  const handleTrain = async () => {
    setTraining(true); setError('')
    setTrainStatus({ status:'training', message:'Starting model training…', metrics:{} })
    try { await trainModels(); pollTraining() }
    catch (e) { setError('Train failed: ' + (e.response?.data?.detail || e.message)); setTraining(false) }
  }

  const handleForecast = async () => {
    setLoading(true); setError('')
    try {
      const [histR, foreR] = await Promise.all([
        getHistorical({ product_id:pid, warehouse_id:wid, limit:60 }),
        getForecast({ product_id:pid, warehouse_id:wid, horizon, model:'ensemble' }),
      ])
      const hist = (histR.data.data || []).map(d => ({ date:d.date, actual:d.sales, type:'historical' }))
      const fore = (foreR.data.predictions || []).map(d => ({
        date: d.date, forecast: d.predicted_demand,
        lower: d.lower_bound, upper: d.upper_bound,
        xgb: d.xgb_prediction, rf: d.rf_prediction, type:'forecast'
      }))
      setChartData([...hist, ...fore])
    } catch (e) {
      setError('Forecast failed: ' + (e.response?.data?.detail || e.message))
    } finally { setLoading(false) }
  }

  const splitIdx   = chartData.findIndex(d => d.type === 'forecast')
  const splitDate  = splitIdx > 0 ? chartData[splitIdx]?.date : null
  const forecastPts = chartData.filter(d => d.type === 'forecast')

  return (
    <div>
      {/* ── Controls ── */}
      <div className="card" style={{ marginBottom:18, display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div className="input-group" style={{ marginBottom:0, minWidth:120 }}>
          <label>Product</label>
          <select value={pid} onChange={e => setPid(e.target.value)}>
            {products.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="input-group" style={{ marginBottom:0, minWidth:120 }}>
          <label>Warehouse</label>
          <select value={wid} onChange={e => setWid(e.target.value)}>
            {warehouses.map(w => <option key={w}>{w}</option>)}
          </select>
        </div>
        <div className="input-group" style={{ marginBottom:0, minWidth:130 }}>
          <label>Horizon</label>
          <select value={horizon} onChange={e => setHorizon(Number(e.target.value))}>
            <option value={7}>Next 7 days</option>
            <option value={30}>Next 30 days</option>
            <option value={90}>Next 90 days</option>
          </select>
        </div>
        <button className="btn btn-success" onClick={handleTrain}  disabled={training}>{training  ? '⏳ Training…'    : '🧠 Train Models'}</button>
        <button className="btn btn-primary" onClick={handleForecast} disabled={loading || training}>{loading ? '⏳ Forecasting…' : '📈 Run Forecast'}</button>
      </div>

      {/* ── Training status banner ── */}
      {trainStatus && (
        <div className="card" style={{
          marginBottom:16,
          borderColor: trainStatus.status==='completed' ? '#22c55e'
                     : trainStatus.status==='error'     ? '#ef4444' : '#3b82f6'
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
            <span style={{ fontSize:20 }}>
              {trainStatus.status==='completed' ? '✅' : trainStatus.status==='error' ? '❌' : '⏳'}
            </span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#f1f5f9', textTransform:'capitalize' }}>
                Training — {trainStatus.status}
              </div>
              <div style={{ fontSize:12, color:'#94a3b8' }}>{trainStatus.message}</div>
            </div>
            {trainStatus.metrics?.mae != null && (
              <div style={{ marginLeft:'auto', display:'flex', gap:16, fontSize:12 }}>
                {[['MAE', trainStatus.metrics.mae,'#3b82f6'],
                  ['RMSE',trainStatus.metrics.rmse,'#f59e0b'],
                  ['MAPE',trainStatus.metrics.mape+'%','#22c55e']
                ].map(([l,v,c]) => (
                  <span key={l} style={{ color:'#94a3b8' }}>
                    {l}: <b style={{ color:c }}>{v}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {/* ── Chart ── */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-title">
            Demand Forecast — {pid} @ {wid} &nbsp;
            <span style={{ color:'#64748b', fontWeight:400 }}>
              ({horizon}-day horizon | {forecastPts.length} predicted points)
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill:'#64748b', fontSize:10 }} tickLine={false}
                interval={Math.max(1, Math.floor(chartData.length/10))} />
              <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
              {splitDate && (
                <ReferenceLine x={splitDate} stroke="#f59e0b" strokeDasharray="5 3"
                  label={{ value:'Forecast Start', fill:'#f59e0b', fontSize:10, position:'insideTopRight' }} />
              )}
              <Line type="monotone" dataKey="actual"   stroke="#22c55e" strokeWidth={2.5} dot={false} name="Historical Sales" connectNulls />
              <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Forecast (Ensemble)" connectNulls strokeDasharray="6 3" />
              <Line type="monotone" dataKey="upper"    stroke="#3b82f655" strokeWidth={1}   dot={false} name="Upper 95% CI" connectNulls />
              <Line type="monotone" dataKey="lower"    stroke="#3b82f655" strokeWidth={1}   dot={false} name="Lower 95% CI" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── XGBoost vs RF comparison chart ── */}
      {forecastPts.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-title">Model Comparison — XGBoost vs Random Forest</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={forecastPts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill:'#64748b', fontSize:10 }} tickLine={false}
                interval={Math.max(1, Math.floor(forecastPts.length/10))} />
              <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
              <Line type="monotone" dataKey="xgb"      stroke="#f59e0b" strokeWidth={2} dot={false} name="XGBoost" />
              <Line type="monotone" dataKey="rf"       stroke="#8b5cf6" strokeWidth={2} dot={false} name="Random Forest" />
              <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2} dot={false} name="Ensemble" strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Forecast table ── */}
      {forecastPts.length > 0 && (
        <div className="card">
          <div className="card-title">Forecast Values — {forecastPts.length} Days</div>
          <div className="table-wrap" style={{ maxHeight:300, overflowY:'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Predicted</th><th>XGBoost</th>
                  <th>Random Forest</th><th>Lower CI</th><th>Upper CI</th>
                </tr>
              </thead>
              <tbody>
                {forecastPts.map((d, i) => (
                  <tr key={i}>
                    <td>{d.date}</td>
                    <td style={{ color:'#3b82f6', fontWeight:700 }}>{d.forecast}</td>
                    <td style={{ color:'#f59e0b' }}>{d.xgb}</td>
                    <td style={{ color:'#8b5cf6' }}>{d.rf}</td>
                    <td style={{ color:'#64748b' }}>{d.lower}</td>
                    <td style={{ color:'#64748b' }}>{d.upper}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!chartData.length && !loading && (
        <div className="empty-state">
          <div className="icon">📈</div>
          <p>Select product &amp; warehouse, click <b style={{color:'#22c55e'}}>Train Models</b> then <b style={{color:'#3b82f6'}}>Run Forecast</b>.</p>
        </div>
      )}
    </div>
  )
}
