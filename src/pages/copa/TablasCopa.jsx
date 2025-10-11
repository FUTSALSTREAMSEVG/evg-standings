// src/pages/copa/TablasCopa.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

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

  const TablaGrupo = ({ code, data }) => (
    <div className="panel panel--tabla-grupo">
      <h2 className="tabla-grupo-title">Grupo {code}</h2>

      <table
        className="compacta compacta--pos"
        style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}
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
          {ordenarTabla(data).map((t, i) => {
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

                <td>{t.pts}</td><td>{t.pj}</td><td>{t.pg}</td><td>{t.pe}</td><td>{t.pp}</td>
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
    <div id="copa-posiciones" className="tables-grid tables-grid--copa">
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
