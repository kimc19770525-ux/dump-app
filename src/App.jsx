import React, { useState, useEffect, Component } from "react";
import * as XLSX from "xlsx";

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, background: "#1a0000", minHeight: "100vh", color: "#ff6b6b", fontFamily: "monospace" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>⚠️ 앱 에러</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{String(this.state.error)}</div>
          <div style={{ fontSize: 11, color: "#ff9999", whiteSpace: "pre-wrap" }}>{this.state.error?.stack?.slice(0, 500)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_VEHICLES = [
  "5623","6957","7028","7035","7214","7250",
  "7785","7799","8367","8627","9145","9451"
];

const MATERIALS = ["토사","뻘","불량토","마사","풍암","원석","선별암","모래","A","B","C","13mm","25mm","40mm","혼합","석분"];
const UNITS = ["개","m³","톤"];
const ADMIN_PW = "121512";
const MATERIAL_COLORS = {
  "모래":  { bg: "#1a3a5c", color: "#64b5f6" },
  "석분":  { bg: "#1a3a5c", color: "#64b5f6" },
  "혼합":  { bg: "#1a3a5c", color: "#64b5f6" },
  "25mm":  { bg: "#1a3a5c", color: "#64b5f6" },
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
// 로컬 기준 날짜 포맷 (UTC 오프셋 문제 방지)
const localDate = (y, m, d) => {
  const dt = new Date(y, m, d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};
const fmt = (n) => Number(n).toLocaleString();
const fmtW = (n) => Number(n) ? Number(n).toLocaleString() + "원" : "-";

const C = {
  bg: "#0f1117", card: "#1a1d27", card2: "#22263a",
  accent: "#f5a623", text: "#e8eaf0", muted: "#7a7f9a",
  border: "#2e3250", danger: "#e74c3c", blue: "#3a86ff",
  green: "#2ecc71", purple: "#a855f7",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Bebas+Neue&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'Noto Sans KR', sans-serif; min-height: 100vh; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  input, select, textarea { font-family: 'Noto Sans KR', sans-serif; }
  button { cursor: pointer; font-family: 'Noto Sans KR', sans-serif; }
  option { background: #22263a; }
`;

// ── 공통 컴포넌트 ──────────────────────────────────────────
function Card({ children, style }) {
  return <div style={{ background: C.card, borderRadius: 16, padding: "20px 18px", border: `1px solid ${C.border}`, ...style }}>{children}</div>;
}

function Btn({ children, onClick, color = C.accent, disabled, small, outline, style }) {
  const textColor = outline ? color : (color === C.accent || color === C.green ? "#000" : "#fff");
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: outline ? "transparent" : (disabled ? C.border : color),
      color: disabled ? C.muted : textColor,
      border: outline ? `1.5px solid ${color}` : "none",
      borderRadius: 10, padding: small ? "7px 14px" : "12px 20px",
      fontWeight: 700, fontSize: small ? 13 : 15,
      opacity: disabled ? 0.6 : 1, transition: "opacity .15s", ...style
    }}>{children}</button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 5, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}

function SI({ value, onChange, placeholder, type = "text", list }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} list={list}
      style={{ width: "100%", background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 15, outline: "none" }} />
  );
}

function SS({ value, onChange, children }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: value ? C.text : C.muted, fontSize: 15, outline: "none" }}>
      {children}
    </select>
  );
}

// ── 작업량 입력 블록 ────────────────────────────────────────
function WorkItem({ item, onChange }) {
  return (
    <div style={{ background: C.card2, borderRadius: 12, padding: "14px", border: `1px solid ${C.border}`, marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginBottom: 12 }}>작업량 *</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>품목</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MATERIALS.map(m => {
            const mc = MATERIAL_COLORS[m];
            const isSelected = item.material === m;
            return (
              <button key={m} onClick={() => {
                const M3_MATERIALS = ["모래","13mm","25mm","40mm","혼합","석분"];
                const isM3 = M3_MATERIALS.includes(m);
                // m3 품목 선택시 단위 자동 m³, 수량 있으면 ×17 변환
                const newQty = isM3 && item.qty ? String(Math.round(Number(item.qty) * 17)) : item.qty;
                const newUnit = isM3 ? "m³" : item.unit;
                onChange({ ...item, material: m, qty: newQty, unit: newUnit });
              }} style={{
                padding: "7px 13px", borderRadius: 20, fontSize: 13,
                fontWeight: isSelected ? 700 : 400,
                background: isSelected ? (["모래","13mm","25mm","40mm","혼합","석분"].includes(m) ? C.blue : "#f5a623") : (mc ? mc.bg+"80" : "#1a1d27"),
                color: isSelected ? "#fff" : (["모래","13mm","25mm","40mm","혼합","석분"].includes(m) ? C.blue : (mc ? mc.color : C.muted)),
                border: `1px solid ${isSelected ? (["모래","13mm","25mm","40mm","혼합","석분"].includes(m) ? C.blue : "#f5a623") : (mc ? mc.color+"50" : C.border)}`,
                boxShadow: isSelected ? "0 0 8px rgba(68,114,196,0.5)" : "none"
              }}>{m}</button>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 2 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>수량</div>
          <input type="number" value={item.qty} onChange={e => {
            const M3_MATERIALS = ["모래","13mm","25mm","40mm","혼합","석분"];
            const raw = e.target.value;
            onChange({ ...item, qty: raw, unit: M3_MATERIALS.includes(item.material) ? "m³" : item.unit });
          }} onBlur={e => {
            const M3_MATERIALS = ["모래","13mm","25mm","40mm","혼합","석분"];
            const raw = e.target.value;
            if (M3_MATERIALS.includes(item.material) && raw && Number(raw) > 0 && Number(raw) <= 9) {
              onChange({ ...item, qty: String(Math.round(Number(raw) * 17)), unit: "m³" });
            }
          }} placeholder="0"
            style={{ width: "100%", background: "#1a1d27", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "12px", color: C.text, fontSize: 20, fontWeight: 700, outline: "none" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>단위</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {UNITS.map(u => (
              <button key={u} onClick={() => onChange({ ...item, unit: u })} style={{
                padding: "7px 0", borderRadius: 8, fontSize: 13,
                fontWeight: item.unit === u ? 700 : 400,
                background: item.unit === u ? C.blue : "#1a1d27",
                color: item.unit === u ? "#fff" : C.muted,
                border: `1px solid ${item.unit === u ? C.blue : C.border}`
              }}>{u}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 탭 네비게이션 (기사용 — 일보입력만) ─────────────────────
function Nav({ tab, setTab }) {
  return (
    <div style={{ padding: "12px 12px 0", background: C.bg }}>
      <div style={{
        padding: "11px 0", borderRadius: "12px 12px 0 0",
        background: C.card, border: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.card}`,
        color: C.accent, fontWeight: 700, fontSize: 14,
        textAlign: "center"
      }}>📋 일보 입력</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 관리자 비밀번호 잠금 화면
// ════════════════════════════════════════════════════════════
function AdminLock({ onUnlock, savedPw }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  const tryUnlock = () => {
    const correct = savedPw || ADMIN_PW;
    if (pw === correct) { onUnlock(); }
    else { setErr(true); setPw(""); setTimeout(() => setErr(false), 1500); }
  };

  return (
    <div style={{ padding: "40px 24px", maxWidth: 360, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: C.accent, letterSpacing: 2, marginBottom: 6 }}>ADMIN ONLY</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 32 }}>관리자 비밀번호를 입력하세요</div>
      <Card>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && tryUnlock()}
          placeholder="비밀번호"
          style={{
            width: "100%", background: C.card2,
            border: `1.5px solid ${err ? C.danger : C.border}`,
            borderRadius: 10, padding: "14px", color: C.text,
            fontSize: 20, textAlign: "center", outline: "none",
            letterSpacing: 6, marginBottom: 12,
            transition: "border-color .2s"
          }}
        />
        {err && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>비밀번호가 틀렸습니다.</div>}
        <Btn onClick={tryUnlock} style={{ width: "100%" }}>확인</Btn>
      </Card>
    </div>
  );
}

// ── 위치 입력 컴포넌트 ──────────────────────────────────────
function LocButtons({ list, value, onChange, placeholder }) {
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState("");
  const allList = list || [];

  const filtered = query.trim()
    ? allList.filter(l => l.startsWith(query.trim()))
    : allList;

  const select = (l) => { onChange(l); setShowModal(false); setQuery(""); };
  const openModal = (e) => {
    if (e.target.value === "__direct__") { setShowModal(true); setQuery(""); onChange(""); }
    else onChange(e.target.value);
  };

  return (
    <>
      <select value={value || ""} onChange={openModal}
        style={{
          width:"100%", background:"#22263a",
          border:`1.5px solid ${value ? "#f5a623" : "#2e3250"}`,
          borderRadius:8, padding:"9px 10px",
          color: value ? "#e8eaf0" : "#7a7f9a",
          fontSize:14, outline:"none"
        }}>
        <option value="">{placeholder || "선택"}</option>
        {allList.map(l => <option key={l} value={l}>{l}</option>)}
        <option value="__direct__">✏️ 직접입력...</option>
      </select>

      {showModal && (
        <div style={{
          position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:9999,
          background:"rgba(0,0,0,0.75)",
          display:"flex", flexDirection:"column", justifyContent:"flex-start", paddingTop:80
        }} onClick={() => { setShowModal(false); setQuery(""); }}>
          <div style={{
            background:"#1a1d27", margin:"0 16px",
            borderRadius:14, overflow:"hidden",
            boxShadow:"0 8px 32px rgba(0,0,0,0.8)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"12px 14px", borderBottom:"1px solid #2e3250" }}>
              <input
                type="text" value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="첫 글자를 입력하세요"
                autoFocus
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                style={{
                  width:"100%", background:"#22263a",
                  border:"1.5px solid #f5a623", borderRadius:10,
                  padding:"11px 14px", color:"#e8eaf0", fontSize:15, outline:"none"
                }}
              />
            </div>
            <div style={{ maxHeight:320, overflowY:"auto" }}>
              {filtered.length === 0 && (
                <div style={{ padding:"16px", color:"#7a7f9a", fontSize:14, textAlign:"center" }}>일치하는 항목 없음</div>
              )}
              {filtered.map(l => (
                <div key={l}
                  onTouchEnd={e => { e.preventDefault(); select(l); }}
                  onMouseDown={e => { e.preventDefault(); select(l); }}
                  style={{
                    padding:"14px 18px", fontSize:15, cursor:"pointer",
                    color: value === l ? "#f5a623" : "#e8eaf0",
                    background: value === l ? "#0f2a0f" : "transparent",
                    fontWeight: value === l ? 700 : 400,
                    borderBottom:"1px solid #2e325040",
                    WebkitTapHighlightColor:"transparent"
                  }}>{l}</div>
              ))}
              {query.trim() && !allList.includes(query.trim()) && (
                <div
                  onTouchEnd={e => { e.preventDefault(); select(query.trim()); }}
                  onMouseDown={e => { e.preventDefault(); select(query.trim()); }}
                  style={{
                    padding:"14px 18px", fontSize:15, cursor:"pointer",
                    color:"#f5a623", borderTop:"1px solid #2e3250",
                    WebkitTapHighlightColor:"transparent"
                  }}>✅ "{query.trim()}" 입력</div>
              )}
            </div>
            <div style={{ padding:"12px", borderTop:"1px solid #2e3250", textAlign:"center" }}>
              <button onClick={() => { setShowModal(false); setQuery(""); }}
                style={{ background:"transparent", border:"none", color:"#7a7f9a", fontSize:14, cursor:"pointer" }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function ReportForm({ vehicles, locationHints, locations, records, onSave }) {
  const emptyWork = { material: "", qty: "", unit: "개" };
  const emptyTrip = { from: "", to: "", work: { ...emptyWork } };

  // localStorage에서 임시 저장 복원 (제출 전까지 유지)
  const DRAFT_KEY = "dump_draft";
  const loadDraft = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
      // 날짜가 오늘이 아니면 초기화
      if (d.date && d.date !== today()) return {};
      return d;
    } catch { return {}; }
  };
  const draft = loadDraft();

  const [date, setDateRaw]    = useState(draft.date || today());
  const [vehicle, setVehicleRaw] = useState(draft.vehicle || "");
  const [trips, setTripsRaw]  = useState(draft.trips || [{ ...emptyTrip }]);
  const [memo, setMemoRaw]    = useState(draft.memo || "");
  const [saved, setSaved]     = useState(false);
  const [err, setErr]         = useState("");

  // 변경 시 localStorage 자동 저장
  const saveDraft = (d, v, t, m) => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ date:d, vehicle:v, trips:t, memo:m })); } catch {}
  };
  const setDate    = v => { setDateRaw(v);    saveDraft(v, vehicle, trips, memo); };
  const setVehicle = v => { setVehicleRaw(v); saveDraft(date, v, trips, memo); };
  const setMemo    = v => { setMemoRaw(v);    saveDraft(date, vehicle, trips, v); };
  const setTrips   = fn => {
    setTripsRaw(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      saveDraft(date, vehicle, next, memo);
      return next;
    });
  };

  // 상·하차지 목록: locations 스토리지 + 일보 기록 합산
  // 상차지: locations.from + 일보의 from만
  const fromHints = records ? records.filter(r=>r.type==="report"&&r.from).map(r=>r.from) : [];
  const toHints   = records ? records.filter(r=>r.type==="report"&&r.to).map(r=>r.to)     : [];
  const fromList  = [...new Set([...(locations?.from||[]), ...fromHints])].sort();
  const toList    = [...new Set([...(locations?.to  ||[]), ...toHints  ])].sort();

  const addTrip = () => {
    if (trips.length >= 10) return;
    setTrips(t => [...t, { ...emptyTrip }]);
  };

  const removeTrip = (i) => {
    if (trips.length <= 1) return;
    setTrips(t => t.filter((_, idx) => idx !== i));
  };

  const updateTrip = (i, field, val) => {
    setTrips(t => t.map((tr, idx) => idx === i ? { ...tr, [field]: val } : tr));
  };

  const updateWork = (i, val) => {
    setTrips(t => t.map((tr, idx) => idx === i ? { ...tr, work: val } : tr));
  };

  const submit = () => {
    if (!vehicle) { setErr("차량번호를 선택해주세요."); return; }
    const invalid = trips.some(t => !t.from || !t.to || !t.work.material || !t.work.qty);
    if (invalid) { setErr("모든 현장의 상·하차지, 품목, 수량을 입력해주세요."); return; }
    setErr("");
    const now = Date.now();
    trips.forEach((t, i) => {
      onSave({
        type: "report", date, vehicle,
        from: t.from, to: t.to, work: t.work,
        memo: i === 0 ? memo : "",
        status: "pending",
        id: now + i, savedAt: new Date().toISOString()
      });
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // 제출 완료 후 임시저장 초기화
    try { localStorage.removeItem("dump_draft"); } catch {}
    setVehicleRaw(""); setTripsRaw([{ ...emptyTrip }]); setMemoRaw("");
    saveDraft(today(), "", [{ ...emptyTrip }], "");
  };

  // 품목 선택 상태 (행별)
  const MATERIALS = ["토사","뻘","불량토","마사","풍암","원석","선별암","모래","A","B","C","13mm","25mm","40mm","혼합","석분"];
  const M3_MATS = ["모래","13mm","25mm","40mm","혼합","석분"];

  const setMaterial = (i, m) => {
    const isM3 = M3_MATS.includes(m);
    updateWork(i, { ...trips[i].work, material: m, unit: isM3 ? "m³" : "개" });
  };
  const setQty = (i, q) => updateWork(i, { ...trips[i].work, qty: q });
  const setQtyBlur = (i, q) => {
    if (M3_MATS.includes(trips[i].work.material) && q && Number(q) > 0 && Number(q) <= 9) {
      updateWork(i, { ...trips[i].work, qty: String(Math.round(Number(q)*17)), unit:"m³" });
    }
  };

  return (
    <div style={{ padding:"12px", maxWidth:520, margin:"0 auto" }}>
      {/* 헤더 */}
      <div style={{ textAlign:"center", marginBottom:14 }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:32, color:C.accent, letterSpacing:3 }}>DUMP LOG</div>
      </div>

      {/* 날짜 + 차량 */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>날짜</div>
          <SI type="date" value={date} onChange={setDate} style={{ width:"100%", background:C.card2, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>차량번호 *</div>
          <SS value={vehicle} onChange={setVehicle} style={{ width:"100%", background:C.card2, border:`1.5px solid ${vehicle?C.accent:C.border}`, borderRadius:10, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}>
            <option value="">-- 선택 --</option>
            {vehicles.map(v => <option key={v}>{v}</option>)}
          </SS>
        </div>
      </div>

      {/* 현장별 카드 */}
      <div style={{ marginBottom:12 }}>
        {trips.map((trip, i) => (
          <div key={i} style={{
            background:C.card2, border:`1.5px solid ${C.border}`,
            borderRadius:12, padding:"12px", marginBottom:8
          }}>
            {/* 번호 + 삭제 */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:13, color:C.accent, fontWeight:700 }}>📍 현장 {i+1}</span>
              {trips.length > 1 ? (
                <button onClick={()=>removeTrip(i)} style={{ background:"none", border:"none", color:C.danger, fontSize:20, cursor:"pointer", padding:0 }}>×</button>
              ) : (
                <button onClick={()=>{ setTrips([{from:"",to:"",work:{material:"",qty:"",unit:"개"}}]); }}
                  style={{ background:"none", border:"none", color:C.muted, fontSize:12, cursor:"pointer", padding:0 }}>↺ 초기화</button>
              )}
            </div>

            {/* 상차지 + 하차지 2열 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>상차지</div>
                <LocButtons list={fromList} value={trip.from} onChange={v=>updateTrip(i,"from",v)} placeholder="선택" />
                {trip.from && <div style={{ fontSize:12, color:C.blue, fontWeight:700, marginTop:3, paddingLeft:2 }}>{trip.from}</div>}
              </div>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>하차지</div>
                <LocButtons list={toList} value={trip.to} onChange={v=>updateTrip(i,"to",v)} placeholder="선택" />
                {trip.to && <div style={{ fontSize:12, color:C.green, fontWeight:700, marginTop:3, paddingLeft:2 }}>{trip.to}</div>}
              </div>
            </div>

            {/* 품목 + 수량 2열 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 90px", gap:8 }}>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>품목</div>
                <select value={trip.work.material} onChange={e=>setMaterial(i,e.target.value)}
                  style={{ width:"100%", background:C.card, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"9px 10px",
                    color: trip.work.material ? (M3_MATS.includes(trip.work.material) ? C.blue : C.accent) : C.muted,
                    fontSize:14, outline:"none", fontWeight: trip.work.material ? 700 : 400 }}>
                  <option value="">선택</option>
                  {MATERIALS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>수량</div>
                <input type="number" value={trip.work.qty}
                  onChange={e=>setQty(i,e.target.value)}
                  onBlur={e=>setQtyBlur(i,e.target.value)}
                  placeholder="0"
                  style={{ width:"100%", background:C.card, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"9px 10px", color:C.text, fontSize:14, outline:"none", textAlign:"center" }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 행 추가 버튼 */}
      {trips.length < 10 && (
        <button onClick={addTrip} style={{
          width:"100%", padding:"10px", borderRadius:10, cursor:"pointer",
          background:"transparent", border:`2px dashed ${C.accent}40`,
          color:C.accent, fontSize:13, fontWeight:700, marginBottom:12
        }}>+ 행 추가 ({trips.length}/10)</button>
      )}

      {/* 메모 + 제출 */}
      <Card>
        <Field label="메모">
          <textarea value={memo} onChange={e=>setMemo(e.target.value)} placeholder="특이사항" rows={2}
            style={{ width:"100%", background:C.card2, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 12px", color:C.text, fontSize:14, resize:"none", outline:"none" }} />
        </Field>
        {err && <div style={{ color:C.danger, fontSize:13, marginBottom:10 }}>{err}</div>}
        <Btn onClick={submit} style={{ width:"100%" }}>
          {saved ? "✅ 저장 완료!" : `일보 제출 (${trips.length}개 현장)`}
        </Btn>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 비용 입력
// ════════════════════════════════════════════════════════════
function ExpenseForm({ vehicles, onSave }) {
  const [mode, setMode] = useState("repair");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const emptyRepair  = { date: today(), vehicle: "", items: [{ desc: "", amount: "" }], memo: "" };
  const emptyFuel    = { date: today(), vehicle: "", liters: "", unitPrice: "", amount: "", station: "", memo: "" };
  const emptyAdvance = { date: today(), vehicle: "", amount: "", memo: "" };
  const [repair, setRepair]   = useState(emptyRepair);
  const [fuel, setFuel]       = useState(emptyFuel);
  const [advance, setAdvance] = useState(emptyAdvance);

  const addRepairItem = () => setRepair(f => ({ ...f, items: [...f.items, { desc: "", amount: "" }] }));
  const removeRepairItem = i => setRepair(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const setRepairItem = (i, field, val) => setRepair(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [field]: val } : it) }));
  const repairTotal = repair.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const calcFuel = (liters, unitPrice) => {
    const l = Number(liters), p = Number(unitPrice);
    return l && p ? String(l * p) : "";
  };

  const submitRepair = () => {
    if (!repair.vehicle) { setErr("차량번호를 선택해주세요."); return; }
    if (!repair.items[0].desc || !repair.items[0].amount) { setErr("수리 품목과 금액을 입력해주세요."); return; }
    setErr("");
    onSave({ type: "repair", ...repair, total: repairTotal, id: Date.now(), savedAt: new Date().toISOString() });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    setRepair(emptyRepair);
  };

  const submitFuel = () => {
    if (!fuel.vehicle) { setErr("차량번호를 선택해주세요."); return; }
    if (!fuel.amount)  { setErr("금액을 입력해주세요."); return; }
    setErr("");
    onSave({ type: "fuel", ...fuel, id: Date.now(), savedAt: new Date().toISOString() });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    setFuel(emptyFuel);
  };

  const submitAdvance = () => {
    if (!advance.vehicle) { setErr("차량번호를 선택해주세요."); return; }
    if (!advance.amount)  { setErr("가불 금액을 입력해주세요."); return; }
    setErr("");
    onSave({ type: "advance", ...advance, id: Date.now(), savedAt: new Date().toISOString() });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    setAdvance(emptyAdvance);
  };

  return (
    <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 38, color: C.green, letterSpacing: 3 }}>EXPENSE</div>
        <div style={{ fontSize: 13, color: C.muted }}>수리비 · 주유비 · 가불 입력</div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["repair","🔧 수리비",C.purple],["fuel","⛽ 주유비",C.green],["advance","💸 가불",C.accent]].map(([id, label, col]) => (
          <button key={id} onClick={() => { setMode(id); setErr(""); }} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: mode === id ? 700 : 400,
            background: mode === id ? col : C.card2,
            color: mode === id ? (col === C.accent ? "#000" : "#fff") : C.muted,
            border: `1px solid ${mode === id ? col : C.border}`
          }}>{label}</button>
        ))}
      </div>

      {mode === "repair" && (
        <Card>
          <Field label="날짜"><SI type="date" value={repair.date} onChange={v => setRepair(f => ({ ...f, date: v }))} /></Field>
          <Field label="차량번호 *">
            <SS value={repair.vehicle} onChange={v => setRepair(f => ({ ...f, vehicle: v }))}>
              <option value="">-- 선택 --</option>
              {vehicles.map(v => <option key={v}>{v}</option>)}
            </SS>
          </Field>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 500 }}>수리 품목 *</div>
          {repair.items.map((it, i) => (
            <div key={i} style={{ background: C.card2, borderRadius: 12, padding: "12px", border: `1px solid ${C.border}`, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.purple, fontWeight: 700 }}>품목 {i + 1}</span>
                {repair.items.length > 1 && (
                  <button onClick={() => removeRepairItem(i)} style={{ background: "none", border: "none", color: C.danger, fontSize: 18, lineHeight: 1, cursor: "pointer" }}>×</button>
                )}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>수리 내용</div>
                <input value={it.desc} onChange={e => setRepairItem(i, "desc", e.target.value)} placeholder="ex) 엔진오일 교환"
                  style={{ width: "100%", background: "#1a1d27", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 14, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>금액 (원)</div>
                <input type="number" value={it.amount} onChange={e => setRepairItem(i, "amount", e.target.value)} placeholder="0"
                  style={{ width: "100%", background: "#1a1d27", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 15, outline: "none" }} />
              </div>
            </div>
          ))}
          <button onClick={addRepairItem} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: `1.5px dashed ${C.border}`, color: C.muted, fontSize: 14, marginBottom: 12, cursor: "pointer" }}>+ 품목 추가</button>
          {repairTotal > 0 && (
            <div style={{ background: "#1a1030", border: `1px solid ${C.purple}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: C.muted }}>합계</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: C.purple }}>{fmt(repairTotal)}원</span>
            </div>
          )}
          <Field label="메모">
            <textarea value={repair.memo} onChange={e => setRepair(f => ({ ...f, memo: e.target.value }))} placeholder="정비소명, 특이사항 등" rows={2}
              style={{ width: "100%", background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 14, resize: "none", outline: "none" }} />
          </Field>
          {err && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <Btn onClick={submitRepair} color={C.purple} style={{ width: "100%" }}>{saved ? "✅ 저장 완료!" : "수리비 저장"}</Btn>
        </Card>
      )}

      {mode === "fuel" && (
        <Card>
          <Field label="날짜"><SI type="date" value={fuel.date} onChange={v => setFuel(f => ({ ...f, date: v }))} /></Field>
          <Field label="차량번호 *">
            <SS value={fuel.vehicle} onChange={v => setFuel(f => ({ ...f, vehicle: v }))}>
              <option value="">-- 선택 --</option>
              {vehicles.map(v => <option key={v}>{v}</option>)}
            </SS>
          </Field>
          <Field label="주유소">
            <SI value={fuel.station} onChange={v => setFuel(f => ({ ...f, station: v }))} placeholder="ex) SK주유소 검단점" />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="주유량 (L)">
                <SI type="number" value={fuel.liters} onChange={v => setFuel(f => ({ ...f, liters: v, amount: calcFuel(v, f.unitPrice) }))} placeholder="0" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="단가 (원/L)">
                <SI type="number" value={fuel.unitPrice} onChange={v => setFuel(f => ({ ...f, unitPrice: v, amount: calcFuel(f.liters, v) }))} placeholder="0" />
              </Field>
            </div>
          </div>
          <Field label="총 금액 (원) *">
            <div style={{ position: "relative" }}>
              <input type="number" value={fuel.amount} onChange={e => setFuel(f => ({ ...f, amount: e.target.value }))} placeholder="0"
                style={{ width: "100%", background: C.card2, border: `1.5px solid ${fuel.amount ? C.green : C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 18, fontWeight: 700, outline: "none" }} />
              {fuel.liters && fuel.unitPrice && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.green }}>자동계산</span>}
            </div>
          </Field>
          <Field label="메모">
            <textarea value={fuel.memo} onChange={e => setFuel(f => ({ ...f, memo: e.target.value }))} placeholder="특이사항" rows={2}
              style={{ width: "100%", background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 14, resize: "none", outline: "none" }} />
          </Field>
          {err && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <Btn onClick={submitFuel} color={C.green} style={{ width: "100%", color: "#000" }}>{saved ? "✅ 저장 완료!" : "주유비 저장"}</Btn>
        </Card>
      )}

      {mode === "advance" && (
        <Card>
          <Field label="날짜"><SI type="date" value={advance.date} onChange={v => setAdvance(f => ({ ...f, date: v }))} /></Field>
          <Field label="차량번호 *">
            <SS value={advance.vehicle} onChange={v => setAdvance(f => ({ ...f, vehicle: v }))}>
              <option value="">-- 선택 --</option>
              {vehicles.map(v => <option key={v}>{v}</option>)}
            </SS>
          </Field>
          <Field label="가불 금액 (원) *">
            <input type="number" value={advance.amount} onChange={e => setAdvance(f => ({ ...f, amount: e.target.value }))} placeholder="0"
              style={{ width: "100%", background: C.card2, border: `1.5px solid ${advance.amount ? C.accent : C.border}`, borderRadius: 10, padding: "14px", color: C.text, fontSize: 22, fontWeight: 900, outline: "none" }} />
          </Field>
          <Field label="메모">
            <textarea value={advance.memo} onChange={e => setAdvance(f => ({ ...f, memo: e.target.value }))} placeholder="사유 등" rows={2}
              style={{ width: "100%", background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 14, resize: "none", outline: "none" }} />
          </Field>
          {err && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <Btn onClick={submitAdvance} color={C.accent} style={{ width: "100%" }}>{saved ? "✅ 저장 완료!" : "가불 저장"}</Btn>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 비용 입력 패널 (관리자 전용)
// ════════════════════════════════════════════════════════════
const EXPENSE_TYPES = [
  { id:"repair",    label:"🔧 수리비",  color: "#a855f7" },
  { id:"fuel",      label:"⛽ 주유비",  color: "#2ecc71" },
  { id:"insurance", label:"🛡 보험료",  color: "#3a86ff" },
  { id:"tax",       label:"🏛 세금",    color: "#f5a623" },
  { id:"fine",      label:"🚨 과태료",  color: "#e74c3c" },
  { id:"advance",   label:"💸 가불",    color: "#7a7f9a" },
];

function ExpenseInputPanel({ vehicles, onSave }) {
  const [mode, setMode] = useState("repair");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const emptyRepair  = { date: today(), vehicle: "", items:[{ desc:"", amount:"" }], memo:"" };
  const emptyFuel    = { date: today(), vehicle: "", liters:"", unitPrice:"", amount:"", station:"", memo:"" };
  const emptySimple  = { date: today(), vehicle: "", desc:"", amount:"", memo:"" };

  const [repair,  setRepair]  = useState(emptyRepair);
  const [fuel,    setFuel]    = useState(emptyFuel);
  const [simple,  setSimple]  = useState(emptySimple);

  const addItem = () => setRepair(f=>({...f, items:[...f.items,{desc:"",amount:""}]}));
  const removeItem = i => setRepair(f=>({...f, items:f.items.filter((_,idx)=>idx!==i)}));
  const setItem = (i,field,val) => setRepair(f=>({...f, items:f.items.map((it,idx)=>idx===i?{...it,[field]:val}:it)}));
  const repairTotal = repair.items.reduce((s,it)=>s+(Number(it.amount)||0),0);
  const calcFuel = (l,p) => { const lv=Number(l),pv=Number(p); return lv&&pv?String(lv*pv):""; };

  const submit = () => {
    if (mode === "repair") {
      if (!repair.vehicle) { setErr("차량번호를 선택해주세요."); return; }
      if (!repair.items[0].desc||!repair.items[0].amount) { setErr("수리 내용과 금액을 입력해주세요."); return; }
      setErr(""); onSave({type:"repair",...repair,total:repairTotal,id:Date.now(),savedAt:new Date().toISOString()});
      setSaved(true); setTimeout(()=>setSaved(false),2500); setRepair(emptyRepair);
    } else if (mode === "fuel") {
      if (!fuel.vehicle) { setErr("차량번호를 선택해주세요."); return; }
      if (!fuel.amount) { setErr("금액을 입력해주세요."); return; }
      setErr(""); onSave({type:"fuel",...fuel,id:Date.now(),savedAt:new Date().toISOString()});
      setSaved(true); setTimeout(()=>setSaved(false),2500); setFuel(emptyFuel);
    } else {
      if (!simple.vehicle) { setErr("차량번호를 선택해주세요."); return; }
      if (!simple.amount) { setErr("금액을 입력해주세요."); return; }
      setErr(""); onSave({type:mode,...simple,id:Date.now(),savedAt:new Date().toISOString()});
      setSaved(true); setTimeout(()=>setSaved(false),2500); setSimple(emptySimple);
    }
  };

  const cur = EXPENSE_TYPES.find(t=>t.id===mode);
  const iS = (field,val,obj,setObj) => <input type={typeof val==="number"?"number":"text"} value={obj[field]} onChange={e=>setObj(f=>({...f,[field]:e.target.value}))} placeholder={val}
    style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:15,outline:"none"}} />;

  return (
    <div style={{ padding:"16px", maxWidth:480, margin:"0 auto" }}>
      <div style={{ marginBottom:16, textAlign:"center" }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:30, color:C.green, letterSpacing:3 }}>비용 입력</div>
      </div>
      {/* 유형 선택 */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
        {EXPENSE_TYPES.map(({id,label,color}) => (
          <button key={id} onClick={()=>{setMode(id);setErr("");}} style={{
            flex:"1 0 30%", padding:"9px 0", borderRadius:10, fontSize:13,
            fontWeight:mode===id?700:400,
            background:mode===id?color:"transparent",
            color:mode===id?(color===C.accent||color===C.green?"#000":"#fff"):C.muted,
            border:`1px solid ${mode===id?color:C.border}`
          }}>{label}</button>
        ))}
      </div>

      <Card>
        <Field label="날짜">
          {mode==="repair" ? iS("date","",repair,setRepair) : mode==="fuel" ? iS("date","",fuel,setFuel) : iS("date","",simple,setSimple)}
        </Field>
        <Field label="차량번호 *">
          <SS value={mode==="repair"?repair.vehicle:mode==="fuel"?fuel.vehicle:simple.vehicle}
              onChange={v=>mode==="repair"?setRepair(f=>({...f,vehicle:v})):mode==="fuel"?setFuel(f=>({...f,vehicle:v})):setSimple(f=>({...f,vehicle:v}))}>
            <option value="">-- 선택 --</option>
            {vehicles.map(v=><option key={v}>{v}</option>)}
          </SS>
        </Field>

        {mode==="repair" && <>
          <div style={{fontSize:12,color:C.muted,marginBottom:8,fontWeight:500}}>수리 품목 *</div>
          {repair.items.map((it,i)=>(
            <div key={i} style={{background:C.card2,borderRadius:12,padding:"12px",border:`1px solid ${C.border}`,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:12,color:cur.color,fontWeight:700}}>품목 {i+1}</span>
                {repair.items.length>1&&<button onClick={()=>removeItem(i)} style={{background:"none",border:"none",color:C.danger,fontSize:18,lineHeight:1,cursor:"pointer"}}>×</button>}
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:4}}>수리 내용</div>
                <input value={it.desc} onChange={e=>setItem(i,"desc",e.target.value)} placeholder="ex) 엔진오일 교환"
                  style={{width:"100%",background:"#1a1d27",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:14,outline:"none"}} />
              </div>
              <div>
                <div style={{fontSize:11,color:C.muted,marginBottom:4}}>금액 (원)</div>
                <input type="number" value={it.amount} onChange={e=>setItem(i,"amount",e.target.value)} placeholder="0"
                  style={{width:"100%",background:"#1a1d27",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:15,outline:"none"}} />
              </div>
            </div>
          ))}
          <button onClick={addItem} style={{width:"100%",padding:"10px",borderRadius:10,background:"transparent",border:`1.5px dashed ${C.border}`,color:C.muted,fontSize:14,marginBottom:12,cursor:"pointer"}}>+ 품목 추가</button>
          {repairTotal>0&&<div style={{background:"#1a1030",border:`1px solid ${cur.color}30`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:13,color:C.muted}}>합계</span>
            <span style={{fontSize:18,fontWeight:900,color:cur.color}}>{fmt(repairTotal)}원</span>
          </div>}
        </>}

        {mode==="fuel" && <>
          <Field label="주유소"><SI value={fuel.station} onChange={v=>setFuel(f=>({...f,station:v}))} placeholder="주유소명" /></Field>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}><Field label="주유량 (L)"><SI type="number" value={fuel.liters} onChange={v=>setFuel(f=>({...f,liters:v,amount:calcFuel(v,f.unitPrice)}))} placeholder="0" /></Field></div>
            <div style={{flex:1}}><Field label="단가 (원/L)"><SI type="number" value={fuel.unitPrice} onChange={v=>setFuel(f=>({...f,unitPrice:v,amount:calcFuel(f.liters,v)}))} placeholder="0" /></Field></div>
          </div>
          <Field label="총 금액 (원) *">
            <div style={{position:"relative"}}>
              <input type="number" value={fuel.amount} onChange={e=>setFuel(f=>({...f,amount:e.target.value}))} placeholder="0"
                style={{width:"100%",background:C.card2,border:`1.5px solid ${fuel.amount?C.green:C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:18,fontWeight:700,outline:"none"}} />
              {fuel.liters&&fuel.unitPrice&&<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11,color:C.green}}>자동계산</span>}
            </div>
          </Field>
        </>}

        {!["repair","fuel"].includes(mode) && <>
          <Field label="내용 (선택)">
            <SI value={simple.desc} onChange={v=>setSimple(f=>({...f,desc:v}))} placeholder={mode==="advance"?"사유":mode==="insurance"?"보험사/종류":mode==="tax"?"세금 종류":"위반 내용"} />
          </Field>
          <Field label="금액 (원) *">
            <input type="number" value={simple.amount} onChange={e=>setSimple(f=>({...f,amount:e.target.value}))} placeholder="0"
              style={{width:"100%",background:C.card2,border:`1.5px solid ${simple.amount?cur.color:C.border}`,borderRadius:10,padding:"14px",color:C.text,fontSize:22,fontWeight:900,outline:"none"}} />
          </Field>
        </>}

        <Field label="메모">
          <textarea value={mode==="repair"?repair.memo:mode==="fuel"?fuel.memo:simple.memo}
            onChange={e=>mode==="repair"?setRepair(f=>({...f,memo:e.target.value})):mode==="fuel"?setFuel(f=>({...f,memo:e.target.value})):setSimple(f=>({...f,memo:e.target.value}))}
            placeholder="특이사항" rows={2}
            style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:14,resize:"none",outline:"none"}} />
        </Field>
        {err&&<div style={{color:C.danger,fontSize:13,marginBottom:10}}>{err}</div>}
        <button onClick={submit} style={{
          width:"100%",padding:"13px",borderRadius:10,border:"none",cursor:"pointer",
          background:saved?"#1a3a1a":cur.color,
          color:cur.color===C.accent||cur.color===C.green?"#000":"#fff",
          fontWeight:700,fontSize:15,transition:"background .2s"
        }}>{saved?`✅ 저장 완료!`:`${cur.label} 저장`}</button>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 매핑 탭 컴포넌트
// ════════════════════════════════════════════════════════════
function MappingTab({ mappings, setMappings, records }) {
  const [selFrom, setSelFrom] = useState("");
  const [selTo, setSelTo]     = useState("");
  const [newClient, setNewClient] = useState("");
  const [useToMapping, setUseToMapping] = useState(false); // 하차지 기준 추가 여부

  // 일보에서 상차지 목록 추출
  const fromList = [...new Set(records.filter(r=>r.type==="report"&&r.from).map(r=>r.from))].sort();
  // 선택한 상차지에서 간 하차지 목록
  const toList = selFrom
    ? [...new Set(records.filter(r=>r.type==="report"&&r.from===selFrom&&r.to).map(r=>r.to))].sort()
    : [];

  const addMapping = () => {
    const loc = useToMapping ? selTo : selFrom;
    const type = useToMapping ? "to" : "from";
    const cli = newClient.trim();
    if (!loc || !cli) return;
    const exists = mappings.some(m => m.type === type && m.location === loc && m.client === cli);
    if (exists) return;
    setMappings(prev => [...prev, { location: loc, client: cli, type, id: Date.now() }]);
    setNewClient("");
    if (useToMapping) setSelTo("");
  };

  const fromMappings = mappings.filter(m => m.type === "from");
  const toMappings   = mappings.filter(m => m.type === "to");

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🗺 현장 → 청구업체 매핑</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          상차지별로 청구업체를 연결해요.<br/>
          같은 상차지에서 하차지에 따라 다른 업체로 청구할 때만 하차지 기준 추가하세요.
        </div>

        {/* 상차지 선택 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.blue, fontWeight: 700, marginBottom: 8 }}>↑ 상차지 선택 *</div>
          {fromList.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted, padding: "8px 0" }}>일보를 먼저 입력해주세요.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {fromList.map(f => (
                <button key={f}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { setSelFrom(f); setSelTo(""); setUseToMapping(false); }}
                  style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                    background: selFrom===f ? C.blue : C.card2,
                    color: selFrom===f ? "#fff" : C.muted,
                    border: `1px solid ${selFrom===f ? C.blue : C.border}`,
                    fontWeight: selFrom===f ? 700 : 400
                  }}>{f}</button>
              ))}
            </div>
          )}
        </div>

        {/* 하차지 기준 추가 (선택사항) */}
        {selFrom && toList.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setUseToMapping(!useToMapping)}
              style={{
                padding: "7px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                background: useToMapping ? C.green : "transparent",
                color: useToMapping ? "#000" : C.muted,
                border: `1px solid ${useToMapping ? C.green : C.border}`,
                marginBottom: useToMapping ? 10 : 0
              }}>
              {useToMapping ? "✅ 하차지 기준으로 추가" : "+ 하차지 기준으로 추가"}
            </button>

            {useToMapping && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {toList.map(t => (
                  <button key={t}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setSelTo(t)}
                    style={{
                      padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                      background: selTo===t ? C.green : C.card2,
                      color: selTo===t ? "#000" : C.muted,
                      border: `1px solid ${selTo===t ? C.green : C.border}`,
                      fontWeight: selTo===t ? 700 : 400
                    }}>{t}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 업체명 입력 */}
        {selFrom && (!useToMapping || selTo) && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
              청구업체명 →
              <span style={{ color: C.accent, marginLeft: 4 }}>
                {useToMapping ? `↓ ${selTo}` : `↑ ${selFrom}`} 기준
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newClient}
                onChange={e => setNewClient(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addMapping()}
                placeholder="업체명 입력"
                autoComplete="off"
                style={{ flex:1, background:C.card2, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}
              />
              <Btn onClick={addMapping} disabled={!newClient.trim()}>추가</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* 매핑 목록 */}
      {mappings.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>설정된 매핑</div>

          {fromMappings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.blue, fontWeight: 700, marginBottom: 8 }}>↑ 상차지 기준</div>
              {fromMappings.map(m => (
                <MappingRow key={m.id} m={m} color={C.blue} onDelete={()=>setMappings(prev=>prev.filter(x=>x.id!==m.id))} onEdit={(id,newClient)=>setMappings(prev=>prev.map(x=>x.id===id?{...x,client:newClient}:x))} />
              ))}
            </div>
          )}

          {toMappings.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 8 }}>↓ 하차지 기준 (예외)</div>
              {toMappings.map(m => (
                <MappingRow key={m.id} m={m} color={C.green} onDelete={()=>setMappings(prev=>prev.filter(x=>x.id!==m.id))} onEdit={(id,newClient)=>setMappings(prev=>prev.map(x=>x.id===id?{...x,client:newClient}:x))} />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── 매핑 행 컴포넌트 (수정/삭제)
function MappingRow({ m, color, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(m.client);

  const save = () => { if(val.trim()) { onEdit(m.id, val.trim()); setEditing(false); } };

  if (editing) {
    return (
      <div style={{ display:"flex", gap:6, alignItems:"center", background:C.card2, borderRadius:10, padding:"8px 10px", marginBottom:6 }}>
        <span style={{ color, fontWeight:700, fontSize:13, whiteSpace:"nowrap" }}>{m.location}</span>
        <span style={{ color:C.muted }}>→</span>
        <input value={val} onChange={e=>setVal(e.target.value)} autoFocus
          style={{ flex:1, background:"#1a1d27", border:`1.5px solid ${color}`, borderRadius:8, padding:"6px 10px", color:C.text, fontSize:13, outline:"none" }} />
        <button onClick={save} style={{ background:color, border:"none", borderRadius:8, padding:"6px 12px", color:"#000", fontWeight:700, fontSize:12, cursor:"pointer" }}>저장</button>
        <button onClick={()=>setEditing(false)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", color:C.muted, fontSize:12, cursor:"pointer" }}>취소</button>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.card2, borderRadius:10, padding:"10px 14px", marginBottom:6 }}>
      <div style={{ fontSize:14 }}>
        <span style={{ color, fontWeight:700 }}>{m.location}</span>
        <span style={{ color:C.muted, margin:"0 8px" }}>→</span>
        <span style={{ fontWeight:700 }}>{m.client}</span>
      </div>
      <div style={{ display:"flex", gap:6 }}>
        <button onClick={()=>setEditing(true)} style={{ background:C.blue+"20", border:`1px solid ${C.blue}40`, borderRadius:8, padding:"4px 10px", color:C.blue, fontSize:12, cursor:"pointer" }}>✏️</button>
        <button onClick={onDelete} style={{ background:"none", border:"none", color:C.danger, cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 마감 탭 컴포넌트
// ════════════════════════════════════════════════════════════
function ClosingTab({ records, closings, onClose, onRefresh, getClients, getPrice, startD, endD }) {
  const [selMonth, setSelMonth] = useState("");
  const [viewMonth, setViewMonth] = useState("");

  // 월 목록 — 일보가 있는 월들
  const monthSet = {};
  records.filter(r => r.type === "report" && r.date).forEach(r => {
    const ym = r.date.slice(0, 7);
    monthSet[ym] = (monthSet[ym] || 0) + 1;
  });
  const months = Object.entries(monthSet).sort((a,b)=>b[0].localeCompare(a[0]));

  // 마감된 월 목록
  const closedMonths = closings.map(c => c.yearMonth || c.date);

  // 선택한 월의 일보
  const viewRecs = viewMonth
    ? records.filter(r => r.type === "report" && r.date && r.date.startsWith(viewMonth))
    : [];

  // 업체별 집계
  const byClientView = {};
  viewRecs.forEach(r => {
    const clients = getClients(r);
    const targets = clients.length > 0 ? clients : ["(미매핑)"];
    targets.forEach(c => {
      if (!byClientView[c]) byClientView[c] = { count: 0, total: 0 };
      byClientView[c].count++;
      const p = getPrice(r.from, r.to, r.work?.material);
      if (p && r.work?.qty) byClientView[c].total += p * Number(r.work.qty);
    });
  });

  const isClosed = (ym) => closedMonths.includes(ym);

  return (
    <div style={{ padding: "0 0 20px" }}>
      {/* 월 선택 */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📅 월별 마감 관리</div>
        {months.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13 }}>일보 데이터가 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {months.map(([ym, count]) => (
              <div key={ym} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: C.card2, borderRadius: 12, padding: "12px 14px",
                border: `1px solid ${isClosed(ym) ? C.green + "50" : C.border}`
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: isClosed(ym) ? C.green : C.text }}>
                    {ym.replace("-","년 ")}월
                    {isClosed(ym) && <span style={{ fontSize: 11, marginLeft: 8, background: C.green+"20", color: C.green, borderRadius: 6, padding: "2px 7px" }}>✅ 마감완료</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>일보 {count}건</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setViewMonth(viewMonth === ym ? "" : ym)} style={{
                    background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: "6px 12px", color: C.muted, fontSize: 12, cursor: "pointer"
                  }}>
                    {viewMonth === ym ? "닫기" : "조회"}
                  </button>
                  {!isClosed(ym) && (
                    <button onClick={() => onClose(ym)} style={{
                      background: C.green, border: "none", borderRadius: 8,
                      padding: "6px 14px", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer"
                    }}>마감</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 선택 월 상세 조회 */}
      {viewMonth && viewRecs.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: C.accent }}>
            📊 {viewMonth.replace("-","년 ")}월 요약
            {isClosed(viewMonth) && <span style={{ fontSize: 11, marginLeft: 8, color: C.green }}>✅ 마감완료</span>}
          </div>

          {/* 업체별 요약 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 700 }}>업체별 청구 현황</div>
            {Object.entries(byClientView).map(([client, data]) => (
              <div key={client} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}20`, fontSize: 13 }}>
                <span style={{ color: client === "(미매핑)" ? C.danger : C.text }}>{client}</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: C.muted, marginRight: 10 }}>{data.count}건</span>
                  <span style={{ fontWeight: 700, color: C.accent }}>{data.total ? fmt(data.total) + "원" : "-"}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 일보 목록 */}
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 700 }}>일보 목록 ({viewRecs.length}건)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["날짜","차량","상차지","하차지","품목","수량","단위"].map(h => (
                    <th key={h} style={{ padding: "5px 4px", color: C.muted, fontWeight: 500, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewRecs.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}15` }}>
                    <td style={{ padding: "5px 4px", whiteSpace: "nowrap" }}>{r.date?.slice(5)}</td>
                    <td style={{ padding: "5px 4px", color: C.accent, whiteSpace: "nowrap" }}>{r.vehicle}</td>
                    <td style={{ padding: "5px 4px" }}>{r.from}</td>
                    <td style={{ padding: "5px 4px" }}>{r.to}</td>
                    <td style={{ padding: "5px 4px", whiteSpace: "nowrap" }}>{r.work?.material||"-"}</td>
                    <td style={{ padding: "5px 4px", fontWeight: 700, whiteSpace: "nowrap" }}>{r.work?.qty ? fmt(r.work.qty) : "-"}</td>
                    <td style={{ padding: "5px 4px", whiteSpace: "nowrap" }}>{r.work?.unit||"-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 상·하차지 목록 관리 패널
// ════════════════════════════════════════════════════════════
function LocManagePanel({ locations, setLocations, records, onBulkRename }) {
  const [editingLoc, setEditingLoc] = useState(null); // {type, old, new}
  const [editVal, setEditVal] = useState("");

  // 일보에서 자동 수집된 목록 (관리자 등록 목록에 없는 것)
  const autoFrom = [...new Set(records.filter(r=>r.type==="report"&&r.from).map(r=>r.from))].sort();
  const autoTo   = [...new Set(records.filter(r=>r.type==="report"&&r.to).map(r=>r.to))].sort();

  // 전체 목록 = 자동수집 + 관리자 등록 (중복제거, 제외목록 반영)
  const excludedFrom = locations.from_excluded || [];
  const excludedTo   = locations.to_excluded   || [];
  const allFrom = [...new Set([...(locations.from||[]), ...autoFrom])].filter(x => !excludedFrom.includes(x)).sort();
  const allTo   = [...new Set([...(locations.to||[]),   ...autoTo  ])].filter(x => !excludedTo.includes(x)).sort();

  const startEdit = (type, loc) => {
    setEditingLoc({ type, old: loc });
    setEditVal(loc);
  };

  const saveEdit = () => {
    if (!editingLoc || !editVal.trim() || editVal === editingLoc.old) {
      setEditingLoc(null); return;
    }
    const newName = editVal.trim();
    const { type, old } = editingLoc;
    // 목록 업데이트
    setLocations(prev => ({
      ...prev,
      [type]: [...new Set([...(prev[type]||[]).map(x => x===old ? newName : x), newName])]
    }));
    // 일보 일괄 수정
    onBulkRename(type === "from" ? "from" : "to", old, newName);
    setEditingLoc(null);
  };

  const removeLoc = (type, loc) => {
    // locations 스토리지에서 삭제 + 제외목록에 추가
    setLocations(prev => ({
      ...prev,
      [type]: (prev[type]||[]).filter(x => x !== loc),
      [type+"_excluded"]: [...(prev[type+"_excluded"]||[]), loc]
    }));
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>📍 상·하차지 목록 관리</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
        기사가 입력하면 자동으로 목록에 쌓여요.<br/>
        ✏️ 눌러서 이름 수정하면 기존 일보도 자동으로 바뀌어요.
      </div>

      {[["from","↑ 상차지",allFrom,C.blue],["to","↓ 하차지",allTo,C.green]].map(([type,label,list,col])=>(
        <div key={type} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: col, fontWeight: 700, marginBottom: 10 }}>{label} ({list.length}개)</div>
          {list.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted }}>아직 입력된 {label} 없음</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {list.map(l => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:8, background:C.card2, borderRadius:10, padding:"8px 12px", border:`1px solid ${col}30` }}>
                  {editingLoc?.type===type && editingLoc?.old===l ? (
                    <>
                      <input
                        value={editVal}
                        onChange={e=>setEditVal(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter") saveEdit(); if(e.key==="Escape") setEditingLoc(null); }}
                        autoFocus
                        style={{ flex:1, background:"#1a1d27", border:`1.5px solid ${col}`, borderRadius:8, padding:"6px 10px", color:C.text, fontSize:14, outline:"none" }}
                      />
                      <button onClick={saveEdit} style={{ background:col, border:"none", borderRadius:8, padding:"6px 12px", color:"#000", fontSize:12, fontWeight:700, cursor:"pointer" }}>저장</button>
                      <button onClick={()=>setEditingLoc(null)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", color:C.muted, fontSize:12, cursor:"pointer" }}>취소</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex:1, color:col, fontWeight:600, fontSize:14 }}>{l}</span>
                      <button onClick={()=>startEdit(type,l)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 10px", color:C.muted, fontSize:12, cursor:"pointer" }}>✏️ 수정</button>
                      <button onClick={()=>removeLoc(type,l)} style={{ background:"transparent", border:"none", color:C.danger, cursor:"pointer", fontSize:16, lineHeight:1 }}>×</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════
// 대기 일보 컴포넌트 — 차량별 카드, 수정 후 승인
// ════════════════════════════════════════════════════════════
function PendingReports({ records, onRefresh }) {
  const allPending = records.filter(r => r.type === "report" && r.status === "pending");
  if (allPending.length === 0) return null;

  // 차량별 묶기
  const byVehicle = {};
  allPending.forEach(r => {
    if (!byVehicle[r.vehicle]) byVehicle[r.vehicle] = [];
    byVehicle[r.vehicle].push(r);
  });

  // 차량 내 편집 상태
  const [editMap, setEditMap] = useState({}); // { id: {date,from,to,material,qty,unit} }

  const startEdit = (r) => {
    setEditMap(prev => ({
      ...prev,
      [r.id]: { date: r.date, from: r.from, to: r.to,
        material: r.work?.material||"", qty: r.work?.qty||"", unit: r.work?.unit||"개" }
    }));
  };

  const updateEdit = (id, field, val) => {
    setEditMap(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  };

  const [approvedIds, setApprovedIds] = useState(new Set());

  const approve = async (r) => {
    const e = editMap[r.id];
    const updated = {
      ...r,
      status: "approved",
      ...(e ? {
        date: e.date, from: e.from, to: e.to,
        work: { ...r.work, material: e.material, qty: e.qty, unit: e.unit }
      } : {})
    };
    try {
      await window.sbRecords.upsert(updated);
      // 사라지지 않고 승인됨 표시
      setApprovedIds(prev => new Set([...prev, r.id]));
      setEditMap(prev => { const n={...prev}; delete n[r.id]; return n; });
    } catch(err) { alert("저장 실패: " + err); }
  };

  const reject = async (r) => {
    if (!window.confirm("이 일보를 반려(삭제)할까요?")) return;
    try {
      await fetch(`${window.sbRecords.url}/rest/v1/records?id=eq.${r.id}`, {
        method: "DELETE",
        headers: { apikey: window.sbRecords.key, Authorization: `Bearer ${window.sbRecords.key}` }
      });
      onRefresh();
    } catch {}
  };

  const approveAll = async (recs, vehicle) => {
    if (!window.confirm(`${vehicle}호 대기 ${recs.length}건을 모두 승인할까요?`)) return;
    for (const r of recs) await approve(r);
    // 전체승인 후 새로고침으로 해당 차량 목록 제거
    onRefresh();
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 10 }}>
        🕐 대기 중 일보 — 차량별 ({allPending.length}건)
      </div>
      {Object.entries(byVehicle).sort(([a],[b])=>a.localeCompare(b)).map(([vehicle, recs]) => (
        <div key={vehicle} style={{ background:"#0a1f14", border:`1.5px solid ${C.green}50`, borderRadius:14, padding:"12px 14px", marginBottom:10 }}>
          {/* 차량 헤더 */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:14, color:C.green, fontWeight:900 }}>🚛 {vehicle}호 ({recs.length}건)</div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => approveAll(recs, vehicle)} style={{
                background:C.green, border:"none", borderRadius:8, padding:"5px 12px",
                color:"#000", fontSize:12, fontWeight:700, cursor:"pointer"
              }}>✅ 전체승인</button>
            </div>
          </div>

          {/* 일보 목록 */}
          {recs.slice().sort((a,b)=>a.savedAt?.localeCompare(b.savedAt)).map(r => {
            const e = editMap[r.id];
            const isEditing = !!e;
            return (
              <div key={r.id} style={{
                background: isEditing ? "#0f2a1a" : C.card2,
                border: `1px solid ${isEditing ? C.green : C.border}`,
                borderRadius: 10, padding: "10px 12px", marginBottom: 8
              }}>
                {!isEditing ? (
                  /* 읽기 모드 */
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:C.muted, minWidth:50 }}>{r.date?.slice(5)}</span>
                    <span style={{ fontSize:13, color:approvedIds.has(r.id) ? C.green : C.text, flex:1 }}>
                      {r.from} → {r.to}
                    </span>
                    <span style={{ fontSize:12, color:C.accent, fontWeight:700, whiteSpace:"nowrap" }}>
                      {r.work?.material} {r.work?.qty}{r.work?.unit}
                    </span>
                    {approvedIds.has(r.id) ? (
                      <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>✅ 승인됨</span>
                    ) : (
                    <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
                      <button onClick={() => startEdit(r)} style={{
                        background:C.blue+"25", border:`1px solid ${C.blue}50`,
                        borderRadius:6, padding:"4px 10px", color:C.blue, fontSize:11, cursor:"pointer"
                      }}>✏️ 수정</button>
                      <button onClick={() => approve(r)} style={{
                        background:C.green+"25", border:`1px solid ${C.green}50`,
                        borderRadius:6, padding:"4px 10px", color:C.green, fontSize:11, cursor:"pointer"
                      }}>✅ 승인</button>
                      <button onClick={() => reject(r)} style={{
                        background:C.danger+"20", border:`1px solid ${C.danger}40`,
                        borderRadius:6, padding:"4px 10px", color:C.danger, fontSize:11, cursor:"pointer"
                      }}>❌</button>
                    </div>
                    )}
                  </div>
                ) : (
                  /* 편집 모드 */
                  <div>
                    <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                      <input type="date" value={e.date} onChange={ev => updateEdit(r.id,"date",ev.target.value)}
                        style={{ flex:"0 0 120px", background:"#1a1d27", border:`1.5px solid ${C.green}`, borderRadius:8, padding:"6px 8px", color:C.text, fontSize:13, outline:"none" }} />
                      <input value={e.from} onChange={ev => updateEdit(r.id,"from",ev.target.value)} placeholder="상차지"
                        style={{ flex:1, minWidth:80, background:"#1a1d27", border:`1.5px solid ${C.green}`, borderRadius:8, padding:"6px 8px", color:C.text, fontSize:13, outline:"none" }} />
                      <input value={e.to} onChange={ev => updateEdit(r.id,"to",ev.target.value)} placeholder="하차지"
                        style={{ flex:1, minWidth:80, background:"#1a1d27", border:`1.5px solid ${C.green}`, borderRadius:8, padding:"6px 8px", color:C.text, fontSize:13, outline:"none" }} />
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <input value={e.material} onChange={ev => updateEdit(r.id,"material",ev.target.value)} placeholder="품목"
                        style={{ flex:2, background:"#1a1d27", border:`1.5px solid ${C.green}`, borderRadius:8, padding:"6px 8px", color:C.text, fontSize:13, outline:"none" }} />
                      <input type="number" value={e.qty} onChange={ev => updateEdit(r.id,"qty",ev.target.value)} placeholder="수량"
                        style={{ flex:1, background:"#1a1d27", border:`1.5px solid ${C.green}`, borderRadius:8, padding:"6px 8px", color:C.text, fontSize:13, outline:"none" }} />
                      <select value={e.unit} onChange={ev => updateEdit(r.id,"unit",ev.target.value)}
                        style={{ flex:1, background:"#1a1d27", border:`1.5px solid ${C.green}`, borderRadius:8, padding:"6px 8px", color:C.text, fontSize:13, outline:"none" }}>
                        {["개","m³","톤"].map(u => <option key={u}>{u}</option>)}
                      </select>
                      <button onClick={async () => {
                        // 수정만 저장 (승인 X)
                        const updated = {
                          ...r,
                          date: e.date,
                          from: e.from,
                          to: e.to,
                          work: { ...r.work, material: e.material, qty: e.qty, unit: e.unit }
                        };
                        try {
                          await window.sbRecords.update(updated);
                          setEditMap(prev => { const n={...prev}; delete n[r.id]; return n; });
                          onRefresh();
                        } catch(err) { alert("저장 실패: " + err); }
                      }} style={{
                        background:C.blue, border:"none", borderRadius:8, padding:"6px 14px",
                        color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap"
                      }}>💾 저장</button>
                      <button onClick={async () => {
                        // 수정 후 승인
                        const updated = {
                          ...r,
                          status: "approved",
                          date: e.date,
                          from: e.from,
                          to: e.to,
                          work: { ...r.work, material: e.material, qty: e.qty, unit: e.unit }
                        };
                        try {
                          await window.sbRecords.update(updated);
                          setApprovedIds(prev => new Set([...prev, r.id]));
                          setEditMap(prev => { const n={...prev}; delete n[r.id]; return n; });
                        } catch(err) { alert("저장 실패: " + err); }
                      }} style={{
                        background:C.green, border:"none", borderRadius:8, padding:"6px 14px",
                        color:"#000", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap"
                      }}>✅ 저장·승인</button>
                      <button onClick={() => setEditMap(prev => { const n={...prev}; delete n[r.id]; return n; })} style={{
                        background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px",
                        color:C.muted, fontSize:12, cursor:"pointer"
                      }}>취소</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 오늘 제출내역 — 차량별 묶음, 눌러서 세부내용
// ════════════════════════════════════════════════════════════
function TodayReports({ todayRecs, todayStr }) {
  const [openVehicle, setOpenVehicle] = useState(null);

  if (todayRecs.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
        <div style={{ fontSize:36, marginBottom:12 }}>📭</div>
        <div style={{ fontSize:14 }}>오늘 제출한 일보가 없어요</div>
      </div>
    );
  }

  // 차량별 묶기
  const byVehicle = {};
  todayRecs.forEach(r => {
    if (!byVehicle[r.vehicle]) byVehicle[r.vehicle] = [];
    byVehicle[r.vehicle].push(r);
  });

  return (
    <div style={{ padding:"16px" }}>
      <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>{todayStr} 제출 내역</div>
      {Object.entries(byVehicle).sort(([a],[b])=>a.localeCompare(b)).map(([vehicle, recs]) => {
        const isOpen = openVehicle === vehicle;
        const allApproved = recs.every(r => r.status === "approved");
        const pendingCount = recs.filter(r => r.status === "pending").length;
        return (
          <div key={vehicle} style={{ marginBottom:10 }}>
            {/* 차량 헤더 — 누르면 펼침/접기 */}
            <button onClick={() => setOpenVehicle(isOpen ? null : vehicle)} style={{
              width:"100%", background: allApproved ? "#0a1f0a" : C.card2,
              border:`1.5px solid ${allApproved ? C.green : C.accent+"60"}`,
              borderRadius: isOpen ? "12px 12px 0 0" : 12,
              padding:"13px 16px", cursor:"pointer", textAlign:"left",
              display:"flex", justifyContent:"space-between", alignItems:"center"
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:15, color: allApproved ? C.green : C.accent, fontWeight:900 }}>
                  🚛 {vehicle}호
                </span>
                <span style={{ fontSize:12, color:C.muted }}>{recs.length}건</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {allApproved ? (
                  <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>✅ 전체승인</span>
                ) : (
                  <span style={{ fontSize:12, color:C.accent, fontWeight:700 }}>⏳ 대기 {pendingCount}건</span>
                )}
                <span style={{ color:C.muted, fontSize:16 }}>{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {/* 세부내용 — 펼쳤을 때 */}
            {isOpen && (
              <div style={{
                background:"#0d1020", border:`1.5px solid ${allApproved ? C.green : C.accent+"60"}`,
                borderTop:"none", borderRadius:"0 0 12px 12px", padding:"10px 12px"
              }}>
                {recs.slice().sort((a,b)=>(a.savedAt||"").localeCompare(b.savedAt||"")).map((r, i) => (
                  <div key={r.id} style={{
                    background: r.status==="approved" ? "#0a1a0a" : C.card2,
                    border:`1px solid ${r.status==="approved" ? C.green+"40" : C.border}`,
                    borderRadius:10, padding:"10px 12px", marginBottom:6
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:C.muted }}>현장 {i+1}</span>
                      <span style={{
                        fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10,
                        background: r.status==="approved" ? C.green+"25" : C.accent+"20",
                        color: r.status==="approved" ? C.green : C.accent
                      }}>
                        {r.status==="approved" ? "✅ 승인됨" : "⏳ 대기중"}
                      </span>
                    </div>
                    <div style={{ fontSize:14, color:C.text, marginBottom:3 }}>
                      <span style={{ color:C.blue }}>{r.from}</span>
                      <span style={{ color:C.muted, margin:"0 6px" }}>→</span>
                      <span style={{ color:C.green }}>{r.to}</span>
                    </div>
                    <div style={{ fontSize:13, color:C.accent, fontWeight:700 }}>
                      {r.work?.material} {r.work?.qty}{r.work?.unit}
                    </div>
                    {r.memo && <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>📝 {r.memo}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 기사 화면 — 일보입력 + 오늘 제출내역
// ════════════════════════════════════════════════════════════
function DriverScreen({ vehicles, locationHints, locations, records, onSave, onRefresh }) {
  return (
    <>
      <Nav />
      <div style={{ background:C.card, borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, minHeight:"calc(100vh - 110px)" }}>
        <ReportForm vehicles={vehicles} locationHints={locationHints} locations={locations} records={records} onSave={onSave} />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// 관리자 대시보드
// ════════════════════════════════════════════════════════════
function AdminDash({ records, vehicles, setVehicles, mappings, setMappings, onSaveMappings, prices, setPrices, locations, setLocations, driverSettings, setDriverSettings, adminPw, setAdminPw, onLock, onSaveExpense, onRefresh }) {
  const [period, setPeriod]         = useState("mid");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd]   = useState("");
  const [adminTab, setAdminTab]     = useState("report");
  const [newVehicle, setNewVehicle] = useState("");
  const [newPw, setNewPw]           = useState("");
  const [newPw2, setNewPw2]         = useState("");
  const [pwMsg, setPwMsg]           = useState("");
  // 단가 설정용
  const [priceFrom, setPriceFrom]   = useState("");
  const [priceTo, setPriceTo]       = useState("");
  const [priceVal, setPriceVal]     = useState("");
  // 수정 모달
  const [editing, setEditing]       = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  // 마감 데이터
  const closings = records.filter(r => r.type === "closing");

  const handleClose = async (yearMonth) => {
    const recs = records.filter(r => r.type === "report" && r.date && r.date.startsWith(yearMonth));
    if (recs.length === 0) { alert("해당 월에 일보가 없습니다."); return; }
    if (!window.confirm(`${yearMonth} 마감하시겠어요?\n총 ${recs.length}건 확정됩니다.`)) return;
    const closing = {
      id: Date.now(),
      type: "closing",
      date: yearMonth,
      vehicle: "",
      yearMonth,
      recordIds: recs.map(r => r.id),
      recordCount: recs.length,
      closedAt: new Date().toISOString(),
      savedAt: new Date().toISOString()
    };
    await window.sbRecords.upsert(closing);
    alert(`✅ ${yearMonth} 마감 완료!\n${recs.length}건이 저장됐습니다.`);
    onRefresh();
  };

  const getPeriodRange = () => {
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
    if (period === "mid") {
      // 전월 26일 ~ 당월 25일
      return [
        localDate(y, m - 1, 26),
        localDate(y, m, 25)
      ];
    }
    if (period === "end") {
      // 당월 1일 ~ 당월 말일
      return [
        localDate(y, m, 1),
        localDate(y, m + 1, 0)
      ];
    }
    return [customStart, customEnd];
  };
  const [startD, endD] = getPeriodRange();

  const inRange = r => r.date >= startD && r.date <= endD;
  const reportRecs = records.filter(r => r.type === "report" && inRange(r) && r.status !== "pending");
  const repairRecs = records.filter(r => r.type === "repair" && inRange(r));
  const fuelRecs   = records.filter(r => r.type === "fuel"   && inRange(r));
  const advanceRecs   = records.filter(r => r.type === "advance"   && inRange(r));
  const insuranceRecs = records.filter(r => r.type === "insurance" && inRange(r));
  const taxRecs       = records.filter(r => r.type === "tax"       && inRange(r));
  const fineRecs      = records.filter(r => r.type === "fine"      && inRange(r));

  const getClients = (rec) => {
    // 하차지 예외 매핑 먼저 확인 — 있으면 상차지 매핑 무시하고 하차지로만
    const toMatch = mappings.find(m => m.type === "to" && m.location === rec.to);
    if (toMatch) return [toMatch.client];

    // 상차지 기준 매핑
    const result = [];
    mappings.forEach(m => {
      if (m.type === "from" && rec.from === m.location && !result.includes(m.client)) result.push(m.client);
    });
    return result;
  };

  // 단가 조회: from||to 기준
  const getPrice = (from, to, material) => {
    const key = `${from}||${to}`;       // 상차지+하차지
    const key2 = `${from}||`;            // 상차지만
    return prices[key] || prices[key2] || 0;
  };

  // 업체별 분류
  const byClient = {};
  reportRecs.forEach(r => {
    const clients = getClients(r);
    const targets = clients.length > 0 ? clients : ["(미매핑)"];
    targets.forEach(c => {
      if (!byClient[c]) byClient[c] = [];
      byClient[c].push(r);
    });
  });

  // 미매핑 현장 추출 — 상차지 기준으로만 (하차지는 예외일 때만 매핑하므로 체크 안 함)
  const unmappedMap = {};
  reportRecs.forEach(r => {
    const fromMapped = mappings.some(m => m.type === "from" && m.location === r.from);
    if (!fromMapped && r.from) unmappedMap[`from::${r.from}`] = { loc: r.from, type: "from" };
  });
  const unmappedLocs = Object.values(unmappedMap);

  const dl = (lines, filename) => {
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  // xlsx 헬퍼
  const xlsxDl = (wb, filename) => {
    // XLSX imported
    try {
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "base64", cellStyles: true });
      // base64 data URI 방식 — 삼성 브라우저 포함 모바일 호환
      const uri = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + wbout;
      const a = document.createElement("a");
      a.href = uri;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 500);
    } catch(e) {
      alert("다운로드 실패: " + e.message);
    }
  };

  const cellStyle = (bold, align, color, bgColor, border) => ({
    font: { name: "맑은 고딕", bold: !!bold, color: color ? { rgb: color } : undefined },
    alignment: { horizontal: align || "left", vertical: "center", wrapText: true },
    fill: bgColor ? { fgColor: { rgb: bgColor }, patternType: "solid" } : undefined,
    border: border ? {
      top: { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left: { style: "thin", color: { rgb: "CCCCCC" } },
      right: { style: "thin", color: { rgb: "CCCCCC" } }
    } : undefined
  });

  // ── 업체별 청구서 xlsx — 템플릿 복사 방식 ──────────────────
  const downloadByClient = (closingType) => {
    // XLSX는 상단 import로 로드됨

    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    let sD, eD;
    if (closingType === "mid") {
      sD = localDate(y, m - 1, 26); eD = localDate(y, m, 25);
    } else {
      sD = localDate(y, m, 1); eD = localDate(y, m + 1, 0);
    }

    const inR = r => r.date >= sD && r.date <= eD;
    const recs = records.filter(r => r.type === "report" && inR(r) && r.status !== "pending");

    const byCl = {};
    recs.forEach(r => {
      const clients = getClients(r);
      const targets = clients.length > 0 ? clients : ["(미매핑)"];
      targets.forEach(c => { if (!byCl[c]) byCl[c] = []; byCl[c].push(r); });
    });

    const clientList = Object.entries(byCl).filter(([c]) => c !== "(미매핑)");
    if (clientList.length === 0) { alert("청구할 업체가 없습니다."); return; }

    try {
      // 템플릿 base64 → ArrayBuffer
      const TMPL_B64 = "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";
      const bin = atob(TMPL_B64);
      const arr = new Uint8Array(bin.length);
      for (let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);

      const wb = XLSX.utils.book_new();
      const mo = eD.slice(5,7).replace(/^0/,"");
      const DS = 12, DE = 33;

      clientList.forEach(([client, rows]) => {
        // 템플릿 워크북 복사
        const tmplWb = XLSX.read(arr, {type:"array", cellStyles:true});
        const tmplWs = tmplWb.Sheets[tmplWb.SheetNames[0]];
        const ws = JSON.parse(JSON.stringify(tmplWs)); // deep copy

        // 날짜 (Excel 시리얼)
        const eDateObj = new Date(eD + "T00:00:00");
        const serial = Math.round((eDateObj - new Date(1899,11,30)) / 86400000);
        ws["E3"] = { ...ws["E3"], v: serial, t:"n", z:"yyyy-mm-dd" };

        // 업체명
        ws["E5"] = { ...ws["E5"], v: client, t:"s" };

        // 데이터행 초기화
        for (let ri=DS; ri<=DE; ri++) {
          "CDEFGHIJKL".split("").forEach(c => {
            const addr = c + ri;
            if (ws[addr]) ws[addr] = { ...ws[addr], v:"", t:"s", f:undefined };
          });
        }

        // 현장별 합계 그룹 (날짜순→차량번호순 정렬 후 그룹핑)
        const preSorted = rows.slice().sort((a,b) => {
          const dCmp = (a.date||"").localeCompare(b.date||"");
          if (dCmp !== 0) return dCmp;
          return (a.vehicle||"").localeCompare(b.vehicle||"");
        });
        const groupMap = {};
        const groupOrder = []; // 그룹 순서 유지
        preSorted.forEach(r => {
          const isM3 = r.work?.unit==="㎥"||r.work?.unit==="m³";
          const key = (r.from||"")+"||"+(r.to||"")+"||"+(r.work?.material||"")+"||"+(isM3?"m3":"ea");
          if (!groupMap[key]) {
            groupMap[key] = {from:r.from,to:r.to,mat:r.work?.material,isM3,qty:0};
            groupOrder.push(key);
          }
          groupMap[key].qty += Number(r.work?.qty)||0;
        });
        // 개수 품목 먼저, m3 나중 / 각 안에서 상차지→하차지→품목 순 정렬
        const allGroups = groupOrder.map(k => groupMap[k]);
        const sortGroup = (arr) => arr.slice().sort((a,b) => {
          const fCmp = (a.from||"").localeCompare(b.from||"");
          if (fCmp !== 0) return fCmp;
          const tCmp = (a.to||"").localeCompare(b.to||"");
          if (tCmp !== 0) return tCmp;
          return (a.mat||"").localeCompare(b.mat||"");
        });
        const groups = [
          ...sortGroup(allGroups.filter(g => !g.isM3)),
          ...sortGroup(allGroups.filter(g => g.isM3))
        ];

        // 데이터 입력
        const setCell = (addr, val, t) => {
          ws[addr] = ws[addr] ? {...ws[addr], v:val, t:t||"s", f:undefined} : {v:val, t:t||"s"};
        };
        const setFormula = (addr, f) => {
          ws[addr] = ws[addr] ? {...ws[addr], v:0, t:"n", f} : {v:0, t:"n", f};
        };

        groups.forEach((g, idx) => {
          if (idx >= DE-DS+1) return;
          const ri = DS + idx;
          setCell("D"+ri, idx+1, "n");
          setCell("E"+ri, g.from||"");
          setCell("F"+ri, g.to||"");
          setCell("G"+ri, g.mat||"");
          if (!g.isM3) { setCell("H"+ri, g.qty, "n"); setFormula("K"+ri, "H"+ri+"*J"+ri); }
          else { setCell("I"+ri, g.qty, "n"); setFormula("K"+ri, "I"+ri+"*J"+ri); }
        });

        // 청구리스트 제목
        setCell("C45", "( "+mo+"월 청구 리스트)");

        // 상세 데이터 (47행~) — 갑지 현장 순서 그대로, 각 현장 내 날짜→차량번호순
        // groups 순서: 개수품목 먼저, m3 나중 (갑지와 동일)
        const detailRows = [];
        groups.forEach(g => {
          const groupRows = rows.filter(r => {
            const isM3 = r.work?.unit==="㎥"||r.work?.unit==="m³";
            return r.from===g.from && r.to===g.to && r.work?.material===g.mat && isM3===g.isM3;
          }).sort((a,b) => {
            const dCmp = (a.date||"").localeCompare(b.date||"");
            if (dCmp !== 0) return dCmp;
            return (a.vehicle||"").localeCompare(b.vehicle||"");
          });
          detailRows.push(...groupRows);
        });
        // 현장별 소계 행 포함해서 작성
        let detailRowIdx = 47;
        groups.forEach(g => {
          const groupRows = detailRows.filter(r => {
            const isM3 = r.work?.unit==="㎥"||r.work?.unit==="m³";
            return r.from===g.from && r.to===g.to && r.work?.material===g.mat && isM3===g.isM3;
          });
          // 데이터 행
          groupRows.forEach(row => {
            const ri = detailRowIdx;
            const day = row.date ? (parseInt(row.date.split("-")[1])+"."+parseInt(row.date.split("-")[2])) : "";
            const isM3 = row.work?.unit==="㎥"||row.work?.unit==="m³";
            const qty = Number(row.work?.qty)||0;
            setCell("C"+ri, day||"", "s");
            setCell("D"+ri, row.vehicle||"");
            setCell("E"+ri, row.from||"");
            setCell("F"+ri, row.to||"");
            setCell("G"+ri, row.work?.material||"");
            if (!isM3) setCell("H"+ri, qty, "n");
            else setCell("I"+ri, qty, "n");
            detailRowIdx++;
          });
          // 소계 행 (노란색) - 수량/m3 숫자만
          const subRi = detailRowIdx;
          const yellow = { patternType:"solid", fgColor:{ rgb:"FFFF00" } };
          const yS = { font:{name:"맑은 고딕",bold:true,sz:11}, fill:yellow, alignment:{horizontal:"center",vertical:"center"} };
          const yR = { font:{name:"맑은 고딕",bold:true,sz:11}, fill:yellow, alignment:{horizontal:"right",vertical:"center"} };
          "CDEFGHIJKL".split("").forEach(c => {
            ws[c+subRi] = { v:"", t:"s", s:yS };
          });
          if (!g.isM3) {
            ws["H"+subRi] = { v:g.qty, t:"n", s:yR };
          } else {
            ws["I"+subRi] = { v:g.qty, t:"n", s:yR };
          }
          detailRowIdx++;
        });

        // ref 업데이트
        const lastRow = detailRowIdx + 1;
        ws["!ref"] = "A1:" + XLSX.utils.encode_cell({r:lastRow, c:15});

        XLSX.utils.book_append_sheet(wb, ws, client.slice(0,31));
      });

      const suffix = closingType==="mid"?"25일마감":"말일마감";
      xlsxDl(wb, `청구서_${suffix}_${sD}_${eD}.xlsx`);
    } catch(err) { alert("엑셀 생성 오류: " + err.message); }
  };

  // ── 기사별 정산서 xlsx — 5623/6821/6957 양식 그대로 ──────────
  const downloadByVehicle = () => {
    // XLSX imported
    

    // 가사정산: 항상 당월 1일 ~ 당월 말일
    const nowV = new Date();
    const vStartD = localDate(nowV.getFullYear(), nowV.getMonth(), 1);
    const vEndD   = localDate(nowV.getFullYear(), nowV.getMonth() + 1, 0);
    const inVRange = r => r.date >= vStartD && r.date <= vEndD;
    const vReportRecs = records.filter(r => r.type === "report" && inVRange(r) && r.status !== "pending");

    const byVehicle = {};
    vReportRecs.forEach(r => { if (!byVehicle[r.vehicle]) byVehicle[r.vehicle] = []; byVehicle[r.vehicle].push(r); });
    if (Object.keys(byVehicle).length === 0) { alert("정산할 일보가 없습니다."); return; }

    const thin = { style: "thin", color: { rgb: "000000" } };
    const bdr = { top: thin, bottom: thin, left: thin, right: thin };
    const SB = (bold, align, sz) => ({
      font: { name: "맑은 고딕", bold: !!bold, sz: sz || 10 },
      alignment: { horizontal: align || "left", vertical: "center" },
      border: bdr,
    });
    const S = (bold, align, sz) => ({
      font: { name: "맑은 고딕", bold: !!bold, sz: sz || 10 },
      alignment: { horizontal: align || "left", vertical: "center" },
    });
    const C2 = (ws, addr, val, style) => { ws[addr] = { v: val, t: typeof val === "number" ? "n" : "s", s: style }; };
    const CF = (ws, addr, formula, style) => { ws[addr] = { f: formula, t: "n", s: style }; };

    const wb = XLSX.utils.book_new();
    const monthStr = `${nowV.getFullYear()}년 ${nowV.getMonth() + 1}월`;

    Object.entries(byVehicle).forEach(([vehicle, rows]) => {
      // ── 시트1: 작업내역

      const ws1 = {};
      ws1["!merges"] = [];
      ws1["!cols"] = [
        { wch: 10 }, { wch: 3.75 }, { wch: 6.5 }, { wch: 6.5 },
        { wch: 13 }, { wch: 16.75 }, { wch: 6.875 }, { wch: 6.5 },
        { wch: 6.5 }, { wch: 7.5 }, { wch: 8.375 }, { wch: 9 }
      ];

      // 헤더행
      C2(ws1, "A1", "매입처", SB(true, "center"));
      C2(ws1, "C1", "날자", SB(true, "center"));
      C2(ws1, "D1", "", SB(true, "center"));
      C2(ws1, "E1", "상차지", SB(true, "center"));
      C2(ws1, "F1", "하차지", SB(true, "center"));
      C2(ws1, "G1", "품명", SB(true, "center"));
      C2(ws1, "H1", "수량", SB(true, "center"));
      C2(ws1, "I1", "m3", SB(true, "center"));
      C2(ws1, "J1", "시간/㎥", SB(true, "center"));
      C2(ws1, "K1", "운반단가", SB(true, "center"));
      C2(ws1, "L1", "지급운반비", SB(true, "center"));

      // 데이터 행
      const sortedV = rows.slice().sort((a, b) => a.date.localeCompare(b.date));
      sortedV.forEach((row, i) => {
        const r = i + 2;
        const day = row.date ? Number(row.date.slice(8)) : "";
        const qty = Number(row.work?.qty) || 0;
        const isM3 = row.work?.unit === "㎥" || row.work?.unit === "m³";
        const price = getPrice(row.from, row.to, row.work?.material) || 0;
        C2(ws1, `A${r}`, "", SB(false));
        C2(ws1, `B${r}`, "", SB(false));
        ws1[`C${r}`] = { v: day, t: "n", s: SB(false, "right") };
        C2(ws1, `D${r}`, Number(vehicle) || vehicle, SB(false));
        C2(ws1, `E${r}`, row.from || "", SB(false));
        C2(ws1, `F${r}`, row.to || "", SB(false));
        C2(ws1, `G${r}`, row.work?.material || "", SB(false));
        if (!isM3 && qty) { ws1[`H${r}`] = { v: qty, t: "n", s: SB(false, "right") }; }
        else { C2(ws1, `H${r}`, "", SB(false, "right")); }
        if (isM3 && qty) { ws1[`I${r}`] = { v: qty, t: "n", s: SB(false, "right") }; }
        else { C2(ws1, `I${r}`, "", SB(false, "right")); }
        C2(ws1, `J${r}`, "", SB(false, "right"));
        if (price) { ws1[`K${r}`] = { v: price, t: "n", s: SB(false, "right") }; }
        else { C2(ws1, `K${r}`, "", SB(false, "right")); }
        CF(ws1, `L${r}`, `(K${r}*H${r})+(K${r}*I${r})`, SB(false, "right"));
      });

      // 합계행
      const totalRow = sortedV.length + 2;
      C2(ws1, `A${totalRow}`, "", SB(false));
      ws1[`B${totalRow}`] = { v: nowV.getMonth() + 1, t: "n", s: SB(false) };
      C2(ws1, `D${totalRow}`, Number(vehicle) || vehicle, SB(false));
      CF(ws1, `L${totalRow}`, `SUM(L2:L${totalRow - 1})`, SB(true, "right"));

      ws1["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRow, c: 11 } });
      XLSX.utils.book_append_sheet(wb, ws1, vehicle.slice(0, 31));
    });

    xlsxDl(wb, `기사정산_${vStartD}_${vEndD}.xlsx`);
  };

  // 일보 수정 저장
  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try { await window.sbRecords.upsert(editing); } catch {}
    setEditSaving(false);
    setEditing(null);
    onRefresh();
  };

  // 일보 삭제
  const deleteRecord = async (id) => {
    if (!window.confirm("이 일보를 삭제할까요?")) return;
    try {
      await fetch(`${window.sbRecords.url}/rest/v1/records?id=eq.${id}`, {
        method: "DELETE",
        headers: { apikey: window.sbRecords.key, Authorization: `Bearer ${window.sbRecords.key}` }
      });
    } catch {}
    onRefresh();
  };

  // 전체 CSV
  const downloadAll = () => {
    const h = "날짜,차량번호,상차지,하차지,청구업체,품목,수량,단위,단가,금액,메모";
    const lines = reportRecs.flatMap(r => {
      const cs = getClients(r);
      const targets = cs.length > 0 ? cs : ["미매핑"];
      const price = getPrice(r.from, r.to, r.work?.material);
      const amount = price && r.work?.qty ? price * Number(r.work.qty) : "";
      return targets.map(c => [r.date, r.vehicle, r.from, r.to, c, r.work?.material||"", r.work?.qty||"", r.work?.unit||"", price||"", amount, r.memo||""].join(","));
    });
    dl([h, ...lines], `일보전체_${startD}_${endD}.csv`);
  };

  const downloadExpenseCSV = () => {
    const h = "날짜,차량번호,구분,내용,금액,메모";
    const rows = [
      ...repairRecs.flatMap(r => r.items.map(it => [r.date,r.vehicle,"수리비",it.desc,it.amount,r.memo||""].join(","))),
      ...fuelRecs.map(r => [r.date,r.vehicle,"주유비",r.station||"",r.amount,r.memo||""].join(",")),
      ...insuranceRecs.map(r => [r.date,r.vehicle,"보험료",r.desc||"",r.amount,r.memo||""].join(",")),
      ...taxRecs.map(r => [r.date,r.vehicle,"세금",r.desc||"",r.amount,r.memo||""].join(",")),
      ...fineRecs.map(r => [r.date,r.vehicle,"과태료",r.desc||"",r.amount,r.memo||""].join(",")),
      ...advanceRecs.map(r => [r.date,r.vehicle,"가불","",r.amount,r.memo||""].join(",")),
    ];
    dl([h,...rows], `비용_${startD}_${endD}.csv`);
  };

  // 상·하차지 이름 일괄 수정 (일보 전체)
  const bulkRename = async (field, oldName, newName) => {
    const targets = records.filter(r => r.type === "report" && r[field] === oldName);
    for (const r of targets) {
      const updated = { ...r, [field]: newName };
      try { await window.sbRecords.upsert(updated); } catch {}
    }
    if (targets.length > 0) onRefresh();
  };

  const addPrice = () => {
    const f = priceFrom.trim(), t = priceTo.trim(), v = Number(priceVal);
    if (!f || !v) return;
    const key = t ? `${f}||${t}` : `${f}||`;
    setPrices(prev => ({ ...prev, [key]: v }));
    setPriceFrom(""); setPriceTo(""); setPriceVal("");
  };

  const removePrice = (key) => setPrices(prev => { const n = { ...prev }; delete n[key]; return n; });

  const changePw = () => {
    if (!newPw || newPw.length < 4) { setPwMsg("4자리 이상 입력해주세요."); return; }
    if (newPw !== newPw2) { setPwMsg("비밀번호가 일치하지 않습니다."); return; }
    setAdminPw(newPw); setNewPw(""); setNewPw2(""); setPwMsg("✅ 비밀번호가 변경됐어요.");
    setTimeout(() => setPwMsg(""), 2000);
  };

  const totalRepair    = repairRecs.reduce((s,r) => s+(r.total||0), 0);
  const totalFuel      = fuelRecs.reduce((s,r) => s+(Number(r.amount)||0), 0);
  const totalInsurance = insuranceRecs.reduce((s,r) => s+(Number(r.amount)||0), 0);
  const totalTax       = taxRecs.reduce((s,r) => s+(Number(r.amount)||0), 0);
  const totalFine      = fineRecs.reduce((s,r) => s+(Number(r.amount)||0), 0);
  const totalAdvance   = advanceRecs.reduce((s,r) => s+(Number(r.amount)||0), 0);

  return (
    <div style={{ padding: "16px", maxWidth: 700, margin: "0 auto" }}>

      {/* ── 수정 모달 ── */}
      {editing && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.card, borderRadius:16, padding:20, width:"100%", maxWidth:420, border:`1px solid ${C.border}` }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:16, color:C.accent }}>✏️ 일보 수정</div>

            <Field label="날짜">
              <input type="date" value={editing.date||""} onChange={e=>setEditing(f=>({...f,date:e.target.value}))}
                style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:15,outline:"none"}} />
            </Field>
            <Field label="차량번호">
              <SS value={editing.vehicle||""} onChange={v=>setEditing(f=>({...f,vehicle:v}))}>
                {vehicles.map(v=><option key={v}>{v}</option>)}
              </SS>
            </Field>
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}>
                <Field label="상차지">
                  <SI value={editing.from||""} onChange={v=>setEditing(f=>({...f,from:v}))} placeholder="상차지" />
                </Field>
              </div>
              <div style={{flex:1}}>
                <Field label="하차지">
                  <SI value={editing.to||""} onChange={v=>setEditing(f=>({...f,to:v}))} placeholder="하차지" />
                </Field>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:14}}>
              <div style={{flex:2}}>
                <Field label="품목">
                  <select value={editing.work?.material||""} onChange={e=>setEditing(f=>({...f,work:{...f.work,material:e.target.value}}))}
                    style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:15,outline:"none"}}>
                    {MATERIALS.map(m=><option key={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{flex:1}}>
                <Field label="수량">
                  <input type="number" value={editing.work?.qty||""} onChange={e=>setEditing(f=>({...f,work:{...f.work,qty:e.target.value}}))}
                    style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:15,outline:"none"}} />
                </Field>
              </div>
              <div style={{flex:1}}>
                <Field label="단위">
                  <SS value={editing.work?.unit||"개"} onChange={v=>setEditing(f=>({...f,work:{...f.work,unit:v}}))}>
                    {UNITS.map(u=><option key={u}>{u}</option>)}
                  </SS>
                </Field>
              </div>
            </div>
            <Field label="메모">
              <textarea value={editing.memo||""} onChange={e=>setEditing(f=>({...f,memo:e.target.value}))} rows={2}
                style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:14,resize:"none",outline:"none"}} />
            </Field>
            <div style={{display:"flex",gap:10,marginTop:4}}>
              <Btn outline color={C.muted} onClick={()=>setEditing(null)} style={{flex:1}}>취소</Btn>
              <Btn onClick={saveEdit} style={{flex:2}} disabled={editSaving}>{editSaving?"저장중...":"저장"}</Btn>
            </div>
          </div>
        </div>
      )}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: C.accent, letterSpacing: 2 }}>ADMIN</div>
          <div style={{ fontSize: 12, color: C.muted }}>일보 조회 · 청구 정리 · 비용 현황</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small outline color={C.green} onClick={onRefresh}>🔄 새로고침</Btn>
          <Btn small outline color={C.muted} onClick={onLock}>🔒 잠금</Btn>
        </div>
      </div>

      {/* 기간 */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📅 조회 기간</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: period === "custom" ? 10 : 0 }}>
          {[["mid", "25일 마감"], ["end", "말일 마감"], ["custom", "직접 입력"]].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              padding: "8px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
              background: period === v ? C.accent : C.card2, color: period === v ? "#000" : C.muted,
              border: `1px solid ${period === v ? C.accent : C.border}`, fontWeight: period === v ? 700 : 400
            }}>{l}</button>
          ))}
        </div>
        {period === "custom" && (
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              style={{ flex: 1, background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 14, outline: "none" }} />
            <span style={{ color: C.muted, alignSelf: "center" }}>~</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              style={{ flex: 1, background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 14, outline: "none" }} />
          </div>
        )}
        {startD && <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>📌 {startD} ~ {endD}</div>}
      </Card>

      {/* 내부 탭 */}
      <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
        {[["report","📋 일보"],["closing","📅 마감"],["mapping","🗺 매핑"],["settings","⚙ 설정"]].map(([id, label]) => (
          <button key={id} onClick={() => setAdminTab(id)} style={{
            flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 11, cursor: "pointer",
            background: adminTab === id ? C.card2 : "transparent",
            color: adminTab === id ? (id === "closing" ? C.green : C.accent) : C.muted,
            border: `1px solid ${adminTab === id ? (id === "closing" ? C.green : C.accent) : C.border}`,
            fontWeight: adminTab === id ? 700 : 400
          }}>{label}</button>
        ))}
      </div>

      {/* ── 일보 탭 ── */}
      {adminTab === "report" && (
        <>
          {/* 대기 중 일보 — 차량별 카드 */}
          <PendingReports records={records} onRefresh={onRefresh} />

          {unmappedLocs.length > 0 && (
            <div style={{ background: "#2a1a00", border: `1px solid ${C.accent}50`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, marginBottom: 6 }}>⚠ 미매핑 현장 ({unmappedLocs.length}곳)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {unmappedLocs.map((x, i) => (
                  <span key={i} style={{ background: "#1a1000", border: `1px solid ${C.accent}30`, borderRadius: 16, padding: "4px 10px", fontSize: 12, color: C.accent }}>
                    {x.type === "from" ? "↑" : "↓"} {x.loc}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>🗺 매핑 탭에서 설정해주세요.</div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[
              ["총 일보", `${reportRecs.length}건`, "📋"],
              ["청구업체", `${Object.keys(byClient).filter(k => k !== "(미매핑)").length}곳`, "🏢"],
              ["미매핑", `${(byClient["(미매핑)"] || []).length}건`, "⚠"],
            ].map(([l, v, ic]) => (
              <Card key={l} style={{ textAlign: "center", padding: "14px 8px" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{ic}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: l === "미매핑" ? C.danger : C.accent }}>{v}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{l}</div>
              </Card>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Btn onClick={downloadAll} style={{ flex: 1 }} disabled={reportRecs.length === 0}>📥 전체CSV</Btn>
            <Btn onClick={() => downloadByClient("mid")} color={C.blue} style={{ flex: 1 }} disabled={reportRecs.length === 0}>📤 25일마감</Btn>
            <Btn onClick={() => downloadByClient("end")} color={C.blue} style={{ flex: 1 }} disabled={reportRecs.length === 0}>📤 말일마감</Btn>
            <Btn onClick={downloadByVehicle} color={C.purple} style={{ flex: 1 }} disabled={reportRecs.length === 0}>🚛 기사별 정산</Btn>
          </div>

          {Object.entries(byClient).length === 0 ? (
            <Card style={{ textAlign: "center", color: C.muted, padding: 30 }}>해당 기간에 일보가 없습니다.</Card>
          ) : Object.entries(byClient).map(([client, rows]) => (
            <Card key={client} style={{ marginBottom: 12, borderColor: client === "(미매핑)" ? C.danger + "40" : C.border }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: client === "(미매핑)" ? C.danger : C.text }}>
                  {client === "(미매핑)" ? "⚠ 미매핑" : `🏢 ${client}`}
                </div>
                <div style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>{rows.length}건</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["날짜","차량","상차지","하차지","품목","수량","단위","단가","금액","메모",""].map(h => (
                        <th key={h} style={{ padding: "6px 6px", color: C.muted, fontWeight: 500, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice().sort((a, b) => a.date.localeCompare(b.date)).map(r => (
                      <tr key={r.id + client} style={{ borderBottom: `1px solid ${C.border}20` }}>
                        <td style={{ padding: "7px 6px", whiteSpace: "nowrap" }}>{r.date}</td>
                        <td style={{ padding: "7px 6px", color: C.accent, whiteSpace: "nowrap" }}>{r.vehicle}</td>
                        <td style={{ padding: "7px 6px" }}>{r.from}</td>
                        <td style={{ padding: "7px 6px" }}>{r.to}</td>
                        <td style={{ padding: "7px 6px", whiteSpace: "nowrap" }}>{r.work?.material || "-"}</td>
                        <td style={{ padding: "7px 6px", fontWeight: 700, whiteSpace: "nowrap" }}>{r.work?.qty ? fmt(r.work.qty) : "-"}</td>
                        <td style={{ padding: "7px 6px", whiteSpace: "nowrap" }}>{r.work?.unit || "-"}</td>
                        <td style={{ padding: "7px 6px", whiteSpace: "nowrap", color: C.muted }}>
                          {(() => { const p = getPrice(r.from, r.to, r.work?.material); return p ? fmt(p) : "-"; })()}
                        </td>
                        <td style={{ padding: "7px 6px", whiteSpace: "nowrap", fontWeight: 700, color: C.green }}>
                          {(() => { const p = getPrice(r.from, r.to, r.work?.material); return p && r.work?.qty ? fmt(p * Number(r.work.qty)) : "-"; })()}
                        </td>
                        <td style={{ padding: "7px 6px", whiteSpace: "nowrap", color: C.muted }}>{r.memo || "-"}</td>
                        <td style={{ padding: "7px 6px", whiteSpace: "nowrap" }}>
                          <button onClick={() => setEditing({...r})} style={{ background: C.blue+"20", border:`1px solid ${C.blue}40`, borderRadius:6, padding:"3px 8px", color:C.blue, fontSize:11, cursor:"pointer", marginRight:4 }}>✏️</button>
                          <button onClick={() => deleteRecord(r.id)} style={{ background: C.danger+"20", border:`1px solid ${C.danger}40`, borderRadius:6, padding:"3px 8px", color:C.danger, fontSize:11, cursor:"pointer" }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}

      {/* ── 마감 탭 ── */}
      {adminTab === "closing" && (
        <ClosingTab
          records={records}
          closings={closings}
          onClose={handleClose}
          onRefresh={onRefresh}
          getClients={getClients}
          getPrice={getPrice}
          startD={startD}
          endD={endD}
        />
      )}

      {/* ── 매핑 탭 ── */}
      {adminTab === "mapping" && (
        <MappingTab
          mappings={mappings}
          setMappings={onSaveMappings}
          records={records}
        />
      )}

      {/* ── 설정 탭 ── */}
      {adminTab === "settings" && (
        <>
          {/* 상·하차지 목록 관리 */}
          <LocManagePanel locations={locations} setLocations={setLocations} records={records} onBulkRename={bulkRename} />

          {/* 비밀번호 변경 */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🔐 관리자 비밀번호 변경</div>
            <Field label="새 비밀번호">
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호"
                style={{ width: "100%", background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 15, outline: "none" }} />
            </Field>
            <Field label="비밀번호 확인">
              <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} placeholder="한 번 더 입력"
                style={{ width: "100%", background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 15, outline: "none" }} />
            </Field>
            {pwMsg && <div style={{ fontSize: 13, color: pwMsg.startsWith("✅") ? C.green : C.danger, marginBottom: 10 }}>{pwMsg}</div>}
            <Btn onClick={changePw} style={{ width: "100%" }}>비밀번호 변경</Btn>
          </Card>

          {/* 차량 관리 */}
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>🚛 차량번호 관리</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={newVehicle} onChange={e => setNewVehicle(e.target.value)} placeholder="차량번호 추가"
                onKeyDown={e => { if (e.key === "Enter") { const t = newVehicle.trim(); if (t && !vehicles.includes(t)) { setVehicles(v => [...v, t].sort()); setNewVehicle(""); } } }}
                style={{ flex: 1, background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 14, outline: "none" }} />
              <Btn small onClick={() => { const t = newVehicle.trim(); if (t && !vehicles.includes(t)) { setVehicles(v => [...v, t].sort()); setNewVehicle(""); } }}>추가</Btn>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {vehicles.map(v => (
                <span key={v} style={{ background: C.card2, border: `1px solid ${C.accent}30`, borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700, color: C.accent, display: "flex", alignItems: "center", gap: 6 }}>
                  {v}
                  <button onClick={() => setVehicles(vs => vs.filter(x => x !== v))} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]                   = useState("report");
  const [records, setRecords]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [vehicles, setVehicles]         = useState(DEFAULT_VEHICLES);
  const [mappings, setMappings]         = useState([]);
  const [prices, setPricesState]        = useState({});
  const [driverSettings, setDSState]    = useState({});
  const [locations, setLocationsState] = useState({ from: [], to: [] });
  const [adminPw, setAdminPwState]      = useState(ADMIN_PW);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const isAdminMode = window.location.search.includes("admin");

  // 2달 지난 일보 자동 삭제
  const autoCleanup = async (recs) => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const cutoff = twoMonthsAgo.toISOString().slice(0, 10);
    const old = recs.filter(r => r.type === "report" && r.date && r.date < cutoff);
    for (const r of old) {
      try {
        await fetch(`${window.sbRecords.url}/rest/v1/records?id=eq.${r.id}`, {
          method: "DELETE",
          headers: { apikey: window.sbRecords.key, Authorization: `Bearer ${window.sbRecords.key}` }
        });
      } catch {}
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const v = await window.storage.get("dump_vehicles"); if (v?.value) setVehicles(JSON.parse(v.value)); } catch {}
      // 상·하차지 목록은 기사/관리자 모두 불러옴
      try { const l = await window.storage.get("dump_locations"); if (l?.value) setLocationsState(JSON.parse(l.value)); } catch {}
      // 기사 모드에서도 일보 기록 불러와서 상·하차지 목록 보완
      if (!isAdminMode) {
        try {
          const recs = await window.sbRecords.getAll();
          const filtered = recs.filter(r => r.type === 'report');
          setRecords(filtered);
        } catch {}
      }
      if (isAdminMode) {
        try {
          const recs = await window.sbRecords.getAll();
          const filtered = recs.filter(r => r.type !== 'settings');
          setRecords(filtered);
          await autoCleanup(filtered);
        } catch {}
        try { const m = await window.storage.get("dump_mappings"); if (m?.value) setMappings(JSON.parse(m.value)); } catch {}
        try { const p = await window.storage.get("dump_prices");   if (p?.value) setPricesState(JSON.parse(p.value)); } catch {}
        try { const d = await window.storage.get("dump_driver_settings"); if (d?.value) setDSState(JSON.parse(d.value)); } catch {}
        try { const pw = await window.storage.get("dump_adminpw"); if (pw?.value) setAdminPwState(pw.value); } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const saveRecord = async (rec) => {
    setRecords(prev => [...prev, rec]);
    await window.sbRecords.upsert(rec);
    // 상·하차지 자동 목록 추가
    if (rec.type === "report") {
      setLocationsState(prev => {
        const newFrom = rec.from && !prev.from?.includes(rec.from)
          ? { ...prev, from: [...(prev.from||[]), rec.from] } : prev;
        const next = rec.to && !newFrom.to?.includes(rec.to)
          ? { ...newFrom, to: [...(newFrom.to||[]), rec.to] } : newFrom;
        if (next !== prev) window.storage.set("dump_locations", JSON.stringify(next)).catch(()=>{});
        return next;
      });
    }
  };

  const refreshRecords = async () => {
    setLoading(true);
    const recs = await window.sbRecords.getAll();
    setRecords(recs.filter(r => r.type !== 'settings'));
    setLoading(false);
  };

  const updateVehicles = fn => {
    setVehicles(prev => { const next = typeof fn === "function" ? fn(prev) : fn; window.storage.set("dump_vehicles", JSON.stringify(next)).catch(() => {}); return next; });
  };

  const updateMappings = fn => {
    setMappings(prev => { const next = typeof fn === "function" ? fn(prev) : fn; window.storage.set("dump_mappings", JSON.stringify(next)).catch(() => {}); return next; });
  };

  const updatePrices = fn => {
    setPricesState(prev => { const next = typeof fn === "function" ? fn(prev) : fn; window.storage.set("dump_prices", JSON.stringify(next)).catch(() => {}); return next; });
  };

  const updateLocations = fn => {
    setLocationsState(prev => { const next = typeof fn === "function" ? fn(prev) : fn; window.storage.set("dump_locations", JSON.stringify(next)).catch(()=>{}); return next; });
  };

  const updateDriverSettings = fn => {
    setDSState(prev => { const next = typeof fn === "function" ? fn(prev) : fn; window.storage.set("dump_driver_settings", JSON.stringify(next)).catch(() => {}); return next; });
  };

  const setAdminPw = (pw) => {
    setAdminPwState(pw);
    window.storage.set("dump_adminpw", pw).catch(() => {});
  };

  const locationHints = records.filter(r => r.type === "report").flatMap(r => [r.from, r.to]).filter(Boolean);

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: C.bg }}>
        <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🚛</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 1 }}>다솔중기 일보관리</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {loading ? "로딩중..." : isAdminMode ? `일보 ${records.filter(r=>r.type==="report").length}건` : "일보 입력"}
            </div>
          </div>
        </div>

        {/* 기사 화면 */}
        {!isAdminMode && (
          <DriverScreen
            vehicles={vehicles} locationHints={locationHints} locations={locations}
            records={records} onSave={saveRecord} onRefresh={refreshRecords}
          />
        )}

        {/* 관리자 화면 — ?admin URL로 접근 */}
        {isAdminMode && (
          <div style={{ background: C.card, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, minHeight: "calc(100vh - 70px)" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🚛</div>
                <div style={{ fontSize: 14 }}>데이터 불러오는 중...</div>
              </div>
            ) : !adminUnlocked ? (
              <AdminLock onUnlock={() => setAdminUnlocked(true)} savedPw={adminPw} />
            ) : (
              <AdminDash
                records={records} vehicles={vehicles} setVehicles={updateVehicles}
                mappings={mappings} setMappings={updateMappings} onSaveMappings={updateMappings}
                prices={prices} setPrices={updatePrices}
                locations={locations} setLocations={updateLocations}
                driverSettings={driverSettings} setDriverSettings={updateDriverSettings}
                adminPw={adminPw} setAdminPw={setAdminPw}
                onLock={() => setAdminUnlocked(false)}
                onSaveExpense={saveRecord}
                onRefresh={refreshRecords}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
