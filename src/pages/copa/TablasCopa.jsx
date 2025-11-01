// src/pages/copa/TablasCopa.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { supabase } from "../../supabaseClient";

/** Tabla de posiciones multi-grupo (A..E) */
export default function TablasCopa({ grupos, ordenarTabla, getLogo, onOpenEquipo }) {
  const HIDE_NAME_BREAKPOINT = 720;
  const [hideNameCol, setHideNameCol] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${HIDE_NAME_BREAKPOINT}px)`);
    const onChange = () => setHideNameCol(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

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

  // tamaño de fuente según longitud (inline => máxima prioridad)
  const fontSizeForName = (name) => {
    const len = (name || "").length;
    if (len > 30) return 11;     // muy largo
    if (len > 24) return 12;     // largo
    if (len > 18) return 13;     // medio
    return 14;                   // normal
  };

  // ====== Partidos para H2H (solo fase de grupos) ======
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("copa_matches")
        .select("id,home_team,away_team,home_score,away_score,phase_type,match_datetime")
        .order("match_datetime", { ascending: false });
      if (alive) setMatches(data || []);
    })();
    return () => { alive = false; };
  }, []);

  // Puntos 2-1-0 (desde PG/PE)
  const pts210 = (row) => (row.pg || 0) * 2 + (row.pe || 0) * 1;

  // H2H: último partido de grupos entre a y b (ganador arriba). Empate o sin partido => 0.
  const h2h = (a, b) => {
    const cand = (matches || []).filter(
      (m) =>
        m.phase_type !== "elim" &&
        ((m.home_team === a.team_id && m.away_team === b.team_id) ||
         (m.home_team === b.team_id && m.away_team === a.team_id))
    );
    if (!cand.length) return 0;
    const m = cand[0]; // más reciente
    if (m.home_score == null || m.away_score == null) return 0;
    if (m.home_score === m.away_score) return 0;
    const aEsLocal = m.home_team === a.team_id;
    const ganoA = aEsLocal ? m.home_score > m.away_score : m.away_score > m.home_score;
    return ganoA ? 1 : -1; // 1 => a por encima
  };

  // “Sorteo” determinístico para empates totales (estable)
  const stableTie = (a, b) => {
    const A = String(a.team_id) + a.equipo;
    const B = String(b.team_id) + b.equipo;
    let ha = 0, hb = 0;
    for (let i = 0; i < A.length; i++) ha = (ha * 31 + A.charCodeAt(i)) | 0;
    for (let i = 0; i < B.length; i++) hb = (hb * 31 + B.charCodeAt(i)) | 0;
    return ha - hb;
  };

  // Orden: PTS(2-1-0) → H2H → DG → GF → PG → sorteo
  const ordenarTablaConReglas = (arr) =>
    [...arr].sort((a, b) => {
      const pa = pts210(a), pb = pts210(b);
      if (pb !== pa) return pb - pa;               // 1) Puntos 2-1-0
      const hh = h2h(a, b);                        // 2) H2H (partido entre ellos)
      if (hh !== 0) return -hh;                    // (1 => a arriba)
      if (b.dg !== a.dg) return b.dg - a.dg;       // 3) Diferencia de gol
      if (b.gf !== a.gf) return b.gf - a.gf;       // 4) Goles a favor
      if (b.pg !== a.pg) return b.pg - a.pg;       // 5) Partidos ganados
      return stableTie(a, b);                      // 6) Sorteo
    });

  const TablaGrupo = ({ code, data }) => (
    <div className="panel panel--tabla-grupo" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <h2 className="tabla-grupo-title">Grupo {code}</h2>

      <table
        className="compacta compacta--pos"
        style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", flex: 1 }}
      >
        {/* Usamos porcentajes para que todo se adapte sin scroll */}
        <colgroup>
          {/* POS, ESC */}
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />

          {/* EQUIPO (solo si está visible) */}
          {!hideNameCol && <col style={{ width: "28%" }} />}

          {/* PTS, PJ, PG, PE, PP, GF, GC, DG */}
          <col style={{ width: "8%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>

        <thead>
          <tr>
            <th>POS</th>
            <th>ESC</th>
            {!hideNameCol && <th>Equipo</th>}
            <th>PTS</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
            <th>GF</th><th>GC</th><th>DG</th>
          </tr>
        </thead>

        <tbody>
          {ordenarTablaConReglas(data).map((t, i) => {
            const logo = getLogo(t.team_id, t.equipo);
            const fs = fontSizeForName(t.equipo);

            return (
              <tr key={t.team_id}>
                <td>{i + 1}</td>

                <td
                  title={`Ver partidos de ${t.equipo}`}
                  onClick={() => onOpenEquipo(t.team_id, t.equipo)}
                  style={{ cursor: "pointer", textAlign: "center", verticalAlign: "middle" }}
                >
                  <img
                    src={logo}
                    alt={`Escudo ${t.equipo}`}
                    className="escudo"
                    onError={onShieldError}
                    style={{ display: "block", marginInline: "auto" }}
                  />
                </td>

                {!hideNameCol && (
                  <td
                    className="td-equipo td-equipo-link"
                    onClick={() => onOpenEquipo(t.team_id, t.equipo)}
                    title={t.equipo}
                    style={{
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      textAlign: "center",
                    }}
                  >
                    {/* máx 2 líneas + tamaño dinámico */}
                    <span
                      className="team-name"
                      style={{
                        fontSize: `${fs}px`,
                        lineHeight: 1.15,
                        letterSpacing: 0,
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                        overflow: "hidden",
                        textWrap: "balance",
                        hyphens: "auto",
                        marginInline: "auto",
                      }}
                    >
                      {t.equipo}
                    </span>
                  </td>
                )}

                {/* PTS mostrados con la regla 2-1-0 */}
                <td>{pts210(t)}</td><td>{t.pj}</td><td>{t.pg}</td><td>{t.pe}</td><td>{t.pp}</td>
                <td>{t.gf}</td><td>{t.gc}</td><td>{t.dg}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const groupCodes = Object.keys(grupos).sort(); // ['A','B',...]
  return (
    <div
      id="copa-posiciones"
      className="tables-grid tables-grid--copa"
      style={{
        // asegura alturas iguales por fila
        gridAutoRows: "1fr",
        alignItems: "stretch",
      }}
    >
      {groupCodes.map((code) => (
        <TablaGrupo key={code} code={code} data={grupos[code]} />
      ))}
    </div>
  );
}

TablasCopa.propTypes = {
  grupos: PropTypes.object.isRequired,               // { 'A': [...], 'B': [...], ... }
  ordenarTabla: PropTypes.func.isRequired,
  getLogo: PropTypes.func.isRequired,                // (teamId, teamName) => url
  onOpenEquipo: PropTypes.func.isRequired,
};
