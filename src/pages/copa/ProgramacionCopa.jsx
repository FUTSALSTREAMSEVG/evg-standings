// src/pages/copa/ProgramacionCopa.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";

const slugify = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

// Semana ISO (se mantiene por si en algún lugar lo usas)
function isoWeekInfo(dIn) {
  const d = new Date(Date.UTC(dIn.getFullYear(), dIn.getMonth(), dIn.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7 + 1;
  d.setUTCDate(d.getUTCDate() + (4 - dayNum));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const isoYear = d.getUTCFullYear();
  return { isoYear, weekNo, key: `${isoYear}-W${String(weekNo).padStart(2, "0")}` };
}

const penText = (p) =>
  p?.pen_home != null && p?.pen_away != null ? `( ${p.pen_home} – ${p.pen_away} pen. )` : null;

export default function ProgramacionCopa({ partidos, equipos, isLoading = false }) {
  // ====== helpers equipo ======
  const teamById = (id) => (equipos || []).find((t) => t.id === id) || null;
  const nombreEquipo = (id) => teamById(id)?.name || "??";
  const escudo = (id) => {
    const t = teamById(id);
    const n = t?.name || "";
    return t?.logo_url || `/logos/${slugify(n)}.webp`;
  };
  const onLogoError = (e, id) => {
    const el = e.currentTarget;
    const n = nombreEquipo(id);
    if (/\.webp(\?.*)?$/i.test(el.src)) el.src = `/logos/${slugify(n)}.png`;
    else {
      el.style.visibility = "hidden";
      el.style.width = "0px";
      el.style.height = "0px";
    }
  };

  const horaStr = (iso) => {
    if (!iso) return "";
    const f = new Date(iso);
    let h = f.getHours();
    const m = String(f.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };
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

  // ===== ordenar por fecha/hora =====
  const partidosOrd = useMemo(
    () => (partidos || []).slice().sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime)),
    [partidos]
  );

  // ======== construir opciones del selector ========
  // Grupos con partidos (fase de grupos)
  const gruposUnicos = useMemo(() => {
    const s = new Set(
      (partidosOrd || [])
        .filter((p) => p.phase_type !== "elim" && p.group_label)
        .map((p) => String(p.group_label).trim())
    );
    // Orden tipo A, B, C... (alfanumérico)
    return Array.from(s).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [partidosOrd]);

  // Fases de eliminación con partidos (usamos el nombre visible)
  const fasesKO = useMemo(() => {
    const map = new Map(); // phaseName -> primer timestamp (para ordenar por fecha)
    for (const p of partidosOrd) {
      if (p.phase_type === "elim") {
        const name = (p.phase_name || p.phase || "ELIMINATORIA").toString();
        const t = new Date(p.match_datetime || Date.now()).getTime();
        if (!map.has(name) || t < map.get(name)) map.set(name, t);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);
  }, [partidosOrd]);

  // ===== selector =====
  // Valores: "ALL" | `G:${label}` | `KO:${phaseName}`
  const [selector, setSelector] = useState("ALL");
  useEffect(() => {
    // si no hay partidos, mantenemos "ALL"
    if (!partidosOrd.length) return;
    setSelector("ALL"); // por pedido: default = Todos
  }, [partidosOrd.length]);

  // ===== columnas del contenedor de DÍAS: 1..6 según ancho (igual que ya tenías) =====
  const gridRef = useRef(null);
  const [cols, setCols] = useState(2);

  useEffect(() => {
    const MIN_CARD = 260; // ancho mínimo por columna (panel Día)
    const calc = () => {
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      const w = gridRef.current?.clientWidth || window.innerWidth;
      const posibles = Math.max(1, Math.floor(w / MIN_CARD));
      if (portrait) setCols(Math.min(2, posibles));
      else setCols(Math.min(6, posibles));
    };
    calc();
    window.addEventListener("resize", calc);
    const mq = window.matchMedia("(orientation: portrait)");
    mq.addEventListener?.("change", calc);
    return () => {
      window.removeEventListener("resize", calc);
      mq.removeEventListener?.("change", calc);
    };
  }, []);

  // ===== lista por selector =====
  const listaFiltrada = useMemo(() => {
    if (selector === "ALL") return partidosOrd;

    if (selector.startsWith("G:")) {
      const label = selector.slice(2);
      return partidosOrd.filter((p) => p.phase_type !== "elim" && String(p.group_label).trim() === label);
    }

    if (selector.startsWith("KO:")) {
      const phase = selector.slice(3);
      return partidosOrd.filter(
        (p) =>
          p.phase_type === "elim" &&
          (String(p.phase_name || "").trim() === phase || String(p.phase || "").trim() === phase)
      );
    }

    return partidosOrd;
  }, [selector, partidosOrd]);

  // ===== agrupar por día =====
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

  // ===== estilos contenedor de DÍAS (grid) =====
  const gridColsStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gap: 12,
    alignItems: "start",
    justifyItems: "stretch",
    width: "100%",
    margin: "0 auto",
    padding: "0 8px",
    overflowX: "hidden",
  };

  // disposición dentro de la tarjeta (igual que ya tenías)
  const filaGrid = {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
    alignItems: "center",
    justifyItems: "center",
    gap: 8,
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

  const logoStyle = {
    width: "clamp(60px, 11vw, 112px)",
    height: "auto",
    objectFit: "contain",
    justifySelf: "center",
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

  const ORANGE = "#F17F26";
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
  const chipMeta = { ...chipBase, background: "#ffffff", color: "#000000", border: `1px solid ${ORANGE}` };
  const metaLabel = { color: ORANGE, fontWeight: 900 };

  return (
    <section id="copa-programacion" className="section-programacion" style={{ padding: "12px 8px" }}>
      <div className="center-max-1200" style={{ maxWidth: "100%", overflow: "hidden" }}>
        {/* Selector (actualizado) */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center", margin: "4px auto 6px auto", flexWrap: "wrap" }}>
          <span>Ver:</span>
          <select value={selector} onChange={(e) => setSelector(e.target.value)}>
            <option value="ALL">Todos</option>

            {gruposUnicos.length > 0 && (
              <optgroup label="Por grupos">
                {gruposUnicos.map((g) => (
                  <option key={`G:${g}`} value={`G:${g}`}>{`Grupo ${g}`}</option>
                ))}
              </optgroup>
            )}

            {fasesKO.length > 0 && (
              <optgroup label="Fase eliminatoria">
                {fasesKO.map((ph) => (
                  <option key={`KO:${ph}`} value={`KO:${ph}`}>{ph}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <h3 className="section-title" style={{ textAlign: "center", color: "#fff", margin: "0 0 8px" }}>
          {selector === "ALL"
            ? "PARTIDOS — TODOS"
            : selector.startsWith("G:")
            ? `PARTIDOS — GRUPO ${selector.slice(2)}`
            : selector.startsWith("KO:")
            ? `PARTIDOS — ${selector.slice(3).toUpperCase()}`
            : "PARTIDOS"}
        </h3>

        {isLoading && <p style={{ color: "#bbb", textAlign: "center" }}>Cargando…</p>}

        {!isLoading && (() => {
          if (!listaFiltrada.length) {
            return <p style={{ color: "#bbb", textAlign: "center" }}>No hay partidos para esta selección.</p>;
          }

          // Agrupar por día
          const g = new Map();
          for (const p of listaFiltrada) {
            if (!p.match_datetime) continue;
            const key = ymd(p.match_datetime);
            if (!g.has(key)) g.set(key, []);
            g.get(key).push(p);
          }
          const grupos = Array.from(g.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([diaKey, arr]) => [diaKey, arr.slice().sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime))]);

          return (
            <div ref={gridRef} className="days-grid" style={gridColsStyle}>
              {grupos.map(([diaKey, arr]) => (
                <section key={diaKey} className="panel" style={{ padding: 8, width: "100%", margin: "0 auto" }}>
                  <h4 style={{ color: "#fff", opacity: 0.95, textAlign: "center", margin: "6px 0 10px", fontSize: "clamp(14px, 2.2vw, 16px)", lineHeight: 1.2 }}>
                    {tituloDia(arr[0].match_datetime)}
                  </h4>

                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {arr.map((p) => {
                      const haveScore = p.home_score != null && p.away_score != null;
                      const isElim = p.phase_type === "elim";
                      const homeName = nombreEquipo(p.home_team);
                      const awayName = nombreEquipo(p.away_team);

                      return (
                        <li key={p.id} className="match-card hoverable" style={{ width: "100%", textAlign: "center", padding: 8 }}>
                          {/* Chips superiores */}
                          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                            <span style={chipHora}>
                              <span style={{ color: ORANGE }} aria-hidden>⏱</span>
                              <span>{horaStr(p.match_datetime)}</span>
                            </span>

                            <span style={chipMeta}>
                              {isElim ? (
                                <>
                                  <span style={metaLabel}>FASE</span>&nbsp;{p.phase_name || p.phase || "KO"}
                                </>
                              ) : (
                                <>
                                  <span style={metaLabel}>GRUPO</span>&nbsp;{p.group_label}
                                </>
                              )}
                            </span>
                          </div>

                          {/* Fila: logos + marcador */}
                          <div style={filaGrid}>
                            <img src={escudo(p.home_team)} alt={homeName} style={logoStyle} onError={(e) => onLogoError(e, p.home_team)} />
                            <div style={scoreBox}>
                              {haveScore ? `${p.home_score} - ${p.away_score}` : "VS"}
                              {isElim && penText(p) && (
                                <div style={{ fontSize: 12, marginTop: 4, opacity: 0.95 }}>{penText(p)}</div>
                              )}
                            </div>
                            <img src={escudo(p.away_team)} alt={awayName} style={logoStyle} onError={(e) => onLogoError(e, p.away_team)} />
                          </div>

                          {/* Fila: nombres */}
                          <div style={{ ...filaGrid, alignItems: "start", marginTop: 6 }}>
                            <span style={nombreStyle} title={homeName}>{homeName}</span>
                            <span style={{ fontSize: "clamp(10px, 2vw, 14px)", opacity: 0.8 }}>vs</span>
                            <span style={nombreStyle} title={awayName}>{awayName}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          );
        })()}
      </div>
    </section>
  );
}

ProgramacionCopa.propTypes = {
  partidos: PropTypes.array.isRequired,
  equipos: PropTypes.array.isRequired,
  isLoading: PropTypes.bool,
};
