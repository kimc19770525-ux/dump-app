import React from 'react'
import ReactDOM from 'react-dom/client'
import App, { ErrorBoundary } from './App.jsx'

const SUPABASE_URL = 'https://tyygxqybgeqobqcglehe.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5eWd4cXliZ2Vxb2JxY2dsZWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTA2MDAsImV4cCI6MjA5MzEyNjYwMH0.bR_h_2X6qt44nTZnAnaGWs09ikrOwXGCPhqUfcPFLzo'

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
}

const sb = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,

  async getAll() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/records?select=*&order=id.desc&limit=5000`, { headers })
      if (!res.ok) { console.error('getAll error:', res.status, await res.text()); return [] }
      const rows = await res.json()
      if (!Array.isArray(rows)) return []
      return rows.map(r => ({
        ...r.data,
        id: r.id,
        type: r.type,
        date: r.date,
        vehicle: r.vehicle,
        savedAt: r.saved_at
      }))
    } catch(e) { console.error('getAll exception:', e); return [] }
  },

  async upsert(record) {
    try {
      const body = {
        id: record.id,
        type: record.type || 'report',
        date: record.date || '',
        vehicle: record.vehicle || '',
        data: record,
        saved_at: record.savedAt || new Date().toISOString()
      }
      // POST with merge-duplicates — 신규/수정 모두 처리
      const res = await fetch(`${SUPABASE_URL}/rest/v1/records`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(body)
      })
      if (!res.ok) { console.error('upsert error:', res.status, await res.text()) }
    } catch(e) { console.error('upsert exception:', e) }
  },

  async update(record) {
    try {
      // 1. 먼저 삭제
      await fetch(`${SUPABASE_URL}/rest/v1/records?id=eq.${record.id}`, {
        method: 'DELETE',
        headers
      })
      // 2. 새로 삽입
      const body = {
        id: record.id,
        type: record.type || 'report',
        date: record.date || '',
        vehicle: record.vehicle || '',
        data: record,
        saved_at: new Date().toISOString()
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/records`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify(body)
      })
      if (!res.ok) { console.error('update error:', res.status, await res.text()) }
    } catch(e) { console.error('update exception:', e) }
  },

  async saveSettings(key, value) {
    const keyId = { dump_vehicles:1, dump_mappings:2, dump_prices:3, dump_driver_settings:4, dump_adminpw:5, dump_locations:6 }
    const id = keyId[key] || 9
    try {
      const body = { id, type: 'settings', date: key, vehicle: '', data: { key, value }, saved_at: new Date().toISOString() }
      // merge-duplicates: 같은 id면 덮어씀
      const res = await fetch(`${SUPABASE_URL}/rest/v1/records`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(body)
      })
      if (!res.ok) console.error('saveSettings error:', res.status, await res.text())
    } catch(e) { console.error('saveSettings exception:', e) }
  },

  async getSettingByKey(key) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/records?type=eq.settings&date=eq.${key}&select=data`, { headers })
      if (!res.ok) return null
      const rows = await res.json()
      return Array.isArray(rows) && rows.length > 0 ? rows[0].data?.value : null
    } catch { return null }
  },

  async deleteRecord(id) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/records?id=eq.${id}`, { method: 'DELETE', headers })
      if (!res.ok) console.error('delete error:', res.status, await res.text())
    } catch(e) { console.error('delete exception:', e) }
  }
}

window.storage = {
  get: async (key) => {
    // Supabase에서 먼저 시도, 실패하면 localStorage
    try {
      const val = await sb.getSettingByKey(key)
      if (val !== null && val !== undefined) {
        localStorage.setItem('sb_' + key, typeof val === 'string' ? val : JSON.stringify(val))
        return { key, value: typeof val === 'string' ? val : JSON.stringify(val) }
      }
    } catch(e) {}
    // localStorage 폴백
    const local = localStorage.getItem('sb_' + key)
    return local ? { key, value: local } : null
  },
  set: async (key, value) => {
    // localStorage에 먼저 저장 (즉시)
    localStorage.setItem('sb_' + key, value)
    // Supabase에도 저장 (비동기)
    try { await sb.saveSettings(key, value) } catch(e) { console.error('Supabase 저장 실패:', e) }
    return { key, value }
  }
}

window.sbRecords = sb

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
