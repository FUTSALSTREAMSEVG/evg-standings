import React, { useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";

export default function EstadisticasCopa({ statsRows, statsView, setStatsView, getLogo }) {
  const all = useMemo(() => (Array.isArray(statsRows) ? statsRows : []), [statsRows]);

  // Asegurar un valor por defecto si no viene desde arriba
  const [localView, setLocalView] = useState(statsView || "valla");
  useEffect(() => {
    setLocalView(statsView || "valla");
  }, [statsView]);

  const changeView = (v) => {
    setLocalView(v);
    if (typeof setStatsView === "function") setStatsView(v);
  };

  const onShieldError = (e) => {
    const el = e.currentTarget;
    if (/\/logos\/.+\.webp(\?.*)?$/i.test(el.src)) {
      el.src = el.src.replace(/\.webp(\?.*)?$/i, ".png$1");
      return;
    }
    el.style.visibility = "hidden";
    el.style.width = "0px";
    el.style.height = "0px";
  };

  // Selecciones
  let rows = [];
  if (localView === "valla") {
    rows = [...all].sort((a, b) => a.gc - b.gc || b.pts - a.pts || b.dg - a.dg || b.gf - a.gf).slice(0, 5);
  } else if (localView === "goles") {
    rows = [...all].sort((a, b) => b.gf - a.gf || b.pts - a.pts || b.dg - a.dg || a.gc - b.gc).slice(0, 5);
  } else if (localView === "mas_goleados") {
    rows = [...all].sort((a, b) => b.gc - a.gc || b.pts - a.pts || b.dg - a.dg || b.gf - a.gf).slice(0, 5);
  }

  const reclas = useMemo(
    () => [...all].sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.pg - a.pg || b.gf - a.gf),
    [all]
  );

  // Responsivo: ocultar nombre si es chico
  const BREAKPOINT = 720;
  const [hideNameCol, setHide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${BREAKPOINT}px)`);
    const onChange = () => setHide(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return (
    <section style={{ padding: "12px 8px" }}>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
        <label>Ver:</label>
        <select value={localView} onChange={(e) => changeView(e.target.value)}>
          <option value="valla">Valla menos vencida</option>
          <option value="goles">Equipo más goleador</option>
          <option value="mas_goleados">Equipos más goleados</option>
          <option value="reclas">Reclasificación</option>
        </select>
      </div>

      {localView !== "reclas" && (
        <div className="panel center-max-900">
          {rows.length === 0 ? (
            <p style={{ color: "#bbb", textAlign: "center" }}>Sin datos de partidos todavía.</p>
          ) : (
            <table className="compacta compacta--stats" style={{ width: "100%", borderCollapse: "collapse" }}>
              {/* sin colgroup con anchos fijos: dejamos que el contenido defina */}
              <thead>
                <tr>
                  <th style={{ padding: "8px 10px" }}>#</th>
                  <th style={{ padding: "8px 10px" }}>Esc</th>
                  <th style={{ padding: "8px 10px" }}>Equipo</th>
                  <th style={{ padding: "8px 10px" }}>{localView === "goles" ? "GF" : "GC"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t, idx) => (
                  <tr key={t.team_id}>
                    <td style={{ padding: "8px 10px" }}>{idx + 1}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <img
                        src={getLogo(t.team_id, t.equipo)}
                        alt={`Escudo ${t.equipo}`}
                        style={{ width: 28, height: 28, objectFit: "contain" }}
                        onError={onShieldError}
                      />
                    </td>
                    <td className="td-equipo" style={{ padding: "8px 10px" }}>{t.equipo}</td>
                    <td style={{ padding: "8px 10px", color: localView === "goles" ? "#ffd7b5" : "#dfeaff" }}>
                      {localView === "goles" ? t.gf : t.gc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {localView === "reclas" && (
        <div className="center-max-1200" style={{ marginTop: 16 }}>
          <h2 style={{ textAlign: "center", margin: "8px 0 10px 0" }}>RECLASIFICACIÓN</h2>
          <div className="panel" style={{ padding: 4 }}>
            {reclas.length === 0 ? (
              <p style={{ color: "#bbb", textAlign: "center", margin: 8 }}>Sin datos de partidos todavía.</p>
            ) : (
              <table className="compacta compacta--pos" style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
                {/* sin colgroup: dejamos fluir, con mínimos paddings */}
                <thead>
                  <tr>
                    <th style={{ padding: "6px 8px" }}>POS</th>
                    <th style={{ padding: "6px 8px" }}>ESC</th>
                    {!hideNameCol && <th style={{ padding: "6px 8px" }}>Equipo</th>}
                    <th style={{ padding: "6px 8px" }}>PTS</th>
                    <th style={{ padding: "6px 8px" }}>PJ</th>
                    <th style={{ padding: "6px 8px" }}>PG</th>
                    <th style={{ padding: "6px 8px" }}>PE</th>
                    <th style={{ padding: "6px 8px" }}>PP</th>
                    <th style={{ padding: "6px 8px" }}>GF</th>
                    <th style={{ padding: "6px 8px" }}>GC</th>
                    <th style={{ padding: "6px 8px" }}>DG</th>
                  </tr>
                </thead>
                <tbody>
                  {reclas.map((t, i) => (
                    <tr key={t.team_id}>
                      <td style={{ padding: "6px 8px" }}>{i + 1}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <img
                          src={getLogo(t.team_id, t.equipo)}
                          alt={`Escudo ${t.equipo}`}
                          style={{ width: 28, height: 28, objectFit: "contain" }}
                          onError={onShieldError}
                        />
                      </td>
                      {!hideNameCol && <td className="td-equipo" style={{ padding: "6px 8px" }}>{t.equipo}</td>}
                      <td style={{ padding: "6px 8px" }}>{t.pts}</td>
                      <td style={{ padding: "6px 8px" }}>{t.pj}</td>
                      <td style={{ padding: "6px 8px" }}>{t.pg}</td>
                      <td style={{ padding: "6px 8px" }}>{t.pe}</td>
                      <td style={{ padding: "6px 8px" }}>{t.pp}</td>
                      <td style={{ padding: "6px 8px" }}>{t.gf}</td>
                      <td style={{ padding: "6px 8px" }}>{t.gc}</td>
                      <td style={{ padding: "6px 8px" }}>{t.dg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

EstadisticasCopa.propTypes = {
  statsRows: PropTypes.array.isRequired, // Debe incluir TODOS los partidos (grupos + eliminatorias)
  statsView: PropTypes.string,           // opcional (default "valla" si no llega)
  setStatsView: PropTypes.func,          // opcional
  getLogo: PropTypes.func.isRequired,
};
