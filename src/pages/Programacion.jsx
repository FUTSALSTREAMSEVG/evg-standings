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

// --- Helpers ISO week (lunes-domingo)
function isoWeekInfo(dIn) {
  const d = new Date(Date.UTC(dIn.getFullYear(), dIn.getMonth(), dIn.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7 + 1;
  d.setUTCDate(d.getUTCDate() + (4 - dayNum));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const isoYear = d.getUTCFullYear();
  return { isoYear, weekNo, key: `${isoYear}-W${String(weekNo).padStart(2, "0")}` };
}

// texto de penales (solo visual)
const penText = (p) =>
  p?.pen_home != null && p?.pen_away != null ? `( ${p.pen_home} – ${p.pen_away} pen. )` : null;

export default function Programacion({ partidos, equipos, isLoading = false, isAdmin = false }) {
  // ===== helpers =====
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

  // ===== semanas (fase de grupos) =====
  const semanas = useMemo(() => {
    const s = new Set(
      partidosOrd
        .filter((p) => p.phase_type !== "elim" && typeof p.week_number === "number")
        .map((p) => p.week_number)
    );
    return Array.from(s).sort((a, b) => a - b);
  }, [partidosOrd]);

  // ===== FE por semana ISO =====
  const feSemanaMap = useMemo(() => {
    const keys = [];
    const byKey = new Map();
    for (const p of partidosOrd) {
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
    const keyToIndex = new Map(keys.map((k, i) => [k, i]));
    return { indexToKey, keyToIndex, byKey };
  }, [partidosOrd]);

  const feSemanas = useMemo(() => feSemanaMap.indexToKey.map((_, i) => i + 1), [feSemanaMap]);

  // ===== selección por defecto =====
  const defaultSelector = useMemo(() => {
    if (feSemanas.length > 0) return `FEW:${feSemanas[feSemanas.length - 1]}`;
    const w = semanas[semanas.length - 1];
    return typeof w === "number" ? `S:${w}` : "";
  }, [feSemanas, semanas]);

  const [selector, setSelector] = useState("");
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) {
      setSelector(defaultSelector);
      didInit.current = true;
    }
  }, [defaultSelector]);

  useEffect(() => {
    if (!selector) return;
    if (selector.startsWith("FEW:")) {
      const n = parseInt(selector.slice(4), 10);
      if (Number.isNaN(n) || n < 1 || n > feSemanas.length) setSelector(defaultSelector);
    } else if (selector.startsWith("S:")) {
      const w = parseInt(selector.slice(2), 10);
      if (!semanas.includes(w)) setSelector(defaultSelector);
    }
  }, [selector, feSemanas.length, semanas.join("|"), defaultSelector]);

  // ===== detectar orientación =====
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const onChange = () => setIsPortrait(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // ===== filtrado según selector =====
  const listaFiltrada = useMemo(() => {
    if (!selector) return [];
    if (selector.startsWith("S:")) {
      const sem = parseInt(selector.slice(2), 10);
      return partidosOrd.filter((p) => p.phase_type !== "elim" && p.week_number === sem);
    }
    if (selector.startsWith("FEW:")) {
      const n = parseInt(selector.slice(4), 10) - 1; // índice 0-based
      const key = feSemanaMap.indexToKey[n];
      if (!key) return [];
      return (feSemanaMap.byKey.get(key) || []).slice().sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime));
    }
    return [];
  }, [selector, partidosOrd, feSemanaMap]);

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

  // ===== estilos =====
  const gridColsStyle = {
    display: "grid",
    gridTemplateColumns: isPortrait
      ? "repeat(2, minmax(0, 1fr))"                 // ➜ vertical: 2 columnas fijas
      : "repeat(auto-fit, minmax(220px, 1fr))",     // ➜ horizontal: se encogen para evitar scroll
    gap: 12,
    alignItems: "start",
    justifyItems: "stretch",
    width: "100%",
    margin: "0 auto",
    padding: "0 8px",
    overflowX: "hidden",
  };

  const listGridFull = { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 };

  const nombreStyle = {
    fontSize: "clamp(11px, 1.9vw, 14px)",
    fontWeight: 700,
    lineHeight: 1.15,
    textAlign: "center",
    maxWidth: "18ch",
    margin: "0 auto",
    overflowWrap: "anywhere",
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

  const logoBase = {
    width: "clamp(60px, 11vw, 112px)",
    height: "auto",
    objectFit: "contain",
    justifySelf: "center",
  };
  const logoMonoDiaPortrait = {
    width: "clamp(70px, 14vw, 124px)",
    height: "auto",
    objectFit: "contain",
    justifySelf: "center",
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
  const chipMeta = {
    ...chipBase,
    background: "#ffffff",
    color: "#000000",
    border: `1px solid ${ORANGE}`,
  };
  const metaLabel = { color: ORANGE, fontWeight: 900 };

  const filaGrid = {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
    alignItems: "center",
    justifyItems: "center",
    gap: 8,
  };

  return (
    <section className="section-programacion" style={{ padding: "12px 8px" }}>
      <div className="center-max-1200" style={{ maxWidth: "100%", overflow: "hidden" }}>
        {/* SELECTOR CENTRADO */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center", margin: "4px auto 6px auto", flexWrap: "wrap" }}>
          <span>Ver:</span>
          <select value={selector} onChange={(e) => setSelector(e.target.value)}>
            {semanas.length > 0 && (
              <optgroup label="Semanas">
                {semanas.map((w) => (
                  <option key={`S${w}`} value={`S:${w}`}>{`Semana ${w}`}</option>
                ))}
              </optgroup>
            )}
            {feSemanas.length > 0 && (
              <optgroup label="Fase Eliminatoria (por semana)">
                {feSemanas.map((n) => (
                  <option key={`FEW${n}`} value={`FEW:${n}`}>{`F.E. Semana ${n}`}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* TÍTULO */}
        <h3 className="section-title" style={{ textAlign: "center", color: "#fff", margin: "0 0 8px" }}>
          {selector.startsWith("S:")
            ? `PARTIDOS — SEMANA ${selector.slice(2)}`
            : selector.startsWith("FEW:")
            ? `PARTIDOS — FASE ELIMINATORIA · SEMANA ${selector.slice(4)}`
            : "PARTIDOS"}
        </h3>

        {/* ESTADOS */}
        {isLoading && <p style={{ color: "#bbb", textAlign: "center" }}>Cargando…</p>}
        {!isLoading && listaFiltrada.length === 0 && (
          <p style={{ color: "#bbb", textAlign: "center" }}>No hay partidos para esta selección.</p>
        )}

        {/* COLUMNAS POR DÍA */}
        {!isLoading && listaFiltrada.length > 0 && (
          <div style={gridColsStyle}>
            {gruposPorDia.map(([diaKey, arr]) => {
              const monoDiaPortrait = isPortrait && arr.length === 1;
              const logoStyle = monoDiaPortrait ? logoMonoDiaPortrait : logoBase;

              return (
                <section key={diaKey} className="panel" style={{ padding: 8, width: "100%", maxWidth: 420, margin: "0 auto" }}>
                  <h4 style={{ color: "#fff", opacity: 0.95, textAlign: "center", margin: "6px 0 10px", fontSize: "clamp(14px, 2.2vw, 16px)", lineHeight: 1.2 }}>
                    {tituloDia(arr[0].match_datetime)}
                  </h4>

                  <ul style={listGridFull}>
                    {arr.map((p) => {
                      const haveScore = p.home_score != null && p.away_score != null;
                      const isElim = p.phase_type === "elim";

                      return (
                        <li key={p.id} className="match-card hoverable" style={{ width: "100%", textAlign: "center", padding: 8 }}>
                          {/* CHIPS: HORA + (FASE | GRUPO) */}
                          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                            <span style={chipHora}>
                              <span style={{ color: ORANGE }} aria-hidden>⏱</span>
                              <span>{horaStr(p.match_datetime)}</span>
                            </span>

                            <span style={chipMeta}>
                              {isElim ? (
                                <>
                                  <span style={metaLabel}>FASE</span>&nbsp;{p.phase}
                                </>
                              ) : (
                                <>
                                  <span style={metaLabel}>GRUPO</span>&nbsp;{p.group_label}
                                </>
                              )}
                            </span>
                          </div>

                          {/* Logos + marcador */}
                          <div className="logos-row" style={filaGrid}>
                            <img src={escudo(p.home_team)} alt={nombreEquipo(p.home_team)} style={logoStyle} onError={(e) => onLogoError(e, p.home_team)} />
                            <div className="big-score" style={scoreBox}>
                              {haveScore ? `${p.home_score} - ${p.away_score}` : "VS"}
                              {isElim && penText(p) && (
                                <div style={{ fontSize: 12, marginTop: 4, opacity: 0.95 }}>{penText(p)}</div>
                              )}
                            </div>
                            <img src={escudo(p.away_team)} alt={nombreEquipo(p.away_team)} style={logoStyle} onError={(e) => onLogoError(e, p.away_team)} />
                          </div>

                          {/* Nombres */}
                          <div className="names-row no-vs" style={{ ...filaGrid, alignItems: "start", marginTop: 6 }}>
                            <span className="team-name" style={nombreStyle} title={nombreEquipo(p.home_team)}>{nombreEquipo(p.home_team)}</span>
                            <span className="vs" style={{ fontSize: "clamp(10px, 2vw, 14px)", opacity: 0.8 }}>vs</span>
                            <span className="team-name" style={nombreStyle} title={nombreEquipo(p.away_team)}>{nombreEquipo(p.away_team)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        {!isLoading && (equipos?.length ?? 0) === 0 && isAdmin && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <a href="/admin">
              <button>Cargar equipos en Panel Admin</button>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

Programacion.propTypes = {
  partidos: PropTypes.array.isRequired,
  equipos: PropTypes.array.isRequired,
  isLoading: PropTypes.bool,
  isAdmin: PropTypes.bool,
};
