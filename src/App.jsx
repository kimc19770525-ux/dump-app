import React, { useState, useEffect, Component } from "react";

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

const MATERIALS = ["토사","뻘","불량토","마사","풍암","원석","선별암","모래","A","B","C","25mm","40mm","혼합","석분"];
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
                const M3_MATERIALS = ["모래","25mm","혼합","석분"];
                const isM3 = M3_MATERIALS.includes(m);
                // m3 품목 선택시 단위 자동 m³, 수량 있으면 ×17 변환
                const newQty = isM3 && item.qty ? String(Math.round(Number(item.qty) * 17)) : item.qty;
                const newUnit = isM3 ? "m³" : item.unit;
                onChange({ ...item, material: m, qty: newQty, unit: newUnit });
              }} style={{
                padding: "7px 13px", borderRadius: 20, fontSize: 13,
                fontWeight: isSelected ? 700 : 400,
                background: isSelected ? "#f5a623" : (mc ? mc.bg+"80" : "#1a1d27"),
                color: isSelected ? "#000" : (mc ? mc.color : C.muted),
                border: `1px solid ${isSelected ? "#f5a623" : (mc ? mc.color+"50" : C.border)}`,
                boxShadow: isSelected ? "0 0 8px #f5a62380" : "none"
              }}>{m}</button>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 2 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>수량</div>
          <input type="number" value={item.qty} onChange={e => {
            const M3_MATERIALS = ["모래","25mm","혼합","석분"];
            const raw = e.target.value;
            onChange({ ...item, qty: raw, unit: M3_MATERIALS.includes(item.material) ? "m³" : item.unit });
          }} onBlur={e => {
            const M3_MATERIALS = ["모래","25mm","혼합","석분"];
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

// ── 위치 입력 컴포넌트 (네이티브 select + 직접입력) ──────────
function LocButtons({ list, value, onChange, placeholder }) {
  const [customMode, setCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const allList = list || [];

  useEffect(() => {
    // value가 목록에 없으면 직접입력 모드
    if (value && !allList.includes(value)) {
      setCustomMode(true);
      setCustomVal(value);
    } else {
      setCustomMode(false);
      setCustomVal("");
    }
  }, [value]);

  if (customMode) {
    return (
      <div style={{ display:"flex", gap:6 }}>
        <input
          type="text"
          value={customVal}
          onChange={e => { setCustomVal(e.target.value); onChange(e.target.value); }}
          placeholder={placeholder || "직접 입력"}
          autoComplete="off"
          style={{ flex:1, background:"#22263a", border:"1.5px solid #f5a623", borderRadius:10, padding:"11px 14px", color:"#e8eaf0", fontSize:15, outline:"none" }}
        />
        <button onClick={() => { setCustomMode(false); onChange(""); }} style={{
          background:"transparent", border:"1px solid #3a3f5a", borderRadius:10,
          padding:"0 12px", color:"#7a7f9a", fontSize:13, cursor:"pointer"
        }}>목록</button>
      </div>
    );
  }

  return (
    <div>
      <select
        value={value || ""}
        onChange={e => {
          const v = e.target.value;
          if (v === "__custom__") { setCustomMode(true); setCustomVal(""); onChange(""); }
          else onChange(v);
        }}
        style={{ width:"100%", background:"#22263a", border:`1.5px solid ${value?"#f5a623":"#2e3250"}`, borderRadius:10, padding:"11px 14px", color: value ? "#e8eaf0" : "#7a7f9a", fontSize:15, outline:"none" }}
      >
        <option value="">{placeholder || "눌러서 선택"}</option>
        {allList.map(l => <option key={l} value={l}>{l}</option>)}
        <option value="__custom__">✏️ 직접 입력...</option>
      </select>
    </div>
  );
}

function ReportForm({ vehicles, locationHints, locations, records, onSave }) {
  const emptyWork = { material: "", qty: "", unit: "개" };
  const emptyTrip = { from: "", to: "", work: { ...emptyWork } };

  const [date, setDate]       = useState(today());
  const [vehicle, setVehicle] = useState("");
  const [trips, setTrips]     = useState([{ ...emptyTrip }]);
  const [memo, setMemo]       = useState("");
  const [saved, setSaved]     = useState(false);
  const [err, setErr]         = useState("");

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
    setVehicle(""); setTrips([{ ...emptyTrip }]); setMemo("");
  };

  return (
    <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 38, color: C.accent, letterSpacing: 3 }}>DUMP LOG</div>
        <div style={{ fontSize: 13, color: C.muted }}>덤프트럭 일일 작업 일보</div>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <Field label="날짜"><SI type="date" value={date} onChange={setDate} /></Field>
        <Field label="차량번호 *">
          <SS value={vehicle} onChange={setVehicle}>
            <option value="">-- 선택 --</option>
            {vehicles.map(v => <option key={v}>{v}</option>)}
          </SS>
        </Field>
      </Card>

      {trips.map((trip, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>📍 현장 {i + 1}</div>
            {trips.length > 1 && (
              <button onClick={() => removeTrip(i)} style={{
                background: C.danger+"20", border:`1px solid ${C.danger}40`,
                borderRadius: 8, padding: "4px 10px", color: C.danger, fontSize: 12, cursor: "pointer", fontWeight: 700
              }}>삭제</button>
            )}
          </div>
          <Card style={{ padding: "14px" }}>
            <Field label="상차지 *">
              <LocButtons list={fromList} value={trip.from} onChange={v => updateTrip(i, "from", v)} placeholder="ex) 수방사" />
            </Field>
            <Field label="하차지 *">
              <LocButtons list={toList} value={trip.to} onChange={v => updateTrip(i, "to", v)} placeholder="ex) 검단현장" />
            </Field>
            <WorkItem item={trip.work} onChange={v => updateWork(i, v)} />
          </Card>
        </div>
      ))}

      {trips.length < 10 && (
        <button onClick={addTrip} style={{
          width: "100%", padding: "12px", borderRadius: 12, cursor: "pointer",
          background: "transparent", border: `2px dashed ${C.accent}50`,
          color: C.accent, fontSize: 14, fontWeight: 700, marginBottom: 12
        }}>+ 현장 추가 ({trips.length}/10)</button>
      )}

      <Card>
        <Field label="메모">
          <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="특이사항 입력" rows={2}
            style={{ width:"100%", background:C.card2, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"11px 14px", color:C.text, fontSize:14, resize:"none", outline:"none" }} />
        </Field>
        {err && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <Btn onClick={submit} style={{ width: "100%" }}>
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
                <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.card2, borderRadius:10, padding:"10px 14px", marginBottom:6 }}>
                  <div style={{ fontSize:14 }}>
                    <span style={{ color:C.blue, fontWeight:700 }}>{m.location}</span>
                    <span style={{ color:C.muted, margin:"0 8px" }}>→</span>
                    <span style={{ fontWeight:700 }}>{m.client}</span>
                  </div>
                  <button type="button" onClick={()=>setMappings(prev=>prev.filter(x=>x.id!==m.id))}
                    style={{ background:"none", border:"none", color:C.danger, cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {toMappings.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 8 }}>↓ 하차지 기준 (예외)</div>
              {toMappings.map(m => (
                <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.card2, borderRadius:10, padding:"10px 14px", marginBottom:6 }}>
                  <div style={{ fontSize:14 }}>
                    <span style={{ color:C.green, fontWeight:700 }}>{m.location}</span>
                    <span style={{ color:C.muted, margin:"0 8px" }}>→</span>
                    <span style={{ fontWeight:700 }}>{m.client}</span>
                  </div>
                  <button type="button" onClick={()=>setMappings(prev=>prev.filter(x=>x.id!==m.id))}
                    style={{ background:"none", border:"none", color:C.danger, cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
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
                      <button onClick={() => approve(r)} style={{
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
// 기사 화면 — 일보입력 + 오늘 제출내역
// ════════════════════════════════════════════════════════════
function DriverScreen({ vehicles, locationHints, locations, records, onSave, onRefresh }) {
  const [tab, setTab] = useState("input"); // "input" | "today"

  const todayStr = today();
  // 오늘 제출한 일보 (차량 무관, 오늘 날짜 기준)
  const todayRecs = records.filter(r => r.type === "report" && r.date === todayStr)
    .slice().sort((a, b) => (b.savedAt||"").localeCompare(a.savedAt||""));

  return (
    <>
      <Nav />
      {/* 탭 버튼 */}
      <div style={{ display:"flex", background:C.card, borderBottom:`1px solid ${C.border}` }}>
        {[["input","📝 일보입력"], ["today",`📋 오늘내역 (${todayRecs.length})`]].map(([k,l]) => (
          <button key={k} onClick={() => { setTab(k); if(k==="today") onRefresh(); }} style={{
            flex:1, padding:"12px 0", border:"none", borderBottom:`2.5px solid ${tab===k ? C.accent : "transparent"}`,
            background:"transparent", color: tab===k ? C.accent : C.muted,
            fontWeight: tab===k ? 700 : 400, fontSize:14, cursor:"pointer"
          }}>{l}</button>
        ))}
      </div>

      <div style={{ background:C.card, borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, minHeight:"calc(100vh - 150px)" }}>
        {tab === "input" && (
          <ReportForm vehicles={vehicles} locationHints={locationHints} locations={locations} records={records} onSave={onSave} />
        )}
        {tab === "today" && (
          <div style={{ padding:"16px" }}>
            {todayRecs.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📭</div>
                <div style={{ fontSize:14 }}>오늘 제출한 일보가 없어요</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>{todayStr} 제출 내역</div>
                {todayRecs.map((r, i) => (
                  <div key={r.id} style={{
                    background:C.card2, border:`1px solid ${r.status==="approved" ? C.green : r.status==="pending" ? C.accent+"60" : C.border}`,
                    borderRadius:12, padding:"12px 14px", marginBottom:8
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontSize:12, color:C.muted }}>현장 {i+1} · {r.vehicle}호</span>
                      <span style={{
                        fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10,
                        background: r.status==="approved" ? C.green+"25" : C.accent+"25",
                        color: r.status==="approved" ? C.green : C.accent
                      }}>
                        {r.status==="approved" ? "✅ 승인됨" : "⏳ 대기중"}
                      </span>
                    </div>
                    <div style={{ fontSize:14, color:C.text, marginBottom:4 }}>
                      {r.from} → {r.to}
                    </div>
                    <div style={{ fontSize:13, color:C.accent, fontWeight:700 }}>
                      {r.work?.material} {r.work?.qty}{r.work?.unit}
                    </div>
                    {r.memo && <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{r.memo}</div>}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// 관리자 대시보드
// ════════════════════════════════════════════════════════════
function AdminDash({ records, vehicles, setVehicles, mappings, setMappings, prices, setPrices, locations, setLocations, driverSettings, setDriverSettings, adminPw, setAdminPw, onLock, onSaveExpense, onRefresh }) {
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
    const result = [];
    mappings.forEach(m => {
      if (m.type === "from" && rec.from === m.location && !result.includes(m.client)) result.push(m.client);
      if (m.type === "to"   && rec.to   === m.location && !result.includes(m.client)) result.push(m.client);
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

  // 미매핑 현장 추출
  const unmappedMap = {};
  reportRecs.forEach(r => {
    const fromMapped = mappings.some(m => m.type === "from" && m.location === r.from);
    const toMapped   = mappings.some(m => m.type === "to"   && m.location === r.to);
    if (!fromMapped && r.from) unmappedMap[`from::${r.from}`] = { loc: r.from, type: "from" };
    if (!toMapped   && r.to)   unmappedMap[`to::${r.to}`]     = { loc: r.to,   type: "to" };
  });
  const unmappedLocs = Object.values(unmappedMap);

  const dl = (lines, filename) => {
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  // xlsx 헬퍼
  const xlsxDl = (wb, filename) => {
    const XLSX = window.XLSX;
    XLSX.writeFile(wb, filename);
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

  // ── 업체별 청구서 xlsx — 4월은석.xlsx 양식 그대로 ──────────
  const downloadByClient = (closingType) => {
    const XLSX = window.XLSX;
    if (!XLSX) { alert("잠시 후 다시 시도해주세요."); return; }

    // 기간 계산
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    let sD, eD, sheetName;
    if (closingType === "mid") {
      // 25일 마감: 전월26일 ~ 당월25일
      sD = localDate(y, m - 1, 26);
      eD = localDate(y, m, 25);
      sheetName = "25일";
    } else {
      // 말일 마감: 당월1일 ~ 당월말일
      sD = localDate(y, m, 1);
      eD = localDate(y, m + 1, 0);
      sheetName = "말일";
    }

    const inR = r => r.date >= sD && r.date <= eD;
    const recs = records.filter(r => r.type === "report" && inR(r) && r.status !== "pending");

    // 업체별 분류
    const byCl = {};
    recs.forEach(r => {
      const clients = getClients(r);
      const targets = clients.length > 0 ? clients : ["(미매핑)"];
      targets.forEach(c => { if (!byCl[c]) byCl[c] = []; byCl[c].push(r); });
    });

    const clientList = Object.entries(byCl).filter(([c]) => c !== "(미매핑)");
    if (clientList.length === 0) { alert("청구할 업체가 없습니다."); return; }

    const wb = XLSX.utils.book_new();

    // 양식 스타일 헬퍼 (맑은 고딕, thin 테두리)
    const thin = { style: "thin", color: { rgb: "000000" } };
    const bdr = { top: thin, bottom: thin, left: thin, right: thin };
    const noBdr = {};
    const S = (bold, align, sz, bg) => ({
      font: { name: "맑은 고딕", bold: !!bold, sz: sz || 10 },
      alignment: { horizontal: align || "left", vertical: "center", wrapText: false },
      fill: bg ? { fgColor: { rgb: bg }, patternType: "solid" } : { patternType: "none" },
    });
    const SB = (bold, align, sz, bg) => ({ ...S(bold, align, sz, bg), border: bdr });

    const C2 = (ws, addr, val, style) => {
      ws[addr] = { v: val, t: typeof val === "number" ? "n" : "s", s: style };
    };
    const CF = (ws, addr, formula, style) => {
      ws[addr] = { f: formula, t: "n", s: style };
    };
    const CD = (ws, addr, dateVal, style) => {
      ws[addr] = { v: dateVal, t: "d", z: "yyyy-mm-dd", s: style };
    };

    clientList.forEach(([client, rows]) => {
      const ws = {};
      ws["!merges"] = [];

      // 열너비: C~L 기준 (A,B 여백)
      ws["!cols"] = [
        { wch: 4.875 }, // A
        { wch: 5.125 }, // B
        { wch: 6.0 },   // C
        { wch: 6.0 },   // D
        { wch: 12.125 },// E
        { wch: 10.0 },  // F
        { wch: 6.0 },   // G
        { wch: 7.375 }, // H
        { wch: 6.0 },   // I
        { wch: 9.875 }, // J
        { wch: 12.0 },  // K
        { wch: 12.25 }, // L
      ];

      // ── 행1: 거래명세서 제목
      ws["!merges"].push({ s: { r: 0, c: 2 }, e: { r: 0, c: 11 } });
      C2(ws, "C1", "거 래 명 세 서", S(true, "center", 16));

      // ── 행3: 일자 / 공급자
      ws["!merges"].push({ s: { r: 2, c: 2 }, e: { r: 2, c: 4 } });
      ws["!merges"].push({ s: { r: 2, c: 4 }, e: { r: 2, c: 5 } });
      ws["!merges"].push({ s: { r: 2, c: 8 }, e: { r: 2, c: 9 } });
      ws["!merges"].push({ s: { r: 2, c: 10 }, e: { r: 2, c: 11 } });
      C2(ws, "C3", "일        자:", S(false));
      C2(ws, "E3", eD, S(false));
      C2(ws, "I3", "공 급 자:", S(false));
      C2(ws, "K3", "㈜ 다 솔 중 기", S(true));

      // ── 행5: 공급받는자
      ws["!merges"].push({ s: { r: 4, c: 2 }, e: { r: 4, c: 4 } });
      ws["!merges"].push({ s: { r: 4, c: 4 }, e: { r: 4, c: 7 } });
      ws["!merges"].push({ s: { r: 4, c: 8 }, e: { r: 4, c: 10 } });
      ws["!merges"].push({ s: { r: 4, c: 11 }, e: { r: 4, c: 11 } });
      C2(ws, "C5", "공급받는자:", S(false));
      C2(ws, "E5", client, S(true));
      C2(ws, "I5", "759-88-00944", S(false));
      C2(ws, "L5", "최 기 희", S(false));

      // ── 행7: 금액
      ws["!merges"].push({ s: { r: 6, c: 2 }, e: { r: 6, c: 4 } });
      ws["!merges"].push({ s: { r: 6, c: 4 }, e: { r: 6, c: 5 } });
      ws["!merges"].push({ s: { r: 6, c: 8 }, e: { r: 6, c: 11 } });
      C2(ws, "C7", "금        액:", S(false));
      CF(ws, "E7", "K45-K43", S(true));
      C2(ws, "I7", "인천시 서구 청라에메랄드로 112 웰카운티 226동 1602호", S(false, "left", 9));

      // ── 행8: 전화
      ws["!merges"].push({ s: { r: 7, c: 8 }, e: { r: 7, c: 11 } });
      C2(ws, "I8", "T:032-564-2306  F:032-566-2306", S(false, "left", 9));

      // ── 행9: 청구내역 레이블
      ws["!merges"].push({ s: { r: 8, c: 2 }, e: { r: 8, c: 11 } });
      C2(ws, "C9", "청구내역:", S(true));

      // ── 행11: 헤더
      ["월/일", "no.", "상차지", "하차지", "품명", "수량", "㎥", "단가", "금액", "비고"].forEach((h, i) => {
        C2(ws, `${String.fromCharCode(67 + i)}11`, h, SB(true, "center", 10, "D9D9D9"));
      });

      // ── 행12: 간격
      // ── 행13~40: 요약 데이터 (상차지+하차지+품목 그룹)
      const summaryMap = {};
      rows.forEach(row => {
        const key = `${row.from}||${row.to}||${row.work?.material}`;
        if (!summaryMap[key]) summaryMap[key] = { from: row.from, to: row.to, mat: row.work?.material, qty: 0, qtyM3: 0 };
        if (row.work?.unit === "㎥" || row.work?.unit === "m³") summaryMap[key].qtyM3 += Number(row.work?.qty) || 0;
        else summaryMap[key].qty += Number(row.work?.qty) || 0;
      });

      let dataRow = 13;
      Object.values(summaryMap).forEach(s => {
        const r = dataRow;
        C2(ws, `C${r}`, "", SB(false));
        C2(ws, `D${r}`, "", SB(false));
        C2(ws, `E${r}`, s.from || "", SB(false));
        C2(ws, `F${r}`, s.to || "", SB(false));
        C2(ws, `G${r}`, s.mat || "", SB(false));
        if (s.qty) { ws[`H${r}`] = { v: s.qty, t: "n", s: SB(false, "right") }; }
        else { C2(ws, `H${r}`, "", SB(false, "right")); }
        if (s.qtyM3) { ws[`I${r}`] = { v: s.qtyM3, t: "n", s: SB(false, "right") }; }
        else { C2(ws, `I${r}`, "", SB(false, "right")); }
        C2(ws, `J${r}`, "", SB(false, "right"));
        CF(ws, `K${r}`, `IF(H${r}<>"",J${r}*H${r},I${r}*J${r})`, SB(false, "right"));
        C2(ws, `L${r}`, "", SB(false));
        dataRow++;
      });

      // 빈행으로 40행까지 채우기
      while (dataRow <= 40) {
        const r = dataRow;
        ["C","D","E","F","G","H","I","J","K","L"].forEach(col => C2(ws, `${col}${r}`, "", SB(false)));
        dataRow++;
      }

      // ── 행41~42: 계
      ws["!merges"].push({ s: { r: 40, c: 2 }, e: { r: 41, c: 6 } });
      ws["!merges"].push({ s: { r: 40, c: 10 }, e: { r: 41, c: 11 } });
      C2(ws, "C41", "  계", SB(true));
      CF(ws, "H41", "SUM(H13:H40)", SB(true, "right"));
      CF(ws, "I41", "SUBTOTAL(9,I13:I40)", SB(true, "right"));
      C2(ws, "J41", "", SB(true, "right"));
      CF(ws, "K41", "SUM(K13:K40)", SB(true, "right"));

      // ── 행43: 빈행 (K42 레퍼런스 맞추기)
      ws["!merges"].push({ s: { r: 42, c: 2 }, e: { r: 42, c: 6 } });
      ws["!merges"].push({ s: { r: 42, c: 7 }, e: { r: 42, c: 9 } });
      ws["!merges"].push({ s: { r: 42, c: 10 }, e: { r: 42, c: 11 } });
      C2(ws, "C43", "", SB(false));
      C2(ws, "H43", "", SB(false));
      C2(ws, "K43", "", SB(false));

      // ── 행44: 공급가/부가세
      ws["!merges"].push({ s: { r: 43, c: 2 }, e: { r: 43, c: 6 } });
      ws["!merges"].push({ s: { r: 43, c: 7 }, e: { r: 43, c: 9 } });
      ws["!merges"].push({ s: { r: 43, c: 10 }, e: { r: 43, c: 11 } });
      C2(ws, "C44", "공급가/부가세", SB(false));
      CF(ws, "H44", "K41-K43", SB(false, "right"));
      CF(ws, "K44", "H44*0.1", SB(false, "right"));

      // ── 행45: 총계
      ws["!merges"].push({ s: { r: 44, c: 2 }, e: { r: 44, c: 6 } });
      ws["!merges"].push({ s: { r: 44, c: 7 }, e: { r: 44, c: 9 } });
      ws["!merges"].push({ s: { r: 44, c: 10 }, e: { r: 44, c: 11 } });
      C2(ws, "C45", "총    계", SB(true));
      CF(ws, "H45", "SUM(H41:H42)", SB(true, "right"));
      CF(ws, "I45", "SUM(I41:I42)", SB(true, "right"));
      CF(ws, "K45", "H44+K44", SB(true, "right"));

      // ── 행46~47: 담당자확인 / 계좌
      ws["!merges"].push({ s: { r: 45, c: 2 }, e: { r: 46, c: 4 } });
      ws["!merges"].push({ s: { r: 45, c: 5 }, e: { r: 45, c: 5 } });
      ws["!merges"].push({ s: { r: 45, c: 6 }, e: { r: 46, c: 11 } });
      C2(ws, "C46", "담당자확인", S(false));
      C2(ws, "G46", "* 아래 계좌로 입금부탁드립니다 *", S(true, "center", 10, "FFFF00"));

      // ── 행48: 계좌번호
      ws["!merges"].push({ s: { r: 47, c: 2 }, e: { r: 47, c: 11 } });
      C2(ws, "C48", "결재계좌번호: 955-024478-01-011  기업은행  ㈜ 다솔중기", S(true, "left", 11));

      // ── 행50: 빈행

      // ── 행51: 업체명
      ws["!merges"].push({ s: { r: 50, c: 2 }, e: { r: 50, c: 11 } });
      CF(ws, "C51", "E5", S(true, "left", 12));

      // ── 행52: 청구리스트 타이틀
      ws["!merges"].push({ s: { r: 51, c: 2 }, e: { r: 51, c: 11 } });
      const monthLabel = `( ${eD.slice(0, 7).replace("-", "년 ")}월 청구 리스트)`;
      C2(ws, "C52", monthLabel, S(false));

      // ── 행53: 상세 헤더 (파란 배경)
      ["월/일", "no.", "상차지", "하차지", "품명", "수량", "㎥", "단가", "금액", "비고"].forEach((h, i) => {
        C2(ws, `${String.fromCharCode(67 + i)}53`, h, SB(true, "center", 10, "4472C4"));
      });

      // ── 행54~: 상세 데이터 (날짜순)
      let detailRow = 54;
      const sortedRows = rows.slice().sort((a, b) => a.date.localeCompare(b.date));
      
      // 그룹별로 묶기 (상차지+하차지+품목)
      const groupMap = {};
      sortedRows.forEach(row => {
        const key = `${row.from}||${row.to}||${row.work?.material}`;
        if (!groupMap[key]) groupMap[key] = [];
        groupMap[key].push(row);
      });

      const groupKeys = [...new Set(sortedRows.map(r => `${r.from}||${r.to}||${r.work?.material}`))];
      groupKeys.forEach(key => {
        const gRows = groupMap[key];
        gRows.forEach(row => {
          const day = row.date ? Number(row.date.slice(8)) : "";
          const r = detailRow;
          ws[`C${r}`] = { v: day, t: day ? "n" : "s", s: SB(false, "right") };
          C2(ws, `D${r}`, row.vehicle || "", SB(false));
          C2(ws, `E${r}`, row.from || "", SB(false));
          C2(ws, `F${r}`, row.to || "", SB(false));
          C2(ws, `G${r}`, row.work?.material || "", SB(false));
          const qty = Number(row.work?.qty) || 0;
          const isM3 = row.work?.unit === "㎥" || row.work?.unit === "m³";
          if (!isM3 && qty) { ws[`H${r}`] = { v: qty, t: "n", s: SB(false, "right") }; }
          else { C2(ws, `H${r}`, "", SB(false, "right")); }
          if (isM3 && qty) { ws[`I${r}`] = { v: qty, t: "n", s: SB(false, "right") }; }
          else { C2(ws, `I${r}`, "", SB(false, "right")); }
          C2(ws, `J${r}`, "", SB(false, "right"));
          C2(ws, `K${r}`, "", SB(false, "right"));
          C2(ws, `L${r}`, "", SB(false));
          detailRow++;
        });
        // 소계 행
        const subStart = detailRow - gRows.length;
        const subEnd = detailRow - 1;
        const sr = detailRow;
        ws["!merges"].push({ s: { r: sr - 1, c: 2 }, e: { r: sr - 1, c: 6 } });
        C2(ws, `C${sr}`, "", SB(false, "left", 10, "F2F2F2"));
        CF(ws, `H${sr}`, `SUM(H${subStart}:H${subEnd})`, SB(true, "right", 10, "F2F2F2"));
        C2(ws, `I${sr}`, "", SB(false, "right", 10, "F2F2F2"));
        C2(ws, `J${sr}`, "", SB(false, "right", 10, "F2F2F2"));
        C2(ws, `K${sr}`, "", SB(false, "right", 10, "F2F2F2"));
        C2(ws, `L${sr}`, "", SB(false, 10, "F2F2F2"));
        detailRow++;
      });

      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: detailRow, c: 11 } });
      XLSX.utils.book_append_sheet(wb, ws, client.slice(0, 31));
    });

    const suffix = closingType === "mid" ? "25일마감" : "말일마감";
    xlsxDl(wb, `청구서_${suffix}_${sD}_${eD}.xlsx`);
  };


  // ── 기사별 정산서 xlsx — 5623/6821/6957 양식 그대로 ──────────
  const downloadByVehicle = () => {
    const XLSX = window.XLSX;
    if (!XLSX) { alert("잠시 후 다시 시도해주세요."); return; }

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
            <Btn onClick={() => downloadByClient("mid")} color={C.blue} style={{ flex: 1 }} disabled={reportRecs.length === 0}>📤 청구(25일마감)</Btn>
            <Btn onClick={() => downloadByClient("end")} color={C.blue} style={{ flex: 1 }} disabled={reportRecs.length === 0}>📤 청구(말일마감)</Btn>
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
          setMappings={setMappings}
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
                mappings={mappings} setMappings={updateMappings}
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
