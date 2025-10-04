import React, { useEffect, useLayoutEffect, useState } from "react";
import PropTypes from "prop-types";

export default function Tablas({
  grupoA, grupoB, ordenarTabla, logoFromName,
  setEquipoDetalleId, setEquipoDetalleNombre, prevScrollRef,
  layout, leftWrapRef, rightWrapRef, commonHeight
}) {
  const HIDE_NAME_BREAKPOINT = 720;

  const getHidden = () =>
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width:${HIDE_NAME_BREAKPOINT}px)`).matches
      : false;

  const [hideNameCol, setHideNameCol] = useState(false);

  useLayoutEffect(() => setHideNameCol(getHidden()), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width:${HIDE_NAME_BREAKPOINT}px)`);
    const onChange = () => setHideNameCol(mq.matches);
    mq.addEventListener?.("change", onChange);
    window.addEventListener("orientationchange", onChange);
    window.addEventListener("resize", onChange);
    onChange();
    return () => {
      mq.removeEventListener?.("change", onChange);
      window.removeEventListener("orientationchange", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  // WebP-first SOLO para rutas locales
  const toWebpFirst = (url) => {
    if (!url) return url;
    if (url.startsWith("/")) {
      return url.replace(/\.png(\?.*)?$/i, ".webp$1");
    }
    return url; // remota (logo_url), no tocar
  };

  const tableFont = {
    fontSize: "clamp(11px, 1.6vw, 14px)",
    tableLayout: "fixed",
    width: "100%",
    borderCollapse: "collapse",
  };
  const headFont  = { fontSize: "clamp(10px, 1.4vw, 13px)", whiteSpace: "nowrap" };
  const titleFont = { fontSize: "clamp(16px, 2.2vw, 20px)", margin: "0 0 8px 0" };

  const teamNameStyle = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-word",
    whiteSpace: "normal",
    lineHeight: 1.15,
    padding: "0 2px",
    textAlign: "center",
  };

  const onOpenEquipo = (team_id, equipo) => {
    prevScrollRef.current = window.scrollY || 0;
    setEquipoDetalleId(team_id);
    setEquipoDetalleNombre(equipo);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  // Fallback: si la URL es local .webp, cae a .png; si es remota y falla, ocúltalo
  const onShieldError = (e, originalPngUrl) => {
    const el = e.currentTarget;
    const isLocal = el.src.startsWith(window.location.origin) || el.src.startsWith("/");
    const isWebp = /\.webp(\?.*)?$/i.test(el.src);
    if (isLocal && isWebp) {
      el.src = originalPngUrl;
    } else {
      el.style.visibility = "hidden";
      el.style.width = "0px";
      el.style.height = "0px";
    }
  };

  const TablaGrupo = ({ titulo, data }) => (
    <div
      className="panel"
      style={{ minHeight: !layout.stacked && commonHeight ? commonHeight : "auto" }}
    >
      <h2 style={titleFont}>{titulo}</h2>
      <table className="compacta compacta--pos" style={tableFont}>
        <colgroup>
          <col style={{ width: 40 }} />   {/* POS */}
          <col style={{ width: 36 }} />   {/* ESC */}
          {!hideNameCol && <col />}       {/* EQUIPO */}
          <col style={{ width: 36 }} />   {/* PTS */}
          <col style={{ width: 36 }} />   {/* PJ */}
          <col style={{ width: 36 }} />   {/* PG */}
          <col style={{ width: 36 }} />   {/* PE */}
          <col style={{ width: 36 }} />   {/* PP */}
          <col style={{ width: 36 }} />   {/* GF */}
          <col style={{ width: 36 }} />   {/* GC */}
          <col style={{ width: 36 }} />   {/* DG */}
        </colgroup>

        <thead style={headFont}>
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

        <tbody>
          {ordenarTabla(data).map((t, i) => {
            // Puede ser remota (logo_url) o local /logos/*.png
            const baseUrl = logoFromName(t.equipo);
            const webpFirst = toWebpFirst(baseUrl);
            return (
              <tr key={t.team_id}>
                <td>{i + 1}</td>
                <td
                  title={`Ver partidos jugados de ${t.equipo}`}
                  onClick={() => onOpenEquipo(t.team_id, t.equipo)}
                  style={{ cursor: "pointer" }}
                >
                  <img
                    src={webpFirst}
                    alt={`Escudo ${t.equipo}`}
                    className="escudo"
                    onError={(e) => onShieldError(e, baseUrl)}
                  />
                </td>

                {!hideNameCol && (
                  <td
                    className="td-equipo td-equipo-link"
                    onClick={() => onOpenEquipo(t.team_id, t.equipo)}
                    title={`Ver partidos jugados de ${t.equipo}`}
                  >
                    <span style={teamNameStyle}>{t.equipo}</span>
                  </td>
                )}

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
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div
      className="tables-grid"
      style={{ gridTemplateColumns: layout.stacked ? "1fr" : "1fr 1fr" }}
    >
      <TablaGrupo titulo="Grupo A" data={grupoA} />
      <TablaGrupo titulo="Grupo B" data={grupoB} />
    </div>
  );
}

Tablas.propTypes = {
  grupoA: PropTypes.array.isRequired,
  grupoB: PropTypes.array.isRequired,
  ordenarTabla: PropTypes.func.isRequired,
  logoFromName: PropTypes.func.isRequired,
  setEquipoDetalleId: PropTypes.func.isRequired,
  setEquipoDetalleNombre: PropTypes.func.isRequired,
  prevScrollRef: PropTypes.object.isRequired,
  layout: PropTypes.shape({ stacked: PropTypes.bool.isRequired }).isRequired,
  leftWrapRef: PropTypes.object.isRequired,
  rightWrapRef: PropTypes.object.isRequired,
  commonHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
};
