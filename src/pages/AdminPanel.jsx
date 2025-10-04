import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { supabase } from "../supabaseClient";

/** Utilidad: slug simple para logos por nombre cuando no hay logo_url */
function slugify(str = "") {
  return String(str)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function AdminPage({ onExit }) {
  // ===== Auth / permisos
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ===== Tabs
  const [activeTab, setActiveTab] = useState("equipos"); // "equipos" | "partidos"

  // ===== Datos base
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);

  // ===== Crear partido
  const [grupo, setGrupo] = useState("A");
  const [equipo1, setEquipo1] = useState("");
  const [equipo2, setEquipo2] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [semana, setSemana] = useState(1);

  // ===== Edición de partido
  const [editando, setEditando] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  // ===== Filtro admin por semana
  const [semanaAdminSeleccionada, setSemanaAdminSeleccionada] = useState(null);

  // ===== Gestión de Equipos
  const [subiendoLogoId, setSubiendoLogoId] = useState(null);
  const [logoFiles, setLogoFiles] = useState({});
  const [localEdits, setLocalEdits] = useState({});
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoGrupo, setNuevoGrupo] = useState("A");

  // ===== Efectos iniciales
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

    recargar();

    const channel = supabase
      .channel("realtime-evg-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, recargar)
      .subscribe();

    return () => {
      try { listener?.subscription?.unsubscribe(); } catch {}
      try { supabase.removeChannel(channel); } catch {}
    };
  }, []);

  const verificarAdmin = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .single();
    setIsAdmin(!error && !!data?.is_admin);
  };

  const recargar = async () => {
    const { data: teams } = await supabase
      .from("teams")
      .select("id,name,group_label,logo_url")
      .order("name");

    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .order("match_datetime", { ascending: true });

    setEquipos(teams || []);
    setPartidos(matches || []);

    const weeks = Array.from(new Set((matches || [])
      .map((m) => m.week_number)
      .filter(Boolean)))
      .sort((a,b)=>a-b);

    setSemanaAdminSeleccionada((prev) =>
      typeof prev === "number" ? prev : (weeks[weeks.length - 1] ?? null)
    );

    setLogoFiles({});
    setLocalEdits({});
    setSubiendoLogoId(null);
  };

  // ===== Utils fechas
  const toLocalDate = (dt) => {
    if (!dt) return "";
    const d = new Date(dt);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const toLocalTime = (dt) => {
    if (!dt) return "";
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };
  const localToISOWithOffset = (localStr) => {
    if (!localStr) return null;
    const [datePart, timePart] = localStr.split("T");
    if (!timePart) return null;
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    const localDate = new Date(y, (m || 1)-1, d || 1, hh || 0, mm || 0, 0, 0);
    const tz = localDate.getTimezoneOffset();
    const sign = tz > 0 ? "-" : "+";
    const abs = Math.abs(tz);
    const oh = String(Math.floor(abs / 60)).padStart(2, "0");
    const om = String(abs % 60).padStart(2, "0");
    return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00${sign}${oh}:${om}`;
  };

  // ===== Utils
  const nombreEquipoPorId = (id) => equipos.find((t) => t.id === id)?.name || "??";
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
  const agruparPorDia = (arr) => {
    const ymd = (dt) => {
      const d = new Date(dt);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    };
    const g = {};
    (arr || []).forEach((m) => {
      if (!m?.match_datetime) return;
      const k = ymd(m.match_datetime);
      g[k] = g[k] || [];
      g[k].push(m);
    });
    return Object.entries(g).sort(([a],[b]) => a.localeCompare(b));
  };

  // ===== Rivales aún no jugados
  const equiposDelGrupo = useMemo(
    () => equipos.filter((t) => t.group_label === grupo),
    [equipos, grupo]
  );
  const idEquipo1 = useMemo(
    () => equiposDelGrupo.find((t) => t.name === equipo1)?.id ?? null,
    [equiposDelGrupo, equipo1]
  );
  const yaJugaron = (idA, idB) => {
    if (!idA || !idB) return false;
    return (partidos || []).some((m) =>
      m && m.home_team && m.away_team &&
      ((m.home_team === idA && m.away_team === idB) || (m.home_team === idB && m.away_team === idA)) &&
      m.home_score != null && m.away_score != null
    );
  };
  const rivalesDisponibles = useMemo(() => {
    if (!idEquipo1) {
      return equiposDelGrupo
        .filter((t) => t.name !== equipo1)
        .map((t) => t.name);
    }
    return equiposDelGrupo
      .filter((r) => r.id !== idEquipo1 && !yaJugaron(idEquipo1, r.id))
      .map((r) => r.name);
  }, [equiposDelGrupo, idEquipo1, equipo1, partidos]);

  // ===== Crear partido
  const guardarPartido = async () => {
    if (!equipo1 || !equipo2 || equipo1 === equipo2 || !fecha || !hora) return;
    const grupoTeams = equipos.filter((t) => t.group_label === grupo);
    const t1 = grupoTeams.find((t) => t.name === equipo1);
    const t2 = grupoTeams.find((t) => t.name === equipo2);
    if (!t1 || !t2) return;

    if (yaJugaron(t1.id, t2.id)) {
      alert("Estos equipos ya jugaron entre sí. Elige otro rival.");
      return;
    }

    const iso = localToISOWithOffset(`${fecha}T${hora}`);
    try {
      const { error } = await supabase.from("matches").insert([{
        group_label: grupo,
        home_team: t1.id,
        away_team: t2.id,
        home_score: null,
        away_score: null,
        played: false,
        match_datetime: iso,
        week_number: semana,
      }]);
      if (error) throw error;
      setEquipo1(""); setEquipo2(""); setFecha(""); setHora(""); setSemana(1);
      await recargar();
    } catch (e) {
      alert("Error al crear partido: " + (e?.message || e));
    }
  };

  // ===== Editar / Eliminar partido
  const empezarEdicion = (p) => {
    setEditando(p.id);
    setEditDraft({
      ...p,
      edit_date: toLocalDate(p.match_datetime),
      edit_time: toLocalTime(p.match_datetime),
    });
  };
  const cancelarEdicion = () => { setEditando(null); setEditDraft(null); };
  const actualizarEdicion = async () => {
    if (!editDraft) return;
    const hasDate = !!editDraft.edit_date;
    const hasTime = !!editDraft.edit_time;
    const localCombined = hasDate && hasTime ? `${editDraft.edit_date}T${editDraft.edit_time}` : null;
    const iso = localCombined ? localToISOWithOffset(localCombined) : null;
    try {
      const { error } = await supabase
        .from("matches")
        .update({
          home_score: editDraft.home_score === "" || editDraft.home_score == null ? null : Number(editDraft.home_score),
          away_score: editDraft.away_score === "" || editDraft.away_score == null ? null : Number(editDraft.away_score),
          played: editDraft.home_score !== null && editDraft.home_score !== "" && editDraft.away_score !== null && editDraft.away_score !== "",
          match_datetime: iso,
          week_number: Number(editDraft.week_number) || null,
        })
        .eq("id", editDraft.id);
      if (error) throw error;
      cancelarEdicion();
      await recargar();
    } catch (e) {
      alert("Error al actualizar partido: " + (e?.message || e));
    }
  };
  const eliminarPartido = async (id) => {
    if (!window.confirm("¿Eliminar partido?")) return;
    try {
      const { error } = await supabase.from("matches").delete().eq("id", Number(id));
      if (error) throw error;
      await recargar();
    } catch (e) {
      alert("No se pudo eliminar el partido: " + (e?.message || e));
    }
  };

  // ===== Listas derivadas
  const semanasDisponibles = useMemo(
    () => Array.from(new Set((partidos || []).map((m) => m.week_number).filter(Boolean))).sort((a,b)=>a-b),
    [partidos]
  );
  const partidosFiltrados = useMemo(() => {
    let base = [...partidos];
    if (typeof semanaAdminSeleccionada === "number") {
      base = base.filter((p) => p.week_number === semanaAdminSeleccionada);
    }
    return base;
  }, [partidos, semanaAdminSeleccionada]);

  // ===== Gestión de equipos: handlers
  const handleEditLocal = (teamId, field, value) => {
    setLocalEdits((prev) => ({
      ...prev,
      [teamId]: { ...(prev[teamId] || {}), [field]: value },
    }));
  };

  async function subirLogo(teamId, file) {
    if (!file) return null;
    setSubiendoLogoId(teamId);
    try {
      const ext = (file.name.split(".").pop() || "webp").toLowerCase();
      const path = `team-${teamId}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("team-logos").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("team-logos").getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error("No se obtuvo URL público del logo.");

      const { error: upTeamErr } = await supabase
        .from("teams")
        .update({ logo_url: publicUrl })
        .eq("id", teamId);
      if (upTeamErr) throw upTeamErr;
      return publicUrl;
    } finally {
      setSubiendoLogoId(null);
    }
  }

  async function guardarEquipo(team) {
    const draft = localEdits[team.id] || {};
    const payload = {
      name: draft.name != null ? draft.name : team.name,
      group_label: draft.group_label != null ? draft.group_label : team.group_label,
    };

    const file = logoFiles[team.id];
    if (file) {
      const publicUrl = await subirLogo(team.id, file);
      if (publicUrl) payload.logo_url = publicUrl;
    }

    const { error } = await supabase.from("teams").update(payload).eq("id", team.id);
    if (error) { alert("No se pudo guardar el equipo: " + error.message); return; }

    setLocalEdits((p) => { const c = { ...p }; delete c[team.id]; return c; });
    setLogoFiles((p) => { const c = { ...p }; delete c[team.id]; return c; });

    await recargar();
  }

  async function crearEquipo() {
    if (!nuevoNombre.trim()) { alert("Escribe un nombre de equipo."); return; }
    const { error } = await supabase.from("teams")
      .insert([{ name: nuevoNombre.trim(), group_label: nuevoGrupo }]);
    if (error) {
      // Si vuelve a aparecer duplicate key, hay que ejecutar el setval del paso 1.
      alert("No se pudo crear el equipo: " + error.message);
      return;
    }
    setNuevoNombre("");
    setNuevoGrupo("A");
    await recargar();
  }

  async function eliminarEquipo(teamId) {
    if (!window.confirm("¿Eliminar equipo y sus partidos/asientos de tabla?")) return;
    try {
      const del1 = await supabase.from("matches").delete().or(`home_team.eq.${teamId},away_team.eq.${teamId}`);
      if (del1.error) throw del1.error;

      const del2 = await supabase.from("initial_standings").delete().eq("team_id", teamId);
      if (del2.error) throw del2.error;

      const del3 = await supabase.from("teams").delete().eq("id", teamId);
      if (del3.error) throw del3.error;

      await recargar();
    } catch (e) {
      alert("No se pudo eliminar el equipo: " + (e?.message || e));
    }
  }

  // ======== RENDER ========
  const TabButton = ({ id, children }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.15)",
        background: activeTab === id ? "rgba(241,127,38,0.25)" : "transparent",
        color: "#fff",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
  TabButton.propTypes = { id: PropTypes.string.isRequired, children: PropTypes.node.isRequired };
  return (
    <div>
      {/* HEADER ADMIN (igual que antes) */}
      <header className="app-header">
        <div />
        <div className="brand-line">
          <picture>
            <source srcSet="/logo-evg.webp" type="image/webp" />
            <img
              src="/logo-evg.png"
              alt="Logo Torneo EVG"
              className="brand-logo"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </picture>
          <h1 className="brand-title">PANEL ADMIN</h1>
        </div>
        <div style={{ justifySelf: "end", display: "flex", gap: 8 }}>
          <button onClick={onExit} style={{ marginRight: 8 }}>Inicio</button>
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

      <section style={{ padding: 16 }}>
        {!session ? (
          <Login onLogged={(s) => setSession(s)} />
        ) : !isAdmin ? (
          <div className="panel center-max-900" style={{ textAlign: "center", margin: "24px auto" }}>
            <p style={{ color: "red" }}>No tienes permisos de administrador.</p>
          </div>
        ) : (
          <>
            {/* ===== Tabs ===== */}
            <div className="center-max-900" style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 14 }}>
              <TabButton id="equipos">Gestión de Equipos</TabButton>
              <TabButton id="partidos">Partidos</TabButton>
            </div>

            {/* ===== PESTAÑA: GESTIÓN DE EQUIPOS ===== */}
            {activeTab === "equipos" && (
              <div className="panel center-max-900" style={{ marginBottom: 16 }}>
                <h3 style={{ textAlign: "center" }}>GESTIÓN DE EQUIPOS</h3>

                {/* Crear equipo */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <input
                    placeholder="Nombre del equipo"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    style={{ minWidth: 220 }}
                  />
                  <select value={nuevoGrupo} onChange={(e) => setNuevoGrupo(e.target.value)}>
                    <option value="A">Grupo A</option>
                    <option value="B">Grupo B</option>
                  </select>
                  <button onClick={crearEquipo}>Crear equipo</button>
                </div>

                {/* Tabla equipos */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ opacity: 0.85 }}>
                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Logo</th>
                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Nombre</th>
                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Grupo</th>
                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Subir nuevo logo</th>
                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipos.map((t) => {
                        const draft = localEdits[t.id] || {};
                        const name = draft.name ?? t.name;
                        const groupLabel = draft.group_label ?? t.group_label;
                        const srcLogo = t.logo_url || `/logos/${slugify(t.name)}.webp`;
                        return (
                          <tr key={t.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <td style={{ padding: "6px 8px" }}>
                              <img
                                src={srcLogo}
                                alt={`Logo ${t.name}`}
                                style={{ width: 36, height: 36, objectFit: "contain", background: "rgba(255,255,255,0.06)", borderRadius: 6 }}
                                onError={(e) => {
                                  if (srcLogo.endsWith(".webp")) e.currentTarget.src = `/logos/${slugify(t.name)}.png`;
                                  else e.currentTarget.src = "/logos/_default.png";
                                }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px", minWidth: 220 }}>
                              <input
                                value={name}
                                onChange={(e) => handleEditLocal(t.id, "name", e.target.value)}
                                style={{ width: "100%" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <select
                                value={groupLabel}
                                onChange={(e) => handleEditLocal(t.id, "group_label", e.target.value)}
                              >
                                <option value="A">A</option>
                                <option value="B">B</option>
                              </select>
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="file"
                                accept=".webp,.png,.jpg,.jpeg"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] || null;
                                  setLogoFiles((prev) => ({ ...prev, [t.id]: f }));
                                }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <button onClick={() => guardarEquipo(t)} disabled={subiendoLogoId === t.id}>
                                  {subiendoLogoId === t.id ? "Subiendo..." : "Guardar"}
                                </button>
                                <button onClick={() => eliminarEquipo(t.id)} style={{ background: "rgba(255,0,0,0.25)", borderColor: "rgba(255,0,0,0.6)" }}>
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== PESTAÑA: PARTIDOS ===== */}
            {activeTab === "partidos" && (
              <>
                {/* CREAR PARTIDO */}
                <div className="panel center-max-900" style={{ textAlign: "center" }}>
                  <h3>CREAR PARTIDO</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
                    <select value={grupo} onChange={(e) => { setGrupo(e.target.value); setEquipo1(""); setEquipo2(""); }}>
                      <option value="A">Grupo A</option>
                      <option value="B">Grupo B</option>
                    </select>

                    <select value={equipo1} onChange={(e) => { setEquipo1(e.target.value); setEquipo2(""); }}>
                      <option value="">Equipo 1</option>
                      {equipos.filter((t) => t.group_label === grupo).map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>

                    <select
                      value={equipo2}
                      onChange={(e) => setEquipo2(e.target.value)}
                      disabled={!equipo1}
                      title={!equipo1 ? "Selecciona primero Equipo 1" : undefined}
                    >
                      <option value="">{equipo1 ? "Rival disponible" : "Elige Equipo 1 primero"}</option>
                      {rivalesDisponibles.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>

                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                    <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                    <input type="number" value={semana} onChange={(e) => setSemana(Number(e.target.value))} style={{ width: 90 }} placeholder="Semana" />
                    <button onClick={guardarPartido} disabled={!equipo1 || !equipo2 || !fecha || !hora}>
                      Crear Partido
                    </button>
                  </div>
                </div>

                {/* FILTRO SEMANA (ADMIN) */}
                <div style={{ marginTop: 12, textAlign: "center" }}>
                  <label style={{ marginRight: 8 }}>Ver (Admin):</label>
                  <select
                    className="week-select-admin"
                    value={typeof semanaAdminSeleccionada === "number" ? semanaAdminSeleccionada : ""}
                    onChange={(e) => setSemanaAdminSeleccionada(parseInt(e.target.value, 10))}
                  >
                    {semanasDisponibles.map((w) => (
                      <option key={w} value={w}>Semana {w}</option>
                    ))}
                  </select>
                </div>

                {/* LISTA / EDICIÓN */}
                <div className="center-max-900" style={{ marginTop: 10 }}>
                  {(() => {
                    const grupos = agruparPorDia(partidosFiltrados);
                    if (!grupos.length) return <p style={{ color: "#bbb", textAlign: "center" }}>No hay partidos para la semana seleccionada.</p>;
                    return grupos.map(([diaKey, arr]) => (
                      <div key={diaKey} style={{ marginBottom: 8 }}>
                        <h4 style={{ color: "#ffffff", opacity: 0.95, textAlign: "center" }}>
                          {formatearCabeceraDia(arr[0].match_datetime)}
                        </h4>
                        <ul className="cards-grid" style={{ gridTemplateColumns: "minmax(300px, 900px)", justifyContent: "center" }}>
                          {arr.map((p) => {
                            const editing = editando === p.id;
                            const haveScore = p.home_score != null && p.away_score != null;
                            const nameHome = nombreEquipoPorId(p.home_team);
                            const nameAway = nombreEquipoPorId(p.away_team);

                            return (
                              <li
                                key={p.id}
                                className={`admin-card ${!editing ? "hoverable" : ""}`}
                                style={{
                                  textAlign: "center",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 10,
                                  position: "relative",
                                  overflow: "hidden",
                                  background: "linear-gradient(rgba(0,0,0,0.40), rgba(0,0,0,0.40)), url('/decor/field-grid.svg') center/120% no-repeat",
                                }}
                              >
                                <div className="admin-toprow" style={{ display: "grid", gridTemplateColumns: "1fr", alignItems: "center" }}>
                                  <div className="admin-badges" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                                    <span className="admin-badge admin-badge-group">GRUPO {p.group_label}</span>
                                    <span className="admin-badge admin-badge-time">{formatearHora(p.match_datetime)}</span>
                                  </div>
                                </div>

                                <div
                                  className="names-row"
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
                                    gap: 10,
                                    alignItems: "center",
                                    textAlign: "center",
                                    fontSize: "clamp(11px, 1.9vw, 14px)",
                                    lineHeight: 1.1,
                                  }}
                                >
                                  <span className="team-name" title={nameHome}
                                    style={{
                                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                      overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-word",
                                      whiteSpace: "normal", minWidth: 0, padding: "0 2px", fontWeight: 700,
                                    }}
                                  >
                                    {nameHome}
                                  </span>

                                  <div className="big-score"
                                    style={{
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                      whiteSpace: "nowrap", lineHeight: 1,
                                      fontSize: "clamp(18px, 5.5vw, 26px)", minWidth: 56,
                                      padding: "6px 12px", borderRadius: 10,
                                      background: "rgba(241,127,38,0.22)",
                                      border: "1px solid rgba(241,127,38,0.65)",
                                      color: "#ffd7b5", fontWeight: 900, letterSpacing: "1px",
                                    }}
                                  >
                                    {haveScore ? `${p.home_score} - ${p.away_score}` : "VS"}
                                  </div>

                                  <span className="team-name" title={nameAway}
                                    style={{
                                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                      overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-word",
                                      whiteSpace: "normal", minWidth: 0, padding: "0 2px", fontWeight: 700,
                                    }}
                                  >
                                    {nameAway}
                                  </span>
                                </div>

                                {editing && (
                                  <>
                                    <div className="admin-bottomrow" style={{ gap: 6, justifyContent: "center", display: "flex", flexWrap: "wrap" }}>
                                      <span title={nameHome} style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{nameHome}</span>
                                      <input type="number" placeholder="Home" style={{ width: 70 }}
                                        value={editDraft?.home_score ?? ""}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, home_score: e.target.value === "" ? "" : Number(e.target.value) }))} />
                                      <span>-</span>
                                      <input type="number" placeholder="Away" style={{ width: 70 }}
                                        value={editDraft?.away_score ?? ""}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, away_score: e.target.value === "" ? "" : Number(e.target.value) }))} />
                                      <span title={nameAway} style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{nameAway}</span>
                                    </div>

                                    <div className="admin-bottomrow" style={{ gap: 8, justifyContent: "center", display: "flex", flexWrap: "wrap" }}>
                                      <input type="date" value={editDraft?.edit_date ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, edit_date: e.target.value }))} />
                                      <input type="time" value={editDraft?.edit_time ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, edit_time: e.target.value }))} />
                                      <input type="number" style={{ width: 90 }} value={editDraft?.week_number ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, week_number: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="Semana" />
                                    </div>
                                  </>
                                )}

                                <div className="admin-actions" style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                  {!editing ? (
                                    <>
                                      <button onClick={() => empezarEdicion(p)}>Editar</button>
                                      <button onClick={() => eliminarPartido(p.id)}>Eliminar</button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={actualizarEdicion}>Guardar</button>
                                      <button onClick={cancelarEdicion}>Cancelar</button>
                                    </>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

AdminPage.propTypes = { onExit: PropTypes.func.isRequired };

/* === Subcomponente Login === */
function Login({ onLogged }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div className="panel center-max-900" style={{ textAlign: "center", margin: "32px auto", maxWidth: 420, width: "100%" }}>
        <h3>Login</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <button
            onClick={async () => {
              try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
                if (error) { alert("Error: " + error.message); return; }
                onLogged(data.session || null);
              } catch {
                alert("Error al iniciar sesión");
              }
            }}
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
Login.propTypes = { onLogged: PropTypes.func.isRequired };
