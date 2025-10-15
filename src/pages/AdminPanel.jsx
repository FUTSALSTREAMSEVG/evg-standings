import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const LOGO_BUCKET = "team-logos";

// --- Helpers ISO week (lunes-domingo)
function isoWeekInfo(dIn) {
  const d = new Date(Date.UTC(dIn.getFullYear(), dIn.getMonth(), dIn.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7 + 1; // lunes=1..domingo=7
  d.setUTCDate(d.getUTCDate() + (4 - dayNum)); // mover a jueves de esa semana
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const isoYear = d.getUTCFullYear();
  return { isoYear, weekNo, key: `${isoYear}-W${String(weekNo).padStart(2, "0")}` };
}

// Convierte "YYYY-MM-DDTHH:mm" local a ISO con offset
function localToISOWithOffset(local) {
  if (!local) return null;
  const [YMD, HM] = local.split("T");
  if (!HM) return null;
  const [y, m, d] = YMD.split("-").map(Number);
  const [hh, mm] = HM.split(":").map(Number);
  const n = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  const off = n.getTimezoneOffset();
  const sign = off > 0 ? "-" : "+";
  const abs = Math.abs(off);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${sign}${oh}:${om}`;
}

function formatearHora(dt) {
  if (!dt) return "";
  const f = new Date(dt);
  let h = f.getHours();
  const m = String(f.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function AdminPanel({ onExit }) {
  const [loading, setLoading] = useState(false);

  // pestañas intactas
  const [activeTab, setActiveTab] = useState("crear"); // crear | equipos | backup

  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [posiciones, setPosiciones] = useState([]);

  // crear partido
  const [tipoPartido, setTipoPartido] = useState("group"); // "group" | "elim"
  const [grupo, setGrupo] = useState("A");
  const [semana, setSemana] = useState(1);
  const [faseSel, setFaseSel] = useState("");   // fase existente seleccionada
  const [faseName, setFaseName] = useState(""); // input (nuevo nombre o renombre)

  const [equipo1, setEquipo1] = useState("");
  const [equipo2, setEquipo2] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");

  // edición partido (inline)
  const [editando, setEditando] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  // ====== Selector único (igual a Programación) ======
  // valores: "S:NN" (semana grupos) | "FEW:NN" (semana ISO eliminatoria)
  const [selector, setSelector] = useState("");
  const didInitFilters = useRef(false);

  useEffect(() => {
    recargarTodo();
    const ch = supabase
      .channel("realtime-evg-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, recargarTodo)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, recargarTodo)
      .on("postgres_changes", { event: "*", schema: "public", table: "initial_standings" }, recargarTodo)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, []);

  async function recargarTodo() {
    setLoading(true);
    try {
      const { data: t } = await supabase.from("teams").select("id,name,group_label,logo_url").order("name");
      const { data: m } = await supabase.from("matches").select("*").order("match_datetime", { ascending: true });
      const { data: s } = await supabase.from("initial_standings").select("*");

      setEquipos(t || []);
      setPartidos(m || []);
      setPosiciones(s || []);

      // SOLO en el primer load fijamos un default, luego no tocamos la elección del usuario
      if (!didInitFilters.current) {
        const { feSemanas } = computeFEWeeks(m || []);
        const semanasGrupos = Array.from(new Set((m || []).map(x => x.week_number).filter(n => typeof n === "number"))).sort((a,b)=>a-b);
        const lastFE = feSemanas[feSemanas.length - 1];
        const lastW = semanasGrupos[semanasGrupos.length - 1];
        if (lastFE) setSelector(`FEW:${lastFE}`);
        else if (typeof lastW === "number") setSelector(`S:${lastW}`);
        didInitFilters.current = true;
      } else {
        // mantener selector actual; si desaparece la opción, elegimos un fallback coherente
        const { feSemanas } = computeFEWeeks(m || []);
        if (selector.startsWith("FEW:")) {
          const n = parseInt(selector.slice(4), 10);
          if (!feSemanas.includes(n)) {
            const lastFE = feSemanas[feSemanas.length - 1];
            if (lastFE) setSelector(`FEW:${lastFE}`);
          }
        } else if (selector.startsWith("S:")) {
          const w = parseInt(selector.slice(2), 10);
          const semanasGrupos = Array.from(new Set((m || []).map(x => x.week_number).filter(n => typeof n === "number")));
          if (!semanasGrupos.includes(w)) {
            const lastW = semanasGrupos.sort((a,b)=>a-b).pop();
            if (typeof lastW === "number") setSelector(`S:${lastW}`);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  // ====== datos derivados ======
  const partidosOrd = useMemo(
    () => (partidos || []).slice().sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime)),
    [partidos]
  );

  const semanasGrupos = useMemo(
    () => Array.from(new Set(partidosOrd.filter(p => p.phase_type !== "elim" && typeof p.week_number === "number").map(p => p.week_number))).sort((a,b)=>a-b),
    [partidosOrd]
  );

  function computeFEWeeks(list) {
    const keys = [];
    const byKey = new Map(); // key ISO -> array matches
    for (const p of list) {
      if (p.phase_type === "elim" && p.match_datetime) {
        const { key } = isoWeekInfo(new Date(p.match_datetime));
        if (!byKey.has(key)) {
          byKey.set(key, []);
          keys.push(key);
        }
        byKey.get(key).push(p);
      }
    }
    keys.sort((a, b) => a.localeCompare(b));
    const indexToKey = keys;
    const feSemanas = keys.map((_, i) => i + 1);
    const keyByIndex = (n) => indexToKey[n - 1] || null;
    return { feSemanas, keyByIndex, byKey };
  }

  const feMeta = useMemo(() => computeFEWeeks(partidosOrd), [partidosOrd]);

  const equiposScope = useMemo(() => {
    if (tipoPartido === "elim") return equipos;
    return equipos.filter((t) => (t.group_label || "").toUpperCase() === grupo);
  }, [equipos, grupo, tipoPartido]);

  const idEquipo1 = useMemo(() => equiposScope.find((t) => t.name === equipo1)?.id ?? null, [equiposScope, equipo1]);
  const yaJugaron = (a, b) =>
    (partidos || []).some((m) => (m.home_team === a && m.away_team === b) || (m.home_team === b && m.away_team === a));
  const rivalesDisponibles = useMemo(() => {
    if (!idEquipo1) return equiposScope.filter((t) => t.name !== equipo1).map((t) => t.name);
    return equiposScope.filter((r) => r.id !== idEquipo1 && !yaJugaron(idEquipo1, r.id)).map((r) => r.name);
  }, [equiposScope, idEquipo1, equipo1, partidos]);

  async function guardarPartido() {
    if (!equipo1 || !equipo2 || equipo1 === equipo2 || !fecha || !hora) return;

    const t1 = equipos.find((t) => t.name === equipo1);
    const t2 = equipos.find((t) => t.name === equipo2);
    if (!t1 || !t2) return;

    if (yaJugaron(t1.id, t2.id)) {
      alert("Estos equipos ya jugaron entre sí.");
      return;
    }

    const iso = localToISOWithOffset(`${fecha}T${hora}`);

    let phaseType = "group";
    let phase = null;
    let payloadExtra = {};
    if (tipoPartido === "elim") {
      phaseType = "elim";
      const f = (faseSel || "").trim() || (faseName || "").trim();
      if (!f) {
        alert("Ponle un nombre a la fase (ej: Cuartos de final).");
        return;
      }
      phase = f;
      payloadExtra = { group_label: null, week_number: null };
    } else {
      payloadExtra = { group_label: grupo, week_number: Number(semana) || null };
    }

    const payload = {
      home_team: t1.id,
      away_team: t2.id,
      home_score: null,
      away_score: null,
      played: false,
      match_datetime: iso,
      phase_type: phaseType,
      phase,
      ...payloadExtra,
    };

    const { error } = await supabase.from("matches").insert([payload]);
    if (error) {
      alert("Error al crear partido: " + error.message);
      return;
    }

    // limpiar form mínimos (no tocamos selector)
    setEquipo1(""); setEquipo2(""); setFecha(""); setHora("");
    if (tipoPartido === "elim" && faseName.trim()) setFaseName(faseName.trim());

    await recargarTodo(); // mantiene el selector vigente
  }

  // ====== renombrar fase inline (selector + input) ======
  async function renombrarFaseInline() {
    const src = (faseSel || "").trim();
    const dst = (faseName || "").trim();
    if (!src) { alert("Selecciona primero una fase existente en el selector."); return; }
    if (!dst) { alert("Escribe el nuevo nombre en el campo de fase."); return; }
    if (src === dst) { alert("El nuevo nombre es igual al actual."); return; }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({ phase: dst })
        .eq("phase_type", "elim")
        .eq("phase", src);
      if (error) { alert("No se pudo renombrar: " + error.message); return; }
      setFaseSel(dst);
      await recargarTodo();
      alert(`Fase renombrada de "${src}" a "${dst}".`);
    } finally {
      setLoading(false);
    }
  }

  // ==== estilos comunes (coinciden con Programación) ====
  const ORANGE = "#F17F26";
  const solidCard = {
    background: "linear-gradient(180deg, #0b0b0b 0%, #141414 100%)",
    border: "1px solid rgba(241,127,38,0.65)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.50), inset 0 0 0 1px rgba(255,255,255,0.06)",
  };
  const chipBase = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "3px 12px",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  };
  const chipHora = {
    ...chipBase,
    background: "linear-gradient(180deg, #0b0b0b 0%, #111 100%)",
    color: "#ffffff",
    border: `1px solid ${ORANGE}`,
    boxShadow: `0 0 0 1px ${ORANGE}40, 0 0 12px ${ORANGE}26, inset 0 0 0 1px rgba(255,255,255,0.06)`,
    textShadow: "0 0 6px rgba(0,0,0,0.45)",
    fontVariantNumeric: "tabular-nums",
  };
  const chipMeta = {
    ...chipBase,
    background: "#ffffff",
    color: "#000000",
    border: `1px solid ${ORANGE}`,
  };
  const metaLabel = { color: ORANGE, fontWeight: 900 };

  // ====== util UI (igual a Programación) ======
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const onChange = () => setIsPortrait(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const nombreEquipoById = (id) => equipos.find((t) => t.id === id)?.name || "??";

  const gridColsStyle = {
    display: "grid",
    gridTemplateColumns: isPortrait
      ? "repeat(auto-fit, minmax(220px, 1fr))"
      : "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    alignItems: "start",
    justifyItems: "stretch",
    width: "100%",
    margin: "0 auto",
    padding: "0 8px",
    overflowX: "hidden",
  };

  const listGridFull = { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 };

  const logoBase = {
    width: "clamp(42px, 8vw, 92px)",
    height: "auto",
    objectFit: "contain",
    justifySelf: "center",
  };

  const scoreBox = {
    minWidth: 68,
    padding: "4px 10px",
    border: "1px solid rgba(255,255,255,0.28)",
    borderRadius: 10,
    fontWeight: 800,
    fontSize: "clamp(14px, 3.5vw, 18px)",
    letterSpacing: 0.3,
    textAlign: "center",
    background: "rgba(255,255,255,0.06)",
    whiteSpace: "nowrap",
  };

  const filaGrid = {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
    alignItems: "center",
    justifyItems: "center",
    gap: 8,
  };

  const nombreStyle = {
    fontSize: "clamp(11px, 1.9vw, 14px)",
    fontWeight: 700,
    lineHeight: 1.15,
    textAlign: "center",
    maxWidth: "18ch",
    margin: "0 auto",
    overflowWrap: "anywhere",
  };

  // ====== filtrado según selector (igual a Programación) ======
  const listaFiltrada = useMemo(() => {
    if (!selector) return [];
    if (selector.startsWith("S:")) {
      const sem = parseInt(selector.slice(2), 10);
      return partidosOrd.filter((p) => p.phase_type !== "elim" && p.week_number === sem);
    }
    if (selector.startsWith("FEW:")) {
      const n = parseInt(selector.slice(4), 10);
      const key = feMeta.keyByIndex(n);
      if (!key) return [];
      const arr = feMeta.byKey.get(key) || [];
      return arr.slice().sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime));
    }
    return [];
  }, [selector, partidosOrd, feMeta]);

  // ===== agrupar por día para columnas =====
  const ymd = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const tituloDia = (iso) => {
    const f = new Date(iso);
    const dias = ["DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO"];
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return `${dias[f.getDay()]} ${f.getDate()} de ${meses[f.getMonth()]}`.toUpperCase();
  };

  const gruposPorDia = useMemo(() => {
    const g = new Map();
    for (const p of listaFiltrada) {
      if (!p.match_datetime) continue;
      const key = ymd(p.match_datetime);
      if (!g.has(key)) g.set(key, []);
      g.get(key).push(p);
    }
    return Array.from(g.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([diaKey, arr]) => [diaKey, arr.slice().sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime))]);
  }, [listaFiltrada]);

  // ====== RENDER ======
  return (
    <div>
      <header className="app-header">
        <div />
        <div className="brand-line">
          <img
            src="/logo-evg.png"
            alt="Logo"
            className="brand-logo"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <h1 className="brand-title">PANEL ADMIN — TORNEO EVG</h1>
        </div>
        <div style={{ justifySelf: "end", display: "flex", gap: 8 }}>
          <button onClick={onExit}>Inicio</button>
        </div>
      </header>

      {/* Pestañas */}
      <nav className="tabs-nav" style={{ marginTop: 8 }}>
        <button className={`tab-btn ${activeTab === "crear" ? "active" : ""}`} onClick={() => setActiveTab("crear")}>
          CREAR PARTIDO
        </button>
        <button className={`tab-btn ${activeTab === "equipos" ? "active" : ""}`} onClick={() => setActiveTab("equipos")}>
          GESTIÓN DE EQUIPOS
        </button>
        <button className={`tab-btn ${activeTab === "backup" ? "active" : ""}`} onClick={() => setActiveTab("backup")}>
          BACKUP
        </button>
      </nav>

      <section style={{ padding: 16 }}>
        {loading && (
          <div className="panel center-max-900" style={{ textAlign: "center", marginBottom: 12 }}>
            <p style={{ color: "#bbb" }}>Cargando…</p>
          </div>
        )}

        {/* TAB: CREAR PARTIDO */}
        {activeTab === "crear" && (
          <>
            <div className="panel center-max-900" style={{ textAlign: "center" }}>
              <h3>CREAR PARTIDO</h3>

              {/* Controles de creación */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
                <label>Tipo:</label>
                <select
                  value={tipoPartido}
                  onChange={(e) => {
                    setTipoPartido(e.target.value);
                    setEquipo1(""); setEquipo2("");
                  }}
                >
                  <option value="group">Fase de grupos</option>
                  <option value="elim">Fase eliminatoria</option>
                </select>

                {tipoPartido === "group" && (
                  <>
                    <label>Grupo:</label>
                    <select
                      value={grupo}
                      onChange={(e) => {
                        setGrupo(e.target.value);
                        setEquipo1(""); setEquipo2("");
                      }}
                    >
                      {["A","B","C","D","E"].map((code) => (
                        <option key={code} value={code}>{`Grupo ${code}`}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={semana}
                      onChange={(e) => setSemana(Number(e.target.value))}
                      style={{ width: 90 }}
                      placeholder="Semana"
                    />
                  </>
                )}

                {tipoPartido === "elim" && (
                  <>
                    <label>Fase:</label>
                    <select
                      value={faseSel}
                      onChange={(e) => setFaseSel(e.target.value)}
                      style={{ minWidth: 180 }}
                    >
                      <option value="">— Elegir guardada —</option>
                      {Array.from(new Set(partidosOrd.filter(p=>p.phase_type==="elim" && p.phase).map(p=>p.phase)))
                        .sort((a,b)=>a.localeCompare(b))
                        .map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                    <input
                      placeholder="o escribe un nombre (ej: Cuartos de final)"
                      value={faseName}
                      onChange={(e) => setFaseName(e.target.value)}
                      style={{ minWidth: 260 }}
                    />
                    {/* ✏️ EDITAR NOMBRE INLINE */}
                    <button
                      title="Renombrar fase seleccionada al nuevo nombre"
                      onClick={renombrarFaseInline}
                      disabled={!faseSel || !faseName || faseSel.trim() === faseName.trim()}
                      style={{ borderColor: "rgba(241,127,38,0.8)" }}
                    >
                      ✏️ Editar nombre
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
                <select
                  value={equipo1}
                  onChange={(e) => {
                    setEquipo1(e.target.value);
                    setEquipo2("");
                  }}
                >
                  <option value="">Equipo 1</option>
                  { (tipoPartido === "elim" ? equipos : equipos.filter((t)=> (t.group_label||"").toUpperCase() === grupo)).map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>

                <select value={equipo2} onChange={(e) => setEquipo2(e.target.value)} disabled={!equipo1}>
                  <option value="">{equipo1 ? "Rival disponible" : "Elige Equipo 1"}</option>
                  { (tipoPartido === "elim" ? equipos : equipos.filter((t)=> (t.group_label||"").toUpperCase() === grupo))
                      .filter((r)=> r.name !== equipo1)
                      .map((r) => (<option key={r.id} value={r.name}>{r.name}</option>)) }
                </select>

                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                <button onClick={guardarPartido} disabled={!equipo1 || !equipo2 || !fecha || !hora}>
                  Crear Partido
                </button>
              </div>
            </div>

            {/* SELECTOR igual a Programación */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center", margin: "12px auto 8px", flexWrap: "wrap" }}>
              <span>Ver (Admin):</span>
              <select value={selector} onChange={(e) => setSelector(e.target.value)}>
                {semanasGrupos.length > 0 && (
                  <optgroup label="Semanas">
                    {semanasGrupos.map((w) => (
                      <option key={`S${w}`} value={`S:${w}`}>{`Semana ${w}`}</option>
                    ))}
                  </optgroup>
                )}
                {feMeta.feSemanas.length > 0 && (
                  <optgroup label="Fase Eliminatoria (por semana)">
                    {feMeta.feSemanas.map((n) => (
                      <option key={`FEW${n}`} value={`FEW:${n}`}>{`F.E. Semana ${n}`}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* LISTADO AGRUPADO POR DÍA EN COLUMNAS (igual a Programación) */}
            <div style={gridColsStyle}>
              {(() => {
                if (!listaFiltrada.length) {
                  return <p style={{ color: "#bbb", textAlign: "center", gridColumn: "1 / -1" }}>No hay partidos.</p>;
                }
                return gruposPorDia.map(([diaKey, arr]) => (
                  <section
                    key={diaKey}
                    className="panel"
                    style={{ padding: 8, width: "100%", maxWidth: 420, margin: "0 auto" }}
                  >
                    <h4 style={{ color: "#fff", opacity: 0.95, textAlign: "center", margin: "6px 0 10px", fontSize: "clamp(14px, 2.2vw, 16px)", lineHeight: 1.2 }}>
                      {tituloDia(arr[0].match_datetime)}
                    </h4>

                    <ul style={listGridFull}>
                      {arr.map((p) => {
                        const haveScore = p.home_score != null && p.away_score != null;

                        return (
                          <li key={p.id} className="admin-card hoverable"
                              style={{ width: "100%", textAlign: "center", padding: 8, ...solidCard }}>
                            {/* CHIPS */}
                            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                              <span style={chipHora}>
                                <span style={{ color: ORANGE }} aria-hidden>⏱</span>
                                <span>{formatearHora(p.match_datetime)}</span>
                              </span>
                              <span style={chipMeta}>
                                {p.phase_type === "elim" ? (
                                  <>
                                    <span style={{ color: ORANGE, fontWeight: 900 }}>FASE</span>&nbsp;{p.phase}
                                  </>
                                ) : (
                                  <>
                                    <span style={{ color: ORANGE, fontWeight: 900 }}>GRUPO</span>&nbsp;{p.group_label}
                                  </>
                                )}
                              </span>
                            </div>

                            {/* Logos + marcador + nombres (compacto) */}
                            <div className="logos-row" style={filaGrid}>
                              <span style={{ ...nombreStyle }}>{nombreEquipoById(p.home_team)}</span>
                              <div className="big-score" style={scoreBox}>{haveScore ? `${p.home_score} - ${p.away_score}` : "VS"}</div>
                              <span style={{ ...nombreStyle }}>{nombreEquipoById(p.away_team)}</span>
                            </div>

                            {/* Acciones admin */}
                            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                              <button onClick={() => {
                                setEditando(p.id);
                                const d = new Date(p.match_datetime);
                                const Y = d.getFullYear();
                                const M = String(d.getMonth() + 1).padStart(2, "0");
                                const D = String(d.getDate()).padStart(2, "0");
                                const h = String(d.getHours()).padStart(2, "0");
                                const m = String(d.getMinutes()).padStart(2, "0");
                                setEditDraft({ ...p, edit_date: `${Y}-${M}-${D}`, edit_time: `${h}:${m}` });
                              }}>
                                Editar
                              </button>
                              <button
                                onClick={async () => {
                                  if (!window.confirm("¿Eliminar partido?")) return;
                                  await supabase.from("matches").delete().eq("id", p.id);
                                  await recargarTodo();
                                }}
                                style={{ background: "rgba(255,0,0,0.25)", borderColor: "rgba(255,0,0,0.6)" }}
                              >
                                Eliminar
                              </button>
                            </div>

                            {/* Editor inline */}
                            {editando === p.id && (
                              <div className="panel" style={{ padding: 8, marginTop: 8 }}>
                                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                  <input type="number" placeholder="Home" value={editDraft.home_score ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, home_score: e.target.value }))} />
                                  <input type="number" placeholder="Away" value={editDraft.away_score ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, away_score: e.target.value }))} />
                                  <input type="date" value={editDraft.edit_date || ""} onChange={(e) => setEditDraft((d) => ({ ...d, edit_date: e.target.value }))} />
                                  <input type="time" value={editDraft.edit_time || ""} onChange={(e) => setEditDraft((d) => ({ ...d, edit_time: e.target.value }))} />
                                  <input type="number" value={editDraft.week_number ?? ""} placeholder="Semana (solo grupos)" onChange={(e) => setEditDraft((d) => ({ ...d, week_number: e.target.value }))} />
                                </div>
                                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
                                  <button
                                    onClick={async () => {
                                      const localCombined = editDraft.edit_date && editDraft.edit_time ? `${editDraft.edit_date}T${editDraft.edit_time}` : null;
                                      const iso = localCombined ? localToISOWithOffset(localCombined) : null;
                                      const payload = {
                                        home_score: editDraft.home_score === "" ? null : Number(editDraft.home_score),
                                        away_score: editDraft.away_score === "" ? null : Number(editDraft.away_score),
                                        played: editDraft.home_score !== "" && editDraft.away_score !== "",
                                        match_datetime: iso,
                                        week_number: editDraft.phase_type === "elim" ? null : (Number(editDraft.week_number) || null),
                                      };
                                      const { error } = await supabase.from("matches").update(payload).eq("id", editDraft.id);
                                      if (error) { alert("No se pudo actualizar: " + error.message); return; }
                                      setEditando(null); setEditDraft(null);
                                      await recargarTodo(); // selector se mantiene
                                    }}
                                  >
                                    Guardar
                                  </button>
                                  <button onClick={() => { setEditando(null); setEditDraft(null); }}>Cancelar</button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ));
              })()}
            </div>
          </>
        )}

        {/* TAB: GESTIÓN DE EQUIPOS (tu UI original) */}
        {activeTab === "equipos" && (
          <div className="panel center-max-900" style={{ marginTop: 0 }}>
            <h3 style={{ textAlign: "center" }}>GESTIÓN DE EQUIPOS (TORNEO)</h3>
            {/* tu UI de equipos permanece igual */}
          </div>
        )}

        {/* TAB: BACKUP (con subida a Storage) */}
        {activeTab === "backup" && (
          <div className="panel center-max-900" style={{ textAlign: "center" }}>
            <h3>BACKUP</h3>
            <p style={{ opacity: 0.8, marginBottom: 8 }}>
              Exporta/Importa datos (equipos, standings, partidos) del Torneo EVG.
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { data: t } = await supabase.from("teams").select("*");
                    const { data: s } = await supabase.from("initial_standings").select("*");
                    const { data: m } = await supabase.from("matches").select("*");
                    const blob = new Blob([JSON.stringify({ teams: t, standings: s, matches: m }, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `backup-evg-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Descargar backup (.json)
              </button>

              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { data: auth } = await supabase.auth.getSession();
                    if (!auth?.session) {
                      alert("Para guardar en Storage necesitas sesión iniciada.");
                      return;
                    }

                    const [{ data: t }, { data: s }, { data: m }] = await Promise.all([
                      supabase.from("teams").select("*"),
                      supabase.from("initial_standings").select("*"),
                      supabase.from("matches").select("*"),
                    ]);
                    const payload = JSON.stringify({ teams: t || [], standings: s || [], matches: m || [] }, null, 2);
                    const blob = new Blob([payload], { type: "application/json" });
                    const fileName = `evg-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

                    const up = await supabase.storage.from("backups").upload(fileName, blob, {
                      upsert: false,
                      contentType: "application/json",
                      cacheControl: "3600",
                    });

                    if (up?.error) {
                      if (String(up.error.message || "").toLowerCase().includes("bucket not found")) {
                        alert(
                          "El bucket 'backups' no existe.\n\nCrea el bucket llamado EXACTAMENTE: backups\n(Dashboard → Storage → New bucket) y vuelve a intentar."
                        );
                      } else {
                        alert("Error al guardar en Supabase: " + up.error.message);
                      }
                      return;
                    }

                    const { data: pub } = supabase.storage.from("backups").getPublicUrl(fileName);
                    let msg = `Backup guardado como ${fileName}`;
                    if (pub?.publicUrl) {
                      msg += `\nURL pública:\n${pub.publicUrl}`;
                    } else {
                      const { data: signed } = await supabase.storage.from("backups").createSignedUrl(fileName, 60 * 60);
                      if (signed?.signedUrl) msg += `\nURL temporal (1h):\n${signed.signedUrl}`;
                    }
                    alert(msg);
                  } catch (err) {
                    alert("Error al guardar en Supabase: " + (err?.message || String(err)));
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Guardar backup en Supabase
              </button>

              <label className="button-like">
                Importar backup (.json)
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!window.confirm("Restaurar backup? Esto insertará/actualizará registros.")) return;
                    const text = await file.text();
                    const { teams = [], standings = [], matches = [] } = JSON.parse(text || "{}");
                    setLoading(true);
                    try {
                      if (teams.length) await supabase.from("teams").upsert(teams, { onConflict: "id" });
                      if (standings.length) await supabase.from("initial_standings").upsert(standings, { onConflict: "team_id" });
                      if (matches.length) await supabase.from("matches").upsert(matches, { onConflict: "id" });
                      alert("Backup restaurado.");
                      await recargarTodo();
                    } catch (err) {
                      alert("Error al restaurar: " + (err?.message || String(err)));
                    } finally {
                      setLoading(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
