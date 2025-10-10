import React, { useEffect, useMemo } from "react";
import PropTypes from "prop-types";

export default function DetalleEquipo({
  equipoId,
  equipoNombre,
  equipos,
  partidos,
  onClose,
}) {
  const team = useMemo(
    () => (equipos || []).find((t) => t.id === equipoId) || null,
    [equipos, equipoId]
  );
  const nombre = team?.name || equipoNombre || "Equipo";

  const slugify = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  // Logo local (WebP -> PNG) o remoto si hay logo_url
  const logoLocalWebp = `/logos/${slugify(nombre)}.webp`;
  const logoLocalPng = `/logos/${slugify(nombre)}.png`;
  const logoPreferido = team?.logo_url ? team.logo_url : logoLocalWebp;

  // Partidos del equipo (orden por fecha asc.)
  const partidosEquipo = useMemo(() => {
    const arr = (partidos || []).filter(
      (m) => m && (m.home_team === equipoId || m.away_team === equipoId)
    );
    return arr.sort((a, b) => {
      const da = a.match_datetime ? new Date(a.match_datetime).getTime() : 0;
      const db = b.match_datetime ? new Date(b.match_datetime).getTime() : 0;
      return da - db;
    });
  }, [partidos, equipoId]);

  // Stats mínimas para rendimiento
  const { pj, pts } = useMemo(() => {
    let pj = 0, pg = 0, pe = 0, pp = 0;
    for (const m of partidosEquipo) {
      const hs = m.home_score;
      const as = m.away_score;
      const played = m.played || (hs != null && as != null);
      if (!played) continue;
      pj += 1;
      const soyLocal = m.home_team === equipoId;
      const mis = soyLocal ? (hs ?? 0) : (as ?? 0);
      const sus = soyLocal ? (as ?? 0) : (hs ?? 0);
      if (mis > sus) pg += 1;
      else if (mis < sus) pp += 1;
      else pe += 1;
    }
    const pts = pg * 3 + pe;
    return { pj, pts };
  }, [partidosEquipo, equipoId]);

  // Rendimiento = (PTS / (PJ*3)) * 100
  const rendimiento = useMemo(() => {
    if (!pj) return 0;
    return Math.round((pts / (pj * 3)) * 100);
  }, [pj, pts]);

  const nombreEquipo = (id) =>
    (equipos || []).find((t) => t.id === id)?.name || "??";

  const logoDe = (id) => {
    const t = (equipos || []).find((tt) => tt.id === id);
    if (t?.logo_url) return t.logo_url;
    const base = `/logos/${slugify(nombreEquipo(id))}`;
    return `${base}.webp`;
  };

  const fmtFecha = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  // Permitir ir a otra pestaña desde el detalle (sin tocar App.jsx):
  // si hacen click en cualquier .tab-btn, cierro el detalle.
  useEffect(() => {
    const handler = (ev) => {
      const el = ev.target.closest?.(".tab-btn");
      if (el) onClose?.();
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [onClose]);

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      {/* ===== Encabezado (Grid de 3 columnas) ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        {/* Col 1: Botón visible a la izquierda */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Volver"
          style={{
            padding: "8px 12px",
            fontWeight: 700,
            borderRadius: 8,
            cursor: "pointer",
            justifySelf: "start",
          }}
        >
          ← Volver
        </button>

        {/* Col 2: LOGO (izq) + NOMBRE (der) CENTRADOS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <picture>
            <source srcSet={logoLocalWebp} type="image/webp" />
            <img
              src={logoPreferido}
              onError={(e) => {
                if (e.currentTarget.src !== logoLocalPng)
                  e.currentTarget.src = logoLocalPng;
              }}
              alt={nombre}
              width={56}
              height={56}
              style={{ display: "block" }}
            />
          </picture>
          <h2 style={{ margin: 0 }}>{nombre}</h2>
        </div>

        {/* Col 3: Espaciador del ancho del botón para centrar de verdad */}
        <div style={{ visibility: "hidden" }}>
          <button style={{ padding: "8px 12px", fontWeight: 700, borderRadius: 8 }}>
            ← Volver
          </button>
        </div>
      </div>

      {/* Rendimiento destacado */}
      <div style={{ textAlign: "center", marginBottom: 14, fontSize: 22, fontWeight: 700 }}>
        Rendimiento: {rendimiento}%
      </div>

      {/* ===== Lista de partidos — formato igual al de Programación ===== */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {partidosEquipo.map((p) => {
          const homeName = nombreEquipo(p.home_team);
          const awayName = nombreEquipo(p.away_team);
          const hs = p.home_score;
          const as = p.away_score;
          const haveScore = p.played || (hs != null && as != null);

          return (
            <li
              key={p.id}
              className="match-card"
              style={{
                /* ancho acotado como pediste antes */
                margin: "0 auto 12px",
                width: "min(100%, 720px)",
                padding: 8,
              }}
            >
              {/* Hora/fecha arriba (como en Programación) */}
              <div
                className="match-date"
                style={{
                  textAlign: "center",
                  color: "#eee",
                  fontSize: "clamp(10px, 1.8vw, 12px)",
                  opacity: 0.9,
                  marginBottom: 6,
                }}
              >
                {fmtFecha(p.match_datetime)}
              </div>

              {/* Logos grandes + marcador al centro (idéntico criterio que Programación) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  gap: 8,
                  alignItems: "center",
                  justifyItems: "center",
                }}
              >
                <img
                  src={logoDe(p.home_team)}
                  alt={homeName}
                  className="logo-img"
                  style={{ width: "clamp(48px, 9vw, 88px)", height: "auto" }}
                />
                <div
                  className="big-score"
                  style={{
                    fontSize: "clamp(18px, 4.5vw, 24px)",
                    minWidth: 48,
                    textAlign: "center",
                  }}
                >
                  {haveScore ? `${hs ?? 0} - ${as ?? 0}` : "VS"}
                </div>
                <img
                  src={logoDe(p.away_team)}
                  alt={awayName}
                  className="logo-img"
                  style={{ width: "clamp(48px, 9vw, 88px)", height: "auto" }}
                />
              </div>

              {/* Nombres debajo (como en Programación) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  alignItems: "center",
                  fontWeight: 700,
                  fontSize: "clamp(12px, 2.4vw, 14px)",
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                <div>{homeName}</div>
                <div>{awayName}</div>
              </div>
            </li>
          );
        })}

        {partidosEquipo.length === 0 && (
          <li style={{ opacity: 0.7, textAlign: "center" }}>
            No hay partidos para este equipo.
          </li>
        )}
      </ul>
    </section>
  );
}

DetalleEquipo.propTypes = {
  equipoId: PropTypes.number.isRequired,
  equipoNombre: PropTypes.string,
  equipos: PropTypes.array.isRequired,
  partidos: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
};
