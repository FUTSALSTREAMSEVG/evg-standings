// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import "./styles/base.css";
import "./styles/evg.css";
import "./styles/copa.css";

import { supabase } from "./supabaseClient";

import Landing from "./pages/Landing.jsx";
import Tablas from "./pages/Tablas.jsx";
import Estadisticas from "./pages/Estadisticas.jsx";
import Programacion from "./pages/Programacion.jsx";
import Grupos from "./pages/Grupos.jsx";
import AdminPageEVG from "./pages/AdminPanel.jsx";
import DetalleEquipo from "./pages/DetalleEquipo.jsx";

// COPA
import TablasCopa from "./pages/copa/TablasCopa.jsx";
import EstadisticasCopa from "./pages/copa/EstadisticasCopa.jsx";
import GruposCopa from "./pages/copa/GruposCopa.jsx";
import AdminPanelCopa from "./pages/copa/AdminPanelCopa.jsx";
import ProgramacionCopa from "./pages/copa/ProgramacionCopa.jsx";

function App() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => { const onPop = () => setPath(window.location.pathname); window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  const navigate = (to) => { if (to !== window.location.pathname) { window.history.pushState({}, "", to); setPath(to); } };

  // EVG
  const [grupoA, setGrupoA] = useState([]);
  const [grupoB, setGrupoB] = useState([]); // <-- CORREGIDO (antes decía "the [grupoB, ...]")
  const [partidosEVG, setPartidosEVG] = useState([]);
  const [equiposEVG, setEquiposEVG] = useState([]);
  const [statsViewEVG, setStatsViewEVG] = useState("valla");
  const [activeTabEVG, setActiveTabEVG] = useState("tablas");
  const [showLanding, setShowLanding] = useState(true);

  // COPA
  const [copaEquipos, setCopaEquipos] = useState([]);
  const [copaGrupos, setCopaGrupos] = useState({});
  const [copaPartidos, setCopaPartidos] = useState([]);
  const [copaStatsAll, setCopaStatsAll] = useState([]); // incluye eliminatorias
  const [statsViewCOPA, setStatsViewCOPA] = useState("valla");
  const [activeTabCOPA, setActiveTabCOPA] = useState("tablas");

  const [equipoDetalleId, setEquipoDetalleId] = useState(null);
  const [equipoDetalleNombre, setEquipoDetalleNombre] = useState("");
  const prevScrollRef = useRef(0);

  const esAdminRuta = path === "/admin" || path === "/admin-copa";
  const showPublicHeader = !showLanding && !esAdminRuta;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      if (data?.session?.user?.id) {
        try {
          const { data: p } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", data.session.user.id)
            .single();
          setIsAdmin(!!p?.is_admin);
        } catch {}
      }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { try { listener?.subscription?.unsubscribe(); } catch {} };
  }, []);

  // EVG público
  useEffect(() => {
    recargarEVG();
    const ch = supabase
      .channel("realtime-evg-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, recargarEVG)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, recargarEVG)
      .on("postgres_changes", { event: "*", schema: "public", table: "initial_standings" }, recargarEVG)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, []);

  async function recargarEVG() {
    const { data: teams } = await supabase.from("teams").select("id,name,group_label,logo_url");
    const { data: standings } = await supabase.from("initial_standings").select("*");
    const { data: matches } = await supabase.from("matches").select("*").order("match_datetime", { ascending: true });

    setEquiposEVG(teams || []);
    const porGrupo = { A: [], B: [] };
    (teams || []).forEach((t) => {
      const st = (standings || []).find((s) => s.team_id === t.id);
      porGrupo[t.group_label].push({
        equipo: t.name,
        pts: st?.points || 0,
        pj: st?.played || 0,
        pg: st?.wins || 0,
        pe: st?.draws || 0,
        pp: st?.losses || 0,
        gf: st?.gf || 0,
        gc: st?.ga || 0,
        dg: (st?.gf || 0) - (st?.ga || 0),
        team_id: t.id,
      });
    });
    (matches || []).forEach((m) => {
      if (m.home_score == null || m.away_score == null) return;
      const a = porGrupo[m.group_label]?.find((t) => t.team_id === m.home_team);
      const b = porGrupo[m.group_label]?.find((t) => t.team_id === m.away_team);
      if (!a || !b) return;
      a.pj++;
      b.pj++;
      a.gf += m.home_score;
      a.gc += m.away_score;
      a.dg = a.gf - a.gc;
      b.gf += m.away_score;
      b.gc += m.home_score;
      b.dg = b.gf - b.gc;
      if (m.home_score > m.away_score) {
        a.pg++;
        a.pts += 2;
        b.pp++;
      } else if (m.home_score < m.away_score) {
        b.pg++;
        b.pts += 2;
        a.pp++;
      } else {
        a.pe++;
        b.pe++;
        a.pts += 1;
        b.pts += 1;
      }
    });
    setGrupoA(porGrupo.A || []);
    setGrupoB(porGrupo.B || []);
    setPartidosEVG(matches || []);
  }

  // COPA público
  useEffect(() => {
    recargarCOPA();
    const ch = supabase
      .channel("realtime-copa-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "copa_matches" }, recargarCOPA)
      .on("postgres_changes", { event: "*", schema: "public", table: "copa_teams" }, recargarCOPA)
      .on("postgres_changes", { event: "*", schema: "public", table: "copa_initial_standings" }, recargarCOPA)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, []);

  async function recargarCOPA() {
    const { data: teams } = await supabase.from("copa_teams").select("id,name,group_label,logo_url");
    const { data: standings } = await supabase.from("copa_initial_standings").select("*");
    const { data: matches } = await supabase.from("copa_matches").select("*").order("match_datetime", { ascending: true });

    setCopaEquipos(teams || []);

    // POSICIONES POR GRUPO (NO sumamos eliminatorias)
    const map = new Map();
    (teams || []).forEach((t) => {
      const st = (standings || []).find((s) => s.team_id === t.id);
      const row = {
        equipo: t.name,
        pts: st?.points || 0,
        pj: st?.played || 0,
        pg: st?.wins || 0,
        pe: st?.draws || 0,
        pp: st?.losses || 0,
        gf: st?.gf || 0,
        gc: st?.ga || 0,
        dg: (st?.gf || 0) - (st?.ga || 0),
        team_id: t.id,
      };
      const key = (t.group_label || "A").toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    (matches || []).forEach((m) => {
      if (m.home_score == null || m.away_score == null) return;
      if (m.phase_type === "elim") return; // NO suman a grupos
      const g = map.get((m.group_label || "A").toUpperCase());
      if (!g) return;
      const a = g.find((t) => t.team_id === m.home_team);
      const b = g.find((t) => t.team_id === m.away_team);
      if (!a || !b) return;
      a.pj++;
      b.pj++;
      a.gf += m.home_score;
      a.gc += m.away_score;
      a.dg = a.gf - a.gc;
      b.gf += m.away_score;
      b.gc += m.home_score;
      b.dg = b.gf - b.gc;
      if (m.home_score > m.away_score) {
        a.pg++;
        a.pts += 2;
        b.pp++;
      } else if (m.home_score < m.away_score) {
        b.pg++;
        b.pts += 2;
        a.pp++;
      } else {
        a.pe++;
        b.pe++;
        a.pts += 1;
        b.pts += 1;
      }
    });
    const obj = Object.fromEntries([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
    setCopaGrupos(obj);

    setCopaPartidos(matches || []);

    // === ESTADÍSTICAS GLOBALES (SÍ suman eliminatorias)
    const allMap = new Map();
    (teams || []).forEach((t) => {
      const st = (standings || []).find((s) => s.team_id === t.id);
      allMap.set(t.id, {
        equipo: t.name,
        team_id: t.id,
        pts: st?.points || 0,
        pj: st?.played || 0,
        pg: st?.wins || 0,
        pe: st?.draws || 0,
        pp: st?.losses || 0,
        gf: st?.gf || 0,
        gc: st?.ga || 0,
        dg: (st?.gf || 0) - (st?.ga || 0),
      });
    });
    (matches || []).forEach((m) => {
      if (m.home_score == null || m.away_score == null) return;
      const a = allMap.get(m.home_team);
      const b = allMap.get(m.away_team);
      if (!a || !b) return;
      a.pj++;
      b.pj++;
      a.gf += m.home_score;
      a.gc += m.away_score;
      a.dg = a.gf - a.gc;
      b.gf += m.away_score;
      b.gc += m.home_score;
      b.dg = b.gf - b.gc;
      if (m.home_score > m.away_score) {
        a.pg++;
        a.pts += 2;
        b.pp++;
      } else if (m.home_score < m.away_score) {
        b.pg++;
        b.pts += 2;
        a.pp++;
      } else {
        a.pe++;
        b.pe++;
        a.pts += 1;
        b.pts += 1;
      }
    });
    setCopaStatsAll(Array.from(allMap.values()));
  }

  const slugify = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  const logoForTeam = (teamId, teamName) => {
    const url =
      (copaEquipos.find((t) => t.id === teamId)?.logo_url) ||
      (equiposEVG.find((t) => t.id === teamId)?.logo_url) ||
      null;
    return url || `/logos/${slugify(teamName)}.webp`;
  };

  const tituloHeader = path.startsWith("/copa") ? "COPA EVG" : "TORNEO EVG";

  return (
    <div className="App app-bg">
      {showPublicHeader && (
        <header className="app-header">
          <div />
          <div className="brand-line">
            <img
              src="/logo-evg.png"
              alt="Logo"
              className="brand-logo"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <h1 className="brand-title">{tituloHeader}</h1>
          </div>
          <div style={{ justifySelf: "end", display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setShowLanding(true);
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

      {path === "/admin" ? (
        /* ==== ADMIN EVG con scope propio ==== */
        <div id="evg-scope">
          <AdminPageEVG
            onExit={() => {
              navigate("/");
              window.scrollTo({ top: 0, behavior: "auto" });
            }}
          />
        </div>
      ) : path === "/admin-copa" ? (
        /* ==== ADMIN COPA con scope propio ==== */
        <div id="copa-scope">
          <AdminPanelCopa
            onExit={() => {
              navigate("/");
              window.scrollTo({ top: 0, behavior: "auto" });
            }}
          />
        </div>
      ) : showLanding ? (
        <Landing
          onEnterEVG={() => setShowLanding(false)}
          onEnterCOPA={() => {
            setShowLanding(false);
            navigate("/copa");
          }}
          session={session}
          onLogout={async () => {
            await supabase.auth.signOut();
            setSession(null);
            setIsAdmin(false);
          }}
        />
      ) : path === "/copa" ? (
        /* ==== PUBLIC COPA con scope propio ==== */
        <div id="copa-scope">
          <nav className="tabs-nav">
            {[
              { key: "tablas", label: "Posiciones" },
              { key: "estadisticas", label: "Estadísticas" },
              { key: "programacion", label: "Programación" },
              { key: "grupos", label: "Grupos" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTabCOPA(tab.key)}
                className={`tab-btn ${activeTabCOPA === tab.key ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTabCOPA === "tablas" && (
            <TablasCopa
              grupos={copaGrupos}
              ordenarTabla={(tabla) =>
                [...tabla].sort(
                  (a, b) =>
                    b.pts - a.pts || b.dg - a.dg || b.pg - a.pg || b.gf - a.gf
                )
              }
              getLogo={(teamId, teamName) => logoForTeam(teamId, teamName)}
              onOpenEquipo={() => {}}
            />
          )}

          {activeTabCOPA === "estadisticas" && (
            <EstadisticasCopa
              statsRows={copaStatsAll}
              statsView={statsViewCOPA}
              setStatsView={setStatsViewCOPA}
              getLogo={(teamId, teamName) => logoForTeam(teamId, teamName)}
            />
          )}

          {activeTabCOPA === "programacion" && (
            <ProgramacionCopa partidos={copaPartidos} equipos={copaEquipos} isLoading={false} />
          )}

          {activeTabCOPA === "grupos" && <GruposCopa equipos={copaEquipos} />}
        </div>
      ) : (
        /* ==== PUBLIC EVG con scope propio ==== */
        <div id="evg-scope">
          <nav className="tabs-nav">
            {[
              { key: "tablas", label: "Posiciones" },
              { key: "estadisticas", label: "Estadísticas" },
              { key: "programacion", label: "Programación" },
              { key: "grupos", label: "Grupos" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTabEVG(tab.key)}
                className={`tab-btn ${activeTabEVG === tab.key ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTabEVG === "tablas" && (
            <Tablas
              grupoA={grupoA}
              grupoB={grupoB}
              ordenarTabla={(tabla) =>
                [...tabla].sort(
                  (a, b) =>
                    b.pts - a.pts || b.dg - a.dg || b.pg - a.pg || b.gf - a.gf
                )
              }
              logoFromName={(name) => `/logos/${slugify(name)}.png`}
              setEquipoDetalleId={() => {}}
              setEquipoDetalleNombre={() => {}}
              prevScrollRef={{ current: 0 }}
              layout={{ stacked: false }}
              leftWrapRef={{ current: null }}
              rightWrapRef={{ current: null }}
              commonHeight={null}
            />
          )}

          {activeTabEVG === "grupos" && <Grupos equipos={equiposEVG} />}

          {activeTabEVG === "estadisticas" && (
            <Estadisticas
              grupoA={grupoA}
              grupoB={grupoB}
              statsView={statsViewEVG}
              setStatsView={setStatsViewEVG}
              logoFromName={(name) => `/logos/${slugify(name)}.png`}
            />
          )}

          {activeTabEVG === "programacion" && (
            <Programacion partidos={partidosEVG} equipos={equiposEVG} />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
