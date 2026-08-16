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

const DEFAULT_MATERIALS = ["토사","불량토","매립토","와라","마사","풍암","원석","선별암","모래","A","B","C","13mm","25mm","40mm","혼합"];
const UNITS = ["개","m³","톤"];
const ADMIN_PW = "121512";
const MATERIAL_COLORS = {
  "모래":  { bg: "#1a3a5c", color: "#64b5f6" },
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
        <option value="__direct__">✏️ 직접입력...</option>
        {allList.map(l => <option key={l} value={l}>{l}</option>)}
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
function ReportForm({ vehicles, locationHints, locations, records, onSave, materials: MATERIALS = DEFAULT_MATERIALS }) {
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
  const _exFrom = locations?.from_excluded || [];
  const _exTo   = locations?.to_excluded   || [];
  const fromList  = [...new Set([...(locations?.from||[]), ...fromHints])].filter(x => !_exFrom.includes(x)).sort();
  const toList    = [...new Set([...(locations?.to  ||[]), ...toHints  ])].filter(x => !_exTo.includes(x)).sort();

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

  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!vehicle) { setErr("차량번호를 선택해주세요."); return; }
    const invalid = trips.some(t => !t.from || !t.to || !t.work.material || !t.work.qty);
    if (invalid) { setErr("모든 현장의 상·하차지, 품목, 수량을 입력해주세요."); return; }
    setErr("");
    setSubmitting(true);
    const now = Date.now();
    try {
      // 각 현장을 순서대로 저장하고 전부 완료될 때까지 대기
      for (let i = 0; i < trips.length; i++) {
        const t = trips[i];
        // 상하차지 공백 정규화 (앞뒤/중간 공백 제거해서 같은 현장으로 통일)
        const normFrom = (t.from || "").replace(/\s+/g, "");
        const normTo   = (t.to   || "").replace(/\s+/g, "");
        await onSave({
          type: "report", date, vehicle,
          from: normFrom, to: normTo, work: t.work,
          memo: i === 0 ? memo : "",
          status: "pending",
          id: now + i, savedAt: new Date().toISOString()
        });
      }
      // 전부 저장 성공한 경우에만 완료 처리
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      try { localStorage.removeItem("dump_draft"); } catch {}
      setVehicleRaw(""); setTripsRaw([{ ...emptyTrip }]); setMemoRaw("");
      saveDraft(today(), "", [{ ...emptyTrip }], "");
    } catch (e) {
      // 저장 실패 - 입력 내용 유지, 에러 표시
      setErr("⚠️ 저장 실패! 신호가 약할 수 있습니다. 잠시 후 다시 제출해주세요.");
      alert("일보 저장에 실패했습니다.\n입력 내용은 그대로 남아있으니 신호가 잘 잡히는 곳에서 다시 제출해주세요.");
    }
    setSubmitting(false);
  };

  // 품목 선택 상태 (행별)
  // MATERIALS는 props로 전달받음
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
        <Btn onClick={submit} style={{ width:"100%" }} disabled={submitting}>
          {submitting ? "📡 저장 중..." : saved ? "✅ 저장 완료!" : `일보 제출 (${trips.length}개 현장)`}
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
function DriverScreen({ vehicles, locationHints, locations, records, onSave, onRefresh, materials }) {
  return (
    <>
      <Nav />
      <div style={{ background:C.card, borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, minHeight:"calc(100vh - 110px)" }}>
        <ReportForm vehicles={vehicles} locationHints={locationHints} locations={locations} records={records} onSave={onSave} materials={materials} />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// 관리자 대시보드
// ════════════════════════════════════════════════════════════
function PriceInputModal({ reportRecs, customPrices, setCustomPrices, onClose, onConfirm }) {
  const locSet = {};
  reportRecs.forEach(r => {
    const k = (r.from||"")+"||"+(r.to||"");
    if (!locSet[k]) locSet[k] = { from:r.from, to:r.to };
  });
  const locs = Object.entries(locSet).sort(([a],[b])=>a.localeCompare(b));

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:9999, background:"rgba(0,0,0,0.85)", display:"flex", flexDirection:"column", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.card, borderRadius:16, overflow:"hidden", maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px 16px 8px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.accent, marginBottom:4 }}>🚛 기사별 정산 — 현장별 단가 입력</div>
          <div style={{ fontSize:12, color:C.muted }}>운반단가 입력 후 출력 (빈칸은 기존 단가 사용)</div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:12 }}>
          {locs.length === 0 && <div style={{ padding:20, color:C.muted, textAlign:"center" }}>이 기간 일보가 없어요</div>}
          {locs.map(([k, loc]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, background:C.card2, borderRadius:10, padding:"10px 12px" }}>
              <div style={{ flex:1, fontSize:13 }}>
                <span style={{ color:C.blue, fontWeight:700 }}>{loc.from}</span>
                <span style={{ color:C.muted, margin:"0 6px" }}>→</span>
                <span style={{ color:C.green, fontWeight:700 }}>{loc.to}</span>
              </div>
              <input type="number" value={customPrices[k]||""} onChange={e=>setCustomPrices(prev=>({...prev,[k]:Number(e.target.value)}))} placeholder="단가"
                style={{ width:90, background:C.card, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"7px 10px", color:C.text, fontSize:13, outline:"none", textAlign:"right" }} />
              <span style={{ fontSize:11, color:C.muted }}>원</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, padding:12, borderTop:`1px solid ${C.border}` }}>
          <button onClick={onClose} style={{ flex:1, padding:12, borderRadius:10, background:"transparent", border:`1px solid ${C.border}`, color:C.muted, fontSize:14, cursor:"pointer" }}>취소</button>
          <button onClick={onConfirm} style={{ flex:2, padding:12, borderRadius:10, background:C.purple, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>✅ 출력</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 관리자 일보 직접 추가 모달
// ════════════════════════════════════════════════════════════
function AdminAddModal({ vehicles, locations, materials, onClose, onAdd }) {
  const MATS = materials || DEFAULT_MATERIALS;
  const [date, setDate] = useState(() => today());
  const [vehicle, setVehicle] = useState("");
  const [from, setFrom] = useState("");
  const [fromDirect, setFromDirect] = useState("");
  const [to, setTo] = useState("");
  const [toDirect, setToDirect] = useState("");
  const [material, setMaterial] = useState(MATS[0] || "토사");
  const [qty, setQty] = useState("");

  const M3_LIST = ["모래","13mm","25mm","40mm","혼합","석분"];
  const isM3 = M3_LIST.includes(material);
  const exFrom = locations?.from_excluded || [];
  const exTo   = locations?.to_excluded   || [];
  const allFrom = [...new Set([...(locations?.from||[])])].filter(x => !exFrom.includes(x)).sort();
  const allTo   = [...new Set([...(locations?.to||[])])].filter(x => !exTo.includes(x)).sort();

  const actualFrom = from === "__direct__" ? fromDirect.replace(/\s+/g,"") : from;
  const actualTo   = to   === "__direct__" ? toDirect.replace(/\s+/g,"")   : to;

  const handleAdd = () => {
    if (!date || !vehicle || !actualFrom || !actualTo || !qty) {
      alert("날짜, 차량, 상차지, 하차지, 수량을 모두 입력해주세요."); return;
    }
    const rec = {
      id: Date.now(),
      type: "report",
      status: "approved",
      date,
      vehicle,
      from: actualFrom,
      to: actualTo,
      work: { material, qty: Number(qty), unit: isM3 ? "㎥" : "개" },
      savedAt: new Date().toISOString(),
    };
    onAdd(rec);
  };

  const inp = { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 14, boxSizing: "border-box", outline: "none" };
  const lbl = { fontSize: 12, color: C.muted, marginBottom: 4, marginTop: 10 };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 20, width: "100%", maxWidth: 400, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: C.text }}>📝 일보 직접 추가</div>

        <div style={lbl}>날짜</div>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} />

        <div style={lbl}>차량번호</div>
        <select value={vehicle} onChange={e=>setVehicle(e.target.value)} style={inp}>
          <option value="">선택</option>
          {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        <div style={lbl}>상차지</div>
        <select value={from} onChange={e=>setFrom(e.target.value)} style={inp}>
          <option value="">선택</option>
          <option value="__direct__">✏️ 직접입력...</option>
          {allFrom.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {from === "__direct__" && <input placeholder="상차지 직접입력" value={fromDirect} onChange={e=>setFromDirect(e.target.value)} style={{...inp, marginTop:6}} />}

        <div style={lbl}>하차지</div>
        <select value={to} onChange={e=>setTo(e.target.value)} style={inp}>
          <option value="">선택</option>
          <option value="__direct__">✏️ 직접입력...</option>
          {allTo.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {to === "__direct__" && <input placeholder="하차지 직접입력" value={toDirect} onChange={e=>setToDirect(e.target.value)} style={{...inp, marginTop:6}} />}

        <div style={lbl}>품명</div>
        <select value={material} onChange={e=>setMaterial(e.target.value)} style={inp}>
          {MATS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <div style={lbl}>{isM3 ? "수량 (㎥)" : "수량 (개)"}</div>
        <input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="수량 입력" style={inp} />

        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <button onClick={onClose} style={{ flex:1, padding:12, borderRadius:10, background:C.border, border:"none", color:C.text, fontSize:14, cursor:"pointer" }}>취소</button>
          <button onClick={handleAdd} style={{ flex:2, padding:12, borderRadius:10, background:C.green, border:"none", color:"#000", fontSize:14, fontWeight:700, cursor:"pointer" }}>✅ 추가</button>
        </div>
      </div>
    </div>
  );
}

function AdminDash({ records, vehicles, setVehicles, mappings, setMappings, onSaveMappings, prices, setPrices, locations, setLocations, materials, setMaterials, driverSettings, setDriverSettings, adminPw, setAdminPw, onLock, onSaveExpense, onRefresh }) {
  const _today = new Date(); const _ty = _today.getFullYear(), _tm = String(_today.getMonth()+1).padStart(2,"0"), _td = String(_today.getDate()).padStart(2,"0"); const _todayStr = `${_ty}-${_tm}-${_td}`;
  const [showAddModal, setShowAddModal] = useState(false);
  const [period, setPeriod]         = useState("custom");
  const [filterVehicle, setFilterVehicle] = useState("");
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [customPrices, setCustomPrices]     = useState({});
  const [customStart, setCustomStart] = useState(_todayStr);
  const [customEnd, setCustomEnd]   = useState(_todayStr);
  const [adminTab, setAdminTab]     = useState("report");
  const [newMaterial, setNewMaterial] = useState("");
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
  const reportRecs = records.filter(r => r.type === "report" && inRange(r) && r.status !== "pending" && (!filterVehicle || r.vehicle === filterVehicle));
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
    font: { name: "돋움", sz: 10, bold: !!bold, color: color ? { rgb: color } : undefined },
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

    let sD, eD;
    if (period === "custom") {
      // 관리자 화면에서 직접입력한 날짜 범위 사용
      [sD, eD] = getPeriodRange();
    } else {
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      if (closingType === "mid") {
        sD = localDate(y, m - 1, 26); eD = localDate(y, m, 25);
      } else {
        sD = localDate(y, m, 1); eD = localDate(y, m + 1, 0);
      }
    }

    const inR = r => r.date && r.date.match(/^\d{4}-\d{2}-\d{2}$/) && r.date >= sD && r.date <= eD;
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
      const TMPL_B64 = "UEsDBBQAAAAIABm4EF1Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6kDkQ9ip68zy51hbYpbYT67+0EP255ecgboi6JIia2mEXxLuRtMzLHDUDWI/o+y8qhiqHke64x3YGMsRoPpB8eA8OibdeAhTEMOMzit7Dp1C5GZ3XPlkJ3sjpRJsPiWDQ6sScfq9wcChDneiU+ixNLOZcrBf+LU8sVU57mym/8ZAW/B7oXUEsDBBQAAAAIABm4EF35v9ioMgEAAIwCAAARAAAAZG9jUHJvcHMvY29yZS54bWzFkrFOwzAQhl8FZXfPdmiErDQDICYqVSISqJvlXFuLOLFsV2lXnoCZgR2JR+tDkKRNoIKd8f7777v/pEuVFap2uHC1RRc0+oudKSsvlJ1FmxCsAPBqg0b6Seuo2uaqdkaGtnRrsFI9yzUCpzQBg0EWMkjogMSOxChLCyWUQxlqd8IXasTbrSt7WKEASzRYBQ9swiDKDi+fh7ePw/trCt+EjhbQGX8UsBiRvfont+9AdHLuvB5dTdNMmrj3tUcweJrfP/T3El35ICuF7ZTXIuwtzqJh82N8c5vfRRmnPCaUEc5zmgh6KWK27LKe5fsObOpCr/R/J04IvSIsyXksKBVT+iPxEDBL278opQ/zk3C9z7YeXQq/9cG6cLrqrj1umBKa5HQqGBU8Xo5zg6kXzh8v+wJQSwMEFAAAAAgAGbgQXUAP8jrzBQAAjRoAABMAAAB4bC90aGVtZS90aGVtZTEueG1s7Vndihs3FL4v9B2GuXfmf8Ze4g322E7a7CYhu0nJpTyWPcpqRkaSd9eEQEkotFAKhbT0ptC7XJTSQAMNvenDLCS0ad+hGo1/NLacpI1TUhobbOnoO0efzpGOpJnzF04zbBxDyhDJm6ZzzjYNmCdkgPJR07xx2KvVTYNxkA8AJjlsmlPIzAu77793HuzwFGbQEPo52wFNM+V8vGNZLBFiwM6RMcxF25DQDHBRpSNrQMGJsJthy7Xt0MoAyk0jB5kwe3U4RAk0/vzk8+cPPzV359a7WPzknBWCBNODRHapqkjs4Mgp/tiUxZgaxwA3TdHRgJwcwlNuGhgwLhqapi0/prV73looYb5BV9Hryc9Mb6YwOHKlHh31F4q+H/hha2HfLe2v47pRN+yGC3sSAJJEjNRZwwbtRrsTzLAKqCxqbHeijudU8Ip9bw3fCopvBe8t8f4avteLlz5UQGUx0PgkcmO/gg+W+HANH9mtjh9V8BKUYpQfraHtIPTi+WgXkCHBl7TwRuD3IncGX6IsZXaV+jnfNNcycJvQngDI4AKOcoNPx3AIEoGLAUZ9iow9NErFxBuDnDAhtl27Z3vit/j6siQ9AnYgULRLUcLWRAUfgyUUjXnT/FBYNRXI0ydPzu49Prv389n9+2f3fpz1va53CeQjVe/5wy//+PZj4/efvnv+4Cs9nqn4Zz989uyXX19knldoff3o2eNHT7/54rfvH2jgLQr6KvwQZZAZV+CJcZ1kYoCaDmCf/j2NwxSgigZIBVID7PK0ArwyBViHa8OqC29SkSl0wIuT2xWuBymdcKQBXk6zCnCfENwmVDucy0Vf6nAm+UjfOZ2ouOsAHOv6jlcC3J2MxZRHOpNxCis0r2ERbTCCOeRG0UaOINSo3UKo4td9lFDCyJAbt5DRBkjrkkPU53qlSygTcZnqCIpQV3yzf9NoE6wz34HHVaRYFgDrTEJcceNFMOEg0zIGGVaRe4CnOpIHU5pUHM64iPQIYmJ0B5Axnc5VOq3QvSwyjD7s+3iaVZGUoyMdcg8QoiI75ChOQTbWckZ5qmI/YEdiigLjGuFaEqS6Qoq6iAPIN4b7JoL87y3rGyID6SdI0TKhuiUBSXU9TvEQwHy2EVRSeobyl+b3lcwe/DuZ/Y3l9O1n8xZF2jW1msM34f6DmbsDJvk1KBbLu8T9LnH/HxP3prW8/XS9zNCWelaXZrKNB/chwviATzHcYzK3MzG8QU8IZUUqLe4J41QUZ91VcCMKZNmghH+EeHqQgrHoxpE9jNjM9IgZY8LE7mButC13l0m2Twal1HHmV1OhAPhSLnaXuVzsRbyUhtHyDrYwL2sjphIIpNFXJ6F0ViXhaUhE3quRcOxtsWhoWNSdF7GwlKiI9WeA4rFG4JeMxHwDGA6KOJX68+huPdKbnFkdtqsZXsPfWqQrJJTpViWhTMMUDOCqeMuxbjT0oXa1NKL6m4i1tZ4bcF6tGSdizXmBMJOAcdMcinOhKGZjYY8VeRPgUd40Ez5z9D/JLGPKeAewtITJpnL8GeKQGhhlYq6rYcD5kpvjRvbbS65hv32es1aDDIdDmPANkmVVtJVGtK2vCS4qZCJIH6SDE6OPJ/Q6EI4KIqdw4AAxvvDmAFFlci+9uJKuZkux8shsuUQBHqdgtqOoybyEy/KCjjIOyXR1VJbOhf1Rbxu77suVVpLmhg0k2pjF3twmr7Dy9KwCba5r1O0X7xKvvyEo1Op6ap6e2qa9Y4sHAqW7cIPf3I3RfM3dYHXWWsq5UtbW3k2Q/m0x8zviuDrBnJX3/1NxR4jnT5XLTCCl8+xyyo0JRU3zjh20/NgN4ppdD7o13/PtWj1oebVWEHhON3DsTtu9K5zC08wJyr574j6Dp7N3L1K+9v4lmx+zzyUks4g8B1tSWb5/cVzd+5fDot00kPDMndDtNbxGO6w1vFav5nfa9VojDtu1ThhHnV4nDuqN3l3TOJZgv+XFftit10Injmt+aBf0641a5Ltuy49a9a7fujvztRj5/H/uXslr9y9QSwMEFAAAAAgAGbgQXcw/QsJKUAAAc8ACABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWy1vX2T3EaO4P1VFLqIi7t5YqxivlO2FTGWLbXU9GzL3r29u/80nratGL09Us/M7n76y6ouJkACCSKzqI2Lc45QQGclkCD4Q5L1zT8/fPrb599vb+8e/Me7t+8/f/vw97u7j48fPfr8y++3715//urDx9v3WfLrh0/vXt/l//npt0efP366ff3Xk9K7t4/M4RAevXv95v3DJ9+c/u3m05Nv7l7/5emHtx8+Pfj021++ffgs/9/Tw+Hw8NGTbz78/e7tm/e3N58efP77u3evP/3nd7dvP/zz24fDw/kffnrz2+93x3/In/74+rfbn2/v/u1j/vyvb+7+9cNN/oez7FH5a3998+72/ec3H94/+HT767cPvxse/+lmGE8fOn3mf725/ednNH6Qp/fz7dvbX+5u/3r6y3cfPk63v949vX379tuHfxryv/zXhw/vfv7l9dvbPx+/eP7XIU8f/vXno6np9X/mb3M0eBYf1/IvHz787fhPL7Llw3FJTn/nOLfX+T//uL3/G9cm5u/7/5+mexyXr3NUxeN52s9O659X4S+vP9/mpf33N3+9+/3bh+nhg7/e/vr672/vfvrwz6vb88qFr/zR4i8f3n4+/f8P/nn/afdViv7hg1/+/vnuw7uzheO63/3n29OiPnj35v39f1//x3mRkbb/ajDb2uasbVbaYVPTnjXdSnMwqj/sz+qh+Q/Hs+a40hx1y3WY14t85a+CYt7D/L3z4NHKXZo/n2b1RNSz9l9uP989e3PaTpuWxtnSeiFMmyEzr4g5UFdqQmiOQLdekXFT17n5b/v1H9dFv/FDsdC5A3zZA759Fxhvi3bnTjDeFxPtu8H4WLT7doQJJQBC354woSxCWMeA4huEEgTBdy5hCMVE7JjAvClNXEehcgljicLYlRZMLGsQ12HUmhhMLPEU1+vZmhpiWde4Ds32aZVATeudep9nWoylsmnH9XrZNktjWa2RrFbztMayXuN6vcZTHDQZKws2roN6O7OacQ5qf6Cu0wS1P8RiYf33danVH2AO68vd9rb0h/kK5wfmyqSawDAUE+253ZdrvR/WoaHLC34IxQJZAFVq9QMswjq9K75BubZ7s95z2iU0pphoz+3euKJNN4RqCU2JQrNeAFVq9basgaU1RtuW9LbEkyU5rNVUWVe7Ds32aZVAteud2pzDvC2bltRkbanVl9rMk9qsfVqlTPOkTGtOrb5UbcdRa2r1fg7qSAomXWqNpWCKpGDSpdYYYA7rC6DiFir4or3elsq8EEMsJtpzewxzWotxHRq6vBCjKRbIAqhSayx1UiR1kuIblNIoxvWe0y5hTMVEe26Pac5rMdENoVrCVKIwrRdAlVpjKmuQLi0PYyrxlEgOazVV1jVdepcdUwnUcb1Tm3NYHOdNm0hN1pZaU6nNEqnNmqeVSpmWSJnWnFpTqdqOo9bUmgDPHBhCogM8QEYOpGbSZdfhYGAeBIts782sNID+encq00PWtGCkPclnJQ/65A5CuZimAKsDKZ+UxOxgYTFI2aT5HqVUysP1JlQvpnVgpD3dZ6UA+nSX6BbTQmS69ULo8OHBwVq4S+vGbAIijNC7xiySLcAKu0shRjYBwesI4WxNccPBw4YmRVtb7s0GYNVI+dYxtQDrRmq55vybbcDCEZ62nYGzUgl0jkWpAh0Q1EAZlDIFA3saKHxSbFjgTXm43rDarGFi2bEmdVwHjqir6JM7DeViJgc2yELoUrBJsBikvFJ9jwT6692oXswRei9jx3XAjAb06UbRLeYIkUmomi4FA1k7DS/Mc2aECBsv7OQM9lBW2B4uhR3ZxADWLmaj2UbZ0JbUdo0p2EKNZ2n/q31qUO5ZUu61p2AL1Z8l3E2Rgm1hbgPHrFSBDqhqoKxKmYKBUQ0UUik2LHCpPOzsjmVND0Y6rgNHJFb0O3vG3pX48KTqUqZgD7WWJ7WW5ntAeeVdZ58sawYw0nEd8K7kPkoHtYvpITIJfdOlYCBwp+GFec57iDB/YccsW4AVJu3cjqlB8IaLGWq2ARua1HaNKdhDjedpn7F9alDueVLutadgD9WfJ3xOkYJ9YXMDx7ZUgQ5Ia6BMS5mCgWUNFGYpNizwqyGOnV20rDmAkY7rwBGdFf2+TlpWDGCjr5eWFdFitBPXIUF5lQ6d/bSsacBIx3UgHRzo9/XUBsCHA6V0ynNMQOoSac8257lUGrWn4WUpOA2wwqTt2zE1C9YuZq3ZBpwAI7VdYwpOUOMl2o9snxqUe4mUe+0pOEH1lwi2U6TgVIid4VCX6lwOAC5DAZfyfBhwLUO5luJ0EZCsPOzstmXNCEbarwPmyNBmfdKMVR5yOsBJuQOpupQnxQ5w2O1Aai3N9yjlVR529t2yZgIj7dcBc4ATcxQmahcTzsxRTKc7Mwak7jS8LM9lExBh5BBd85FSOFJ3IO3hjqlB8JLzde2HtA5w2O5AarvG02OHBKtG+5btU0uwbqTcaz9BdkiwcATbKc6QHQqxMxzqUgU6AC5DAZcyBQPXMpRrKTYskKw87GzHZU0LRjquA0eGVvT72nFZscSHJVWXMgXbARaD1Fqa71HKqzzsbMdlTQdGOq4DtpysMxQmahezQERDMZ0uBQOpOw0vzHPWQISRw3atqcQaWGHSPe6YGgQvOYfXnueshQ1NarvGFGyhxrO0idk+NSj3LCn32lOwherPEmynSMG2EDvDoS7dMxLoCQNSdGmfkvBoHj2PKaDnFHxnOy5rlh3rQ8d14MjQin5fOy4rwjMrpOpSpmAPtZbveWDBQ3nlQ2c7zvhY9qAnh/BUD57AgzMEJmoXE55VoJhOl4KB1J2GF+Y5HyHCyKG81lTiE6ww6R63Ty1B8JLzeu15zifY0KS2a0zBHmo8T5uYzVMLUO4FUu61p+AA1V8g2E6RgkMhdoZDXapAB8BlKOBSpmDgWoZyLcWGBZKVh70Pq6XBg5GO68CRoRX9zgfWEjyymEjVpUzBCWqt1PFgQ1ZyoN/72FoyAYx0XAdSOZ1nKEzULqaFyCSYTpeCEalLpM/bnOeShQgjJ/WanxOzsMKke9wxNQhecoCv4yE2Bxua1HaNKThBjZdoE7N9alDuJVLutafgBNVfIthOkYJTIXaWQ12aQLcAuCwFXLoUbIFrWcq1FM/MA8myB/KsqTJrZM0BjHQ8uH9kaEW/rx2XFQPY6GvHZUW0GO0Y1h5KeZWHne24rGnASPt1ICs50O9rx1mAiJZiOlUKtkDqTsPL8lw2ARFGTuo1ppJsAVaYdI87pgbBSw7wNee5bKNs6IHUdm0pOBsYwNbFV4dsw4C5i9tx2YYFc+3tuKxUAp1DXapAB8BlKeBSpmDgWpZyLcWGBZKVh53tuKwZwUjHdeDI0GZ90rlVZg1b2rV52NeOy4qwGB1PRWSlAPqd7bismcBIx3XAltN5lsJE7WI6iEyC6XQpGEjdaXhhnrMOIoyc1GtNJdbBCpPuccfUIHjJAb72PGc9bGhS2zWmYAs1nqVNzPapQblnSbnXnoItVH+WYDtFCraF2FkOdakCHQCXpYBLmYKBa1nKtRQbFkhWHna247KmBSMd14EjQyv6fe24rFjiw5OqS5mCPdRavuOpiKxkQL+zHZc1HRjpuA74cjrPUpioXcwCES3FdLoUDKTuNLwwz4XS8D0NL0vBoRzbOw0vnpoHaxcDVxvKYT4bSG3XmIID1HiBNjHbpwblXiDlXnsKDlD9BYLtFCk4FGJnOdSlCnQAXJYCLmUKBq5lKddSbFggWXnY2Y7LmmXHJtdxHTgytKLf147Lig5s9LXjsiIsRsdTEVkpgX5nO86m8oRqHnZcB1I5nWcpTNQupofIJJhOl4IRqUukz9uc55KHCCMn9VpTSQqwwqR73D61AMFLDvC157kUYEOT2q4xBSeo8RJtYrZPDcq9RMq99hScoPpLBNspUnAqxM5xqEsT6A4Al6OAS5eCHXAtR7nW9oZ1QLLysLMdlzU9GGm/DrhDeclcHva149xQ2rV52NeOy4oWbLRj2KzkQL+zHZc1Axhpvw5kpVT0CUzULmaBiI5iOlUKdkDqTsPL8lw24cHahe24bAFWmHSPO6ZWgncgB/ia81y2UTb0QGq7thScDcCq0SZm+9QsrBsp95pTcLYBC0ewneKtvUMhdo5DXapAB8DlKOBSpmDgWo5yLcWGBZLlLHmcVZs1bHmeNQ87rgO2vIwuD/vacVkxgI2+dlxWRIvRjmGdLeVVHna247KmASMd1wFbTuc5ChO1ixkgMgmm06VgIHWn4YV5zkaIMHJSrzWV2AgrTLrHHVOD4CUH+NrznI2woUlt15iCLdR4ljYx26cG5Z4l5V57CrZQ/VmC7RQp2BZi5zjUpQp0AFyOAi5lCgau5SjXUmxYIFl52NmOy5oRjHRcB0J5aZ0LpHOrzBqhtGvzsK8dlxVhMTqeishKAfQ723FZM4GRjutAKKfzHIWJ2sU0EJkE0+lSMJC60/DCPBcMRBg5qdeaSoKBFSbd446pQfCSA3zteS5Y2NCktmtMwQFqvECbmO1Tg3IvkHKvPQUHqP4CwXaKFBwKsXMc6lIFOgAuRwGXMgUD13KUayk2LJCsPOxsx2VNC0Y6rgOpvLYuD/vacVmxxEciVZcyBSeotVLHUxFZyYB+Zzsuazow0nEdSOV0nqMwUbuYESKTYDpdCkakLpE+b3OeSwkijJzUa00lKcEKk+5xx9QgeMkBvvY8l8phPjeS2q4xBY9Q4420idk8tRHKvZGUe+0peITqbyTYTpGCx0LsPIe6dL/RUIouTwGX8ocuBvRDDx1PRXggWXnY2Y7LmvBbER0vLfZDeW1dHva147KiAxt97bisCIvR8VREVkqg39mO8wP8bMTQ8dLirGRAv68d5wEieorpdD9+AaTuNLwsz2UTEGHkpF5jKvGDgxUm3eP2qTkIXnKAr/3XJgYHG5rUdo0/gzF4WDXaxGyfWoB1I+Ve+09hDAEWjmA7xY9hDIXYeQ51qQIdAJengEuZgoFrecq1FBsWSFYe9v6ooS3Ps+Zhx3XAltfW5WFfO87b0q7Nw752XFaExeh4KiIrOdDvbMdlzQBGOq4DtpzO8xQmahdzhMgkmE75+0MjrAXp87b/1M8IEUZ/sKzZGKww6R53TK0EryMH+NrznCuH+bwjtV1jCnZQ4znaxGyfGpR7jpR77SnYQfXnCLZTpGBXiJ3nUJcq0AFweQq4lCkYuJanXEuxYYFk+UAeZ9VmjQC/0RU6XlrsA/yYViCdW2XWCKVdm4edP/wWLFqMjp9+C1BeBfKsqnoxyxOqedhxHQjldJ6nMFG7mA4ik2A6XQoGUncaXpjnAvyuWaA/bNZsDFaYdI87pgbBSw7wtee54GFDk9quMQUHqPECbWK2Tw3KvUDKvfYUHKD6CwTbKVJwKMTOc6hLFegAuDwFXMoUDFzLU66l2LBAsvKwsx2XNSMY6bgOpPLaOp9I51aZNVJp1+ZhXzsuK8JidDwVkZUC6He247JmAiMd14GxnM7zFCYqFxMgoqeYTpeCEakbmR+kbdyuI/w27Uh/AK3ZWAJjFzOSEX62diQH+Nrz3FgO8/mR1HaNKXiEGm+kTcz2qUG5N5Jyrz0Fj1D9jQTbKVLwWIhd4FCXJtADAK5AAZcuBQfgWoFyre0NG4Bk5WFnOy5rWjDSfh0IQ3ltXR72teOyYio2SNWlS8FZERaj46mIrGRAv7MdlzUdGGm/DmSlAPp97bgAEDFQTKdKwQFI3Wl4WZ7LJiDC6K+gNRuDFSbd446pQfCSA3zNeS4METY0qe3aUnA2AKtGm5jtU0uwbqTca07B2QYsHMF22yk4K5VA51CXKtABcAUKuJQpGLhWoFxLsWGBZOVhZzsua5Yd6zpeWhxceW1dHva147KiAxt97bisGMFGO4bNSgn0O9txwZUnVPOw4zrgyum8QGGidjELRAwU0+lSMJC60/DCPOcGiDD6K2itxgysMOket0/NQPCSA3ztec6Vw3zBkdquMQU7qPEcbWK2Tw3KPUfKvfYU7KD6cwTbKVKwK8QucKhLFegAuAIFXMoUDFwrUK6l2LBAsvKwsx2XNT0Y6bgOhPLaujzsa8eFUNq1edjXjsuKsBgdT0VkJQf6ne24rBnASMd1IJTTeYHCRO1iRohMgul0KRhI3Wl4YZ4LESKM/gpaszFYYdI97pgaBC85wNee50KCDU1qu8YUHKDGC7SJ2T41KPcCKffaU3CA6i8QbKdIwaEQu8ChLlWgA+AKFHApUzBwrUC5lmLDAskKI3mcVZs1xvI8ax52XAfG8tq6POxrx2XFADb62nFZES1GO4YNI5RXI3lWVb2Y5QnVPOy4DozldF6gMFG7mAYik2A6XQpGpG5kft+2cbuOFiKM/gpaszFYYdI97pgaBC85wNee50YLG5rUdo0peIQab6RNzPapQbk3knKvPQWPUP2NBNspUvBYiF3kUJcm0CMArkgBly4FR+BakXKt7Q0bgWTlYWc7LmtGMNJ+HYhDeW1dHEjnVpc1sqIBG33tuKwIi9HxVERWCqDf2Y7LmgmMtF8H4lBO50UKE7WLmSAyCaZTpeAIpO40vCzPZRMQYfRX0JqNwQqT7nHH1CB4yQG+5jyXbZQNbUht15aCs4EIti6+OmQbCcxd3I7LNkYw196Oi6YQu8ihLlWgA+CKFHApUzBwrUi5lmLDAsnKw852XNa0YKTjOuDKa+vysK8dlxVLfDhSdSlTsLOwGB1PRWQlA/qd7bis6cBIx3XAldN5kcJE7WJaiEyC6XQpGEjdaXhhnnMOIoz+ClqzMVhh0j3umBoELznA157nnIcNTWq7xhTsoMZztInZPjUo9xwp99pTsIPqzxFsp0jBrhC7yKEuVaAD4IoUcClTMHCtSLmWYsMCycrDznZc1iw7NnS8tDiG8tq6POxrx2VFBzb62nFZERaj46mIrJRAv7MdF0N5QjUPO64DoZzOixQmahdzhMgkmE6XgoHUnYYX5rkwQoTRX0FrNBbLsb3T8MKpxdJLzsOLgWu2UTZ0JLVdYwqOUONF2sRsnxqUe5GUe+0pOEL1Fwm2U6TgWIhd5FCXKtABcEUKuJQpGLhWpFxLsWGBZOVhZzsua3ow0nEdGMtr6/Kwrx0Xx9KuzcO+dlxWhMXoeCoiKznQ72zHZc0ARjquA2M5nRcpTNQupofIJJhOl4IRqRuZ37dt3K6jhwijv4LWbAxWmHSPO6YGwUsO8LXnuTHAhia1XWMKHqHGG2kTs31qUO6NpNxrT8EjVH8jwXaKFDwWYpc41KUJ9ASAK1HApUvBCbhWolxre8MmIFlpII+zKrNG1hzASPt1IA3ltXV52NeOy4oBbPS147IiWox2DJtMKa/ysLMdlzUNGGm/DmQlB/p97bgEEDFRTKdKwQlI3Wl4WZ7LJgawdmE7LluAFSbd446pWbB2MXDNNsqGNqS2a0vB2QCsGm1itk/NwrqRcq85BWcbsHAE222n4KxUAp1DXapAB8CVKOBSpmDgWolyLcWGBZKVh53tuKwZwUjHdcCV19YlRzq3yqzhSrs2D/vacVkRFqPjqYisFEC/sx2XNRMY6bgOuHI6L1GYqF3MAJFJMJ0uBQOpOw0vzHMuQITRX0FrNgYrTLrHHVOD4CUH+NrznIuwoUlt15iCHdR4jjYx26cG5Z4j5V57CnZQ/TmC7RQp2BVilzjUpQp0AFyJAi5lCgaulSjXUmxYIFl52NmOy5oWjHRcB2J5bV0e9rXjsmKJj0iqLmUKjlBrxY6nIrKSAf3OdlzWdGCk4zoQy+m8RGGidjELREwU0+lSMJC60/DCPBcNRBj9FbRmY7DCpHvcMTUIXnKArz3PRQsbmtR2jSk4Qo0XaROzfWpQ7kVS7rWn4AjVXyTYTpGCYyF2iUNdqkAHwJUo4FKmYOBaiXItxYYFkpWHne24rFl27Njx0uI0ltfW5WFfOy4rOrDR147LirAYHU9FZKUE+p3tuDSWJ1TzsOM6MJbTeYnCRO1iRohMgul0KRiRupH5fdvG7TpGiDD6K2itxhKsMOket08tQfCSA3zteW5MsKFJbdeYgkeo8UbaxGyd2ngo5d5peGEKzjYGMNfejstKc6CPHOrSBPoIgGukgEuXgkfgWiPlWtsbdgSSlYed7bis6cFI+3VgNOW1dXnY144bTWnX5mFfOy4rwmJ0PBWRlRzod7bjsmYAI+3XgayUij6BidrFtBCZBNOpUvAIpO40vCzPZRMQYfRX0JqNwQqT7nHH1CB4yQG+9jxnHGxoUtu1peBsAFaNNjHbp+Zh3Ui5156CjYeFI9hOkYJNIXYjh7pUgQ6Aa6SAS5mCgWuNlGspNiyQrNGRx1m1WcOV51nzsOM64Mpr6/Kwrx2XFQPY6GvHZUW0GO0YdnSlvMrDznZc1jRgpOM64MrpvJHCRO1iJohMgul0KRhI3Wl4YZ5zI0QY/RW0ZmOwwqR73DE1CF5ygK89z7lymG/0pLZrTMEeajxPm5jNU/NQ7nlS7rWnYA/VnyfYTpGCfSF2I4e6VIEOgGukgEuZgoFrjZRrKTYskKw87GzHZc0IRjquA7G8tm6MpHOrzBqxtGvzsK8dlxVhMTqeishKAfQ723FZM4GRjutALKfzRgoTtYvpIDIJptOlYCB1p+GFeS46iDD6K2jNxmCFSfe4Y2oQvOQAX3ueix42NKntGlNwhBov0iZm+9Sg3Iuk3GtPwRGqv0iwnSIFx0LsRg51qQIdANdIAZcyBQPXGinXUmxYIFl52NmOy5oWjHRcB8by2ro87GvHZcUSHyOpupQpeIRaa+x4KiIrGdDvbMdlTQdGOq4DYzmdN1KYqF3MAhGHA+V0qhx8VDTIyKXV5tGGRfYu7MkdTThk7lJUcrThkb2LyWs2Uo715TEp89qy8dECWj3a0eyYnkHrR6q/5ox8NIIWkHC87Zx81ArFAke/NLF/1PTISl+P7qiJ59JOZ49aEVno7NMdVWEvm473GR+1BmShr1d31HTISl+37qiJFqXjsYmjVkIWOjt2WdXD7jQdbzY+ahlkoa9rd9RE0Up4njJVA9O7H1+aC41HMUd/Mq3ZXEBrTZrNHdMLKKDJib+OXGgC2uykHGxN1Sai1aOdz47pJbR+pErsSNUmoQUkvE+Tqk2C4OcomS74AY7dj/tSNVCx+3H7VgYSdhx39vOOqh6Z6blmuDEiC309veHgDxAvnlRu2lTtUb3mOx6vOGo5ZKGzs3dUDchMzzXDHyA/UjapXtZhQFa6+ntHRbQmzE/mtm5lP3hk78Ie39EEWmvSlO6ZHgS0JycDO3KhN7DZPakRW1O1R7Wipx3SjumhstGTsrEjVXtURXrCBTWp2lsIfo6m6YI/osKNUjRtqo4Oz6Wd9h614OIayXOz6pwSy5Ozx3HPNSN6iyz09f6OmgFZ6ev+HTXxorRz36yFSrRIHo/VL2swyEzPNSMGhyz0dQGPmihaCR9UpmpghPfjS3NhjCjm6E+wtZtDa02a1z3TQwFNThB25MIY0WYnNWJrqo6oVoy0k9oxPVQ2RlI2dqTqiKrISPihJlXHwg6HgUNuquAfEGgbKGhTpuoB8bWB8jXFVh4QUcvjzv7gUTUiMx3XjOFQXqWXx6SdrMwpWdMgK31dwqMmWpSOxzWOWgFZ6OwUHlUTMtNxzcg3gQewQACnelkNilaCDXWpekDk8DS+MBce79uRvQt7hkcTaK1Jk7tneiigyUnD9lyYjaDNTmrExlSdLaDVox3Xjuk5tH6kbGxP1ceba2SwvX84HO8piwUOuemCH4G2gYI2bapGfG2gfE2zlRFRy+POPuJR1SIzPdcMEzyy0NdLPGpCvBhSuWlTtYloUToe6zhqGWShs6N4VHXITM81w8SALPR1FY+aKFoJNlSmakQOT+NLc6FJKOboT7q1m0NrTZrhPdNDAU1OJHbkQjPCZrekRmxN1RbVipY2ZdunZ1HZaEnZ2JGqLaoiLYGImlRtgR8OHHLTBT8CbQMFbdpUjfjaQPmaZisjopbHvW3FrAp72Xe8l/moNSALnW3FrOmQlc62YtZEi9Lx+MdRKyELvW3FwVvYnb7jDc1HLYMsdLYVBwQ2B4oNlakakcPT+NJc6C2KOfrTb83mHFpr0hnvmJ5DAU1OLnbkQu/QZic1Ymuq9qhW9LQp2zE9VDZ6UjZ2pGqPqkhPIKImVXvghwOH3HTBj0DbQEGbNlUjvjZQvqbZyoio5XFvWzGremSm55oRY0QWOtuKQ4Q2dB53thWzJlqUjsdEjloOWehtK2bVgMz0XDNigvxIAad6WUcUrQQbKlM1JoeR+enf1q0cRxRz9Cfi2s2htSad8Z7pQUAncsCxIxcmOOw4JFIjtqbqhGrFRJuyHdNDZWMiZWNHqk6oikwEImpSdQJ+aDjkpgp+g0CboaBNmaoN4muG8jXFVjaIqJkDef5Xm1Oy6oDMdFwzzKG86u847mwrZs2ArHS2FbMmXpQORGwOUKLlcW9bMasaZKbjmpG1HLLQ2VY0CGwaig11qdogcngaX5gLsw0Uc/Sn5NrNobUmnfGe6aGAJgcc23NhNoI2O6kRG1N1toBWjzZlO6YX0fqRsrE9VWcjaAEJRFSk6qwFwc8hN13wI9BmKGjTpmrE1wzla5qtjIhaHve2FbNqRGZ6rhkmQXo0pCOtzSkG2tB53NlWzJpoUToeOzlqBWSht62YVRMy03PNsHB60VDAqV1WBDYNxYbKVI3I4Wl8aS600Mo+jS9M1RaONZ7Gl08PAtqSA44dudDCYUdjSY3YmqotqhUtbcp2TA+VjZaUjR2p2qIq0hKIqEnVFvih4ZCbLvgRaDMUtGlTNeJrhvI1zVZGRC2Pe9uKWdUiMz3XDO88stDZVsyaEC+eVG7aVO1RveZ7njzJWgZZ6G0rZlWHzPRcMzycXjQUcKqX1aNoJdhQmaoROTyNL82FPqCYoz9N124OrTXpjPdMDwU0OeDYkQt9RJud1IitqdqjWtHTpmzH9FDZ6EnZ2JGqPaoiPYGImlTtgR8aDrnpgh+BNkNBmzZVI75mKF/TbGVE1PK4t62YVWEvp473Sx+1BmShs62YNR2y0tlWzJoRWelAxFkrIQu9bUWT4FniPO65ZiQ4vWgo4FQvK4BNQ7GhMlVjcpiYnyZu3cppQDFHf8Ku2ZxBa0064x3TMyigyQHHjlyY4LBjvg+/sK2YLaDVo03ZjumhsjGRsrEjVSdURSYCETWpOgE/tBxyUwW/RaDNUtCmTNUW8TVL+ZpiK1tE1PK4t62YVT0y03HNsIfyKsLjuLOtmO+rD2CFVG7KVJ010aL0PHmStRyy0NtWzKoBmem4ZmStBBYI4FQva0TRSrChLlVbRA5P4wtzYbaBYo7+1F27ObTWpDPeMz0U0OSAY3suzEbQZic1YmOqzhbQ6tGmbMf0RrR+pGxsT9XZCFpAAhEVqTprQfBzyE0X/Ai0WQratKka8TVL+ZpmKyOiZi158FidUyw8eZzHPdcMO1hkobOtmDUDstLZVsyaeFE6ELG1UKLlcW9bMasaZKbnmmHh9KKlgFO9rAZFK8GGylSNyOFpfGkutBbFHP1JvHZzaK1JZ7xneiigyQHHjlxoLdrspEZsTdUW1YqWNmU7pofKRkvKxo5UbVEVaQlE1KRqC/zQcshNF/wItFkK2rSpGvE1S/maZisjopbHvW3FrBqRmZ5rhg+QHj3pSGtzioc2dB53thWzJlqUnidPslZAFnrbilk1ITM91wwPpxctBZzqZU0oWgk2VKZqRA5P40tzoU8o5uhP57WbQ2tNOuM900MBTQ44duRCD4cdbSA1YmuqDqhWDLQp2z69gMrGQMrGjlQdUBUZCETUpOoA/NByyE0X/Ai0WQratKka8TVL+ZpmKyOilse9bcWsapGZnmtGglce5nFnWzFrQrwkUrlpU3VC9VrqefIkaxlkobetmFUdMtNzzUhwetFSwKleVouilWBDZarG5DAxP53cupWTQzFHf2Kv3Rxaa9IZ75keCmhywLEjFyaPNjupEVtTdUK1YqJN2Y7pobIxkbKxI1UnVEUmAhE1qToBP3QcclMFv0OgzVHQpkzVDvE1R/maYis7RNTyuLetmFVHMNPxnuyj1oAsdLYVs6ZDVjrbilkTLUrPkydZKyELvW1Fd4BnifO445qRtQyy0NlWdAhsOooNdanaIXJ4Gl+YC7MNFHP0p/hazQ1wrPE0vnR6A/TJ8/hyGJyNwGYfSI3YmKqzhRFZu/xK4gaD1o+Uje2pOhtBC0ggoiJVZy0Ifg656YIfgTZHQZs2VSO+5ihf02xlRNTyuLetmFU9MtNzzbDwysM87mwrOgtt6DzubCtmTbQoPU+eZC2HLPS2FbNqQGZ6rhkWTi86CjjVy+pRtBJsqEzViByexpfmQutRzNGf7Gs3h9aadMZ7pocCmhxw7MiFNqDNTmrE1lRtUa1oaVO2Y3qobLSkbOxI1RZVkZZARE2qtsAPHYfcdMGPQJujoE2bqhFfc5SvabYyImrOkweP1TnFw5PHedxzzfDwysM87mwrZs2ArHS2FbMmXpQOROwCKtECeapYvawBniXO455rRoDTi44CTu2yIrDpKDZUpmpEDk/jS3NhgFb2aXxhqg4DWmvSGe+ZnkX2LofB2Qhs9kBqxNZUHVCtGGhTtmN6qGwMpGzsSNUBVZGBQERNqg7ADx2H3HTBj0Cbo6BNm6oRX3OUr2m2MiJqedzbVsyqEZnpuWYkeOWhS6Qjrc0pCdrQedzZVsyaaFF6njzJWgFZ6G0rZtWEzPRcMxKcXnQUcKqXNaBoJdhQmaoxOUzMTzu3buUUUMzRnwBsN4fWmnTGe6aHApoccOzIhSmizU5qxNZUnVCtmGhTtmN6qGxMpGzsSNUJVZGJQERNqk7ADz2H3FTB7xFo8xS0KVO1R3zNU76m2MoeEbU87m0rZlWLzHRcM/wArzzM4862YtZMYIVUbspUnTXRovQ8eZK1DLLQ21bMqg6Z6bhmZK2ALHS2FT0Cm55iQ12q9ogcnsYX5sJsA8Uc/XXAdnNorUlnvGd6KKDJAcf2XOgHizY7qREbU3W2gFaPNmU7pufQ+pGysT1VZyNoAQlEVKTqrAXBzyE3XfAj0OYpaNOmasTXPOVrmq2MiFoe97YVsyrsZdvz4mxv4ZWHedzZVsyaDlnpbCtmTbQoPU+eZK2ELPS2Fb2FZ4nzuOeaYeH0oqeAU72sEUUrwYbKVI3I4Wl8aS60EcUc/XXAZnMJrTXpjHdML6GAJgccO3KhTWizkxqxNVVbVCta2pRtn55DZaMjZWNHqnaoinQEImpStQN+6Dnkpgt+BNo8BW3aVI34mqd8TbOVEVHL4962Ylb1yEzPNSPAKw/zuLOt6AO0ofO4s62YNdGi9Dx5krUcstDbVsyqAZnpuWYEOL3oKeBUL6tF0UqwoTJVI3J4Gl+aC4NFMUd/HbDdHFpr0hnvmR4KaHLAsSMXBoc2O6kRW1N1QLVioE3ZjumhsjGQsrEjVQdURQYCETWpOgA/9Bxy0wU/Am2egjZtqkZ8zVO+ptnKiKj5RB48VueUBE8e53HPNSPBKw99Ih1pbU5J0IbO4862YtbEi9KBiH1CJVoiTxXrlxWeJc7jnmtGgtOLngJO9bImFK0EGypTNSaHifn96NatnEYUc/TXAdvNobUmnfGe6aGAJgccO3JhgsOOfiQ1YmuqHlGtONKmbPv0RlQ2jqRs7EjVI6oiRwIRNal6BH4YOOSmCv6AQFugoE2ZqgPia4HyNcVWDoio5XFvWzGrRmSm45oRBnjlYa70O9uKWdMgK51txayJFqXnyZOsFZCF3rZiVk3ITMc1I98oHcACAZzqZXUoWgk21KXqgMjhaXxhLsw2UMzRXwdsN4fWmnTGe6aHApoccGzPhdkI2uykRmxM1dkCWj3alO2YXkDrR8rG9lSdjaAFJBBRkarzjToEv71/2d+jbOLzk28+/357e/f967vXT7759OGfDz6dtH7PEzPmqxLLV7dvfvv9frKfv32YS8k8geNHn97/w/G59yx98/7tm/e3P999yuI32fTdk//+35wbnPv6QR7Ew+FwP4huPA1GF9x5YMPX3zy6y5M66j365Wz+x4X59w+R6CdW9Ch/hfI9zPl72K9M/Ys8uPv9zS9/++7D6d/mb2Wqf/b7uuiHuuhZXfS8Lrqqi17URS/rouu6aKqLfqyLfmJFCyfYsxMOXw0bPvjXDx+xD+xJesQPlcjywyGkrx+c/+/0v1P6+jETRt/f2zpGAXHavSi6IvrHE3e8PHzz6B/YS2cLhvFSXfTiXuS9sDtMjKct4Ly3X4vf4uV5qsy3uD4vVuD/0IP/ePf28eePr3/JKeHjp9vPt5/+cfsw//Xje+/S6a/7OIb7neh9uJ+Gi/Y8sdHkVWYmNJ3/qq9739173wvOn/3tsL+Xe87V3XcvioHZc3XRc1f3Zl304l50BBxkz50nz2hdn0UDs+fOokN9/bxi98wL6PEq1YNtjrX83zR4//XJ+0P4WtxA97aPZIZ44Pxnx+qfLVF2POxw+jsu5r/D/Jlnvp4mfd1lddELj11GJxf9+MeU/ng4jM5xAX62XNlWxxxkfDRom+R/yTuH/XI/1tfwJ1a0CISg30ihulu+D3U3nrWY4H4W6l4Jda/URS9CfSPVZ3hdF00B+2l58apr/cSKFqseG7Zf3N5+3ht8vTp4M/LbLVZd+MO9KDJr9/wsYr7qVV304iyq79/jddYdt62x6XBMF2NKqGw7fjF7f/XInxhPCSaMeVccv2FwJ42Ya7/7f7+3EOz9/47DUXEYzGk5xpwmjkaSv1dO4fS/3aluNCYcFQ9uyArhYI6ClK1z2/b+K6UDEw6xXsuwokU4JHUts6onU72erIt+qIue1UXP66KruujFvSgNlSj418cHa/7og/vj8Uc7Hjx4dv7f4fS/uWLlbJC7ItZF01nEVaH1yf/EihaeG3ur0PEkrS0LCvnTHjheS81pT+TQD/zmfjZWE+PzuuiqLnpRF03n6Y/MetZFP7GixXoOh3mFnh0fZql9H0F2Jche8LLlDIaG3Dzc/0sSbiYOY84yj+a7Ci4pbxl5/+ErRu2H7b/tRuv8KfOZ+0Q7BL6EeKb4HvnmJWhsPdfYcof09XzDzti40ny3kO5tHHgbL7ZtDNaYgdN9qfj7Pt1falxOWJyNa4WN04V7vmBzFxyFjRTv19IZX0Ed9zYMc6Pw01km7sgz7Rg2mc13w/1du2Guj0/PssRVj7OMKbN+mGW1Snu+ozxGQr5wfz1fy9koP9tKwm4N9wXGqdieS4H7OxrWy88V87PhtGPybjSOj/azDfDCP55YvwQFL84fGpnFfTnLBmQg1zL5/5ZGrucPmvyRX59kvT/kP/7No1+PCsuPTvNHmevin88yJqL+pS66qYtesaJlGFp9GFohDK0QhlYIQ7vpZhOsub/ZPf1XCEO7FYZzYsjJJd9Qs2G3MZ8/sXFm1yGUwySu44x8CMXZWYah1siFmV2Gmc1hZithZoUws/Uwq4pu6qJXrGgZZk4fZk4IMyeEmRPCzG2FmfPuPrxO173Tddjf84F8W+PuLyYDeyF4Nhu/KO42JsjHnaNx59ZhRz6Dws7RsOPTm1vGnctx5ypx54S4c/W4q4pu6qJXrGgZd14fd16IOy/EnRfizvfF3fOf2UDzOwTaxoz4QLtXGr0UaF4INM9cRz0XaH4ZaD4Hmq8EmhcCzdcDrSq6qYtesaJloAV9oAUh0IIQaEEItLBroIUdAu3exlhjsd+xgRZooNl1oAUh0II20MIy0EIOtFAJtCAEWqgHWlV0Uxe9YkXLQIv6QItCoEUh0KIQaLEv0H6+ZgMt7hBoGzPiM1qkgeZJpEUh0qI20uIy0mKOtFiJtChEWqxHWlV0Uxe9YkXLSEv6SEtCpCUh0pIQaWnXSEs7RNrGjPiUlmikhXWgJSHQElOksYGWloGWcqClSqAlIdBSPdCqopu66BUrWgbaqA+0UQi0UQi0UQi0cddAG3cItFG+dp6gTDjI8GNkbkrXcUc+g+Ju1Ca4cRl3Y467sRJ3oxB3Yz3uqqKbuugVK1qeNzqo484c6nF3lrFxN8u4uJtl+8TdbO2SuDvbEOLOOzdY6W74arYhxR39DMTdLNuMu/mD57gzhz/kv83H3fxRLu7OMi7u6qKbuugVK1rG3aCPu0GIu0GIu0GIu2Ez7rYi5dlsQ4q2w/2hlXPT2R/GGEoMs9G3MS/j371jI26oRtMLKss3FGZV6L2cP4VjzloacQOOuGz7D1mzEnGDEHFDPeKqopu66BUrWkacvtlghGaDEZoNRmg2mE2Yr4i4zSZDR8RtzyvG5L6eD8Oy0VfvH7ygshxXbh18TJOBCz6zDD6Tg6/SYjBCi8HUWwx10U1d9IoVLYNP32IwQovBCC0GI7QYzGaLQRF8262F5AezOHTjTh2uanv6+da8qumu3kh4QWX54pniOuIsE3EDjTi7jDibI67SbTBCt8HUuw110U1d9IoVLSNO320wQrfBCN0GI3QbzHa3YTvitpsKq4hTpLuNeVUjrt5DeDHLIo64NUl5aZhOAxdxbhlxLkdcpc9ghD6DqfcZ6qKbuugVK1pGnL7PYIQ+gxH6DLOMjbjtPsN2xG13F9YR54LZyHEb86pGXL2Z8ILK/vEkpHXAeSbgmIuqXwaczwFX6TfMH2UDrt5vqItu6qJXrGgZcPp+gxH6DUboNxih32AWdH8hezbLmMOrzwW9K1MH+y8E2ctZxjyJcG0K5yeyyQhg39TBfl10Uxe9YkVLj+rBvhHAvhHA/ixjPRoFj0bBo3W9K1MH6C8E2ctZxno0Ch4VALqpA/S66KYuesWKlh7VA3QjAHQjAHQjAPSzjPdoEjxa17sydVL9QpC9NIRiI48mwaMCqTZ1Ul0X3dRFr1jR0qNqUv3UCDTaCDTajILXRsFrdb0rU+e8LwTZS0MYMPLaKHhN4Lymznnropu66BUrWj7SqOa8T63AcmcZ5zV7qHttlnFeE/SuZhnntVnGPZIzy7i9Nss4r80yzmu2Tknropu66BUrWnpNTUmfWoGEzjLWa4PgtUHwWl3vapaxXjvLmDP8L2cZ67VB8JpAGm2dNNZFN3XRK1a09JqaND61Ak20Ak08y3ivGcFrdb0rK1A8QfbSEniHvGYErwmIztYRXV10Uxe9YkVLr6kR3VMrYDgrYLizjPeaFbxW17uyAgoTZC8tAWDIa1bwmoC5bB1z1UU3ddErVrT0mmt4pMae4U/lkQf+kfMHpydljeEfsDmbPL11nvpbED6ThM8l4VURHh/5+vXJz//24/+4GszjHAr/k71vf8EovMgKL2oKL22dLF0XY6YYu87GrmvGJum7/FiEbDzVIVZddFMXvaqLfppFwuMqtuXJduvr3/p7SfiDJHwmCZ9LwquzMDEX1xeC7KWtQ5/r8gfZTCHM5sciZP1eZ0l10U1d9IoVLX0bWnwbqsv1/VlWca0gfCYJn0vCK2E+LyTFl5LwughZ5wqaPxYh69w6VqqLbuqiV3XRT7NI2tQtz8vbe94RhENJ6/dVnJ7hewTg+P4f5hcJsZeUM1Q5MO78QRI+k4TPi5CpWq6KMJySek7yf8z+r1xNhL/yUvor16u/kv/qH/KqV64agqEfi5ANsDrlqotu6qJXddFPlYksI0zzCH6JsHv+Eg/VCPPGH8av71/HINQlSQoiQfhMEj4vQjaIytxLWWJdLkt8rSwhn8+VSq5KKp9/Of9x5ob/ukwszqH1/+Vwq4SW8CV+LEKmEP+zreO2uuimLnpVF/1UmcgytDTvCCihdQ+JQv2tGc6n+xyV/xvLy3VOj6qG8ev5rRpsuJ0B1IG5rf9hFg7sVe88K/a+514WTWXGf7h/I8n5vRzzq9pOe+I4WevQCztOsy+p+fQt51aedW5YvOHDn04aOh9PL/M4v2jqD1yTTvreLyThS0l4LQknaTn/bOtosS66qYtesaLl+7IODUHozsxrYP7W90XIVBw/FCH3bpEi5JKW9DevpL/5QhK+lITXknCSvsqfZyHjwbropi56xYqWHhxaPHj/L146hGYO9zvw/t1ZZEem83seTk/AP34wev/Hg3Eupj8ehvz/hvJuqtNT8+aceu5tuhD8cTev3gM3vwYOPbN/ssC9tWD5DVarX8eFddFNXfSqLvqJn8fSMzNKtNvvtfyzq0OzuuimLnrFipbzm1+VqHjv5uTONIe77AqyP7s6VqqLbuqiV6xo+b1asJJz8yXsWHr8wB+e+N7NpIOryCThM0n4XBJeScIXkvClJLyWhFMRsq6sE5266KYuesWKlq5soTbOyzXS/3jg5vfu4HeHzS8Ty6XD+eYu3Wc8Ozr39f/kKibnpXAQhM8k4XNJeCUJX0jCl5LwWhJORciGQx301EU3ddErVrQMB3Jo6NmHT+9e3wcDFx1mDo7v3JkmMF/z6VkmkAHF25q2jFTe1rT9t/Vva1J8D/XbmjS2tt7WpPluW29r2rZRf1uT4u9vvq1JYWPzbU0KG1tva/ppjl/uIvuzq1K0f62L/q0u+l910b/XRf+7Lvo/ddH/rYv+9CdB9p0geyrIvhdkPwiyZ4LsuSC7EmQvBNlLQXYtyCZB9qMg+7Mg+xdBdsPKlmk7wjX6zNwGaIf+48n6eabvz5/CZ7JDMqun8H44f8rV34CqfwXYbEu6BLS+Akwxv81XgJX1wmuxfs6/fIi5KXp5FlruDbeCbOJlS78m8GtS+TVRv44+rv2advRr+gJ+3Z7ftl+Txq+p6p6XguxakE28bOnWEdw6qtw6ErfGg0lrt447unX8Am7dnt+2W0fGreunh88f4t1al10LsomXLV/tXl6h+tQfNG49fwp/lWTDereeP7WLW2dbe7pVMb9Nt5b1knbr+UOsWwXZtSCbeNnSrfDuYD9wbnVrtw6aJHz+1D5uHb6AW7fnt+3WgXGrWbt1ENxal10LsomXLd1qwK1G5VajScLnT+3jVvMF3Lo9v223Go1bjeDWuuxakE28bOlW9PMZVuXW80+6HBZ+Xb8F9ofzx/bxq/0Cft2e37ZfrSYLW8Gvddm1IJt42dKvDvzqVH51qour29Gt7gu4dXt+2251GrfOH2L96gS/1mUTL1v61YNfvcqvnvh1HBzZrn5Hv/ov4Nft+W371Wv86oXtWpddC7KJly3dGsCtgXOrX7s1qIqmsKNbwxdw6/b8tt0aGLeuX6Z6/hDv1rrsWpBNvGzpVgBNngVNxK0UNHFF046gyX8B0KSY37ZbNaDJ13nRS0F2LcgmXrZ0K3Amz3Im4takK5p2BE2zrV39ugNoKgsmEQkvgCZBdi3IJl629CuAJs+CJuJXBjQZf1i7dUfQ5L8AaFLMb9utGtDkBdAkyK4F2cTLlj8dB6ApsKBp7dZAQRNTM4UdQVP4AqBJMb9NtwYNaAoCaBJk14Js4mVLtwJoCnW28b0g+0GQPRNkzwXZVZghzjGZnE8uu/g4L2Xl5LJg7KUguxZkEy9bLh8AncACnTV+DRToMCVn2AYm6h8gCZtAZ/sVnFvzYd9mHThis85m84e4d0y8DAKyEWQTL1s6Dv3SJYtsiOOs5tY+bBMRveM2iY3CcRvz4R3HIRniOCs5TmAygmziZUvHAZMJKiZz/tRW2Ri2oYfec5tQRuG5jfnwnuOoC/GckzwnUBdBNvGypeeAugQVdQmUunBbbptq6B23SV0UjtuYD+84DqsQx3nJcQJXEWQTL1s6DrhKYLkKcRzlKlzpt80t9I7b5CoKx23Mh3ccB06I44LkOIGcCLKJly0dB+QkqMhJYI7oMNXJNpnQO26TnCgctzEf3nEcGiGOi5LjBDYiyCZetnQcsJGgYiOBnsFhkFfYRg96x22iEYXjNubDO07DPuYP8Y4T4Icgm3jZ0nEAP4IKfgQKP7hUuQ0X9I7bhB8Kx23Mh3echm7MH+IdJ+ANQTbxsuVvtAPeiCzeWO2l7yPFGwy1itv4QO24uIk3th23NR/WcZHjF2vHzR9iHRcFgCHIJl62dBwAjMielCGOoydlYhzHteO2T6LoHbd5UkbhuI358I7jjsIQxw2S4wR0IsgmXrZ0HKCTyKIT4jiKTkbn1+eH447oJO6ATrbmwztOg06ihE6igE4E2cTLlo4DdBJZdDKuHUfRCVOcxB3RSdwBnWzNh3ecBp1ECZ1EAZ0IsomXLR0H6CSy6IQ4jh5niWZwa8ftSE7iDuRkaz684zTkJErkJArkRJBNvGzpOCAnkSUnxHGUnHDXuB3JSdyBnGzNh3echpxEiZxEgZwIsomXLR0H5CRy5MQe1o5TnUiJO5KTuAM52ZoP7zgNOYkSOYkCORFkEy9bOg7ISeTICXWc6sxJ3JGcxB3IydZ8eMdpyEmUyEkUyIkgm3jZ0nFATiJHTqjjKDlhbsDjjuRktnWR43rISVkQ0XESOYkCORFkEy9bOq6Qk6s4MwD0Ns1gHuf5V15DFQUuIMgmXraYVgIukFgusFq/7xPDBeilN21yAf5XFk+vV0r3T3nXfuzwWdoBFGxNkA2wxIGC9Rn9JIGCJIACQTbxsqUnARQkFhQQT1JQwLSf0iYouMSTO5CDrQnyntQ8RJMkcpAEciDIJl629CSQg0TJAXLgGhggry3uyheyZ2lx17+QPRf0rhLctJe0lQ6P81pWzqwk6QY+CTfwgmziZcv1gxv4pLqBT6ob+LR5A8/vhOc/s6G/wy381oz40NfcwifpFj4Jt/CCbOJlS9fBLXxS3cIn1S182ryFb3LdDjfxWzPiXcfdxJOsJd3EJ+EmXpBNvGzpOriJT6qb+KS6iU+bN/FNrtvhNn5rRrzrNLfxSbqNT8JtvCCbeNnSdXAbn+htPPLY+u4duWlxi7y64CxuwVcXnLreVYI7aLjg2HzBqb3eNUl300m4mxZkEy9brh/cTSf2HAIJfdXddNq8m24K/R3up7dm9B0b+tz9NMla0v10Eu6nBdnEy5aug/vpxJ5EIK5jTiIwF5zN++km1+1wR701I951mjvq+UO864Q7akE28bKl6+AsQqJnEZDH1kcQkJtGIWuNQtaq612lkclaMWetyt39iyQdCUjCrb8gm3jZYv1GuPUf2Vv/VeSP3J1/WpOksfPO/+drLvLHHW71t2bEXq9H7lZ/HfmjdKs/Crf6gmziZUvPwa3+yN7qrz2nutMfO+/0K57b4dZ+a0a85zSHAkbp1n4Ubu0F2cTLlp6DW/uROxSwPpU/qh6nGDfPBDR5bodTAVsz4j2neQXGKEGFUYAKgmziZUvPAVQYOahAPKdiCmMnU6h4bgemsDUj3nMcUyCek5jCKDAFQTbxsqXngCmMHFMgntM9UDF2MoWK63ZgClsz4l2nORgwSkxhFJiCIJt42dJ1wBRGjimEteu8znWdTKHiuh2YwtaMeNdxTIHsOokpjAJTEGQTL1u6DpjCyB0NIK6jJwOY+6px82RAk+d2OBuwNSPec5qzAaNEM0aBZgiyiZctPQc0Y+RoBvEcAzMoxxs7YUbFczvAjK0Z8Z7THA4YJZgxCjBDkE28bOk5gBkjBzOI5yjL4O4LOllGxXM7sIytGfGe41gGyZYSyxgFliHIJl629BywjJF7riKuPUcfq+DuCzYfq2jy3A4PVmzNiPec5sGKUaIoo0BRBNnEyxaeO/4e4ey6028Tbvpu/tQGSJk/tpP3irlL3Lc5J9Z/sCySA8unWA/OUtaFknCqCFdOHJATOaRCnah6zGL+2G5O3IGqbM6p4kQNVymfqjhRICuScKoIV040yIkcXVk/cTF/aiONzh/bzYk7AJbNOVWcqHnwonyq4kQBskjCqSJcOdEiJ3KghTqRIS1cOt0VtRRzlzmxB7bAsshOlHDLLK04UQAuFeHKiQ45kWMu1ImqN4vOH9vNiTtQl805VZyo4S7lUxUnCuRFEk4V4cqJHjmRoy/D+kTh/LHNfLorfynmLvNiD4GBdZG9KDGYWVrxokBhKsKVFwPyIgdiGC9SFMPuxV1ZTDF3mRd7aAysi+xFicfM0ooXBSJTEa68GJEXOSgzrCn2/LHNvbgrlynmLvNiD5mBdZG9KLGZWVrxokBnKsKVFxPyIgdoGC8yx01oG2n+2G5e3AHSbM6p4kXNkZPyqYoXBVAjCaeKcOXFEXmRgzWMF7lXgBK4PX9sNy/uAGw251TxogbZlE9VvChAG0k4VYRLLw4I2wwctqFeHFSPvswf28uLwx7cZmtOvBcHFbcZRG4zSNxGEE4V4cqLiNsMHLdhvKg6DDN/bDcv7gFutuZU8aIK3AwiuBkkcCMIp4pw5UUEbgYO3DBepOQmBUO9uC+5GfYgN1tzqnhRRW4GkdwMErkRhFNFuPIiIjcDR24YL1J0wzycOn9sNy/ugW625lTxogrdDCK6GSR0IwininDlRYRuBg7drMuW7+ePbd1pDPuym2EPdrM1p4oXVexmENnNILEbQThVhCsvInYzsOyGepF5HIe50xj2ZTfDHuxma04VL6rYzSCym0FiN4JwqghXXkTsZmDZDfWi6hjN/LHdvLgHu9maU8WLKnYziOxmkNiNIJwqwpUXEbsZWHZDvcgdqaEtjWFfdjPswW625lTxoordDCK7GSR2IwininDlRcRuBpbdUC8y7Ia7X9yX3czmLvNiF7sp6yJ7UWQ3g8RuBOFUEa68iNjNwLIb6kXKbtj7xX3ZzbAHu9maU8WLKnYziOxmkNiNIJwqwqUXDWI3hmU369fQzh/bqm7MvuzG7MFutubEe9Go2I0R2Y2R2I0gnCrClRcRuzEsu6FeZA7dMNWN2ZfdmD3YzdacKl5UsRsjshsjsRtBOFWEKy8idmNYdkO9yPzoL3NdNPuyG7MHu9maU8WLKnZjRHZjJHYjCKeKcOVFxG4My26oF1U/GDN/bDcv7sFutuZU8aKK3RiR3RiJ3QjCqSJceRGxG8Oym/UJ8Pljm3txX3Zj9mA3W3OqeFHFbozIbozEbgThVBGuvIjYjWHZDTmManTnbsy+7MbswW625lTxoordGJHdGIndCMKpIlx5EbEbw7Ib6kUduzH7shuzB7vZmlPFiyp2Y0R2YyR2IwininDlRcRuDMtuqBcpu2Gvi/uyG7MHu9maU8WLKnZjRHZjJHYjCKeKcOVFxG4My26oF5lHo5j+otmX3czmLvNiF7sp6yJ7UWQ3RmI3gnCqCFdeROzGsD8+s3737fyxzepmX3Zj9mA3W3OqeFHFbozIbozEbgThVBEuvWgRu7Hsa2eIFy1lN1xGtfuyG7sHu9maE+9Fy7Gb9aOK5VO8F63EbgThVBGuvIjYjVW9bXb+2FaNavdlN3YPdrM1p4oXVezGiuzGSuxGEE4V4cqLiN1Y9jdqqBcZdsNwVLsvu7F7sJutOVW8qGI3VmQ3VmI3gnCqCFdeROzGsu+7pV5kHpli7jTsvuzG7sFutuZU8aKK3ViR3ViJ3QjCqSJceRGxG8u++pZ6kWM3tEts92U3dg92szWnihdV7MaK7MZK7EYQThXhyouI3ViO3TBeZM7dMDWq3Zfd2D3YzdacKl5UsRsrshsrsRtBOFWEKy8idmM5dmPWb9ibP7aZUfdlN3YPdrM1p4oXVezGiuzGSuxGEE4V4cqLiN1Yjt0wXtSxG7svu7F7sJutOVW8qGI3VmQ3VmI3gnCqCFdeROzGUnaDnbdGNthjCyayED4rQsbqc0nzCiaE3vU6Hh4f17XysteiUllLiaAIwqkiXK0lIiiWIyjkgLbVARS7L0CxewCUrTmxLzyGZZFvvUWAYiWAIgininDpRIcAiuMACnGi0/ETty8/cXvwk6058U50Kn7iRH7iJH4iCKeKcOVExE8cx09Io9Zx75uhxb7bF5+4PfDJ1pz4S5NT4RMn4hMn4RNBOFWEKycifOI4fEK6Co55aonbifvSE7cHPdmaU2UnquiJE+mJk+iJIJwqwpUTET1xlJ5g562hCfbYgkqs6gu34B6r+kLQvIIJofoiXyQeHxe2VmA4EWI4CWIIwqkiXC0mghiOgxh0R6h+v2f+2G47Yg+GsT0n79xgvxZ+AO0KVkneICLScBLSEIRTRbjyKUIajiIN7Ms1ycAO9NIG8dIGqWtewYTwBnHuuEFcdYOIZMFJZEEQThXhajERWXC6t7E4hiwwJbjblyy4PciCYk7Rh8PRyGiNq+wQFWhwImhwEmgQhFNFuHIqAg2OggbsyzVfwA6M0g6J0g6pa17BhBY7JFQ3h3ir76RbfUE4VYSrdUS3+o49pkFvbZhHbLjLx/Yxja1oflaMSFviqHyMZmfDKe+PMZSdxm+RjZkZ/+4dvy3oeQ3sRkoZ6CmXl/PHKv6UcAMvXPkT4Qane1GKYx62YY7duG3eoPCngjK0+3NjZnV/UvCA/UmBA+tPiTwIwqkiXPrTI/LgdY/deOaxG2Z/+m30sO1PrwAOzf7cmlnVn54yCORPT9kD508vQQhBOFWEK38iCOHZQxzkKI7XvTzFb1MIhT8V7KHdnxszq/uT4gjsT4oh/vHEOuJPiUcIwqkiXPkT8QjPHucgDQ+vAxJ+G0go/KnAEO3+3JhZ3Z+UTGB/UiLB7k8JTQjCqSJc+ROhCc8e7CDXT08PdnCHrPz2wQ6FPxXHOdr9uTGzuj/pCQ/sTwpFWH9KdEQQThXhyp+Ijnj2iAf1p+61uH4bjyj8qYAi7f7cmFndnxSMYH9SIML6UyIjgnCqCFf+RGTEs4c9yMPkXvegjt8+7KHwp+KIR7s/N2ZW9yc99YH9SZkM608JzgjCqSJc+RPBGc8e+yD40lM4w/pzG4Qo/KlAMu3+3JhZ3Z8Uy2B/UhzD+lPiMoJwqghX/kRcxrMHQKg/mRevMMdb/fYBEIU/Fcc+2v25MbO6P+lJEOxPioXY+lbiQ4JwqghX/kR8yHN8iPEn5UPcC+b8HnxoNrKvP3v5UFkg3p86PuQlPiQIp4pw5U/Ehzz7QA/5mQDPvUjXH4g/9+BD/kvwoa2Z1f0p8iGv40Ne4kOCcKoIl/4MiA8F9tEe4s+ge6Vu2IMPhS/Bh7ZmVvVnEPlQ0PGhIPEhQThVhCt/Ij4UWD5E/Un50Oj8QPy5Bx8KX4IPbc2s7k+RDwWODzH+lPiQIJwqwpU/ER8KLB8aiT+Zx30Yfhv24EPhS/ChrZnV/SnyoaDjQ0HiQ4JwqghX/kR8KLC/SU34bVD9KvX8sQv9+SX40NbM6v4U+VDQ8aEg8SFBOFWEK38iPhTYX6qm/qR8iKtvwx58KHwJPrQ1s7o/RT4UdHwoSHxIEE4V4cqfiA8F8eRMEE7OBOnkTFgwntW5AEHzCibErx/wmPnUwLGp/Pi4svzRgZezTmUxJTjDC1eLieBM0D2TE3TP5IQ94Ez4EnBGMbMYk7s/03M48Odngghqgg7UBAnUCMKpIlz5FoGawIEaJvFRUMOBt7AHqAlfAtQoZqbwrQhtAgdtGN9K0EYQThXhyrcI2gTx+Z0gPL8TpOd3ZiGfBKXnd8qE+PVLTBIM4ZgEK4/3vJx1KospERNeuFpMREyC7vW1QffTQ2EPYhK2iUnyw9GINzbdn/vL5k4b5RBSZaP0EpMgEpOgIyZBIiaCcKoIl/6MiJhElpiQ46BRd6Im7kFM4jYxaffn1syq/owiMYk6YhIlYiIIp4pw5U9ETCJLTMj+PH/M42nHgyUlfNwDmcRtZNLh0F5kEkVkEnVHaqKETAThVBGuHIqQSWSRCXWo7khN3AOZxG1k0uHPXmQSRWQSOWTC+FNCJoJwqghX/kTIJLJHaqg/db9RFPdAJnEbmXT4sxeZRBGZRA6ZMP6UkIkgnCrClT8RMonskRqCNCPzxBGDwOIeyCRuI5MOf/Yikygik6hDJlFCJoJwqghX/kTIJLJHaqg/mfencAXRHkdqov8S/uw9UhNFhBO9zp8StRGEU0W48ieiNpGlNtSfuued4h7UJm5Tmw5/9h6piSKpiTpSEyVSIwininDlT0RqovioUxQedYrSo05xQVtWd/OC5hVMiF8/oCHobn58fFzZ2t18lNCIIJwqwtViIjQS2eedaDFCz7Nw2CvucZ5lNqLfHArstTWz+uYQUc0s3docEp0RhFNFuPInojNRR2ciQ2e4YmQPOhOb6YzGn710Jop0JuroTJTojCCcKsKlPxOiM0lHZ5KOzqQ96ExqpjMKf27NrOrPJNKZpKMzSaIzgnCqCFf+RHQm6V5am7i3rtBiJO0BZ1IznNH4sxfOJBHOJB2cSRKcEYRTRbjyJ4IzSff62qSDM2kPOJOa4YzGn71wJolwJunOsyQJzgjCqSJc+RPBmcTCGXKzkHTnWdIecCY1wxmNP3vhTBLhTNKdZ0kSnBGEU0W48ieCM0kHZ5LudTBpDziTmuGMxp+9cCaJcCbp4EyS4IwgnCrClT8RnEk6OJMYOMNdP/eAM6kZzmj82Qtnkghnkg7OJAnOCMKpIlz5E8GZROEMduOayWDfLXDH6mY+LQDL6mZe0LyCCfHrBzAEbubj8XxS8rWb+SSREUE4VYSrxURkJOkeNkq6h43SHmdYUmzeHC6YDdK1NbP65hBJTYq6zSHBGUE4VYQrfyI4k3QPGyXdw0ZpDzgzG9nXn71wpiwQ708dnEkSnBGEU0W48ieCM4l92IhevHRwJu0BZ1I7nFH4sxfOJBHOJB2cSRKcEYRTRbj054jgzMjCGeLPUQdnxj3gzNgOZ7b9uTWzqj9HEc6MOjgzSnBGEE4V4cqfCM6MFM5gN66ZDPbdAnesipFxAVhWxYigeQUT4tcPYAgUIyk+Pq5srRgZJTIiCKeK8H4xH33+/fb27vvXd6+ffPPu9tNvt09v3779/OCXD39/nz97+nnY8s8PPt3+mhfbjo9/cIeHj4jk2rrHk3WM5MqGxy9tYCQv0uMpsbZCtsVpXFufJZ6z5R9fc/9+ZWP+65HTsFnA/PtTl/+G42w9z99+Yr/90/ztn7PzepZ1nlV0QtZh1yU+nrgZPx0eTwM747z2jlv7py6rOE7nh/j4Gfs3bMqz4r2S3cVKnuY1fs6u8XWWTKzkB/v42Wn1H0HkPfnm46c37+/+5ePdmw/vPz/4/cOnN//14f3d67dPb9/f3X66/WveNUeVj69/u/3x9aff3uQPvb39Ncfq4athDMkf7Gjj4RDT8fDApze//V4R3X34eBSMyRkP0ocP/vLh7u7DO17n99vXf73NWyonp18/fLi7H54n8/Pt3d8/PsjTzfN8fZz8tw8/fvh09+n1m7uHDz6+/nj76ec3/3X77cN8ofrL29e//O1P7//677+/ubs9f5+8Gb/7dPv6b2Xr5T377vX7v79+e/rnp/M/PvnmL5/+9uBNXobj+6bfvcl/xhw/+R/5v6fB+7PBR8VizgMf3jYaP6atk/HD2bhfGi8W8/ifHz797ZRFnvw/UEsDBBQAAAAIABm4EF0WODlC4QcAAH9wAAANAAAAeGwvc3R5bGVzLnhtbO1dT4vbRhT/KkILJSndSLJsrdVdL2kNC4UWQpNDIQ6LbMu2qP64shx2cwqhLZQeSmB7KGmgh9JS6C0J9LCfpses8x2qkWRb8s7TjqUZeRRqs1iamffeb9578+/NSHs0C85t8/7ENAPhzLHdWUecBMH0Y0maDSamY8zueFPTDXNGnu8YQXjrj6XZ1DeN4QwRObbUkGVNcgzLFY+P3Llz4gQzYeDN3aAjHqyShPjns2FHVLSmKMTsut7Q7IjyqSBK2IKtbMGe0tvf2wPKatmyp/sfCnsf7e3Jp/uHvdQ1Sv/gm7kXHO7HP1Ha3dN9gO1Blm1M8++zv+KLmOvtw94tXEbvNsC0nWV6Hn5isqvvvo0veoITXyxeXCxThknKy8v44vAuwF7f0O8dBPHhl+bwUe9WeAPBOpA31N1cqltK7Hp8NPLctXkVZF+UEnIzHFN4bNgd8erP54uXT4W3r367uvgZEQ8mhj8L3SvKVRo6ShsZjmWfx0lqVMizPV8IQpcLBSsoZfYkoYjvkDcmEhzL9fwIViz7GoKffly8eEosOisI4lnXWukMFCXT45mjoVwpJcxhuUPzzAwdvs3Y+kvW7YpM3abHsp9kk2uIAn/G+Cm2BFg98/hmZrlj28wR+PbN66s/LssJzGsgNPjn2ZsCf4r2uKmfTaREP2gQs2x7NYg1xTjh+GhqBIHpuyfhTUQTJV7LEpLrB+fTUNjYN86VRkskJph5tjVEIsfdNOjIlv0kbdVDhTMlxDjFrKgYf9zviCfRR95aVvQT6q3v+UPTX2mugYb/OO34yDZHQUjvW+MJ+g28KRLiBYHnhBdDyxh7rhHpdUmRphSiaWhHDCbRNHKAhYYKJhKIykclIyhExcNyS8RE5eOi5HWbGJZPUjcpAzmXCgM5tzwpZGlDzblM12rexuKbIobevB/2mFsIIaTcts4SUymE7K65A+taFzfDFq27cKVZ+hMhQaqpbYFGYieiqFKZguGk/y5sIQYC6l5VqmNhRUphMn6T+nb5votQKywnWMCoQ9UJqpBRVKU79SCO/IAr/ZEPddzMKquEXtT80dpQTj5EDnCd4oa++jrBTb31dYqlylcVSy7ChenAtO37iMlXo8zew9koFd+OottudNkIL8MlbZIas0lujOnUPv/EtsauY0Yx7pCNsbwVHpt+YA1QYGEQ3ppxEO9sBEtSQEnSzuA1lbUorTpR5KpoNkoqECYqWisp7WKxw6V8TWk0crxN3gaNMLUee8Gn89DX3agI2uox7/nmyDqL7s9GMS0jtywOqWRLUTmBpK4hNQFICjvDCbOJb7lfP/BOrCAJZZJCbLCBOPF860koDYGMenmxIOpk35edahsg7iVMusArUHg54DJbfavM9N2qsg2y1jc1N2Hl3ynYrRrBrrSjrk8vyMq5kxM27Abr5tYKLzqlaFCbUhCp98bJGIsJYpGpT8bECvs5IhXtQUYu04ZKK4+XyWylU34aTRZCSa/JUnMwla92UJPmWkFnVxxnctwzRqozANoq2Ya3igyVVh4KAxYwMaS4Aw4snFYmi05aK2dgFj7HQnXQxHWHqoP6P868rloLF2zBOWMJKaLN6Gxy6D3h32LuPzS0wL63pWYZvR5eruzezTMLcPaLB6Zzu6rXOClIYICrzEx9lxEuHnEnj/LUOvIMdQVtvppYXXoC9l0BFZx12t/B9w7cw84EnOq1v6NhhzZ1p+G7A8beW69NPqVS7+XlOAK0OUPNMytwAs4DbOlVIPsoAsNolsLZiFvxkos6Ts7mgzxH4jJhaiZRihb1WArUxVds9q17U062VajhrjgcSg23xkG7I8HZqgnOJl84eV5+E+3s8wC00ogh20kLXzC5jrqQndrhAWlKo9AipSYwZfIFX/5GWC2WQKCxqKmB3/3Ausy1uT+6Ap7sqnjGtO2MFHL+g+K+T6QWziZokBpaVNQAcW9S4Q6eA+ZhUUH0tEMppDuMPJfCzWr/gTXuHe5TcYmbKKrOpYcTPfnFJXKCRwQZ4S71dAzBMz0UYZduhhUMLNQeWuXR3ETnW7hsX/gxhB7uqvti/kcR/Oj3v8Yr8XFofo5wF48AEBzE5GSKThAArg/SMlGAkqdGwUgS22WkUspNaxL9r08cuJbPmYK+pbJ1XTohEJC9zpR9Q2bLfosxsgj7Eqaty+PytT33WOPjrzV9nQyf53bfi/dp7PAArJS8yyz1Fr3MO/RWqQJ6PX9HfPf818XvT9faEfpzyw4sd9UN4glOFVlWFy8uFi8vr169zjwniCcQmuuVGabQ4ofLsJzwUH4kNNYt9oaCgrruPXGCv3/z7peLLM9WTpUWz/6+evXPuqwWKXWtxuOjwOjbZlanocaG5siY28GDVWZHXF9/YQ6tudNYlbqHjJ2UWl9/jvp4JRIYvS8xlJW8IbKb3Prjfhf/JsXNnPjfAuBzIJo4D5+D8iA5EAKIJqaC5LxP9WmD9YnzIGxtbE4bpGmDNDEVLqcbfSE5eBo9/OBrquuqqmmQRrtdLIIupDdNQ394bhA2RAHJQZK20zVsbdhD8v0Asmmeh0A1hT0Rqimsa5SD1xui0HW8tSE5iAKyAuQ7SD5eDvIpPI2qIqtC2KAWDOfoOpSDfBHvo5oGaEdDX7x9oFaiqrqOz0F5eASqCuWg1gjnQAgQBihHjcZhaWM8kpbjlLT+l4PH/wFQSwMEFAAAAAgAGbgQXZeKuxzAAAAAEwIAAAsAAABfcmVscy8ucmVsc52SuW7DMAxAf8XQnjAH0CGIM2XxFgT5AVaiD9gSBYpFnb+v2qVxkAsZeT08EtweaUDtOKS2i6kY/RBSaVrVuAFItiWPac6RQq7ULB41h9JARNtjQ7BaLD5ALhlmt71kFqdzpFeIXNedpT3bL09Bb4CvOkxxQmlISzMO8M3SfzL38ww1ReVKI5VbGnjT5f524EnRoSJYFppFydOiHaV/Hcf2kNPpr2MitHpb6PlxaFQKjtxjJYxxYrT+NYLJD+x+AFBLAwQUAAAACAAZuBBdS7o42pcBAAC7AgAADwAAAHhsL3dvcmtib29rLnhtbI1S207bQBT8FXcViadiOw0RiWJLFagFCbURIHhEG+9xfMRerN0THHjuR/DEF/TTyj9wbGMI4qVPuzNnd2Y0u4vG+duVc7fR1mgbMlER1fM4DkUFRoZ9V4PlSem8kcTQr+NQe5AqVABkdDxOkmlsJFqRLwatpY/zRbu5QmjCO9/C6A4DrlAj3Wei22sQkUGLBh9AZSIRUahcc+I8PjhLUl8U3mmdibQfXIEnLD7RF22eS7kKHbO9Rqtck4nx4fSQFe8H/DUdM2w6dI2KKj5yMJm8cSeA64pY4+DbjEmSq3NJ6DIxTRiW6AN1Tl1OWRDeAZv2aEPuB2oCfywJfnq3qdGu2zjcRrxTR1fdsPa9z/3/NO/KEgs4dsXGgKW+eg+6DWhDhXUQkZUGMvHv6e/z45+2GHY4VX1JxKl2Kvdz5IE/VX2+IZSCEi2oX6zzEb1K32y1NftLj5ZuvvNHEJF27WsMTonI93r7vS+jo1E6H52NJuki3lHKPyB24fvF0kft0oWdpcl4xm1vtD5i7rc9c1INRQ6fKX8BUEsDBBQAAAAIABm4EF0kHpuirQAAAPgBAAAaAAAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHO1kT0OgzAMha8S5QA1UKlDBUxdWCsuEAXzIxISxa4Kty+FAZA6dGGyni1/78lOn2gUd26gtvMkRmsGymTL7O8ApFu0ii7O4zBPahes4lmGBrzSvWoQkii6QdgzZJ7umaKcPP5DdHXdaXw4/bI48A8wvF3oqUVkKUoVGuRMwmi2NsFS4stMlqKoMhmKKpZwWiDiySBtaVZ9sE9OtOd5Fzf3Ra7N4wmu3wxweHT+AVBLAwQUAAAACAAZuBBdZZB5khkBAADPAwAAEwAAAFtDb250ZW50X1R5cGVzXS54bWytk01OwzAQha8SZVslLixYoKYbYAtdcAFjTxqr/pNnWtLbM07aSqASFYVNrHjevM+el6zejxGw6J312JQdUXwUAlUHTmIdIniutCE5SfyatiJKtZNbEPfL5YNQwRN4qih7lOvVM7Ryb6l46XkbTfBNmcBiWTyNwsxqShmjNUoS18XB6x+U6kSouXPQYGciLlhQiquEXPkdcOp7O0BKRkOxkYlepWOV6K1AOlrAetriyhlD2xoFOqi945YaYwKpsQMgZ+vRdDFNJp4wjM+72fzBZgrIyk0KETmxBH/HnSPJ3VVkI0hkpq94IbL17PtBTluDvpHN4/0MaTfkgWJY5s/4e8YX/xvO8RHC7r8/sbzWThp/5ovhP15/AVBLAQIUAxQAAAAIABm4EF1Gx01IlQAAAM0AAAAQAAAAAAAAAAAAAACAAQAAAABkb2NQcm9wcy9hcHAueG1sUEsBAhQDFAAAAAgAGbgQXfm/2KgyAQAAjAIAABEAAAAAAAAAAAAAAIABwwAAAGRvY1Byb3BzL2NvcmUueG1sUEsBAhQDFAAAAAgAGbgQXUAP8jrzBQAAjRoAABMAAAAAAAAAAAAAAIABJAIAAHhsL3RoZW1lL3RoZW1lMS54bWxQSwECFAMUAAAACAAZuBBdzD9CwkpQAABzwAIAGAAAAAAAAAAAAAAAgIFICAAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sUEsBAhQDFAAAAAgAGbgQXRY4OULhBwAAf3AAAA0AAAAAAAAAAAAAAIAByFgAAHhsL3N0eWxlcy54bWxQSwECFAMUAAAACAAZuBBdl4q7HMAAAAATAgAACwAAAAAAAAAAAAAAgAHUYAAAX3JlbHMvLnJlbHNQSwECFAMUAAAACAAZuBBdS7o42pcBAAC7AgAADwAAAAAAAAAAAAAAgAG9YQAAeGwvd29ya2Jvb2sueG1sUEsBAhQDFAAAAAgAGbgQXSQem6KtAAAA+AEAABoAAAAAAAAAAAAAAIABgWMAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAhQDFAAAAAgAGbgQXWWQeZIZAQAAzwMAABMAAAAAAAAAAAAAAIABZmQAAFtDb250ZW50X1R5cGVzXS54bWxQSwUGAAAAAAkACQA+AgAAsGUAAAAA";
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
          const M3_LIST = ["모래","13mm","25mm","40mm","혼합","석분"];
          const isM3 = M3_LIST.includes(r.work?.material) || (r.work?.unit==="㎥"||r.work?.unit==="m³");
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

        // 데이터 입력 (얇은 테두리 포함)
        const thinB = { style: "thin", color: { rgb: "000000" } };
        const dBorder = { top: thinB, bottom: thinB, left: thinB, right: thinB };
        const dS = { font:{name:"돋움",sz:10}, alignment:{vertical:"center"}, border: dBorder };
        const setCell = (addr, val, t) => {
          ws[addr] = ws[addr] ? {...ws[addr], v:val, t:t||"s", f:undefined, s:{...dS,...(ws[addr].s||{}), border: dBorder}} : {v:val, t:t||"s", s:dS};
        };
        const setFormula = (addr, f) => {
          ws[addr] = ws[addr] ? {...ws[addr], v:0, t:"n", f, s:{...dS,...(ws[addr].s||{}), border: dBorder}} : {v:0, t:"n", f, s:dS};
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

        // 상세 데이터 영역(47행~) 전체 삭제 — 템플릿에 박힌 이전 데이터 완전 제거
        Object.keys(ws).forEach(key => {
          if (key.startsWith("!")) return;
          const rowNum = parseInt(key.replace(/[A-Z]/g, ""), 10);
          if (!isNaN(rowNum) && rowNum >= 47) delete ws[key];
        });

        // 상세 데이터 (47행~) — 갑지 현장 순서 그대로, 각 현장 내 날짜→차량번호순
        // groups 순서: 개수품목 먼저, m3 나중 (갑지와 동일)
        const detailRows = [];
        groups.forEach(g => {
          const groupRows = rows.filter(r => {
            const M3_LIST = ["모래","13mm","25mm","40mm","혼합","석분"];
            const isM3 = M3_LIST.includes(r.work?.material) || (r.work?.unit==="㎥"||r.work?.unit==="m³");
            return r.from===g.from && r.to===g.to && r.work?.material===g.mat && isM3===g.isM3;
          }).sort((a,b) => {
            const dCmp = (a.date||"").localeCompare(b.date||"");
            if (dCmp !== 0) return dCmp;
            return (a.vehicle||"").localeCompare(b.vehicle||"");
          });
          detailRows.push(...groupRows);
        });
        // 현장별 소계 행 포함해서 작성
        const M3_LIST_D = ["모래","13mm","25mm","40mm","혼합","석분"];
        const isM3byMat = (mat, unit) => M3_LIST_D.includes(mat) || unit==="㎥" || unit==="m³";
        let detailRowIdx = 47;
        groups.forEach(g => {
          const groupRows = detailRows.filter(r => {
            const rm3 = isM3byMat(r.work?.material, r.work?.unit);
            return r.from===g.from && r.to===g.to && r.work?.material===g.mat && rm3===g.isM3;
          });
          // 데이터 행
          groupRows.forEach(row => {
            const ri = detailRowIdx;
            const day = row.date ? (parseInt(row.date.split("-")[1])+"-"+String(parseInt(row.date.split("-")[2])).padStart(2,"0")) : "";
            const isM3 = isM3byMat(row.work?.material, row.work?.unit);
            const qty = Number(row.work?.qty)||0;
            setCell("C"+ri, day||"", "s");
            setCell("D"+ri, row.vehicle||"");
            setCell("E"+ri, row.from||"");
            setCell("F"+ri, row.to||"");
            setCell("G"+ri, row.work?.material||"");
            // 수량/㎥ 둘 중 하나만 입력 (품목 기준으로 판단)
            if (!isM3) { setCell("H"+ri, qty, "n"); setCell("I"+ri, "", "s"); }
            else { setCell("I"+ri, qty, "n"); setCell("H"+ri, "", "s"); }
            detailRowIdx++;
          });
          // 소계 행 (노란색) - 수량/m3 SUM 수식으로 합산
          const subRi = detailRowIdx;
          const dataStartRi = subRi - groupRows.length;
          const dataEndRi = subRi - 1;
          const yellow = { patternType:"solid", fgColor:{ rgb:"FFFF00" } };
          const subThin = { style: "thin", color: { rgb: "000000" } };
          const subBorder = { top: subThin, bottom: subThin, left: subThin, right: subThin };
          const yS = { font:{name:"돋움",bold:true,sz:10}, fill:yellow, alignment:{horizontal:"center",vertical:"center"}, border: subBorder };
          const yR = { font:{name:"돋움",bold:true,sz:10}, fill:yellow, alignment:{horizontal:"right",vertical:"center"}, border: subBorder };
          "CDEFGHIJKL".split("").forEach(c => {
            ws[c+subRi] = { v:"", t:"s", s:yS };
          });
          if (groupRows.length > 0) {
            if (!g.isM3) {
              ws["H"+subRi] = { f:`SUM(H${dataStartRi}:H${dataEndRi})`, t:"n", v:g.qty, s:yR };
            } else {
              ws["I"+subRi] = { f:`SUM(I${dataStartRi}:I${dataEndRi})`, t:"n", v:g.qty, s:yR };
            }
          } else {
            if (!g.isM3) { ws["H"+subRi] = { v:g.qty, t:"n", s:yR }; }
            else { ws["I"+subRi] = { v:g.qty, t:"n", s:yR }; }
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
  const downloadByVehicle = (customPrices = {}) => {
    // XLSX imported
    

    // 기사정산: 관리자 화면에서 설정한 날짜 범위 사용
    const [vStartD, vEndD] = getPeriodRange();
    const inVRange = r => r.date && r.date >= vStartD && r.date <= vEndD;
    const vReportRecs = records.filter(r => r.type === "report" && inVRange(r) && r.status !== "pending");

    const byVehicle = {};
    vReportRecs.forEach(r => { if (!byVehicle[r.vehicle]) byVehicle[r.vehicle] = []; byVehicle[r.vehicle].push(r); });
    if (Object.keys(byVehicle).length === 0) { alert("정산할 일보가 없습니다."); return; }

    const thin = { style: "thin", color: { rgb: "000000" } };
    const bdr = { top: thin, bottom: thin, left: thin, right: thin };
    const SB = (bold, align, sz) => ({
      font: { name: "돋움", bold: !!bold, sz: sz || 10 },
      alignment: { horizontal: align || "left", vertical: "center" },
      border: bdr,
    });
    const S = (bold, align, sz) => ({
      font: { name: "돋움", bold: !!bold, sz: sz || 10 },
      alignment: { horizontal: align || "left", vertical: "center" },
    });
    const C2 = (ws, addr, val, style) => { ws[addr] = { v: val, t: typeof val === "number" ? "n" : "s", s: style }; };
    const CF = (ws, addr, formula, style) => { ws[addr] = { f: formula, t: "n", s: style }; };

    const wb = XLSX.utils.book_new();
    const monthStr = `${vStartD} ~ ${vEndD}`;

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
        const locKey = (row.from||"") + "||" + (row.to||"");
        const price = customPrices[locKey] || getPrice(row.from, row.to, row.work?.material) || 0;
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
        CF(ws1, `L${r}`, `IFERROR(K${r}*H${r},0)+IFERROR(K${r}*I${r},0)`, SB(false, "right"));
      });

      // 합계행
      const totalRow = sortedV.length + 2;
      C2(ws1, `A${totalRow}`, "", SB(false));
      ws1[`B${totalRow}`] = { v: parseInt(vStartD.split("-")[1]), t: "n", s: SB(false) };
      C2(ws1, `D${totalRow}`, Number(vehicle) || vehicle, SB(false));
      CF(ws1, `L${totalRow}`, `SUM(L2:L${totalRow - 1})`, SB(true, "right"));

      ws1["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRow, c: 11 } });
      XLSX.utils.book_append_sheet(wb, ws1, vehicle.slice(0, 31));
    });

    xlsxDl(wb, `기사정산_${vStartD}_${vEndD}.xlsx`);
  };

  // 일보 수정 저장
  const [editSaved, setEditSaved] = useState(false);
  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      await window.sbRecords.upsert(editing);
      // 로컬 records만 업데이트 (화면 유지)
      setRecords(prev => prev.map(r => r.id === editing.id ? editing : r));
    } catch {}
    setEditSaving(false);
    setEditSaved(true);
    setTimeout(() => setEditSaved(false), 1500);
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
    <>
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
                    {(materials||DEFAULT_MATERIALS).map(m=><option key={m}>{m}</option>)}
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
              <Btn outline color={C.muted} onClick={()=>{ setEditing(null); onRefresh(); }} style={{flex:1}}>닫기</Btn>
              <Btn onClick={saveEdit} style={{flex:2}} disabled={editSaving}>{editSaving?"저장중...":editSaved?"✅ 완료!":"저장"}</Btn>
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
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>🚛 차량 조회 (선택)</div>
          <select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)}
            style={{ width: "100%", background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 14, outline: "none" }}>
            <option value="">전체 차량</option>
            {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
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
            <Btn onClick={() => setShowAddModal(true)} color={C.green} style={{ flex: 1 }}>➕ 일보추가</Btn>
            <Btn onClick={downloadAll} style={{ flex: 1 }} disabled={reportRecs.length === 0}>📥 전체CSV</Btn>
            <Btn onClick={() => downloadByClient("mid")} color={C.blue} style={{ flex: 1 }} disabled={reportRecs.length === 0}>📤 25일마감</Btn>
            <Btn onClick={() => downloadByClient("end")} color={C.blue} style={{ flex: 1 }} disabled={reportRecs.length === 0}>📤 말일마감</Btn>
            <Btn onClick={() => setShowPriceModal(true)} color={C.purple} style={{ flex: 1 }} disabled={reportRecs.length === 0}>🚛 기사별 정산</Btn>
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

          {/* 품목 관리 */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>📦 품목 관리</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>품목을 추가하거나 X로 삭제할 수 있어요.</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={newMaterial} onChange={e => setNewMaterial(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newMaterial.trim()) { setMaterials(prev => [...prev, newMaterial.trim()]); setNewMaterial(""); }}}
                placeholder="새 품목 입력"
                style={{ flex: 1, background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none" }}
              />
              <Btn onClick={() => { if (newMaterial.trim()) { setMaterials(prev => [...prev, newMaterial.trim()]); setNewMaterial(""); }}}>추가</Btn>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(materials||DEFAULT_MATERIALS).map(m => (
                <div key={m} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card2, borderRadius: 8, padding: "6px 10px", border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.text }}>{m}</span>
                  <button onClick={() => setMaterials(prev => prev.filter(x => x !== m))}
                    style={{ background: "none", border: "none", color: C.danger, fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
          </Card>

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
    {/* 기사별 정산 단가 입력 모달 */}
    {/* 관리자 일보 직접 추가 모달 */}
    {showAddModal && <AdminAddModal
      vehicles={vehicles}
      locations={locations}
      materials={materials}
      onClose={() => setShowAddModal(false)}
      onAdd={async (rec) => {
        try {
          await onSaveExpense(rec);
          await onRefresh();
          setShowAddModal(false);
          alert("일보가 추가됐습니다.");
        } catch(e) {
          alert("저장 실패: " + (e?.message || JSON.stringify(e)));
        }
      }}
    />}
    {showPriceModal && <PriceInputModal
      reportRecs={reportRecs}
      customPrices={customPrices}
      setCustomPrices={setCustomPrices}
      onClose={()=>setShowPriceModal(false)}
      onConfirm={()=>{ const p = {...customPrices}; setShowPriceModal(false); setTimeout(()=>downloadByVehicle(p), 100); }}
    />}
    </>
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
  const [materials, setMaterialsState] = useState(DEFAULT_MATERIALS);
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
      try { const mat = await window.storage.get("dump_materials"); if (mat?.value) setMaterialsState(JSON.parse(mat.value)); } catch {}
      // 상·하차지 목록은 기사/관리자 모두 불러옴
      try {
        // id=6 레코드를 직접 fetch로 조회
        const locRes = await fetch(
          `${window.sbRecords.url}/rest/v1/records?id=eq.6&select=data`,
          { headers: { apikey: window.sbRecords.key, Authorization: `Bearer ${window.sbRecords.key}` } }
        );
        const locArr = await locRes.json();
        const locData = Array.isArray(locArr) && locArr.length > 0 ? locArr[0].data : null;
        const locWork = locData?.work || locData;
        if (locWork && locWork.loc_from_excluded !== undefined) {
          // 새 방식으로 저장된 경우
          const parse = s => { try { return JSON.parse(s||"[]"); } catch { return []; } };
          setLocationsState({
            from: parse(locWork.loc_from),
            to:   parse(locWork.loc_to),
            from_excluded: parse(locWork.loc_from_excluded),
            to_excluded:   parse(locWork.loc_to_excluded),
          });
        } else {
          // 기존 window.storage 방식 폴백
          const l = await window.storage.get("dump_locations");
          if (l?.value) {
            const parsed = JSON.parse(l.value);
            setLocationsState({
              from: parsed.from || [],
              to: parsed.to || [],
              from_excluded: parsed.from_excluded || [],
              to_excluded: parsed.to_excluded || [],
            });
          }
        }
      } catch (e) { console.error("locations 로드 실패:", e); }
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
    await window.sbRecords.upsert(rec);
    // 저장 확인: DB에서 직접 조회해서 검증
    try {
      const chk = await fetch(`${window.sbRecords.url}/rest/v1/records?id=eq.${rec.id}&select=id`, {
        headers: { apikey: window.sbRecords.key, Authorization: `Bearer ${window.sbRecords.key}` }
      });
      const arr = await chk.json();
      if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error("저장 확인 실패 - DB에 저장되지 않았습니다");
      }
    } catch (e) {
      if (e.message.includes("저장 확인 실패")) throw e;
      // 네트워크 오류 등은 무시 (저장은 됐을 수 있음)
    }
    setRecords(prev => [...prev, rec]);
    // 상·하차지 자동 목록 추가
    if (rec.type === "report") {
      updateLocations(prev => {
        let next = prev;
        // 기사가 직접 입력한 현장은 제외목록에서 자동 해제하고 목록에 추가
        if (rec.from) {
          const exFrom = (next.from_excluded || []).filter(x => x !== rec.from);
          if (!next.from?.includes(rec.from)) {
            next = { ...next, from: [...(next.from||[]), rec.from], from_excluded: exFrom };
          } else if (exFrom.length !== (next.from_excluded||[]).length) {
            next = { ...next, from_excluded: exFrom };
          }
        }
        if (rec.to) {
          const exTo = (next.to_excluded || []).filter(x => x !== rec.to);
          if (!next.to?.includes(rec.to)) {
            next = { ...next, to: [...(next.to||[]), rec.to], to_excluded: exTo };
          } else if (exTo.length !== (next.to_excluded||[]).length) {
            next = { ...next, to_excluded: exTo };
          }
        }
        return next;
      });
    }
  };

  const refreshRecords = async () => {
    // 초기 로딩이 아닌 갱신이므로 loading 화면을 띄우지 않음 (AdminDash 마운트 유지 → 조회 조건 보존)
    const recs = await window.sbRecords.getAll();
    setRecords(recs.filter(r => r.type !== 'settings'));
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

  const updateMaterials = fn => {
    setMaterialsState(prev => { const next = typeof fn === "function" ? fn(prev) : fn; window.storage.set("dump_materials", JSON.stringify(next)).catch(()=>{}); return next; });
  };

  const updateLocations = fn => {
    setLocationsState(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      // upsert로 저장 - data 컬럼에 전체 record가 저장됨
      window.sbRecords.upsert({
        id: 6,
        type: "settings",
        date: "dump_locations",
        vehicle: "SETTINGS",
        status: "settings",
        work: {
          loc_from: JSON.stringify(next.from||[]),
          loc_to: JSON.stringify(next.to||[]),
          loc_from_excluded: JSON.stringify(next.from_excluded||[]),
          loc_to_excluded: JSON.stringify(next.to_excluded||[]),
        },
        savedAt: new Date().toISOString(),
      }).catch(()=>{});
      return next;
    });
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
            materials={materials}
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
                materials={materials} setMaterials={updateMaterials}
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
