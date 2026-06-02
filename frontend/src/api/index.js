import axios from 'axios'

// With Vite proxy, /api/* → http://localhost:8000/api/*
const api = axios.create({ baseURL: '/api', timeout: 90000 })

export const uploadData         = (file)  => { const f = new FormData(); f.append('file', file); return api.post('/upload/data', f) }
export const getUploadStatus    = ()      => api.get('/upload/status')
export const clearData          = ()      => api.delete('/upload/clear')
export const trainModels        = ()      => api.post('/forecast/train')
export const getTrainStatus     = ()      => api.get('/forecast/train/status')
export const getForecast        = (p)     => api.post('/forecast/predict', p)
export const getHistorical      = (p)     => api.get('/forecast/historical', { params: p })
export const getProducts        = ()      => api.get('/forecast/products')
export const getWarehouses      = ()      => api.get('/forecast/warehouses')
export const getRiskScores      = (p)     => api.get('/risk/predict', { params: p })
export const getRiskAlerts      = ()      => api.get('/risk/alerts')
export const getRiskSummary     = ()      => api.get('/risk/summary')
export const getRecommendations = (p)     => api.get('/optimization/recommendations', { params: p })
export const getEOQ             = (p)     => api.get('/optimization/eoq', { params: p })
export const getOptSummary      = ()      => api.get('/optimization/summary')
export const runSimulation      = (p)     => api.post('/simulation/run', p)
export const getScenarios       = ()      => api.get('/simulation/scenarios')
export const detectAnomalies    = ()      => api.get('/anomaly/detect')
export const getAnomalyTimeline = ()      => api.get('/anomaly/timeline')
export const getAnalyticsSummary= ()      => api.get('/analytics/summary')
export const getInventoryAnalytics = ()   => api.get('/analytics/inventory')
export const getSupplierAnalytics  = ()   => api.get('/analytics/supplier')
export const getTrends          = (g)     => api.get('/analytics/trends', { params: { granularity: g } })
export const getRegional        = ()      => api.get('/analytics/regional')

export default api
