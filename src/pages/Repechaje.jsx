import React, { useMemo } from "react";
import PropTypes from "prop-types";

/* ---------- utils ---------- */
const slugify = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

function teamById(equipos, id) {
  return (equipos || []).find((t) => t.id === id) || null;
}
function logoUrlForTeam(equipos, id) {
  const t = teamById(equipos, id);
  if (!t) return null;
  if (t.logo_url) return t.logo_url;
  return `/logos/${slugify(t.name || "")}.webp`;
}
function onLogoError(e, equipos, id) {
  const el = e.currentTarget;
  const t = teamById(equipos, id);
  if (/\.webp(\?.*)?$/i.test(el.src)) el.src = `/logos/${slugify(t?.name || "")}.png`;
  else el.style.visibility = "hidden";
}

/* ranking pos 1..N de un grupo ya ordenado */
function atPosition(sortedGroup, pos1based) {
  const idx = Number(pos1based) - 1;
  return Array.isArray(sortedGroup) && sortedGroup[idx] ? sortedGroup[idx] : null;
}

/* busca partido elim exacto, sin importar quién es local */
function findMatch(partidos, aId, bId) {
  if (!aId || !bId) return null;
  return (
    (partidos || []).find(
      (m) =>
        m?.phase_type === "elim" &&
        ((m.home_team === aId && m.away_team === bId) ||
          (m.home_team === bId && m.away_team === aId))
    ) || null
  );
}
function winnerId(m) {
  if (!m) return null;
  const hs = m.home_score, as = m.away_score;
  if (hs == null || as == null) return null;
  if (hs === as) {
    if (m.pen_home != null && m.pen_away != null) return m.pen_home > m.pen_away ? m.home_team : m.away_team;
    return null;
  }
  return hs > as ? m.home_team : m.away_team;
}
function scoreForVisualOrder(m, leftId, rightId) {
  if (!m) return "VS";
  const hs = m.home_score, as = m.away_score;
  if (hs == null || as == null) return "VS";
  if (m.home_team === leftId && m.away_team === rightId) return `${hs} - ${as}`;
  if (m.home_team === rightId && m.away_team === leftId) return `${as} - ${hs}`;
  return `${hs} - ${as}`;
}
const penText = (m)=> (m?.pen_home!=null && m?.pen_away!=null ? `( ${m.pen_home} – ${m.pen_away} pen. )` : null);

/* tarjeta (solo logos) */
function MatchCard({ leftId, rightId, leftPh, rightPh, equipos, partidos, note, noteTitle }) {
  const m = leftId && rightId ? findMatch(partidos, leftId, rightId) : null;
  const scoreText = scoreForVisualOrder(m, leftId, rightId);
  const wId = winnerId(m);

  const renderLogo = (id, ph, glow) =>
    id ? (
      <img
        src={logoUrlForTeam(equipos, id)}
        alt=""
        className={glow ? "winner-glow" : ""}
        style={{
          /* ajuste para que NO se corten */
          width: "clamp(72px, 12vw, 128px)",
          height: "clamp(72px, 12vw, 128px)",
          maxWidth: "128px",
          maxHeight: "128px",
          objectFit: "contain",
          padding: 6,
          background: "transparent",
          borderRadius: "50%",
          justifySelf: "center",
        }}
        onError={(e) => onLogoError(e, equipos, id)}
      />
    ) : (
      <div
        title={ph}
        style={{
          width: "clamp(72px, 12vw, 128px)",
          height: "clamp(72px, 12vw, 128px)",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.28)",
          display: "grid",
          placeItems: "center",
          fontWeight: 900,
          background: "rgba(255,255,255,0.06)",
        }}
      >
        {ph}
      </div>
    );

  return (
    <li className="match-card hoverable" style={{ width: "100%", textAlign: "center", padding: 8 }}>
      {note && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <span
            title={noteTitle || note}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              padding: "3px 12px",
              fontSize: 13,
              fontWeight: 800,
              background: "#fff",
              color: "#000",
              border: "1px solid #F17F26",
            }}
          >
            {note}
          </span>
        </div>
      )}

      <div
        className="logos-row"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
          alignItems: "center",
          justifyItems: "center",
          gap: 8,
        }}
      >
        {renderLogo(leftId, leftPh, wId && wId===leftId)}
        <div className="big-score" style={{
            minWidth: 68, padding: "4px 10px", border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: 10, fontWeight: 800, fontSize: "clamp(14px,3.5vw,18px)",
            background: "rgba(255,255,255,0.06)", whiteSpace: "nowrap",
          }}>
          {scoreText}
          {m && penText(m) && <div style={{ fontSize: 12, marginTop: 4, opacity: 0.95 }}>{penText(m)}</div>}
        </div>
        {renderLogo(rightId, rightPh, wId && wId===rightId)}
      </div>
    </li>
  );
}

/* ---------- Sección completa ---------- */
export default function Repechaje({ grupoA, grupoB, equipos, partidos, ordenarTabla }) {
  // ranking actual (mismo criterio que Tablas)
  const A = useMemo(() => ordenarTabla([...grupoA]), [grupoA, ordenarTabla]);
  const B = useMemo(() => ordenarTabla([...grupoB]), [grupoB, ordenarTabla]);

  /* ======== Ajuste R3/R4: ganadores ocupan 15/16 ======== */
  const A15 = atPosition(A,15)?.team_id || null;
  const A16 = atPosition(A,16)?.team_id || null;
  const A17 = atPosition(A,17)?.team_id || null;
  const A18 = atPosition(A,18)?.team_id || null;
  const B15 = atPosition(B,15)?.team_id || null;
  const B16 = atPosition(B,16)?.team_id || null;
  const B17 = atPosition(B,17)?.team_id || null;
  const B18 = atPosition(B,18)?.team_id || null;

  const aR3w = winnerId(findMatch(partidos, A15, A18)); // nuevo 15A
  const aR4w = winnerId(findMatch(partidos, A16, A17)); // nuevo 16A
  const bR3w = winnerId(findMatch(partidos, B15, B18)); // nuevo 15B
  const bR4w = winnerId(findMatch(partidos, B16, B17)); // nuevo 16B

  const adj15A = aR3w ?? A15;
  const adj16A = aR4w ?? A16;
  const adj15B = bR3w ?? B15;
  const adj16B = bR4w ?? B16;

  /* ======== Repechaje 3 ======== */
  const R3 = [
    { left: A15, right: A18, lph: "15A", rph: "18A", note: "R3", noteTitle: "15A vs 18A → ganador ocupa 15A" },
    { left: B15, right: B18, lph: "15B", rph: "18B", note: "R3", noteTitle: "15B vs 18B → ganador ocupa 15B" },
    { left: A16, right: A17, lph: "16A", rph: "17A", note: "R4", noteTitle: "16A vs 17A → ganador ocupa 16A" },
    { left: B16, right: B17, lph: "16B", rph: "17B", note: "R4", noteTitle: "16B vs 17B → ganador ocupa 16B" },
  ];

  /* ======== Repechaje 2 (L1..L8) ======== */
  const L = {
    L1: { left: atPosition(A,9)?.team_id || null,  right: adj16B, lph:"9A",  rph:"16B*" },
    L2: { left: atPosition(A,10)?.team_id || null, right: adj15B, lph:"10A", rph:"15B*" },
    L3: { left: atPosition(A,11)?.team_id || null, right: atPosition(B,14)?.team_id || null, lph:"11A", rph:"14B" },
    L4: { left: atPosition(A,12)?.team_id || null, right: atPosition(B,13)?.team_id || null, lph:"12A", rph:"13B" },
    L5: { left: atPosition(B,9)?.team_id || null,  right: adj16A, lph:"9B",  rph:"16A*" },
    L6: { left: atPosition(B,10)?.team_id || null, right: adj15A, lph:"10B", rph:"15A*" },
    L7: { left: atPosition(B,11)?.team_id || null, right: atPosition(A,14)?.team_id || null, lph:"11B", rph:"14A" },
    L8: { left: atPosition(B,12)?.team_id || null, right: atPosition(A,13)?.team_id || null, lph:"12B", rph:"13A" },
  };
  const R2 = ["L1","L2","L3","L4","L5","L6","L7","L8"].map((k)=>({ key:k, ...L[k] }));

  const winners = Object.fromEntries(R2.map(({key,left,right})=>[key, winnerId(findMatch(partidos,left,right))]));

  /* ======== Repechaje 1 ======== */
  const R1 = [
    { left: atPosition(A,5)?.team_id || null, right: winners.L8 || null, lph:"5A", rph:"L8" },
    { left: atPosition(B,5)?.team_id || null, right: winners.L4 || null, lph:"5B", rph:"L4" },
    { left: atPosition(A,6)?.team_id || null, right: winners.L7 || null, lph:"6A", rph:"L7" },
    { left: atPosition(B,6)?.team_id || null, right: winners.L3 || null, lph:"6B", rph:"L3" },
    { left: atPosition(A,7)?.team_id || null, right: winners.L6 || null, lph:"7A", rph:"L6" },
    { left: atPosition(B,7)?.team_id || null, right: winners.L2 || null, lph:"7B", rph:"L2" },
    { left: atPosition(A,8)?.team_id || null, right: winners.L5 || null, lph:"8A", rph:"L5" },
    { left: atPosition(B,8)?.team_id || null, right: winners.L1 || null, lph:"8B", rph:"L1" },
  ];

  const listGridFull = { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 };
  const gridCols = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    alignItems: "start",
    justifyItems: "stretch",
    width: "100%",
    margin: 0,
    padding: "0 8px",
  };

  return (
    <section style={{ padding: "12px 8px" }}>
      <div className="center-max-1200">
        {/* REPECHAJE 3 */}
        <section className="panel" style={{ padding: 8, marginBottom: 10 }}>
          <h3 style={{ textAlign: "center", margin: "6px 0 10px" }}>REPECHAJE 3</h3>
          <ul style={listGridFull}>
            <div style={gridCols}>
              {R3.map((p, i) => (
                <MatchCard
                  key={`r3-${i}`}
                  leftId={p.left}
                  rightId={p.right}
                  leftPh={p.lph}
                  rightPh={p.rph}
                  equipos={equipos}
                  partidos={partidos}
                  note={p.note}
                  noteTitle={p.noteTitle}
                />
              ))}
            </div>
          </ul>
        </section>

        {/* REPECHAJE 2 */}
        <section className="panel" style={{ padding: 8, marginBottom: 10 }}>
          <h3 style={{ textAlign: "center", margin: "6px 0 10px" }}>REPECHAJE 2</h3>
          <ul style={listGridFull}>
            <div style={gridCols}>
              {R2.map((p) => (
                <MatchCard
                  key={p.key}
                  leftId={p.left}
                  rightId={p.right}
                  leftPh={p.lph}
                  rightPh={p.rph}
                  equipos={equipos}
                  partidos={partidos}
                  note={p.key}
                  noteTitle={p.tip}
                />
              ))}
            </div>
          </ul>
        </section>

        {/* REPECHAJE 1 */}
        <section className="panel" style={{ padding: 8, marginBottom: 10 }}>
          <h3 style={{ textAlign: "center", margin: "6px 0 10px" }}>REPECHAJE 1</h3>
          <ul style={listGridFull}>
            <div style={gridCols}>
              {R1.map((p, i) => (
                <MatchCard
                  key={`r1-${i}`}
                  leftId={p.left}
                  rightId={p.right}
                  leftPh={p.lph}
                  rightPh={p.rph}
                  equipos={equipos}
                  partidos={partidos}
                  note={p.noteTitle}
                  noteTitle={p.noteTitle}
                />
              ))}
            </div>
          </ul>
        </section>
      </div>
    </section>
  );
}

Repechaje.propTypes = {
  grupoA: PropTypes.array.isRequired,
  grupoB: PropTypes.array.isRequired,
  equipos: PropTypes.array.isRequired,
  partidos: PropTypes.array.isRequired,
  ordenarTabla: PropTypes.func.isRequired,
};
