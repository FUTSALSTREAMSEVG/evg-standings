import React from "react";
import PropTypes from "prop-types";

export default function Landing({ onEnterEVG, onEnterCOPA, session, onLogout }) {
  return (
    <>
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
          {session && <button onClick={onLogout}>Cerrar sesión</button>}
        </div>
      </header>

      <section className="landing center-max-900" style={{ paddingTop: 8 }}>
        <h2 className="section-title">Bienvenid@</h2>
        <p className="landing-text">Elegí qué competencia querés ver:</p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="landing-btn" onClick={onEnterEVG}>
            Entrar al TORNEO EVG
          </button>
          <button className="landing-btn" onClick={onEnterCOPA}>
            Entrar a la COPA EVG
          </button>
        </div>
      </section>
    </>
  );
}

Landing.propTypes = {
  onEnterEVG: PropTypes.func.isRequired,
  onEnterCOPA: PropTypes.func.isRequired,
  session: PropTypes.any,
  onLogout: PropTypes.func.isRequired,
};
