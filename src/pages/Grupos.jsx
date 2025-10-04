import React, { useMemo } from "react";
import PropTypes from "prop-types";

function slugify(str = "") {
  return String(str)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// Construye rutas locales
const localWebp = (name) => `/logos/${slugify(name)}.webp`;
const localPng  = (name) => `/logos/${slugify(name)}.png`;

// Handler de errores con cadena de fallbacks:
// 1) si venimos de logo_url (externo) -> intentar local .webp -> luego .png
// 2) si venimos de .webp local -> caer a .png local
// 3) si venimos de .png local -> ocultar (o podrías poner un placeholder)
function handleLogoError(e) {
  const img = e.currentTarget;
  const name = img.dataset.name || "";
  const stage = img.dataset.stage || "url"; // "url" | "webp" | "png"

  if (stage === "url") {
    img.src = localWebp(name);
    img.dataset.stage = "webp";
    return;
  }
  if (stage === "webp") {
    img.src = localPng(name);
    img.dataset.stage = "png";
    return;
  }
  // stage === "png": último fallback → ocultar
  img.style.visibility = "hidden";
}

export default function Grupos({ equipos }) {
  // Orden por fecha de creación (si la tienes en teams.created_at), si no por id/nombre
  const sortByCreated = (arr = []) =>
    [...arr].sort((a, b) => {
      const aKey = a?.created_at ? new Date(a.created_at).getTime() : (a?.id ?? 0);
      const bKey = b?.created_at ? new Date(b.created_at).getTime() : (b?.id ?? 0);
      if (aKey !== bKey) return aKey - bKey;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });

  const { grupoA, grupoB } = useMemo(() => {
    const A = (equipos || []).filter((t) => t.group_label === "A");
    const B = (equipos || []).filter((t) => t.group_label === "B");
    return { grupoA: sortByCreated(A), grupoB: sortByCreated(B) };
  }, [equipos]);

  // === Panel con tu MISMO estilo (no se toca el layout) ===
  const Panel = ({ titulo, items }) => (
    <div
      className="panel-like"
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/decor/field-grid.svg') center/150% no-repeat",
      }}
    >
      {/* Header del panel */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(44,23,8,0.85), rgba(44,23,8,0.65))",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          padding: "10px 12px",
          textAlign: "center",
          position: "relative",
        }}
      >
        <span
          style={{
            display: "inline-block",
            background: "rgba(241,127,38,0.25)",
            border: "1px solid rgba(241,127,38,0.6)",
            borderRadius: 10,
            padding: "6px 16px",
            fontWeight: 800,
            letterSpacing: "0.5px",
          }}
        >
          {titulo}
        </span>
      </div>

      {/* Grid de logos (sin tabla de stats) */}
      <div style={{ padding: 12 }}>
        {items.length === 0 ? (
          <p style={{ color: "#bbb", margin: "6px 4px" }}>Sin equipos.</p>
        ) : (
          <ul
            style={{
              display: "grid",
              // MISMAS columnas tipo "tabla": varias por fila, responsivo
              gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
              gap: 10,
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {items.map((t) => {
              const hasUrl = !!t.logo_url;
              const initialSrc = hasUrl ? t.logo_url : localWebp(t.name);
              const stage = hasUrl ? "url" : "webp";
              return (
                <li
                  key={t.id}
                  title={t.name}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 10,
                    minHeight: 96,
                  }}
                >
                  <img
                    src={initialSrc}
                    alt={`Logo ${t.name}`}
                    data-name={t.name}
                    data-stage={stage}
                    onError={handleLogoError}
                    style={{
                      width: 70,
                      height: 70,
                      objectFit: "contain",
                      display: "block",
                      filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))",
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <section style={{ padding: "12px 8px" }}>
      {/* Dos columnas como Posiciones; en móvil cae a una */}
      <div
        className="grupos-2col"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <Panel titulo="GRUPO A" items={grupoA} />
        <Panel titulo="GRUPO B" items={grupoB} />
      </div>

      {/* Responsivo simple sin tocar tu CSS global */}
      <style>{`
        @media (max-width: 980px) {
          .grupos-2col {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

Grupos.propTypes = {
  equipos: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      name: PropTypes.string,
      logo_url: PropTypes.string,     // ← viene de Supabase
      group_label: PropTypes.string,
      created_at: PropTypes.string,   // ← si lo seleccionas, ordena por creación
    })
  ).isRequired,
};
