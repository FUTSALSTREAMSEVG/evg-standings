import React, { useMemo } from "react";
import PropTypes from "prop-types";

export default function Estadisticas({
  grupoA, grupoB, statsView, setStatsView, logoFromName
}) {
  const all = useMemo(() => {
    const map = new Map();
    [...grupoA, ...grupoB].forEach((t) => map.set(t.team_id, { ...t }));
    return Array.from(map.values());
  }, [grupoA, grupoB]);

  // WebP-first SOLO locales
  const toWebpFirst = (url) =>
    url && url.startsWith("/") ? url.replace(/\.png(\?.*)?$/i, ".webp$1") : url;

  const onShieldError = (e, pngUrl) => {
    const el = e.currentTarget;
    const isLocal = el.src.startsWith(window.location.origin) || el.src.startsWith("/");
    const isWebp = /\.webp(\?.*)?$/i.test(el.src);
    if (isLocal && isWebp) {
      el.src = pngUrl; // fallback a PNG local
    } else {
      el.style.visibility = "hidden";
      el.style.width = "0px";
      el.style.height = "0px";
    }
  };

  // ======= Top 5 (valla / goles / mas_goleados) =======
  let rows = [];
  if (statsView === "valla") {
    rows = [...all].sort((a, b) => {
      if (a.gc !== b.gc) return a.gc - b.gc;
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      return b.gf - a.gf;
    }).slice(0, 5);
  } else if (statsView === "goles") {
    rows = [...all].sort((a, b) => {
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      return a.gc - b.gc;
    }).slice(0, 5);
  } else if (statsView === "mas_goleados") {
    rows = [...all].sort((a, b) => {
      if (b.gc !== a.gc) return b.gc - a.gc;
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      return b.gf - a.gf;
    }).slice(0, 5);
  }

  const lastColLabel = statsView === "goles" ? "GF" : "GC";
  const lastColColor = statsView === "goles" ? "#ffd7b5" : "#dfeaff";

  // ===== Reclasificación (A+B) =====
  const BREAKPOINT = 720; // mismo corte que Posiciones para ocultar nombre
  const getMatches = (q) =>
    typeof window !== "undefined" ? window.matchMedia(q).matches : false;

  const [hideNameCol, setHideNameCol] = React.useState(getMatches(`(max-width:${BREAKPOINT}px)`));
  const [oneColumn, setOneColumn] = React.useState(getMatches(`(max-width:${BREAKPOINT}px)`));

  React.useEffect(() => {
    const mqlHide = window.matchMedia(`(max-width:${BREAKPOINT}px)`);
    const mqlCols = window.matchMedia(`(max-width:${BREAKPOINT}px)`);
    const onChange = () => {
      setHideNameCol(mqlHide.matches);
      setOneColumn(mqlCols.matches);
    };
    try { mqlHide.addEventListener("change", onChange); } catch { mqlHide.addListener(onChange); }
    try { mqlCols.addEventListener("change", onChange); } catch { mqlCols.addListener(onChange); }
    setHideNameCol(mqlHide.matches);
    setOneColumn(mqlCols.matches);
    return () => {
      try { mqlHide.removeEventListener("change", onChange); } catch {}
      try { mqlHide.removeListener(onChange); } catch {}
      try { mqlCols.removeEventListener("change", onChange); } catch {}
      try { mqlCols.removeListener(onChange); } catch {}
    };
  }, []);

  const reclasOrden = (arr) => [...arr].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.pg !== a.pg) return b.pg - a.pg;
    return b.gf - a.gf;
  });

  const reclas = useMemo(() => reclasOrden([...grupoA, ...grupoB]), [grupoA, grupoB]);
  const mid = Math.ceil(reclas.length / 2);
  const leftReclas = reclas.slice(0, mid);
  const rightReclas = reclas.slice(mid);

  const TableHeadPos = () => (
    <thead>
      <tr>
        <th>POS</th>
        <th>ESC</th>
        {!hideNameCol && <th>Equipo</th>}
        <th>PTS</th>
        <th>PJ</th>
        <th>PG</th>
        <th>PE</th>
        <th>PP</th>
        <th>GF</th>
        <th>GC</th>
        <th>DG</th>
      </tr>
    </thead>
  );

  const renderPosRow = (t, indexBase) => {
    const baseUrl = logoFromName(t.equipo);   // remoto o local
    const primary = toWebpFirst(baseUrl);     // solo cambia si es local
    return (
      <tr key={t.team_id}>
        <td>{indexBase + 1}</td>
        <td>
          <img
            src={primary}
            alt={`Escudo ${t.equipo}`}
            className="escudo"
            onError={(e) => onShieldError(e, baseUrl)}
          />
        </td>
        {!hideNameCol && <td className="td-equipo">{t.equipo}</td>}
        <td>{t.pts}</td>
        <td>{t.pj}</td>
        <td>{t.pg}</td>
        <td>{t.pe}</td>
        <td>{t.pp}</td>
        <td>{t.gf}</td>
        <td>{t.gc}</td>
        <td>{t.dg}</td>
      </tr>
    );
  };

  return (
    <section style={{ padding: "12px 8px" }}>
      {/* Selector de vista */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
        <label>Ver:</label>
        <select value={statsView} onChange={(e) => setStatsView(e.target.value)}>
          <option value="valla">Valla menos vencida</option>
          <option value="goles">Equipo más goleador</option>
          <option value="mas_goleados">Equipos más goleados</option>
          <option value="reclas">Reclasificación</option>
        </select>
      </div>

      {/* TOP 5 (no reclas) */}
      {statsView !== "reclas" && (
        <div className="panel center-max-900">
          <table className="compacta compacta--stats">
            <colgroup>
              <col style={{ width: 60 }} />
              <col style={{ width: 60 }} />
              <col />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Esc</th>
                <th>Equipo</th>
                <th>{lastColLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, idx) => {
                const baseUrl = logoFromName(t.equipo);
                const primary = toWebpFirst(baseUrl);
                return (
                  <tr key={t.team_id}>
                    <td>{idx + 1}</td>
                    <td>
                      <img
                        src={primary}
                        alt={`Escudo ${t.equipo}`}
                        className="escudo"
                        onError={(e) => onShieldError(e, baseUrl)}
                      />
                    </td>
                    <td className="td-equipo">{t.equipo}</td>
                    <td style={{ color: lastColColor }}>
                      {statsView === "goles" ? t.gf : t.gc}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== RECLASIFICACIÓN (A + B) ===== */}
      {statsView === "reclas" && (
        <div className="center-max-1200" style={{ marginTop: 16 }}>
          <h2 style={{ textAlign: "center", margin: "8px 0 10px 0" }}>RECLASIFICACIÓN</h2>

          <div
            className="tables-grid"
            style={{ gridTemplateColumns: oneColumn ? "1fr" : "1fr 1fr" }}
          >
            {/* Panel IZQUIERDO: sin título y padding reducido para subir la tabla */}
            <div className="panel" style={{ padding: 4 }}>
              <table className="compacta compacta--pos" style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
                <colgroup>
                  <col style={{ width: 40 }} />
                  <col style={{ width: 36 }} />
                  {!hideNameCol && <col />}
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                </colgroup>
                <TableHeadPos />
                <tbody>
                  {leftReclas.map((t, i) => renderPosRow(t, i))}
                </tbody>
              </table>
            </div>

            {/* Panel DERECHO: sin título y padding reducido para subir la tabla */}
            <div className="panel" style={{ padding: 4 }}>
              <table className="compacta compacta--pos" style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
                <colgroup>
                  <col style={{ width: 40 }} />
                  <col style={{ width: 36 }} />
                  {!hideNameCol && <col />}
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 36 }} />
                </colgroup>
                <TableHeadPos />
                <tbody>
                  {rightReclas.map((t, idx) => renderPosRow(t, leftReclas.length + idx))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

Estadisticas.propTypes = {
  grupoA: PropTypes.array.isRequired,
  grupoB: PropTypes.array.isRequired,
  statsView: PropTypes.oneOf(["valla", "goles", "mas_goleados", "reclas"]).isRequired,
  setStatsView: PropTypes.func.isRequired,
  logoFromName: PropTypes.func.isRequired,
};
