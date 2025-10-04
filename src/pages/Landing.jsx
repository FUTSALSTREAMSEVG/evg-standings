import React from "react";
import PropTypes from "prop-types";

export default function Landing({ onEnter, session, onLogout }) {
  return (
    <>
      {/* Header exclusivo del Landing */}
      <header className="app-header">
        <div />
        <div className="brand-line">
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img
              src="/logo.png"
              alt="Logo FUVEV"
              className="brand-logo"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </picture>
          <h1 className="brand-title">FUVEV</h1>
        </div>
        <div style={{ justifySelf: "end", display: "flex", gap: 8 }}>
          {/* (SIN botón ADMIN aquí) */}
          {session && (
            <button onClick={onLogout}>
              Cerrar sesión
            </button>
          )}
        </div>
      </header>

      {/* Contenido del Landing */}
      <section className="landing center-max-900" style={{ paddingTop: 8 }}>
        <h2 className="section-title">Bienvenid@</h2>
        <p className="landing-text">
          Aquí puedes ver posiciones, estadísticas y programación del Torneo EVG.
        </p>
        <button className="landing-btn" onClick={onEnter}>
          Entrar
        </button>
      </section>
    </>
  );
}

Landing.propTypes = {
  onEnter: PropTypes.func.isRequired,
  session: PropTypes.any,         // puede ser null
  onLogout: PropTypes.func.isRequired,
};
