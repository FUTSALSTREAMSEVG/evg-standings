import React, { useEffect, useRef, useState } from "react";
import "./index.css";
import { supabase } from "./supabaseClient";

// Páginas
import Landing from "./pages/Landing.jsx";
import Tablas from "./pages/Tablas.jsx";
import Estadisticas from "./pages/Estadisticas.jsx";
import Programacion from "./pages/Programacion.jsx";
import Grupos from "./pages/Grupos.jsx";
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
  const [activeTab, setActiveTab] = useState("tablas"); // 'tablas' | 'estadisticas' | 'programacion' | 'grupos'
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

  // Ajuste de altura común (si lo usas en tus tablas)
  const [commonHeight, setCommonHeight] = useState(null);
  const leftWrapRef = useRef(null);
  const rightWrapRef = useRef(null);
  const [layout, setLayout] = useState({ stacked: false });

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setLayout({ stacked: w < 980 });
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
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
    // 🔧 Aquí el cambio: también traemos logo_url
    const { data: teams } = await supabase
      .from("teams")
      .select("id,name,group_label,logo_url");

    const { data: standings } = await supabase
      .from("initial_standings")
      .select("*");

    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .order("match_datetime", { ascending: true });

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
      else { a.pe++; b.pe++; a.pts += 1; b.pts += 1; }
    });

    setGrupoA(porGrupo.A || []);
    setGrupoB(porGrupo.B || []);
    setPartidos(matches || []);
  };

  // Helpers públicos usados fuera de Programación
  const slugify = (s) => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
  const logoFromName = (name) => `/logos/${slugify(name)}.png`;
  const nombreEquipo = (id) => equiposTodos.find((t) => t.id === id)?.name || "??";
  const logoFromTeamId = (id) => logoFromName(nombreEquipo(id));

  // Header público solo cuando NO es landing ni /admin
  const showPublicHeader = !showLanding && path !== "/admin";
  return (
    <div className="App app-bg">
      {showPublicHeader && (
        <header className="app-header">
          <div />
          <div className="brand-line">
            <img
              src="/logo-evg.png"
              alt="Logo Torneo EVG"
              className="brand-logo"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <h1 className="brand-title">TORNEO EVG</h1>
          </div>
          <div style={{ justifySelf: "end", display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setShowLanding(true);
                setActiveTab("tablas");
                navigate("/");
                window.scrollTo({ top: 0, behavior: "auto" });
              }}
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
      ) : (
        <>
          {/* Tabs (orden público solicitado) */}
          <nav className="tabs-nav">
            {[
              { key: "tablas",       label: "Posiciones"   },
              { key: "estadisticas", label: "Estadísticas" },
              { key: "programacion", label: "Programación" },
              { key: "grupos",       label: "Grupos"       },
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

          {activeTab === "grupos" && (
            <Grupos equipos={equiposTodos} />
          )}

          {activeTab === "estadisticas" && (
            <Estadisticas
              grupoA={grupoA}
              grupoB={grupoB}
              statsView={statsView}
              setStatsView={setStatsView}
              logoFromName={logoFromName}
            />
          )}

          {activeTab === "programacion" && (
            <Programacion
              partidos={partidos}
              equipos={equiposTodos}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
