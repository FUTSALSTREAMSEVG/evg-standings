import React, { useEffect, useRef, useState } from "react";
import "./index.css";
import { supabase } from "./supabaseClient";

// Páginas
import Landing from "./pages/Landing.jsx";
import Tablas from "./pages/Tablas.jsx";
import Estadisticas from "./pages/Estadisticas.jsx";
import Programacion from "./pages/Programacion.jsx";
import AdminPage from "./pages/AdminPanel.jsx"; // /admin como página completa

function App() {
  // ===== Estado público =====
  const [grupoA, setGrupoA] = useState([]);
  const [grupoB, setGrupoB] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [equiposTodos, setEquiposTodos] = useState([]);

  // Auth (para "Cerrar sesión" en headers públicos)
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Pestañas públicas
  const [activeTab, setActiveTab] = useState("tablas"); // 'tablas' | 'estadisticas' | 'programacion'
  const [statsView, setStatsView] = useState("valla");   // 'valla' | 'goles' | 'mas_goleados'

  // Landing
  const [showLanding, setShowLanding] = useState(true);

  // Routing mínimo sin react-router
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (to) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, "", to);
      setPath(to);
    }
  };

  // Detalle por equipo (público)
  const [equipoDetalleId, setEquipoDetalleId] = useState(null);
  const [equipoDetalleNombre, setEquipoDetalleNombre] = useState("");
  const prevScrollRef = useRef(0);

  // Layout responsivo (solo para tablas A/B)
  const [layout, setLayout] = useState({ stacked: false });
  useEffect(() => {
    const recompute = () => {
      const w = window.innerWidth || 1200;
      const h = window.innerHeight || 800;
      setLayout({ stacked: w <= 900 || h > w });
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);
  const leftWrapRef = useRef(null);
  const rightWrapRef = useRef(null);
  const [commonHeight, setCommonHeight] = useState(null);
  useEffect(() => {
    if (layout.stacked) { setCommonHeight(null); return; }
    const l = leftWrapRef.current?.offsetHeight || 0;
    const r = rightWrapRef.current?.offsetHeight || 0;
    setCommonHeight(Math.max(l, r) || null);
  }, [grupoA, grupoB, layout.stacked]);

  // Sesión y permisos públicos
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      if (data?.session?.user?.id) await verificarAdmin(data.session.user.id);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user?.id) verificarAdmin(s.user.id);
      else setIsAdmin(false);
    });
    return () => { try { listener?.subscription?.unsubscribe(); } catch {} };
  }, []);
  const verificarAdmin = async (userId) => {
    const { data, error } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
    setIsAdmin(!error && !!data?.is_admin);
  };

  // Datos públicos (equipos/posiciones/partidos) + realtime
  useEffect(() => {
    recargarPublico();
    const channel = supabase
      .channel("realtime-evg-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, recargarPublico)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, recargarPublico)
      .on("postgres_changes", { event: "*", schema: "public", table: "initial_standings" }, recargarPublico)
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, []);

  const recargarPublico = async () => {
    // ⬇️ IMPORTANTE: traemos logo_url también
    const { data: teams } = await supabase.from("teams").select("id,name,group_label,logo_url");
    const { data: standings } = await supabase.from("initial_standings").select("*");
    const { data: matches } = await supabase.from("matches").select("*").order("match_datetime", { ascending: true });
    setEquiposTodos(teams || []);

    // construye tabla por grupos desde initial_standings + resultados
    const porGrupo = { A: [], B: [] };
    (teams || []).forEach((t) => {
      const st = (standings || []).find((s) => s.team_id === t.id);
      porGrupo[t.group_label].push({
        equipo: t.name, pts: st?.points || 0, pj: st?.played || 0, pg: st?.wins || 0,
        pe: st?.draws || 0, pp: st?.losses || 0, gf: st?.gf || 0, gc: st?.ga || 0,
        dg: (st?.gf || 0) - (st?.ga || 0), team_id: t.id,
      });
    });
    (matches || []).forEach((m) => {
      if (m.home_score == null || m.away_score == null) return;
      const a = porGrupo[m.group_label]?.find((t) => t.team_id === m.home_team);
      const b = porGrupo[m.group_label]?.find((t) => t.team_id === m.away_team);
      if (!a || !b) return;
      a.pj++; b.pj++;
      a.gf += m.home_score; a.gc += m.away_score; a.dg = a.gf - a.gc;
      b.gf += m.away_score; b.gc += m.home_score; b.dg = b.gf - b.gc;
      if (m.home_score > m.away_score) { a.pg++; a.pts += 2; b.pp++; }
      else if (m.home_score < m.away_score) { b.pg++; b.pts += 2; a.pp++; }
      else { a.pe++; b.pe++; a.pts++; b.pts++; }
    });

    setGrupoA(porGrupo.A);
    setGrupoB(porGrupo.B);
    setPartidos(matches || []);
  };

  // Helpers
  const slugify = (s) => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

  // ⬇️ DEVUELVE logo_url si existe; si no, tu archivo local PNG (compat)
  const logoFromName = (name) => {
    const t = (equiposTodos || []).find((x) => x.name === name);
    if (t?.logo_url) return t.logo_url; // remoto (no tocar extensión)
    return `/logos/${slugify(name)}.png`; // local (luego cada vista puede probar .webp primero)
  };

  const nombreEquipo = (id) => equiposTodos.find((t) => t.id === id)?.name || "??";
  const logoFromTeamId = (id) => logoFromName(nombreEquipo(id));

  // ==== Helpers WebP-first (solo para rutas locales) ====
  const toWebpFirst = (maybePng) =>
    maybePng && maybePng.startsWith("/")
      ? maybePng.replace(/\.png(\?.*)?$/i, ".webp$1")
      : maybePng;

  const onLogoError = (e, pngFallback, defaultIfPngFails = "/logos/_default.png") => {
    const el = e.currentTarget;
    if (/\.webp(\?.*)?$/i.test(el.src)) {
      el.src = pngFallback; // cae a PNG si era local .webp
    } else {
      el.src = defaultIfPngFails; // default si también falla PNG
    }
  };

  // Header público solo cuando NO es landing ni /admin
  const showPublicHeader = !showLanding && path !== "/admin";
  return (
    <div className="App app-bg">
      {showPublicHeader && (
        <header className="app-header">
          <div />
          <div className="brand-line">
            {/* Logo del header público, WebP-first con fallback */}
            <picture>
              <source srcSet="/logo-evg.webp" type="image/webp" />
              <img
                src="/logo-evg.png"
                alt="Logo Torneo EVG"
                className="brand-logo"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </picture>
            <h1 className="brand-title">TORNEO EVG</h1>
          </div>
          <div style={{ justifySelf: "end", display: "flex", gap: 8 }}>
            {/* INICIO: vuelve al landing */}
            <button
              onClick={() => {
                setShowLanding(true);
                setEquipoDetalleId(null);
                setEquipoDetalleNombre("");
                navigate("/");
                window.scrollTo({ top: 0, behavior: "auto" });
              }}
              style={{ marginRight: 8 }}
            >
              Inicio
            </button>
            {session && (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setSession(null);
                  setIsAdmin(false);
                }}
              >
                Cerrar sesión
              </button>
            )}
          </div>
        </header>
      )}

      {/* Routing mínimo */}
      {path === "/admin" ? (
        <AdminPage
          onExit={() => {
            navigate("/");
            window.scrollTo({ top: 0, behavior: "auto" });
          }}
        />
      ) : showLanding ? (
        <Landing
          onEnter={() => setShowLanding(false)}
          session={session}
          onLogout={async () => {
            await supabase.auth.signOut();
            setSession(null);
            setIsAdmin(false);
          }}
        />
      ) : equipoDetalleId ? (
        /* Detalle por equipo (público) */
        <section style={{ padding: "12px 8px" }}>
          <button
            onClick={() => {
              setEquipoDetalleId(null);
              setEquipoDetalleNombre("");
              window.scrollTo({ top: prevScrollRef.current || 0, behavior: "auto" });
            }}
            style={{ marginBottom: 10 }}
          >
            ← Volver
          </button>
          <h2 style={{ margin: "0 0 8px 0" }}>
            Partidos de {equipoDetalleNombre || nombreEquipo(equipoDetalleId)}
          </h2>

          {partidos
            .filter((p) =>
              (p.home_team === equipoDetalleId || p.away_team === equipoDetalleId) &&
              p.home_score != null && p.away_score != null
            )
            .sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime)).length === 0 ? (
            <p style={{ color: "#bbb" }}>No hay partidos jugados registrados para este equipo.</p>
          ) : (
            <ul className="cards-grid">
              {partidos
                .filter((p) =>
                  (p.home_team === equipoDetalleId || p.away_team === equipoDetalleId) &&
                  p.home_score != null && p.away_score != null
                )
                .sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime))
                .map((p) => {
                  const haveScore = p.home_score != null && p.away_score != null;
                  const nombre = (id) => nombreEquipo(id);

                  // Usa el helper que puede devolver remoto o local:
                  const pngHome = logoFromName(nombre(p.home_team));
                  const pngAway = logoFromName(nombre(p.away_team));
                  const webpHome = toWebpFirst(pngHome);
                  const webpAway = toWebpFirst(pngAway);

                  return (
                    <li key={p.id} className="match-card">
                      <div className="match-badges">
                        <span className="badge badge-group played">GRUPO {p.group_label}</span>
                        <span className="badge badge-time">
                          {(() => {
                            const f = new Date(p.match_datetime);
                            const dias = ["DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO"];
                            const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
                            let h = f.getHours();
                            const m = String(f.getMinutes()).padStart(2, "0");
                            const ampm = h >= 12 ? "pm" : "am";
                            h = h % 12 || 12;
                            return `${dias[f.getDay()]} ${f.getDate()} de ${meses[f.getMonth()]} • ${h}:${m} ${ampm}`;
                          })()}
                        </span>
                      </div>
                      <div className="logos-row">
                        <img
                          src={webpHome}
                          alt={`Logo ${nombre(p.home_team)}`}
                          className="logo-img"
                          onError={(e) => onLogoError(e, pngHome)}
                        />
                        <div className="big-score">
                          {haveScore ? `${p.home_score} - ${p.away_score}` : "VS"}
                        </div>
                        <img
                          src={webpAway}
                          alt={`Logo ${nombre(p.away_team)}`}
                          className="logo-img"
                          onError={(e) => onLogoError(e, pngAway)}
                        />
                      </div>
                      <div className="names-row">
                        <span className="team-name">{nombre(p.home_team)}</span>
                        <span className="vs">vs</span>
                        <span className="team-name">{nombre(p.away_team)}</span>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      ) : (
        <>
          {/* Tabs */}
          <nav className="tabs-nav">
            {[
              { key: "tablas", label: "Posiciones" },
              { key: "estadisticas", label: "Estadísticas" },
              { key: "programacion", label: "Programación" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Contenido por pestaña */}
          {activeTab === "tablas" && (
            <Tablas
              grupoA={grupoA}
              grupoB={grupoB}
              ordenarTabla={(tabla) =>
                [...tabla].sort((a, b) => {
                  if (b.pts !== a.pts) return b.pts - a.pts;
                  if (b.dg !== a.dg) return b.dg - a.dg;
                  if (b.pg !== a.pg) return b.pg - a.pg;
                  return b.gf - a.gf;
                })
              }
              // ⬇️ pasa helper que puede devolver remoto o local
              logoFromName={logoFromName}
              setEquipoDetalleId={setEquipoDetalleId}
              setEquipoDetalleNombre={setEquipoDetalleNombre}
              prevScrollRef={prevScrollRef}
              layout={layout}
              leftWrapRef={leftWrapRef}
              rightWrapRef={rightWrapRef}
              commonHeight={commonHeight}
            />
          )}

          {activeTab === "estadisticas" && (
            <Estadisticas
              grupoA={grupoA}
              grupoB={grupoB}
              statsView={statsView}
              setStatsView={setStatsView}
              // ⬇️ igual aquí
              logoFromName={logoFromName}
            />
          )}

          {activeTab === "programacion" && (
            <Programacion
              partidos={partidos}
              // ⬇️ equipos incluyen logo_url ahora
              equipos={equiposTodos}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
