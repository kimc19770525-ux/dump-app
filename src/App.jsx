import React, { useState, useEffect, Component } from "react";
import ExcelJS from "exceljs";

// file-saver 대체: 순수 브라우저 API로 파일 다운로드
function saveAs(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

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
        // 상하차지 정규화: 공백 제거 + 영문은 대문자로 통일 (노량진SK / 노량진sk / 노량진 SK → 전부 동일 취급)
        const normFrom = (t.from || "").replace(/\s+/g, "").toUpperCase();
        const normTo   = (t.to   || "").replace(/\s+/g, "").toUpperCase();
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
function ClosingTab({ records, closings, onClose, onRefresh, getClients, getPrice, clientPrices, setClientPrices, startD, endD }) {

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

  // ── 유사 지명 감지 (오타/철자 차이로 갈라진 것 찾기) ──
  const levenshtein = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
      }
    }
    return dp[a.length][b.length];
  };

  const findSimilarPairs = (list) => {
    const pairs = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i+1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a === b || a.length < 3 || b.length < 3) continue;
        const dist = levenshtein(a, b);
        if (dist >= 1 && dist <= 2) pairs.push([a, b, dist]);
      }
    }
    return pairs.sort((x,y) => x[2]-y[2]);
  };

  const mergeInto = (type, keep, drop) => {
    setLocations(prev => ({
      ...prev,
      [type]: [...new Set((prev[type]||[]).filter(x => x !== drop).concat(keep))]
    }));
    onBulkRename(type, drop, keep);
  };

  const similarFrom = findSimilarPairs(allFrom).map(p => [...p, "from"]);
  const similarTo   = findSimilarPairs(allTo).map(p => [...p, "to"]);
  const similarAll  = [...similarFrom, ...similarTo];

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>📍 상·하차지 목록 관리</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
        기사가 입력하면 자동으로 목록에 쌓여요.<br/>
        ✏️ 눌러서 이름 수정하면 기존 일보도 자동으로 바뀌어요.
      </div>

      {similarAll.length > 0 && (
        <div style={{ background: C.card2, border: `1px solid ${C.accent}60`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
            ⚠️ 비슷한 이름 후보 ({similarAll.length}건) — 같은 곳인데 다르게 입력된 건 아닌지 확인하세요
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {similarAll.map(([a, b, dist, type], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                <span style={{ color: C.muted }}>{type === "from" ? "상차지" : "하차지"}:</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{a}</span>
                <span style={{ color: C.muted }}>↔</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{b}</span>
                <button onClick={() => mergeInto(type, a, b)}
                  style={{ background: C.blue+"20", border: `1px solid ${C.blue}40`, borderRadius: 6, padding: "3px 8px", color: C.blue, fontSize: 11, cursor: "pointer" }}>
                  "{b}"→"{a}"로 합치기
                </button>
                <button onClick={() => mergeInto(type, b, a)}
                  style={{ background: C.green+"20", border: `1px solid ${C.green}40`, borderRadius: 6, padding: "3px 8px", color: C.green, fontSize: 11, cursor: "pointer" }}>
                  "{a}"→"{b}"로 합치기
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
function DriverScreen({ vehicles, locationHints, locations, records, onSave, onRefresh, materials, driverSettings }) {
  const [mode, setMode] = useState("input"); // "input" | "myrecords"
  return (
    <>
      <Nav />
      <div style={{ background:C.card, borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, minHeight:"calc(100vh - 110px)" }}>
        <div style={{ display:"flex", borderBottom:`1px solid ${C.border}` }}>
          {[["input","📝 일보 입력"],["myrecords","📊 내 실적 보기"]].map(([id,label]) => (
            <button key={id} onClick={()=>setMode(id)}
              style={{ flex:1, padding:"14px 0", background:"transparent", border:"none", borderBottom: mode===id ? `2px solid ${C.blue}` : "2px solid transparent",
                       color: mode===id ? C.text : C.muted, fontSize:14, fontWeight: mode===id?700:500, cursor:"pointer" }}>
              {label}
            </button>
          ))}
        </div>
        {mode === "input" && (
          <ReportForm vehicles={vehicles} locationHints={locationHints} locations={locations} records={records} onSave={onSave} materials={materials} />
        )}
        {mode === "myrecords" && (
          <MyRecordsView vehicles={vehicles} records={records} driverSettings={driverSettings} />
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// 기사 본인 실적 조회 — 차량번호 + PIN 확인 후 본인 차량 기록만 표시
// ════════════════════════════════════════════════════════════
function MyRecordsView({ vehicles, records, driverSettings }) {
  const [vehicle, setVehicle] = useState("");
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [err, setErr] = useState("");

  const monthStart = today().slice(0,7) + "-01";
  const monthEnd = today();

  const tryUnlock = () => {
    if (!vehicle) { setErr("차량번호를 선택해주세요."); return; }
    const savedPin = driverSettings?.[vehicle]?.pin || "";
    if (!savedPin) { setErr("이 차량은 PIN이 아직 등록되지 않았습니다. 관리자에게 문의하세요."); return; }
    if (pin.trim() !== savedPin) { setErr("PIN번호가 일치하지 않습니다."); return; }
    setErr("");
    setUnlocked(true);
  };

  if (!unlocked) {
    return (
      <div style={{ padding: "40px 20px", maxWidth: 360, margin: "0 auto" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, textAlign:"center" }}>내 실적 보기</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, textAlign:"center" }}>
          본인 차량번호와 PIN을 입력하면 이번 달 본인 실적만 볼 수 있습니다.
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>차량번호</div>
          <select value={vehicle} onChange={e=>setVehicle(e.target.value)}
            style={{ width:"100%", padding:12, borderRadius:10, background:C.card2, border:`1px solid ${C.border}`, color:C.text, fontSize:14 }}>
            <option value="">선택하세요</option>
            {(vehicles||[]).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>PIN번호</div>
          <input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)}
            placeholder="4자리 숫자"
            style={{ width:"100%", padding:12, borderRadius:10, background:C.card2, border:`1px solid ${C.border}`, color:C.text, fontSize:14 }} />
        </div>
        {err && <div style={{ color:C.danger, fontSize:12, marginBottom:12, textAlign:"center" }}>{err}</div>}
        <button onClick={tryUnlock}
          style={{ width:"100%", padding:14, borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" }}>
          확인
        </button>
      </div>
    );
  }

  const myRecs = (records||[])
    .filter(r => r.type === "report" && r.vehicle === vehicle && r.date >= monthStart && r.date <= monthEnd)
    .sort((a,b) => (b.date||"").localeCompare(a.date||""));

  const totalQty = myRecs.reduce((s,r) => s + (Number(r.work?.qty)||0), 0);

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>차량 {vehicle} — {monthStart.slice(0,7)}월 실적</div>
        <button onClick={()=>{ setUnlocked(false); setPin(""); }}
          style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.muted, borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer" }}>
          🔒 나가기
        </button>
      </div>
      <div style={{ background:C.card2, borderRadius:12, padding:14, marginBottom:14, display:"flex", justifyContent:"space-around", textAlign:"center" }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900 }}>{myRecs.length}</div>
          <div style={{ fontSize:11, color:C.muted }}>운행건수</div>
        </div>
        <div>
          <div style={{ fontSize:20, fontWeight:900 }}>{totalQty.toLocaleString()}</div>
          <div style={{ fontSize:11, color:C.muted }}>총 수량</div>
        </div>
      </div>
      {myRecs.length === 0 ? (
        <div style={{ textAlign:"center", color:C.muted, padding:"40px 0", fontSize:13 }}>이번 달 기록이 없습니다.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {myRecs.map(r => (
            <div key={r.id} style={{ background:C.card2, borderRadius:10, padding:12, border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:700 }}>{r.date}</span>
                <span style={{ fontSize:12, color:C.muted }}>{r.work?.material} {r.work?.qty}{r.work?.unit}</span>
              </div>
              <div style={{ fontSize:12, color:C.muted }}>{r.from} → {r.to}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 관리자 대시보드
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
// 업체 선택 후 청구서(일보마감) 발행 모달
// ════════════════════════════════════════════════════════════
function ClientSelectModal({ reportRecs, getClients, onClose, onConfirm }) {
  const allClients = [...new Set(
    reportRecs.flatMap(r => {
      const cs = getClients(r);
      return cs.length > 0 ? cs : [];
    })
  )].sort();

  const [selected, setSelected] = useState([]);

  const toggle = (c) => {
    setSelected(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 20, width: "100%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: C.text }}>📋 일보마감 — 업체 선택</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          선택 안 하면 조회기간 내 전체 업체가 발행됩니다.<br/>
          특정 업체만 발행하려면 체크하세요.
        </div>

        {allClients.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted, padding: "20px 0", textAlign:"center" }}>조회기간 내 일보가 없습니다.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap: 8, marginBottom: 16 }}>
            {allClients.map(c => (
              <label key={c} style={{ display:"flex", alignItems:"center", gap: 10, background: C.card2, borderRadius: 8, padding: "10px 12px", border: `1px solid ${selected.includes(c) ? C.blue : C.border}`, cursor:"pointer" }}>
                <input type="checkbox" checked={selected.includes(c)} onChange={()=>toggle(c)} style={{ width:18, height:18 }} />
                <span style={{ fontSize:14, color: C.text }}>{c}</span>
              </label>
            ))}
          </div>
        )}

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:12, borderRadius:10, background:C.border, border:"none", color:C.text, fontSize:14, cursor:"pointer" }}>취소</button>
          <button onClick={()=>onConfirm(selected)} style={{ flex:2, padding:12, borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            📤 {selected.length > 0 ? `선택 ${selected.length}곳` : "전체"} 발행
          </button>
        </div>
      </div>
    </div>
  );
}

function PriceInputModal({ reportRecs, customPrices, setCustomPrices, getPrice, onClose, onConfirm }) {
  const locSet = {};
  reportRecs.forEach(r => {
    const k = (r.from||"")+"||"+(r.to||"");
    if (!locSet[k]) locSet[k] = { from:r.from, to:r.to, material:r.work?.material };
  });
  const locs = Object.entries(locSet).sort(([a],[b])=>a.localeCompare(b));

  // 모달이 열릴 때, 기존 저장된 단가를 미리 채워서 표시 (변경분만 수정하면 됨)
  useEffect(() => {
    setCustomPrices(prev => {
      const next = { ...prev };
      let changed = false;
      locs.forEach(([k, loc]) => {
        if (next[k] === undefined) {
          const saved = getPrice ? getPrice(loc.from, loc.to, loc.material) : 0;
          if (saved) { next[k] = saved; changed = true; }
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:9999, background:"rgba(0,0,0,0.85)", display:"flex", flexDirection:"column", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.card, borderRadius:16, overflow:"hidden", maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px 16px 8px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.accent, marginBottom:4 }}>🚛 기사마감 — 현장별 단가 입력</div>
          <div style={{ fontSize:12, color:C.muted }}>기존 단가가 자동으로 채워져요. 변동된 곳만 수정하고, 새 현장은 직접 입력하세요.</div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:12 }}>
          {locs.length === 0 && <div style={{ padding:20, color:C.muted, textAlign:"center" }}>이 기간 일보가 없어요</div>}
          {locs.map(([k, loc]) => {
            const savedPrice = getPrice ? getPrice(loc.from, loc.to, loc.material) : 0;
            const isNew = !savedPrice;
            return (
              <div key={k} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, background:C.card2, borderRadius:10, padding:"10px 12px", border: isNew ? `1px solid ${C.accent}` : "1px solid transparent" }}>
                <div style={{ flex:1, fontSize:13 }}>
                  <span style={{ color:C.blue, fontWeight:700 }}>{loc.from}</span>
                  <span style={{ color:C.muted, margin:"0 6px" }}>→</span>
                  <span style={{ color:C.green, fontWeight:700 }}>{loc.to}</span>
                  {isNew && <span style={{ marginLeft:6, fontSize:10, color:C.accent }}>NEW</span>}
                </div>
                <input type="number" value={customPrices[k]??""} onChange={e=>setCustomPrices(prev=>({...prev,[k]:e.target.value===""?"":Number(e.target.value)}))} placeholder={isNew ? "새 단가 입력" : "단가"}
                  style={{ width:100, background:C.card, border:`1.5px solid ${isNew?C.accent:C.border}`, borderRadius:8, padding:"7px 10px", color:C.text, fontSize:13, outline:"none", textAlign:"right" }} />
                <span style={{ fontSize:11, color:C.muted }}>원</span>
              </div>
            );
          })}
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

function AdminDash({ records, vehicles, setVehicles, mappings, setMappings, onSaveMappings, prices, setPrices, locations, setLocations, materials, setMaterials, driverSettings, setDriverSettings, clientEmails, setClientEmails, clientPrices, setClientPrices, adminPw, setAdminPw, onLock, onSaveExpense, onRefresh }) {
  const _today = new Date(); const _ty = _today.getFullYear(), _tm = String(_today.getMonth()+1).padStart(2,"0"), _td = String(_today.getDate()).padStart(2,"0"); const _todayStr = `${_ty}-${_tm}-${_td}`;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showClientSelectModal, setShowClientSelectModal] = useState(false);
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

  // ── 업체별 청구서 xlsx — 템플릿 복사 방식 ──────────────────
  // 업체청구단가: 별도로 지정된 값이 있으면 그 값, 없으면 기사정산단가(getPrice)와 동일
  const getClientPrice = (from, to) => {
    const key = `${from}||${to}`;
    const key2 = `${from}||`;
    if (clientPrices[key] !== undefined && clientPrices[key] !== "") return Number(clientPrices[key]);
    if (clientPrices[key2] !== undefined && clientPrices[key2] !== "") return Number(clientPrices[key2]);
    return getPrice(from, to);
  };

  const downloadByClient = async (selectedClients = null) => {
    // 관리자 화면에서 직접 조회한 날짜 범위를 항상 사용
    const [sD, eD] = getPeriodRange();

    const inR = r => r.date && r.date.match(/^\d{4}-\d{2}-\d{2}$/) && r.date >= sD && r.date <= eD;
    const recs = records.filter(r => r.type === "report" && inR(r) && r.status !== "pending");

    const byCl = {};
    recs.forEach(r => {
      const clients = getClients(r);
      const targets = clients.length > 0 ? clients : ["(미매핑)"];
      targets.forEach(c => { if (!byCl[c]) byCl[c] = []; byCl[c].push(r); });
    });

    let clientList = Object.entries(byCl).filter(([c]) => c !== "(미매핑)");
    // 특정 업체만 선택했다면 그 업체만 필터링
    if (selectedClients && selectedClients.length > 0) {
      clientList = clientList.filter(([c]) => selectedClients.includes(c));
    }
    if (clientList.length === 0) { alert("청구할 업체가 없습니다."); return; }

    try {
      const M3_LIST = ["모래","13mm","25mm","40mm","혼합","석분"];
      const isM3byMat = (mat, unit) => M3_LIST.includes(mat) || unit==="㎥" || unit==="m³";
      const mo = eD.slice(5,7).replace(/^0/,"");

      const thinBorder = { top:{style:"thin"}, bottom:{style:"thin"}, left:{style:"thin"}, right:{style:"thin"} };
      const doubleBorder = { top:{style:"double"}, bottom:{style:"double"}, left:{style:"double"}, right:{style:"double"} };
      const centerV = { vertical: "middle", horizontal: "center" };
      const rightV = { vertical: "middle", horizontal: "right" };
      const leftV = { vertical: "middle" };

      const wb = new ExcelJS.Workbook();

      clientList.forEach(([client, rows]) => {
        const ws = wb.addWorksheet(client.slice(0,31));
        ws.properties.defaultRowHeight = 21;
        ws.columns = [
          {width:4.875},{width:5.125},{width:6.0},{width:6.0},{width:12.125},{width:13.0},
          {width:6.0},{width:7.375},{width:6.0},{width:9.875},{width:13.0},{width:12.25}
        ];
        // 행 높이는 모든 셀 작성이 끝난 뒤 이 함수 맨 끝에서 한 번만 최종 확정한다
        // (여기서 미리 지정하지 않음 — mergeCells/셀접근이 반복되며 리셋되는 것을 방지)

        // ── 제목 ──
        ws.mergeCells("C1:L1");
        const titleCell = ws.getCell("C1");
        titleCell.value = "거 래 명 세 서";
        titleCell.font = { name:"돋움", size:18, bold:true };
        titleCell.alignment = centerV;

        // ── 상단 정보 ──
        ws.getCell("C3").value = "일        자:";
        ws.getCell("C3").font = { name:"돋움", size:11, bold:true };
        ws.getCell("E3").value = new Date(eD + "T00:00:00");
        ws.getCell("E3").numFmt = "yyyy-mm-dd";
        ws.getCell("E3").font = { name:"굴림", size:11, bold:true };
        ws.getCell("I3").value = "공 급 자:";
        ws.getCell("I3").font = { name:"돋움", size:11, bold:true };
        ws.getCell("K3").value = "㈜ 다 솔 중 기  ";
        ws.getCell("K3").font = { name:"맑은 고딕", bold:true, size:14 };

        ws.getCell("C5").value = "공급받는자:";
        ws.getCell("C5").font = { name:"돋움", size:11, bold:true };
        ws.getCell("E5").value = "㈜ " + client;
        ws.getCell("E5").font = { name:"굴림", size:11, bold:true };
        ws.getCell("I5").value = "759-88-00944";
        ws.getCell("I5").font = { name:"돋움", size:11, bold:true };
        ws.getCell("L5").value = "최 기 희";
        ws.getCell("L5").font = { name:"돋움", size:11, bold:true };

        ws.getCell("C7").value = "금        액:";
        ws.getCell("C7").font = { name:"돋움", size:11, bold:true };
        ws.getCell("E7").value = { formula: "K36" };
        ws.getCell("E7").font = { name:"돋움", size:11, bold:true };
        ws.getCell("E7").numFmt = "#,##0";
        ws.getCell("I7").value = "인천시 서구 청라에메랄드로 112 웰카운티 226동 1602호";
        ws.getCell("I7").font = { name:"돋움", size:9, bold:true };
        ws.getCell("I8").value = "T:032-564-2306  F:032-566-2306";
        ws.getCell("I8").font = { name:"돋움", size:9, bold:true };

        ws.getCell("C9").value = "청구내역:";
        ws.getCell("C9").font = { name:"돋움", size:11, bold:false };

        // ── 공급자 정보 박스(I3:L8) 이중선 테두리 ──
        for (const col of ["I","J","K","L"]) {
          ws.getCell(col+"3").border = { ...(ws.getCell(col+"3").border||{}), top:{style:"double"} };
          ws.getCell(col+"8").border = { ...(ws.getCell(col+"8").border||{}), bottom:{style:"double"} };
        }
        for (let r=3; r<=8; r++) {
          ws.getCell("I"+r).border = { ...(ws.getCell("I"+r).border||{}), left:{style:"double"} };
          ws.getCell("L"+r).border = { ...(ws.getCell("L"+r).border||{}), right:{style:"double"} };
        }

        // ── 헤더행(11) ──
        const headers = ["월/일","no.","상차지","하차지","품명","수량","㎥","단가","금액","비고"];
        headers.forEach((h, i) => {
          const col = String.fromCharCode(67 + i); // C부터
          const cell = ws.getCell(col + "11");
          cell.value = h;
          cell.font = { name:"돋움", size:9, bold:false };
          cell.alignment = centerV;
          cell.border = thinBorder;
        });

        // ── 현장별 합계 그룹 ──
        const preSorted = rows.slice().sort((a,b) => {
          const dCmp = (a.date||"").localeCompare(b.date||"");
          if (dCmp !== 0) return dCmp;
          return (a.vehicle||"").localeCompare(b.vehicle||"");
        });
        const groupMap = {};
        const groupOrder = [];
        preSorted.forEach(r => {
          const isM3 = isM3byMat(r.work?.material, r.work?.unit);
          const key = (r.from||"")+"||"+(r.to||"")+"||"+(r.work?.material||"")+"||"+(isM3?"m3":"ea");
          if (!groupMap[key]) {
            groupMap[key] = {from:r.from,to:r.to,mat:r.work?.material,isM3,qty:0};
            groupOrder.push(key);
          }
          groupMap[key].qty += Number(r.work?.qty)||0;
        });
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

        // ── 갑지 데이터행(12~33) ──
        const DS = 12, DE = 33;
        groups.forEach((g, idx) => {
          if (idx >= DE-DS+1) return;
          const ri = DS + idx;
          const setC = (col, val, numFmt) => {
            const cell = ws.getCell(col+ri);
            cell.value = val;
            cell.font = { name:"맑은 고딕", size:11 };
            cell.alignment = leftV;
            cell.border = thinBorder;
            if (numFmt) cell.numFmt = numFmt;
          };
          setC("D", idx+1);
          setC("E", g.from||"");
          setC("F", g.to||"");
          setC("G", g.mat||"");
          if (!g.isM3) setC("H", g.qty);
          else setC("I", g.qty);
          setC("J", getClientPrice(g.from, g.to) || "", "#,##0");
          const kCell = ws.getCell("K"+ri);
          kCell.value = { formula: (g.isM3?"I":"H")+ri+"*J"+ri };
          kCell.font = { name:"맑은 고딕", size:11 };
          kCell.border = thinBorder;
          kCell.alignment = rightV;
          // 나머지 빈 셀도 테두리
          "CL".split("").forEach(c => { ws.getCell(c+ri).border = thinBorder; });
        });
        // 빈 데이터행도 테두리(사용 안한 행 포함)
        for (let ri=DS; ri<=DE; ri++) {
          "CDEFGHIJKL".split("").forEach(c => {
            const cell = ws.getCell(c+ri);
            if (!cell.border) cell.border = thinBorder;
          });
        }

        // ── 계행(34) : 지급운반비 합계 ──
        ws.getCell("C34").value = "  계";
        ws.getCell("H34").value = { formula: `SUM(H${DS}:H${DE})` };
        ws.getCell("I34").value = { formula: `SUM(I${DS}:I${DE})` };
        ws.getCell("K34").value = { formula: `SUM(K${DS}:K${DE})` };

        // ── 공급가/부가세(35): 계(K34, 부가세포함) 를 역산 ──
        ws.getCell("C35").value = "공급가/부가세";
        ws.getCell("H35").value = { formula: "ROUND(K34/1.1,0)" };
        ws.getCell("K35").value = { formula: "K34-H35" };

        // ── 총계(36): 공급가+부가세 = K34와 동일 ──
        ws.getCell("C36").value = "총    계";
        ws.getCell("H36").value = { formula: "SUM(H34:H35)" };
        ws.getCell("I36").value = { formula: "SUM(I34:I35)" };
        ws.getCell("K36").value = { formula: "H35+K35" };

        for (let ri=34; ri<=36; ri++) {
          "CDEFGHIJKL".split("").forEach(c => {
            const cell = ws.getCell(c+ri);
            cell.font = { name:"돋움", size:10, bold: ri===36 };
            cell.border = thinBorder;
            cell.alignment = c==="C" ? leftV : rightV;
          });
        }

        ws.getCell("C37").value = "담당자확인";
        ws.getCell("G37").value = "* 아래 계좌로 입금부탁드립니다 *";
        ws.getCell("C38").value = "결재계좌번호: 955-024478-01-011 기업은행 ㈜ 다솔중기";
        ws.getCell("C39").value = { formula: "E5" };

        // ── 청구 리스트 제목(45) ──
        ws.getCell("C45").value = `( ${mo}월 청구 리스트)`;
        ws.getCell("C45").font = { name:"돋움", size:10, bold:true };

        // ── 상세 헤더(46) ──
        headers.forEach((h, i) => {
          const col = String.fromCharCode(67 + i);
          const cell = ws.getCell(col + "46");
          cell.value = h;
          cell.font = { name:"돋움", size:10, bold:true };
          cell.alignment = centerV;
          cell.border = thinBorder;
        });

        // ── 상세 데이터(47행~) ──
        const detailRows = [];
        groups.forEach(g => {
          const groupRows = rows.filter(r => {
            const isM3 = isM3byMat(r.work?.material, r.work?.unit);
            return r.from===g.from && r.to===g.to && r.work?.material===g.mat && isM3===g.isM3;
          }).sort((a,b) => {
            const dCmp = (a.date||"").localeCompare(b.date||"");
            if (dCmp !== 0) return dCmp;
            return (a.vehicle||"").localeCompare(b.vehicle||"");
          });
          detailRows.push({g, groupRows});
        });

        let ri = 47;
        detailRows.forEach(({g, groupRows}) => {
          const dataStartRi = ri;
          groupRows.forEach(row => {
            const day = row.date ? (parseInt(row.date.split("-")[1])+"-"+String(parseInt(row.date.split("-")[2])).padStart(2,"0")) : "";
            const isM3 = isM3byMat(row.work?.material, row.work?.unit);
            const qty = Number(row.work?.qty)||0;
            const setC = (col, val) => {
              const cell = ws.getCell(col+ri);
              cell.value = val;
              cell.font = { name:"돋움", size:10 };
              cell.alignment = leftV;
              cell.border = thinBorder;
            };
            setC("C", day||"");
            setC("D", row.vehicle||"");
            setC("E", row.from||"");
            setC("F", row.to||"");
            setC("G", row.work?.material||"");
            if (!isM3) { setC("H", qty); setC("I", ""); }
            else { setC("I", qty); setC("H", ""); }
            "JKL".split("").forEach(c => { ws.getCell(c+ri).border = thinBorder; });
            ri++;
          });
          const dataEndRi = ri - 1;
          // 소계 행 (노란색)
          "CDEFGHIJKL".split("").forEach(c => {
            const cell = ws.getCell(c+ri);
            cell.value = "";
            cell.font = { name:"돋움", size:10, bold:true };
            cell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FFFFFF00"} };
            cell.alignment = c==="H"||c==="I" ? rightV : centerV;
            cell.border = thinBorder;
          });
          if (groupRows.length > 0) {
            const sumCol = g.isM3 ? "I" : "H";
            ws.getCell(sumCol+ri).value = { formula: `SUM(${sumCol}${dataStartRi}:${sumCol}${dataEndRi})` };
          }
          ri++;
        });

        // 모든 mergeCells/데이터 작성이 끝난 뒤, 마지막에 폰트 → 행 높이 순서로 확정 적용
        // (ExcelJS는 row.height 지정 후 eachCell 등으로 그 행에 다시 접근하면 height가 리셋되는 이슈가 있음
        //  → 반드시 폰트를 먼저 다 적용한 뒤, 맨 마지막에 height만 지정)
        ws.getRow(1).eachCell({ includeEmpty: true }, cell => {
          cell.font = { ...(cell.font||{}), name: "돋움", size: 18 };
        });
        const preservedFontCells = new Set(["C3","E3","I3","K3","C5","E5","I5","L5","C7","E7","I7","I8","C9"]);
        for (let r=2; r<=200; r++) {
          ws.getRow(r).eachCell({ includeEmpty: true }, cell => {
            if (preservedFontCells.has(cell.address)) return; // 상단 라벨 영역: 이미 지정한 폰트 유지
            if (r === 11) { cell.font = { ...(cell.font||{}), name:"돋움", size:9 }; return; } // 표 헤더
            if (r >= 12 && r <= 33) { cell.font = { ...(cell.font||{}), name:"맑은 고딕", size:11 }; return; } // 갑지 데이터행
            cell.font = { ...(cell.font||{}), name: "돋움", size: 10 };
          });
        }
        // 실제 표시 목표값의 2배를 지정 (환경상 저장값이 절반으로 렌더링되는 것을 보정)
        // 목표: 1행15, 2/3/5/7/8/9/10/11행10.50, 4/6행2.30, 12행부터7.90
        const safeCommit = (row) => { try { row.commit(); } catch(e) {} };
        // 1행/2~10행/35~39행/45행은 2배로 확대 (사용자 요청)
        const row1 = ws.getRow(1); row1.height = 60; safeCommit(row1);
        for (let r=2; r<=10; r++) { const rr = ws.getRow(r); rr.height = (r===4||r===6) ? 9.2 : 42; safeCommit(rr); }
        { const rr = ws.getRow(11); rr.height = 21; safeCommit(rr); }
        for (let r=12; r<=200; r++) {
          const rr = ws.getRow(r);
          rr.height = (r>=35 && r<=39) || r===45 ? 42 : 21;
          safeCommit(rr);
        }

        ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/octet-stream" });
      saveAs(blob, `청구서_${sD}_${eD}.xlsx`);
    } catch(err) {
      alert("엑셀 생성 오류: " + err.message);
      console.error(err);
    }
  };

  // ── 기사별 정산서 xlsx — 5623/6821/6957 양식 그대로 ──────────
  const downloadByVehicle = async (customPrices = {}) => {
    const [vStartD, vEndD] = getPeriodRange();
    const inVRange = r => r.date && r.date >= vStartD && r.date <= vEndD;
    const vReportRecs = records.filter(r => r.type === "report" && inVRange(r) && r.status !== "pending");

    const byVehicle = {};
    vReportRecs.forEach(r => { if (!byVehicle[r.vehicle]) byVehicle[r.vehicle] = []; byVehicle[r.vehicle].push(r); });
    if (Object.keys(byVehicle).length === 0) { alert("정산할 일보가 없습니다."); return; }

    try {
      const thinBorder = { top:{style:"thin"}, bottom:{style:"thin"}, left:{style:"thin"}, right:{style:"thin"} };
      const centerV = { vertical:"middle", horizontal:"center" };
      const rightV = { vertical:"middle", horizontal:"right" };
      const leftV = { vertical:"middle" };

      const wb = new ExcelJS.Workbook();
      let grandPayoutTotal = 0; // 경영현황 시트용 — 전 차량 지급운반비 합계(숫자)

      Object.entries(byVehicle).forEach(([vehicle, rows]) => {
        const ws = wb.addWorksheet(vehicle.slice(0,31));
        ws.columns = [
          {width:10},{width:3.75},{width:6.5},{width:6.5},
          {width:13},{width:16.75},{width:6.875},{width:6.5},
          {width:6.5},{width:7.5},{width:8.375},{width:9}
        ];
        // 행 높이는 모든 셀 작성이 끝난 뒤 이 함수 맨 끝에서 한 번만 최종 확정한다

        // 헤더행
        const headers = ["매입처","","날자","","상차지","하차지","품명","수량","m3","시간/㎥","운반단가","지급운반비"];
        headers.forEach((h, i) => {
          const col = String.fromCharCode(65 + i);
          const cell = ws.getCell(col + "1");
          cell.value = h;
          cell.font = { name:"돋움", size:10, bold:true };
          cell.alignment = centerV;
          cell.border = thinBorder;
        });

        // 데이터 행
        const sortedV = rows.slice().sort((a, b) => a.date.localeCompare(b.date));
        let vehiclePayoutTotal = 0; // 이 차량의 지급운반비 합계(숫자) — 경영현황 합산용
        sortedV.forEach((row, i) => {
          const r = i + 2;
          const day = row.date ? Number(row.date.slice(8)) : "";
          const qty = Number(row.work?.qty) || 0;
          const isM3 = row.work?.unit === "㎥" || row.work?.unit === "m³";
          const locKey = (row.from||"") + "||" + (row.to||"");
          const price = customPrices[locKey] || getPrice(row.from, row.to, row.work?.material) || 0;
          vehiclePayoutTotal += price * qty;

          const setC = (col, val, align) => {
            const cell = ws.getCell(col+r);
            cell.value = val;
            cell.font = { name:"돋움", size:10 };
            cell.alignment = align || leftV;
            cell.border = thinBorder;
          };
          setC("A", "");
          setC("B", "");
          setC("C", day, rightV);
          setC("D", Number(vehicle) || vehicle);
          setC("E", row.from || "");
          setC("F", row.to || "");
          setC("G", row.work?.material || "");
          setC("H", (!isM3 && qty) ? qty : "", rightV);
          setC("I", (isM3 && qty) ? qty : "", rightV);
          setC("J", "", rightV);
          setC("K", price || "", rightV);
          const lCell = ws.getCell("L"+r);
          lCell.value = { formula: `IFERROR(K${r}*H${r},0)+IFERROR(K${r}*I${r},0)` };
          lCell.font = { name:"돋움", size:10 };
          lCell.alignment = rightV;
          lCell.border = thinBorder;
        });
        grandPayoutTotal += vehiclePayoutTotal;

        // 합계행
        const totalRow = sortedV.length + 2;
        "ABCDEFGHIJK".split("").forEach(c => {
          const cell = ws.getCell(c+totalRow);
          cell.font = { name:"돋움", size:10 };
          cell.border = thinBorder;
        });
        ws.getCell("B"+totalRow).value = parseInt(vStartD.split("-")[1]);
        ws.getCell("D"+totalRow).value = Number(vehicle) || vehicle;
        const totalCell = ws.getCell("L"+totalRow);
        totalCell.value = { formula: `SUM(L2:L${totalRow - 1})` };
        totalCell.font = { name:"돋움", size:10, bold:true };
        totalCell.alignment = rightV;
        totalCell.border = thinBorder;

        // 기타비용(차감) — 엑셀에서 직접 입력하는 칸
        const etcRow = totalRow + 1;
        ws.mergeCells(`A${etcRow}:K${etcRow}`);
        const etcLabelCell = ws.getCell(`A${etcRow}`);
        etcLabelCell.value = "기타비용(차감)";
        etcLabelCell.font = { name:"돋움", size:10, bold:true };
        etcLabelCell.alignment = rightV;
        const etcValCell = ws.getCell(`L${etcRow}`);
        etcValCell.value = 0;
        etcValCell.font = { name:"돋움", size:10, color: { argb: "FFCC0000" } };
        etcValCell.alignment = rightV;
        etcValCell.border = thinBorder;
        etcValCell.numFmt = "#,##0";
        etcValCell.note = "수리비/주유비/가불 외 추가로 차감할 금액을 여기 직접 입력하세요.";

        // 최종지급액 = 지급운반비합계 - 기타비용
        const finalRow = etcRow + 1;
        ws.mergeCells(`A${finalRow}:K${finalRow}`);
        const finalLabelCell = ws.getCell(`A${finalRow}`);
        finalLabelCell.value = "최종지급액";
        finalLabelCell.font = { name:"돋움", size:11, bold:true };
        finalLabelCell.alignment = rightV;
        const finalValCell = ws.getCell(`L${finalRow}`);
        finalValCell.value = { formula: `L${totalRow}-L${etcRow}` };
        finalValCell.font = { name:"돋움", size:11, bold:true };
        finalValCell.alignment = rightV;
        finalValCell.border = thinBorder;
        finalValCell.numFmt = "#,##0";

        // 청구서와 동일한 보정 원리 적용 (실제 표시 10.5pt 상당 = 코드값 21)
        const safeCommitV = (row) => { try { row.commit(); } catch(e) {} };
        for (let r=1; r<=200; r++) { const rr = ws.getRow(r); rr.height = 21; safeCommitV(rr); }
      });

      // ── 경영현황 시트 — 매출/비용/법인수익 요약 ──────────────────
      {
        const ws = wb.addWorksheet("경영현황");
        ws.columns = [{width:22},{width:16},{width:30}];

        const titleCell = ws.getCell("A1");
        titleCell.value = `경영현황 요약 (${vStartD} ~ ${vEndD})`;
        titleCell.font = { name:"맑은 고딕", size:14, bold:true };
        ws.mergeCells("A1:C1");

        // 매출(업체청구금액) 합계 — 청구서와 동일 단가 기준, 미매핑 포함 전체
        const revenueTotal = vReportRecs.reduce((s, r) => {
          const qty = Number(r.work?.qty) || 0;
          const price = getPrice(r.from, r.to, r.work?.material) || 0;
          return s + price * qty;
        }, 0);

        const repairTotal    = repairRecs.reduce((s, r) => s + (r.items||[]).reduce((s2, it) => s2 + (Number(it.amount)||0), 0), 0);
        const fuelTotal       = fuelRecs.reduce((s, r) => s + (Number(r.amount)||0), 0);
        const insuranceTotal  = insuranceRecs.reduce((s, r) => s + (Number(r.amount)||0), 0);
        const taxTotal        = taxRecs.reduce((s, r) => s + (Number(r.amount)||0), 0);
        const fineTotal       = fineRecs.reduce((s, r) => s + (Number(r.amount)||0), 0);

        let row = 3;
        const sectionHeader = (label) => {
          const c = ws.getCell(`A${row}`);
          c.value = label;
          c.font = { name:"맑은 고딕", size:12, bold:true, color: { argb: "FF2E86DE" } };
          row += 1;
        };
        const dataRow = (label, value, opts = {}) => {
          const labelCell = ws.getCell(`A${row}`);
          labelCell.value = label;
          labelCell.font = { name:"돋움", size:11, bold: !!opts.bold };
          const valCell = ws.getCell(`B${row}`);
          valCell.value = opts.formula ? { formula: opts.formula } : value;
          valCell.font = { name:"돋움", size:11, bold: !!opts.bold, color: opts.editable ? { argb: "FFCC0000" } : undefined };
          valCell.numFmt = "#,##0";
          valCell.alignment = { horizontal: "right" };
          valCell.border = { top:{style:"thin"}, bottom:{style:"thin"}, left:{style:"thin"}, right:{style:"thin"} };
          if (opts.note) valCell.note = opts.note;
          const thisRow = row;
          row += 1;
          return thisRow;
        };

        sectionHeader("📈 매출");
        const revenueRow = dataRow("업체청구금액 합계", revenueTotal);

        row += 1;
        sectionHeader("📉 비용");
        const payoutRow    = dataRow("기사 지급운반비 합계", grandPayoutTotal);
        const repairRow    = dataRow("수리비", repairTotal);
        const fuelRow      = dataRow("주유비", fuelTotal);
        const insuranceRow = dataRow("보험료", insuranceTotal);
        const taxRow       = dataRow("세금", taxTotal);
        const fineRow      = dataRow("과태료", fineTotal);

        row += 1;
        sectionHeader("💳 법인카드 사용내역 (직접 입력)");
        const cardRows = [];
        ["카드1", "카드2", "카드3"].forEach(label => {
          cardRows.push(dataRow(label, 0, { editable: true, note: "카드사에서 받은 이번 마감기간 총 사용금액을 입력하세요." }));
        });
        const cardSumRow = dataRow("법인카드 합계", null, { bold: true, formula: `SUM(B${cardRows[0]}:B${cardRows[cardRows.length-1]})` });

        row += 1;
        sectionHeader("🧾 기타비용 (직접 입력)");
        const etcSummaryRow = dataRow("기타비용", 0, { editable: true, note: "위 항목에 없는 추가 비용을 직접 입력하세요." });

        row += 1;
        sectionHeader("💰 법인수익");
        dataRow(
          "법인수익 (매출 - 비용 합계)", null,
          { bold: true, formula: `B${revenueRow}-B${payoutRow}-B${repairRow}-B${fuelRow}-B${insuranceRow}-B${taxRow}-B${fineRow}-B${cardSumRow}-B${etcSummaryRow}` }
        );

        ws.getColumn("A").width = 26;
        ws.getColumn("B").width = 16;
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/octet-stream" });
      saveAs(blob, `기사정산_${vStartD}_${vEndD}.xlsx`);
    } catch(err) {
      alert("엑셀 생성 오류: " + err.message);
      console.error(err);
    }
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
            <Btn onClick={() => setShowClientSelectModal(true)} color={C.blue} style={{ flex: 1 }} disabled={reportRecs.length === 0}>📤 일보마감</Btn>
            <Btn onClick={() => setShowPriceModal(true)} color={C.purple} style={{ flex: 1 }} disabled={reportRecs.length === 0}>🚛 기사마감</Btn>
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
          clientPrices={clientPrices}
          setClientPrices={setClientPrices}
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
          {/* 단가표 — 기사정산단가와 업체청구단가를 구분 관리 */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>💰 단가표 (업체청구단가)</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              왼쪽은 기사정산에 쓰이는 단가(참고용, 수정 불가), 오른쪽은 업체청구서에 쓸 단가입니다.
              비워두면 기사정산단가와 동일하게 청구되고, 다르게 청구할 노선만 오른쪽 칸에 입력하면 됩니다.
            </div>
            {(() => {
              const routeMap = {};
              records.filter(r => r.type === "report").forEach(r => {
                const clients = getClients(r);
                const targets = clients.length > 0 ? clients : ["(미매핑)"];
                targets.forEach(client => {
                  const key = `${r.from||""}||${r.to||""}||${r.work?.material||""}||${client}`;
                  if (!routeMap[key]) {
                    routeMap[key] = { from: r.from||"", to: r.to||"", mat: r.work?.material||"", client };
                  }
                });
              });
              const routes = Object.values(routeMap).sort((a,b) =>
                a.client.localeCompare(b.client) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
              );
              if (routes.length === 0) {
                return <div style={{ fontSize: 12, color: C.muted }}>운반내역이 아직 없습니다.</div>;
              }
              return (
                <div style={{ maxHeight: 420, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.card2, position: "sticky", top: 0 }}>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>업체</th>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>상차지</th>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>하차지</th>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>품명</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>기사정산단가</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>업체청구단가</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes.map((rt, i) => {
                        const priceKey = `${rt.from}||${rt.to}`;
                        const driverPrice = getPrice(rt.from, rt.to, rt.mat) || 0;
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: "6px 8px" }}>{rt.client}</td>
                            <td style={{ padding: "6px 8px" }}>{rt.from}</td>
                            <td style={{ padding: "6px 8px" }}>{rt.to}</td>
                            <td style={{ padding: "6px 8px" }}>{rt.mat}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: C.muted }}>
                              {driverPrice ? driverPrice.toLocaleString() : "-"}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                              <input
                                type="number"
                                defaultValue={clientPrices?.[priceKey] ?? ""}
                                placeholder={driverPrice ? String(driverPrice) : "0"}
                                onBlur={e => {
                                  const v = e.target.value.trim();
                                  setClientPrices(prev => {
                                    const next = { ...prev };
                                    if (v === "") delete next[priceKey]; else next[priceKey] = Number(v);
                                    return next;
                                  });
                                }}
                                style={{ width: 100, textAlign: "right", background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", color: C.text, fontSize: 12, outline: "none" }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </Card>

          {/* 이메일 설정 — 업체별/기사별 발송 주소 */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>📧 이메일 설정</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              업체청구서·기성내역서를 보낼 이메일 주소를 등록해두면 자동발송 시 사용됩니다.
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: C.blue }}>업체 이메일 (청구서용)</div>
            {Array.from(new Set((mappings||[]).map(m => m.client).filter(Boolean))).length === 0 ? (
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>매핑 탭에서 청구업체를 먼저 등록하세요.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {Array.from(new Set((mappings||[]).map(m => m.client).filter(Boolean))).map(client => (
                  <div key={client} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, width: 90, flexShrink: 0, color: C.text }}>{client}</span>
                    <input
                      type="email"
                      defaultValue={clientEmails?.[client] || ""}
                      placeholder="example@naver.com"
                      onBlur={e => setClientEmails(prev => ({ ...prev, [client]: e.target.value.trim() }))}
                      style={{ flex: 1, background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: C.green }}>기사(차량) 이메일 (기성내역서용)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {(vehicles||[]).map(v => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, width: 90, flexShrink: 0, color: C.text }}>{v}</span>
                  <input
                    type="email"
                    defaultValue={driverSettings?.[v]?.email || ""}
                    placeholder="example@naver.com"
                    onBlur={e => setDriverSettings(prev => ({ ...prev, [v]: { ...(prev?.[v]||{}), email: e.target.value.trim() } }))}
                    style={{ flex: 1, background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }}
                  />
                </div>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: C.accent }}>기사 PIN번호 (내 실적 보기용, 4자리 숫자 추천)</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
              기사가 앱에서 "내 실적 보기" 누를 때 본인 차량번호와 함께 입력하는 번호입니다. 다른 기사 실적을 못 보게 막는 최소한의 장치입니다.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(vehicles||[]).map(v => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, width: 90, flexShrink: 0, color: C.text }}>{v}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    defaultValue={driverSettings?.[v]?.pin || ""}
                    placeholder="예: 1234"
                    onBlur={e => setDriverSettings(prev => ({ ...prev, [v]: { ...(prev?.[v]||{}), pin: e.target.value.trim() } }))}
                    style={{ flex: 1, background: C.card2, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }}
                  />
                </div>
              ))}
            </div>
          </Card>

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
    {/* 일보마감 - 업체 선택 모달 */}
    {showClientSelectModal && <ClientSelectModal
      reportRecs={reportRecs}
      getClients={getClients}
      onClose={() => setShowClientSelectModal(false)}
      onConfirm={(selected) => {
        setShowClientSelectModal(false);
        downloadByClient(selected.length > 0 ? selected : null);
      }}
    />}
    {showPriceModal && <PriceInputModal
      reportRecs={reportRecs}
      customPrices={customPrices}
      setCustomPrices={setCustomPrices}
      getPrice={getPrice}
      onClose={()=>setShowPriceModal(false)}
      onConfirm={()=>{
        const p = {...customPrices};
        // 변경/신규 입력한 단가를 저장해서 다음 마감때도 자동으로 채워지게 함
        const toSave = {};
        Object.entries(p).forEach(([k, v]) => { if (v !== "" && v != null) toSave[k] = v; });
        if (Object.keys(toSave).length > 0) {
          setPrices(prev => ({ ...prev, ...toSave }));
        }
        setShowPriceModal(false);
        setTimeout(()=>downloadByVehicle(p), 100);
      }}
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
  const [clientEmails, setCEState]      = useState({});
  const [clientPrices, setCPState]      = useState({});
  const [materials, setMaterialsState] = useState(DEFAULT_MATERIALS);
  const [locations, setLocationsState] = useState({ from: [], to: [] });
  const [adminPw, setAdminPwState]      = useState(ADMIN_PW);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const isAdminMode = window.location.search.includes("admin");

  // 자동삭제 기능 제거됨 (2026-08: 세무/소송 증빙용으로 전체 데이터 영구 보관 필요)

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
        } catch {}
        try { const m = await window.storage.get("dump_mappings"); if (m?.value) setMappings(JSON.parse(m.value)); } catch {}
        try { const p = await window.storage.get("dump_prices");   if (p?.value) setPricesState(JSON.parse(p.value)); } catch {}
        try { const d = await window.storage.get("dump_driver_settings"); if (d?.value) setDSState(JSON.parse(d.value)); } catch {}
        try { const ce = await window.storage.get("dump_client_emails"); if (ce?.value) setCEState(JSON.parse(ce.value)); } catch {}
        try { const cp = await window.storage.get("dump_client_prices"); if (cp?.value) setCPState(JSON.parse(cp.value)); } catch {}
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

  const updateClientEmails = fn => {
    setCEState(prev => { const next = typeof fn === "function" ? fn(prev) : fn; window.storage.set("dump_client_emails", JSON.stringify(next)).catch(() => {}); return next; });
  };

  const updateClientPrices = fn => {
    setCPState(prev => { const next = typeof fn === "function" ? fn(prev) : fn; window.storage.set("dump_client_prices", JSON.stringify(next)).catch(() => {}); return next; });
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
            materials={materials} driverSettings={driverSettings}
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
                clientEmails={clientEmails} setClientEmails={updateClientEmails}
                clientPrices={clientPrices} setClientPrices={updateClientPrices}
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
