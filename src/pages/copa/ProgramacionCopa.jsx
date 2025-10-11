// src/pages/copa/ProgramacionCopa.jsx
import React, { useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";

export default function ProgramacionCopa({ partidos, equipos, isLoading = false }) {
  // ===== utils
  const slugify = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  const teamById = (id) => (equipos || []).find((t) => t.id === id) || null;
  const nombreEquipo = (id) => teamById(id)?.name || "??";
  const escudo = (id) => {
    const t = teamById(id);
    const n = t?.name || "";
    return t?.logo_url || `/logos/${slugify(n)}.webp`;
  };
  const onLogoError = (e, id) => {
    const el = e.currentTarget;
    const t = teamById(id);
    const n = t?.name || "";
    if (/\.webp(\?.*)?$/i.test(el.src)) el.src = `/logos/${slugify(n)}.png`;
    else {
      el.style.visibility = "hidden";
      el.style.width = "0px";
      el.style.height = "0px";
    }
  };

  const hora = (iso) => {
    const f = new Date(iso);
    let h = f.getHours();
    const m = String(f.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  // ===== ordenar por fecha/hora
  const partidosOrd = useMemo(
    () => (partidos || []).slice().sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime)),
    [partidos]
  );

  // ===== GRUPOS
  const partidosGrupos = useMemo(
    () => partidosOrd.filter((p) => p.phase_type !== "elim" && typeof p.week_number === "number"),
    [partidosOrd]
  );

  const fechas = useMemo(() => {
    const s = new Set();
    partidosGrupos.forEach((p) => s.add(p.week_number));
    return Array.from(s).sort((a, b) => a - b);
  }, [partidosGrupos]);

  const juegosPorFecha = useMemo(() => {
    const map = new Map();
    fechas.forEach((n) => map.set(n, []));
    partidosGrupos.forEach((p) => {
      if (!map.has(p.week_number)) map.set(p.week_number, []);
      map.get(p.week_number).push(p);
    });
    return map;
  }, [fechas, partidosGrupos]);

  // ===== ELIMINATORIA
  const partidosElim = useMemo(
    () => partidosOrd.filter((p) => p.phase_type === "elim" && p.phase_name),
    [partidosOrd]
  );

  const fases = useMemo(() => {
    const recency = new Map();
    for (const p of partidosElim) {
      const ts = p.match_datetime ? new Date(p.match_datetime).getTime() : 0;
      recency.set(p.phase_name, Math.max(recency.get(p.phase_name) || 0, ts));
    }
    return Array.from(recency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [partidosElim]);

  const juegosPorFase = useMemo(() => {
    const map = new Map();
    fases.forEach((f) => map.set(f, []));
    partidosElim.forEach((p) => {
      if (!map.has(p.phase_name)) map.set(p.phase_name, []);
      map.get(p.phase_name).push(p);
    });
    return map;
  }, [fases, partidosElim]);

  // ===== selector principal y responsive
  const [scope, setScope] = useState("grupos"); // "grupos" | "elim"
  useEffect(() => setScope("grupos"), []);

  // móviles verticales → lista con selectores extra
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const onChange = () => setIsPortrait(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const [fechaSel, setFechaSel] = useState(() => fechas[fechas.length - 1] ?? "");
  const [faseSel, setFaseSel] = useState(() => fases[0] || "");
  useEffect(() => setFechaSel(fechas[fechas.length - 1] ?? ""), [fechas.join("|")]);
  useEffect(() => setFaseSel(fases[0] || ""), [fases.join("|")]);

  // ===== estilos
  const LOGO = 96;

  const filaPartido = {
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  };
  const scoreBox = {
    minWidth: 72,
    padding: "4px 10px",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: 0.3,
    textAlign: "center",
    background: "rgba(255,255,255,0.06)",
  };
  const nombre = { fontSize: 15, fontWeight: 700, lineHeight: 1.1 };

  // Grid columnas tipo EVG
  const gridColsEVG = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    alignItems: "start",
    width: "100%",
    margin: 0,
    padding: "0 8px",
  };

  // 🔧 NUEVO: listas que estiran los ítems al 100% del ancho
  const listGridFull = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, justifyItems: "stretch" };
  const liFull = { width: "100%", textAlign: "center" };

  return (
    <section className="section-programacion" style={{ padding: "12px 8px" }}>
      <div className="center-max-1200">
        {/* Selector principal */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <label>Ver:</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="grupos">Fase de grupos</option>
            <option value="elim" disabled={fases.length === 0}>Fase eliminatoria</option>
          </select>

          {/* Controles extra SOLO en vertical */}
          {isPortrait && scope === "grupos" && (
            <>
              <label>Fecha:</label>
              <select value={fechaSel} onChange={(e) => setFechaSel(parseInt(e.target.value, 10))}>
                {fechas.map((n) => (
                  <option key={n} value={n}>{`Fecha ${n}`}</option>
                ))}
              </select>
            </>
          )}
          {isPortrait && scope === "elim" && fases.length > 0 && (
            <>
              <label>Fase:</label>
              <select value={faseSel} onChange={(e) => setFaseSel(e.target.value)}>
                {fases.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {isLoading ? (
          <p style={{ color: "#bbb", textAlign: "center" }}>Cargando…</p>
        ) : scope === "grupos" ? (
          // ================== FASE DE GRUPOS ==================
          <>
            {fechas.length === 0 ? (
              <p style={{ color: "#bbb", textAlign: "center" }}>No hay fechas de grupos todavía.</p>
            ) : isPortrait ? (
              // --- VERTICAL: 1 columna (Fecha seleccionada) ---
              <div className="panel" style={{ padding: 8 }}>
                <h3 style={{ textAlign: "center", margin: "6px 0 10px" }}>{`FECHA ${fechaSel || ""}`}</h3>
                <ul style={listGridFull}>
                  {(juegosPorFecha.get(fechaSel) || []).map((p) => {
                    const done = p.home_score != null && p.away_score != null;
                    return (
                      <li key={p.id} className="match-card hoverable" style={{ ...liFull, padding: 8 }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 4 }}>
                          <span className="badge badge-group">GRUPO {p.group_label}</span>
                          <span className="badge badge-time">{hora(p.match_datetime)}</span>
                        </div>
                        <div style={filaPartido}>
                          <img src={escudo(p.home_team)} alt={nombreEquipo(p.home_team)} style={{ width: LOGO, height: LOGO, objectFit: "contain" }} onError={(e) => onLogoError(e, p.home_team)} />
                          <span style={nombre}>{nombreEquipo(p.home_team)}</span>
                          <span style={scoreBox}>{done ? `${p.home_score} - ${p.away_score}` : "VS"}</span>
                          <span style={nombre}>{nombreEquipo(p.away_team)}</span>
                          <img src={escudo(p.away_team)} alt={nombreEquipo(p.away_team)} style={{ width: LOGO, height: LOGO, objectFit: "contain" }} onError={(e) => onLogoError(e, p.away_team)} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              // --- HORIZONTAL: columnas por FECHA (layout EVG) ---
              <div style={gridColsEVG}>
                {fechas.map((n) => {
                  const juegos = juegosPorFecha.get(n) || [];
                  if (!juegos.length) return null;
                  return (
                    <section key={n} className="panel" style={{ padding: 8 }}>
                      <h3 style={{ textAlign: "center", margin: "6px 0 10px" }}>{`FECHA ${n}`}</h3>
                      <ul style={listGridFull}>
                        {juegos.map((p) => {
                          const done = p.home_score != null && p.away_score != null;
                          return (
                            <li key={p.id} className="match-card hoverable" style={{ ...liFull, padding: 8 }}>
                              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 4 }}>
                                <span className="badge badge-group">GRUPO {p.group_label}</span>
                                <span className="badge badge-time">{hora(p.match_datetime)}</span>
                              </div>
                              <div style={filaPartido}>
                                <img src={escudo(p.home_team)} alt={nombreEquipo(p.home_team)} style={{ width: LOGO, height: LOGO, objectFit: "contain" }} onError={(e) => onLogoError(e, p.home_team)} />
                                <span style={nombre}>{nombreEquipo(p.home_team)}</span>
                                <span style={scoreBox}>{done ? `${p.home_score} - ${p.away_score}` : "VS"}</span>
                                <span style={nombre}>{nombreEquipo(p.away_team)}</span>
                                <img src={escudo(p.away_team)} alt={nombreEquipo(p.away_team)} style={{ width: LOGO, height: LOGO, objectFit: "contain" }} onError={(e) => onLogoError(e, p.away_team)} />
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
          </>
        ) : (
          // ================== FASE ELIMINATORIA ==================
          <>
            {fases.length === 0 ? (
              <p style={{ color: "#bbb", textAlign: "center" }}>No hay fases de eliminatoria todavía.</p>
            ) : isPortrait ? (
              // --- VERTICAL: 1 columna (Fase seleccionada) ---
              <div className="panel" style={{ padding: 8 }}>
                <h3 style={{ textAlign: "center", margin: "6px 0 10px" }}>{faseSel}</h3>
                <ul style={listGridFull}>
                  {(juegosPorFase.get(faseSel) || []).map((p) => {
                    const done = p.home_score != null && p.away_score != null;
                    return (
                      <li key={p.id} className="match-card hoverable" style={{ ...liFull, padding: 8 }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 4 }}>
                          <span className="badge badge-time">{hora(p.match_datetime)}</span>
                        </div>
                        <div style={filaPartido}>
                          <img src={escudo(p.home_team)} alt={nombreEquipo(p.home_team)} style={{ width: LOGO, height: LOGO, objectFit: "contain" }} onError={(e) => onLogoError(e, p.home_team)} />
                          <span style={nombre}>{nombreEquipo(p.home_team)}</span>
                          <span style={scoreBox}>{done ? `${p.home_score} - ${p.away_score}` : "VS"}</span>
                          <span style={nombre}>{nombreEquipo(p.away_team)}</span>
                          <img src={escudo(p.away_team)} alt={nombreEquipo(p.away_team)} style={{ width: LOGO, height: LOGO, objectFit: "contain" }} onError={(e) => onLogoError(e, p.away_team)} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              // --- HORIZONTAL: columnas por FASE (layout EVG) ---
              <div style={gridColsEVG}>
                {fases.map((fase) => {
                  const juegos = juegosPorFase.get(fase) || [];
                  if (!juegos.length) return null;
                  return (
                    <section key={fase} className="panel" style={{ padding: 8 }}>
                      <h3 style={{ textAlign: "center", margin: "6px 0 10px" }}>{fase}</h3>
                      <ul style={listGridFull}>
                        {juegos.map((p) => {
                          const done = p.home_score != null && p.away_score != null;
                          return (
                            <li key={p.id} className="match-card hoverable" style={{ ...liFull, padding: 8 }}>
                              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 4 }}>
                                <span className="badge badge-time">{hora(p.match_datetime)}</span>
                              </div>
                              <div style={filaPartido}>
                                <img src={escudo(p.home_team)} alt={nombreEquipo(p.home_team)} style={{ width: LOGO, height: LOGO, objectFit: "contain" }} onError={(e) => onLogoError(e, p.home_team)} />
                                <span style={nombre}>{nombreEquipo(p.home_team)}</span>
                                <span style={scoreBox}>{done ? `${p.home_score} - ${p.away_score}` : "VS"}</span>
                                <span style={nombre}>{nombreEquipo(p.away_team)}</span>
                                <img src={escudo(p.away_team)} alt={nombreEquipo(p.away_team)} style={{ width: LOGO, height: LOGO, objectFit: "contain" }} onError={(e) => onLogoError(e, p.away_team)} />
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
          </>
        )}
      </div>
    </section>
  );
}

ProgramacionCopa.propTypes = {
  partidos: PropTypes.array.isRequired,
  equipos: PropTypes.array.isRequired,
  isLoading: PropTypes.bool,
};
