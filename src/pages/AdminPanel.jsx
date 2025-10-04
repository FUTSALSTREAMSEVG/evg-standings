import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { supabase } from "../supabaseClient";

export default function AdminPage({ onExit }) {
  // Auth y permisos
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Datos
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);

  // Crear partido
  const [grupo, setGrupo] = useState("A");
  const [equipo1, setEquipo1] = useState(""); // nombre (no id)
  const [equipo2, setEquipo2] = useState(""); // nombre (no id)
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [semana, setSemana] = useState(1);

  // Edición
  const [editando, setEditando] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  // Filtro admin
  const [semanaAdminSeleccionada, setSemanaAdminSeleccionada] = useState(null);

  // ====== Hooks ======
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
    const { data, error } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
    setIsAdmin(!error && !!data?.is_admin);
  };

  const recargar = async () => {
    const { data: teams } = await supabase.from("teams").select("id,name,group_label").order("name");
    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .order("match_datetime", { ascending: true });

    setEquipos(teams || []);
    setPartidos(matches || []);

    const weeks = Array.from(new Set((matches || []).map((m) => m.week_number).filter(Boolean))).sort((a,b)=>a-b);
    setSemanaAdminSeleccionada((prev) => (typeof prev === "number" ? prev : (weeks[weeks.length - 1] ?? null)));
  };

  // ====== Utils ======
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
    const localDate = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    const tz = localDate.getTimezoneOffset();
    const sign = tz > 0 ? "-" : "+";
    const abs = Math.abs(tz);
    const oh = String(Math.floor(abs / 60)).padStart(2, "0");
    const om = String(abs % 60).padStart(2, "0");
    return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00${sign}${oh}:${om}`;
  };

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

  // ========= LÓGICA: rivales del mismo grupo que NO han jugado con Equipo1 =========
  const equiposDelGrupo = useMemo(
    () => equipos.filter((t) => t.group_label === grupo),
    [equipos, grupo]
  );
  const idEquipo1 = useMemo(() => equiposDelGrupo.find((t) => t.name === equipo1)?.id ?? null, [equiposDelGrupo, equipo1]);

  // "Ya jugó" = existe un partido con ambos equipos y escores no nulos.
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

  // ====== Crear partido ======
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

    const localCombined = `${fecha}T${hora}`;
    const iso = localToISOWithOffset(localCombined);
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

  // ====== Editar / Eliminar ======
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
      const { error } = await supabase.from("matches").update({
        home_score: editDraft.home_score === "" || editDraft.home_score == null ? null : Number(editDraft.home_score),
        away_score: editDraft.away_score === "" || editDraft.away_score == null ? null : Number(editDraft.away_score),
        played: editDraft.home_score !== null && editDraft.home_score !== "" && editDraft.away_score !== null && editDraft.away_score !== "",
        match_datetime: iso,
        week_number: Number(editDraft.week_number) || null,
      }).eq("id", editDraft.id);
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

  // ====== Listas derivadas ======
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
  // ====== UI ======
  return (
    <div>
      {/* Header propio de la PÁGINA ADMIN */}
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
            {/* === CREAR PARTIDO === */}
            <div className="panel center-max-900" style={{ textAlign: "center" }}>
              <h3>CREAR PARTIDO</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
                <select value={grupo} onChange={(e) => { setGrupo(e.target.value); setEquipo1(""); setEquipo2(""); }}>
                  <option value="A">Grupo A</option>
                  <option value="B">Grupo B</option>
                </select>

                {/* Equipo 1: del grupo */}
                <select
                  value={equipo1}
                  onChange={(e) => { setEquipo1(e.target.value); setEquipo2(""); }}
                >
                  <option value="">Equipo 1</option>
                  {equiposDelGrupo.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>

                {/* Equipo 2: rivales del grupo que NO han jugado con Equipo 1 */}
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

            {/* === FILTRO SEMANA (ADMIN) === */}
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

            {/* === LISTA / EDICIÓN === */}
            <div className="center-max-900" style={{ marginTop: 10 }}>
              {(() => {
                const grupos = agruparPorDia(partidosFiltrados);
                if (!grupos.length) return <p style={{ color: "#bbb", textAlign: "center" }}>No hay partidos para la semana seleccionada.</p>;
                return grupos.map(([diaKey, arr]) => (
                  <div key={diaKey} style={{ marginBottom: 8 }}>
                    <h4 style={{ color: "#ffffff", opacity: 0.95, textAlign: "center" }}>{formatearCabeceraDia(arr[0].match_datetime)}</h4>
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
                              // ⬇️ Fondo SIEMPRE visible en la tarjeta (sin overlay ni hover)
                              background: "linear-gradient(rgba(0,0,0,0.70), rgba(0,0,0,0.7)), url('/decor/field-grid.svg') center/120% no-repeat",

                            }}
                          >
                            {/* ===== FILA SUPERIOR: badges + hora ===== */}
                            <div className="admin-toprow" style={{ display: "grid", gridTemplateColumns: "1fr", alignItems: "center" }}>
                              <div className="admin-badges" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                                <span className="admin-badge admin-badge-group">GRUPO {p.group_label}</span>
                                <span className="admin-badge admin-badge-time">{formatearHora(p.match_datetime)}</span>
                              </div>
                            </div>

                            {/* ===== SOLO NOMBRES + MARCADOR (SIN LOGOS) ===== */}
                            <div
                              className="names-row"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
                                gap: 10,
                                alignItems: "center",
                                textAlign: "center",
                                fontSize: "clamp(20px, 1.9vw, 14px)",
                                lineHeight: 1.1,
                              }}
                            >
                              <span
                                className="team-name"
                                title={nameHome}
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
                                  fontWeight: 700,
                                }}
                              >
                                {nameHome}
                              </span>

                              <div
                                className="big-score"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  whiteSpace: "nowrap",
                                  lineHeight: 1,
                                  fontSize: "clamp(18px, 5.5vw, 26px)",
                                  minWidth: 56,
                                  padding: "6px 12px",
                                  borderRadius: 10,
                                  background: "rgba(241,127,38,0.22)",
                                  border: "1px solid rgba(241,127,38,0.65)",
                                  color: "#ffd7b5",
                                  fontWeight: 900,
                                  letterSpacing: "1px",
                                }}
                              >
                                {haveScore ? `${p.home_score} - ${p.away_score}` : "VS"}
                              </div>

                              <span
                                className="team-name"
                                title={nameAway}
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
                                  fontWeight: 700,
                                }}
                              >
                                {nameAway}
                              </span>
                            </div>

                            {/* ===== CUERPO (solo en edición): inputs ===== */}
                            {editing && (
                              <>
                                <div className="admin-bottomrow" style={{ gap: 6, justifyContent: "center", display: "flex", flexWrap: "wrap" }}>
                                  <span
                                    title={nameHome}
                                    style={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 1,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      maxWidth: 180,
                                    }}
                                  >
                                    {nameHome}
                                  </span>
                                  <input
                                    type="number" placeholder="Home" style={{ width: 70 }}
                                    value={editDraft?.home_score ?? ""}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, home_score: e.target.value === "" ? "" : Number(e.target.value) }))}
                                  />
                                  <span>-</span>
                                  <input
                                    type="number" placeholder="Away" style={{ width: 70 }}
                                    value={editDraft?.away_score ?? ""}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, away_score: e.target.value === "" ? "" : Number(e.target.value) }))}
                                  />
                                  <span
                                    title={nameAway}
                                    style={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 1,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      maxWidth: 180,
                                    }}
                                  >
                                    {nameAway}
                                  </span>
                                </div>

                                <div className="admin-bottomrow" style={{ gap: 8, justifyContent: "center", display: "flex", flexWrap: "wrap" }}>
                                  <input
                                    type="date"
                                    value={editDraft?.edit_date ?? ""}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, edit_date: e.target.value }))}
                                  />
                                  <input
                                    type="time"
                                    value={editDraft?.edit_time ?? ""}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, edit_time: e.target.value }))}
                                  />
                                  <input
                                    type="number" style={{ width: 90 }}
                                    value={editDraft?.week_number ?? ""}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, week_number: e.target.value === "" ? null : Number(e.target.value) }))}
                                    placeholder="Semana"
                                  />
                                </div>
                              </>
                            )}

                            {/* ===== BARRA INFERIOR: botones SIEMPRE ABAJO ===== */}
                            <div
                              className="admin-actions"
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                gap: 8,
                                flexWrap: "wrap",
                                marginTop: 6,
                                paddingTop: 6,
                                borderTop: "1px solid rgba(255,255,255,0.08)",
                              }}
                            >
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
      </section>
    </div>
  );
}

AdminPage.propTypes = {
  onExit: PropTypes.func.isRequired, // vuelve a "/"
};

// ====== Subcomponente Login (centrado) ======
function Login({ onLogged }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div className="panel center-max-900"
           style={{ textAlign: "center", margin: "32px auto", maxWidth: 420, width: "100%" }}>
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
Login.propTypes = {
  onLogged: PropTypes.func.isRequired,
};
