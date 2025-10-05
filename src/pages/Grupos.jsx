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
function handleLogoError(e) {
  const img = e.currentTarget;
  const name = img.getAttribute("data-name") || "";
  const stage = img.getAttribute("data-stage") || "webp";

  // 1) Si era URL remota y falla, ocultar (no tenemos fallback garantizado)
  if (stage === "url") {
    img.style.visibility = "hidden";
    img.style.width = "0px";
    img.style.height = "0px";
    return;
  }

  // 2) Si era local .webp → intenta .png
  if (stage === "webp") {
    img.setAttribute("data-stage", "png");
    img.src = localPng(name);
    return;
  }

  // 3) Si ya era .png y falla, ocultar
  if (stage === "png") {
    img.style.visibility = "hidden";
    img.style.width = "0px";
    img.style.height = "0px";
  }
}

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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          color: "#fff",
          textTransform: "uppercase",
          textAlign: "center",
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

    {/* Grid de logos */}
    <div style={{ padding: 12 }}>
      {items.length === 0 ? (
        <p style={{ color: "#bbb", margin: "6px 4px" }}>Sin equipos.</p>
      ) : (
        <ul
          className="logos-5col"
          style={{
            display: "grid",
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
                  minHeight: "auto",
                }}
              >
                <img
                  className="logo-grid-img"
                  src={initialSrc}
                  alt={`Logo ${t.name}`}
                  data-name={t.name}
                  data-stage={stage}
                  onError={handleLogoError}
                  style={{
                    /* sin tamaños fijos inline: dejan actuar al CSS responsivo */
                    width: "100%",
                    height: "auto",
                    aspectRatio: "1 / 1",
                    objectFit: "contain",
                    imageRendering: "auto",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
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

export default function Grupos({ equipos }) {
  // Orden por fecha de creación (si la tienes), si no por id/nombre
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
    return {
      grupoA: sortByCreated(A),
      grupoB: sortByCreated(B),
    };
  }, [equipos]);

  return (
    <section style={{ padding: "12px 8px" }}>
      {/* 2 col en desktop; 1 col en móviles (A arriba, B abajo) */}
      <div
        className="grupos-2col"
        style={{
          display: "grid",
          /* ⚠️ OJO: sin gridTemplateColumns inline para permitir media queries */
          gap: 14,
        }}
      >
        <Panel titulo="GRUPO A" items={grupoA} />
        <Panel titulo="GRUPO B" items={grupoB} />
      </div>

      {/* CSS responsivo (incluye columnas del contenedor y tamaños de logos) */}
      <style>{`
        /* Contenedor: 2 columnas por defecto */
        .grupos-2col {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        /* En móvil: UNA sola columna (apila A sobre B) */
        @media (max-width: 980px) {
          .grupos-2col { grid-template-columns: 1fr; }
        }

        /* 5 columnas de equipos SIEMPRE */
        .logos-5col { grid-template-columns: repeat(5, minmax(0, 1fr)); }

        /* Desktop: logos cómodos/grandes */
        .logo-grid-img { max-width: 110px; }
        @media (min-width: 1400px) { .logo-grid-img { max-width: 120px; } }

        /* Móviles: ya no quedan "enanos" porque el panel ocupa 100% (una sola columna).
           Mantenemos tamaños generosos para buena legibilidad. */
        @media (max-width: 720px) {
          .logos-5col { gap: 10px; }
          .logos-5col li { padding: 10px; }
          .logo-grid-img { max-width: 78px; }
        }
        @media (max-width: 520px) {
          .logos-5col { gap: 8px; }
          .logos-5col li { padding: 8px; }
          .logo-grid-img { max-width: 70px; }
        }
        @media (max-width: 420px) {
          .logos-5col { gap: 6px; }
          .logos-5col li { padding: 7px; }
          .logo-grid-img { max-width: 62px; }
        }
        @media (max-width: 360px) {
          .logos-5col { gap: 6px; }
          .logos-5col li { padding: 6px; }
          .logo-grid-img { max-width: 56px; }
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
      logo_url: PropTypes.string,     // de Supabase
      group_label: PropTypes.string,
      created_at: PropTypes.string,   // si lo seleccionas, ordena por creación
    })
  ).isRequired,
};
