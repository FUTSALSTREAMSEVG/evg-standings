import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";

export default function Programacion({ partidos, equipos }) {
  // ===== Helpers =====
  const slugify = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  const nombreEquipo = (id) => (equipos || []).find((t) => t.id === id)?.name || "??";
  const logoFromTeamId = (id) => `/logos/${slugify(nombreEquipo(id))}.png`;

  const ymdLocal = (dt) => {
    const d = new Date(dt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };

  const agruparPorDia = (matchesArray) => {
    const groups = {};
    (matchesArray || []).forEach((m) => {
      if (!m?.match_datetime) return;
      const key = ymdLocal(m.match_datetime);
      groups[key] = groups[key] || [];
      groups[key].push(m);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const formatearHora = (dt) => {
    if (!dt) return "";
    const f = new Date(dt);
    let h = f.getHours();
    const m = String(f.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const formatearCabeceraDia = (dt) => {
    if (!dt) return "";
    const f = new Date(dt);
    const dias = ["DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO"];
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return `${dias[f.getDay()]} ${f.getDate()} de ${meses[f.getMonth()]}`;
  };

  // ===== Estado Programación =====
  const semanasDisponibles = useMemo(
    () =>
      Array.from(
        new Set((partidos || []).map((p) => p.week_number).filter((x) => typeof x === "number"))
      ).sort((a, b) => a - b),
    [partidos]
  );

  const [semanaSeleccionada, setSemanaSeleccionada] = useState(
    semanasDisponibles[semanasDisponibles.length - 1] ?? null
  );

  const lista = useMemo(() => {
    let l = [...(partidos || [])];
    if (typeof semanaSeleccionada === "number") {
      l = l.filter((p) => p.week_number === semanaSeleccionada);
    }
    return l;
  }, [partidos, semanaSeleccionada]);

  const gruposDia = useMemo(() => agruparPorDia(lista), [lista]);
  const etiquetaSemana = () =>
    typeof semanaSeleccionada === "number" ? `Semana ${semanaSeleccionada}` : "-";

  // ===== UI =====
  return (
    <section className="tables-grid section-programacion">
      {/* Picker de semana */}
      <div className="week-picker-public" style={{ justifyContent: "center" }}>
        <span className="week-label">Ver:</span>
        <select
          className="week-select-public"
          value={typeof semanaSeleccionada === "number" ? semanaSeleccionada : ""}
          onChange={(e) => setSemanaSeleccionada(parseInt(e.target.value, 10))}
        >
          {semanasDisponibles.map((w) => (
            <option key={w} value={w}>
              Semana {w}
            </option>
          ))}
        </select>
      </div>

      {/* Título */}
      <div className="center-max-900" style={{ textAlign: "center" }}>
        <h3 className="section-title" style={{ color: "#ffffff" }}>
          PARTIDOS — {etiquetaSemana().toUpperCase()}
        </h3>
      </div>

      {/* DÍAS como columnas a todo ancho */}
      <div
        className="days-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
          alignItems: "start",
          width: "100%",
          margin: 0,
          padding: "0 8px",
        }}
      >
        {gruposDia.length === 0 ? (
          <div className="panel" style={{ gridColumn: "1 / -1", textAlign: "center" }}>
            <p style={{ color: "#bbb" }}>No hay partidos para el filtro seleccionado.</p>
          </div>
        ) : (
          gruposDia.map(([diaKey, arr]) => (
            <section key={diaKey} className="day-column panel" style={{ padding: 8 }}>
              <h4
                style={{
                  color: "#ffffff",
                  opacity: 0.95,
                  textAlign: "center",
                  margin: "6px 0 10px",
                  fontSize: "clamp(14px, 2.2vw, 16px)",
                  lineHeight: 1.2,
                }}
              >
                {formatearCabeceraDia(arr[0].match_datetime).toUpperCase()}
              </h4>

              <ul
                className="cards-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 10,
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {arr.map((p) => {
                  const haveScore = p.home_score != null && p.away_score != null;
                  return (
                    <li key={p.id} className="match-card hoverable" style={{ padding: 8 }}>
                      {/* Badges (mismo tamaño para todos) */}
                      <div
                        className="match-badges"
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          justifyContent: "center",
                          fontSize: "clamp(10px, 2.5vw, 12px)",
                        }}
                      >
                        <span className={`badge badge-group ${haveScore ? "played" : "pending"}`}>
                          GRUPO {p.group_label}
                        </span>
                        <span className="badge badge-time">{formatearHora(p.match_datetime)}</span>
                      </div>

                      {/* Logos + marcador (mismos tamaños) */}
                      <div className="logos-row" style={{ gap: 8 }}>
                        <img
				loading="lazy" decoding="async" fetchpriority="low"
                          src={logoFromTeamId(p.home_team)}
                          alt={`Logo ${nombreEquipo(p.home_team)}`}
                          className="logo-img"
                          style={{ width: "clamp(36px, 7.5vw, 64px)", height: "auto" }}
                          onError={(e) => (e.currentTarget.src = "/logos/_default.png")}
                        />
                        <div
                          className="big-score"
                          style={{
                            fontSize: "clamp(18px, 4.5vw, 24px)",
                            minWidth: 48,
                            textAlign: "center",
                          }}
                        >
                          {haveScore ? `${p.home_score} - ${p.away_score}` : "VS"}
                        </div>
                        <img
				loading="lazy" decoding="async" fetchpriority="low"
                          src={logoFromTeamId(p.away_team)}
                          alt={`Logo ${nombreEquipo(p.away_team)}`}
                          className="logo-img"
                          style={{ width: "clamp(36px, 7.5vw, 64px)", height: "auto" }}
                          onError={(e) => (e.currentTarget.src = "/logos/_default.png")}
                        />
                      </div>

                      {/* Nombres: MISMO TAMAÑO, hasta 2 líneas, centrados */}
                      <div
                        className="names-row no-vs"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
                          gap: 6,
                          alignItems: "center",
                          textAlign: "center",
                          fontSize: "clamp(12px, 2.2vw, 16px)", // mismo para todos
                          lineHeight: 1.1,
                        }}
                      >
                        <span
                          className="team-name"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,              // máx. 2 líneas
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            wordBreak: "break-word",          // rompe si hay palabras larguísimas
                            whiteSpace: "normal",
                            minWidth: 0,
                            padding: "0 2px",
                          }}
                          title={nombreEquipo(p.home_team)}
                        >
                          {nombreEquipo(p.home_team)}
                        </span>

                        <span
                          className="vs"
                          style={{ fontSize: "clamp(10px, 2vw, 14px)", opacity: 0.8 }}
                        >
                          vs
                        </span>

                        <span
                          className="team-name"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            wordBreak: "break-word",
                            whiteSpace: "normal",
                            minWidth: 0,
                            padding: "0 2px",
                          }}
                          title={nombreEquipo(p.away_team)}
                        >
                          {nombreEquipo(p.away_team)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </section>
  );
}

Programacion.propTypes = {
  partidos: PropTypes.array.isRequired,
  equipos: PropTypes.array.isRequired,
};

