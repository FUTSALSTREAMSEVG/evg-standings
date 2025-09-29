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
  } else {
    rows = [...all].sort((a, b) => {
      if (b.gc !== a.gc) return b.gc - a.gc;
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      return b.gf - a.gf;
    }).slice(0, 5);
  }

  const lastColLabel = statsView === "goles" ? "GF" : "GC";
  const lastColColor = statsView === "goles" ? "#ffd7b5" : "#dfeaff";

  return (
    <section style={{ padding: "12px 8px" }}>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
        <label>Ver:</label>
        <select value={statsView} onChange={(e) => setStatsView(e.target.value)}>
          <option value="valla">Valla menos vencida</option>
          <option value="goles">Equipo más goleador</option>
          <option value="mas_goleados">Equipos más goleados</option>
        </select>
      </div>

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
              <th>POS</th>
              <th>ESC</th>
              <th>Equipo</th>
              <th>{lastColLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, idx) => (
              <tr key={t.team_id}>
                <td>{idx + 1}</td>
                <td>
                  <img
                    src={logoFromName(t.equipo)}
                    alt={`Escudo ${t.equipo}`}
                    className="escudo"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; e.currentTarget.style.width = "0px"; e.currentTarget.style.height = "0px"; }}
                  />
                </td>
                <td className="td-equipo">{t.equipo}</td>
                <td style={{ color: lastColColor }}>
                  {statsView === "goles" ? t.gf : t.gc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

Estadisticas.propTypes = {
  grupoA: PropTypes.array.isRequired,
  grupoB: PropTypes.array.isRequired,
  statsView: PropTypes.oneOf(["valla", "goles", "mas_goleados"]).isRequired,
  setStatsView: PropTypes.func.isRequired,
  logoFromName: PropTypes.func.isRequired,
};
