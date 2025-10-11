// src/pages/copa/AdminPanelCopa.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

const COPA_BUCKET = "team-logos-copa";

function slugify(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function AdminPanelCopa({ onExit }) {
  const [session, setSession] = useState(null);
  const [adminTab, setAdminTab] = useState("partidos");

  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [fases, setFases] = useState([]);
  const [loading, setLoading] = useState(false);

  const [tipoPartido, setTipoPartido] = useState("grupos");
  const [grupo, setGrupo] = useState("A");
  const [equipo1, setEquipo1] = useState("");
  const [equipo2, setEquipo2] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [semana, setSemana] = useState(1);

  const [faseName, setFaseName] = useState("");
  const [faseSel, setFaseSel] = useState("");

  const [semanaSel, setSemanaSel] = useState(null);

  const [editando, setEditando] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const [localEdits, setLocalEdits] = useState({});
  const [logoFiles, setLogoFiles] = useState({});
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoGrupo, setNuevoGrupo] = useState("A");
  const [subiendoLogoId, setSubiendoLogoId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
    })();

    recargarTodo();

    const ch = supabase
      .channel("realtime-copa")
      .on("postgres_changes", { event: "*", schema: "public", table: "copa_teams" }, recargarTodo)
      .on("postgres_changes", { event: "*", schema: "public", table: "copa_matches" }, recargarTodo)
      .on("postgres_changes", { event: "*", schema: "public", table: "copa_initial_standings" }, recargarTodo)
      .on("postgres_changes", { event: "*", schema: "public", table: "copa_groups" }, recargarTodo)
      .on("postgres_changes", { event: "*", schema: "public", table: "copa_phases" }, recargarTodo)
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, []);

  async function recargarTodo() {
    setLoading(true);
    try {
      const { data: g } = await supabase.from("copa_groups").select("*").order("code");
      const { data: t } = await supabase.from("copa_teams").select("id,name,group_label,logo_url").order("name");
      const { data: m } = await supabase.from("copa_matches").select("*").order("match_datetime", { ascending: true });
      const { data: p } = await supabase
        .from("copa_phases")
        .select("*")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

      setGrupos(g || []);
      setEquipos(t || []);
      setPartidos(m || []);
      setFases(p || []);

      const weeks = Array.from(new Set((m || []).map((x) => x.week_number).filter(Boolean))).sort((a, b) => a - b);
      setSemanaSel((prev) => (typeof prev === "number" ? prev : weeks[weeks.length - 1] ?? null));
    } finally {
      setLoading(false);
    }
  }

  function toLocalDate(dt) {
    const d = new Date(dt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function toLocalTime(dt) {
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function localToISOWithOffset(local) {
    if (!local) return null;
    const [YMD, HM] = local.split("T");
    if (!HM) return null;
    const [y, m, d] = YMD.split("-").map(Number);
    const [hh, mm] = HM.split(":").map(Number);
    const n = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    const off = n.getTimezoneOffset();
    const sign = off > 0 ? "-" : "+";
    const abs = Math.abs(off);
    const oh = String(Math.floor(abs / 60)).padStart(2, "0");
    const om = String(abs % 60).padStart(2, "0");
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${sign}${oh}:${om}`;
  }

  const equiposScope = useMemo(() => {
    if (tipoPartido === "elim") return equipos;
    return equipos.filter((t) => (t.group_label || "").toUpperCase() === grupo);
  }, [tipoPartido, equipos, grupo]);

  const idEquipo1 = useMemo(() => equiposScope.find((t) => t.name === equipo1)?.id ?? null, [equiposScope, equipo1]);
  const yaJugaron = (a, b) =>
    (partidos || []).some((m) => (m.home_team === a && m.away_team === b) || (m.home_team === b && m.away_team === a));
  const rivalesDisponibles = useMemo(() => {
    if (!idEquipo1) return equiposScope.filter((t) => t.name !== equipo1).map((t) => t.name);
    return equiposScope.filter((r) => r.id !== idEquipo1 && !yaJugaron(idEquipo1, r.id)).map((r) => r.name);
  }, [equiposScope, idEquipo1, equipo1, partidos]);

  async function crearEquipo() {
    if (!nuevoNombre.trim()) {
      alert("Escribe un nombre de equipo.");
      return;
    }
    const { error } = await supabase.from("copa_teams").insert([{ name: nuevoNombre.trim(), group_label: nuevoGrupo }]);
    if (error) {
      alert("No se pudo crear el equipo: " + error.message);
      return;
    }
    setNuevoNombre("");
    setNuevoGrupo("A");
    await recargarTodo();
  }

  function handleEditLocal(teamId, field, value) {
    setLocalEdits((p) => ({ ...p, [teamId]: { ...(p[teamId] || {}), [field]: value } }));
  }

  async function subirLogo(teamId, file) {
    if (!file) return null;
    setSubiendoLogoId(teamId);
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth?.session) {
        alert("Debes iniciar sesión para subir logos (no hay sesión activa).");
        return null;
      }
      const ext = (file.name.split(".").pop() || "webp").toLowerCase();
      const path = `team-${teamId}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from(COPA_BUCKET).upload(path, file, {
        upsert: false,
        cacheControl: "3600",
        contentType:
          file.type ||
          (ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/webp"),
      });
      if (up?.error) {
        console.error("Upload error:", up.error);
        alert(`No se pudo subir el logo: ${up.error.message}\nBucket: ${COPA_BUCKET}`);
        return null;
      }
      const { data: pub, error: pubErr } = supabase.storage.from(COPA_BUCKET).getPublicUrl(path);
      if (pubErr || !pub?.publicUrl) {
        console.error("Public URL error:", pubErr);
        alert("Subida ok, pero no se pudo obtener la URL pública del logo.");
        return null;
      }
      return pub.publicUrl;
    } finally {
      setSubiendoLogoId(null);
    }
  }

  async function guardarEquipo(team) {
    const draft = localEdits[team.id] || {};
    const payload = { name: draft.name ?? team.name, group_label: draft.group_label ?? team.group_label };
    const file = logoFiles[team.id];
    if (file) {
      const url = await subirLogo(team.id, file);
      if (url) payload.logo_url = url;
    }
    const { error } = await supabase.from("copa_teams").update(payload).eq("id", team.id);
    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }
    setLocalEdits((p) => {
      const c = { ...p };
      delete c[team.id];
      return c;
    });
    setLogoFiles((p) => {
      const c = { ...p };
      delete c[team.id];
      return c;
    });
    await recargarTodo();
  }

  async function eliminarEquipo(teamId) {
    if (!window.confirm("¿Eliminar equipo (y sus partidos/posiciones)?")) return;
    await supabase.from("copa_matches").delete().or(`home_team.eq.${teamId},away_team.eq.${teamId}`);
    await supabase.from("copa_initial_standings").delete().eq("team_id", teamId);
    await supabase.from("copa_teams").delete().eq("id", teamId);
    await recargarTodo();
  }

  async function guardarPartido() {
    if (!equipo1 || !equipo2 || equipo1 === equipo2 || !fecha || !hora) return;
    const t1 = equipos.find((t) => t.name === equipo1);
    const t2 = equipos.find((t) => t.name === equipo2);
    if (!t1 || !t2) return;
    if (yaJugaron(t1.id, t2.id)) {
      alert("Estos equipos ya jugaron entre sí.");
      return;
    }
    const iso = localToISOWithOffset(`${fecha}T${hora}`);

    let fase = (faseSel || "").trim();
    if (!fase && tipoPartido === "elim") fase = (faseName || "").trim();
    if (tipoPartido === "elim" && !fase) {
      alert("Ponle un nombre a la fase (ej: Cuartos de final).");
      return;
    }

    if (tipoPartido === "elim" && fase && !fases.some((f) => f.name.toLowerCase() === fase.toLowerCase())) {
      const nextOrder = (fases[fases.length - 1]?.display_order || 0) + 1;
      const ins = await supabase.from("copa_phases").insert([{ name: fase, display_order: nextOrder }]).select().single();
      if (!ins?.error && ins?.data)
        setFases((prev) => [...prev, ins.data].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)));
    }

    const payload = {
      home_team: t1.id,
      away_team: t2.id,
      home_score: null,
      away_score: null,
      played: false,
      match_datetime: iso,
      week_number: tipoPartido === "grupos" ? semana : null,
      group_label: tipoPartido === "grupos" ? grupo : null,
      phase_type: tipoPartido,
      phase_name: tipoPartido === "elim" ? fase : null,
    };

    const { error } = await supabase.from("copa_matches").insert([payload]);
    if (error) {
      alert("Error al crear partido: " + error.message);
      return;
    }

    setEquipo1("");
    setEquipo2("");
    setFecha("");
    setHora("");
    setSemana(1);
    if (tipoPartido === "elim") setFaseName("");
    await recargarTodo();
  }

  function empezarEdicion(p) {
    setEditando(p.id);
    setEditDraft({ ...p, edit_date: toLocalDate(p.match_datetime), edit_time: toLocalTime(p.match_datetime) });
  }
  function cancelarEdicion() {
    setEditando(null);
    setEditDraft(null);
  }
  async function actualizarEdicion() {
    if (!editDraft) return;
    const localCombined = editDraft.edit_date && editDraft.edit_time ? `${editDraft.edit_date}T${editDraft.edit_time}` : null;
    const iso = localCombined ? localToISOWithOffset(localCombined) : null;
    const payload = {
      home_score: editDraft.home_score === "" ? null : Number(editDraft.home_score),
      away_score: editDraft.away_score === "" ? null : Number(editDraft.away_score),
      played: editDraft.home_score !== "" && editDraft.away_score !== "",
      match_datetime: iso,
      week_number: Number(editDraft.week_number) || null,
    };
    const { error } = await supabase.from("copa_matches").update(payload).eq("id", editDraft.id);
    if (error) {
      alert("No se pudo actualizar: " + error.message);
      return;
    }
    cancelarEdicion();
    await recargarTodo();
  }

  const semanas = useMemo(
    () => Array.from(new Set((partidos || []).map((m) => m.week_number).filter(Boolean))).sort((a, b) => a - b),
    [partidos]
  );

  // Incluir eliminatorias aunque filtres por semana
  const partidosFiltrados = useMemo(() => {
    const list = partidos || [];
    if (typeof semanaSel === "number") {
      return list.filter((p) => p.week_number === semanaSel || p.phase_type === "elim");
    }
    return list;
  }, [partidos, semanaSel]);

  const codesDisponibles = grupos.length ? grupos.map((g) => g.code) : ["A", "B", "C", "D", "E"];
  const equiposPorGrupo = useMemo(() => {
    const map = new Map();
    codesDisponibles.forEach((c) => map.set(c, []));
    (equipos || []).forEach((t) => {
      const code = (t.group_label || "").toUpperCase();
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(t);
    });
    for (const arr of map.values()) arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return map;
  }, [equipos, grupos]);

  return (
    <div>
      <header className="app-header">
        <div />
        <div className="brand-line">
          <img
            src="/logo-evg.png"
            alt="Logo"
            className="brand-logo"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        <h1 className="brand-title">PANEL ADMIN — COPA EVG</h1>
        </div>
        <div style={{ justifySelf: "end", display: "flex", gap: 8 }}>
          <button onClick={onExit}>Inicio</button>
        </div>
      </header>

      <nav className="tabs-nav" style={{ marginTop: 8 }}>
        {[
          { key: "partidos", label: "Partidos" },
          { key: "equipos", label: "Equipos" },
          { key: "grupos", label: "Grupos" },
        ].map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${adminTab === t.key ? "active" : ""}`}
            onClick={() => setAdminTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section style={{ padding: 16 }}>
        {loading && (
          <div className="panel center-max-900" style={{ textAlign: "center", marginBottom: 12 }}>
            <p style={{ color: "#bbb" }}>Cargando…</p>
          </div>
        )}

        {adminTab === "grupos" && (
          <div
            className="center-max-1200"
            style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}
          >
            {(grupos.length ? grupos : [{ code: "A" }, { code: "B" }, { code: "C" }, { code: "D" }, { code: "E" }]).map(
              (g) => {
                const list = equiposPorGrupo.get(g.code) || [];
                const max = g.max_teams || 0;
                const titulo = g.display_name || `Grupo ${g.code}`;
                return (
                  <div key={g.code} className="panel" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <h3 style={{ margin: 0 }}>{titulo}</h3>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>
                        {max ? `${list.length} / ${max} equipos` : `${list.length} equipos`}
                      </span>
                    </div>
                    {list.length === 0 ? (
                      <p style={{ color: "#bbb", margin: "6px 0 0 0" }}>Sin equipos asignados.</p>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                        {list.map((t) => (
                          <li key={t.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <img
                              src={t.logo_url || `/logos/${slugify(t.name)}.webp`}
                              alt=""
                              style={{ width: 20, height: 20, objectFit: "contain", opacity: 0.9 }}
                              onError={(e) => {
                                const el = e.currentTarget;
                                const fallback = `/logos/${slugify(t.name)}.png`;
                                if (/\.webp(\?.*)?$/i.test(el.src)) el.src = fallback;
                                else el.style.visibility = "hidden";
                              }}
                            />
                            <span style={{ fontSize: 14 }}>{t.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {max ? (
                      <p style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>
                        Máximo configurado: {max} equipo{max === 1 ? "" : "s"}.
                      </p>
                    ) : (
                      <p style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>Sin límite de equipos configurado.</p>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}

        {adminTab === "partidos" && (
          <>
            <div className="panel center-max-900" style={{ textAlign: "center" }}>
              <h3>CREAR PARTIDO</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
                <label>Tipo:</label>
                <select
                  value={tipoPartido}
                  onChange={(e) => {
                    setTipoPartido(e.target.value);
                    setEquipo1("");
                    setEquipo2("");
                  }}
                >
                  <option value="grupos">Fase de grupos</option>
                  <option value="elim">Fase eliminatoria</option>
                </select>

                {tipoPartido === "grupos" && (
                  <>
                    <label>Grupo:</label>
                    <select
                      value={grupo}
                      onChange={(e) => {
                        setGrupo(e.target.value);
                        setEquipo1("");
                        setEquipo2("");
                      }}
                    >
                      {(grupos.length ? grupos.map((g) => g.code) : ["A", "B", "C", "D", "E"]).map((code) => (
                        <option key={code} value={code}>
                          Grupo {code}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {tipoPartido === "elim" && (
                  <>
                    <label>Fase:</label>
                    <select value={faseSel} onChange={(e) => setFaseSel(e.target.value)} style={{ minWidth: 160 }}>
                      <option value="">— Elegir guardada —</option>
                      {fases.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="o escribe un nombre (ej: Cuartos de final)"
                      value={faseName}
                      onChange={(e) => setFaseName(e.target.value)}
                      style={{ minWidth: 260 }}
                    />
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
                <select
                  value={equipo1}
                  onChange={(e) => {
                    setEquipo1(e.target.value);
                    setEquipo2("");
                  }}
                >
                  <option value="">Equipo 1</option>
                  {equiposScope.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select value={equipo2} onChange={(e) => setEquipo2(e.target.value)} disabled={!equipo1}>
                  <option value="">{equipo1 ? "Rival disponible" : "Elige Equipo 1"}</option>
                  {rivalesDisponibles.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                {tipoPartido === "grupos" && (
                  <input type="number" value={semana} onChange={(e) => setSemana(Number(e.target.value))} style={{ width: 90 }} placeholder="Semana" />
                )}
                <button onClick={guardarPartido} disabled={!equipo1 || !equipo2 || !fecha || !hora}>
                  Crear Partido
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12, textAlign: "center" }}>
              <label style={{ marginRight: 8 }}>Ver (Admin):</label>
              <select
                className="week-select-admin"
                value={typeof semanaSel === "number" ? semanaSel : ""}
                onChange={(e) => setSemanaSel(parseInt(e.target.value, 10))}
              >
                {semanas.map((w) => (
                  <option key={w} value={w}>
                    Semana {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="center-max-900" style={{ marginTop: 10 }}>
              {(() => {
                const ymd = (dt) => {
                  const d = new Date(dt);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                };
                const g = {};
                (partidosFiltrados || []).forEach((m) => {
                  if (!m?.match_datetime) return;
                  const k = ymd(m.match_datetime);
                  g[k] = g[k] || [];
                  g[k].push(m);
                });
                const gruposDia = Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
                if (!gruposDia.length) return <p style={{ color: "#bbb", textAlign: "center" }}>No hay partidos.</p>;
                const nombreEquipo = (id) => equipos.find((t) => t.id === id)?.name || "??";
                return gruposDia.map(([diaKey, arr]) => (
                  <div key={diaKey} style={{ marginBottom: 8 }}>
                    <h4 style={{ color: "#fff", opacity: 0.95, textAlign: "center" }}>
                      {(() => {
                        const f = new Date(arr[0].match_datetime);
                        const dias = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
                        const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
                        return `${dias[f.getDay()]} ${f.getDate()} de ${meses[f.getMonth()]}`;
                      })()}
                    </h4>
                    <ul className="cards-grid" style={{ gridTemplateColumns: "minmax(300px, 900px)", justifyContent: "center" }}>
                      {arr.map((p) => {
                        const editing = editando === p.id;
                        const haveScore = p.home_score != null && p.away_score != null;
                        const nameHome = nombreEquipo(p.home_team);
                        const nameAway = nombreEquipo(p.away_team);
                        return (
                          <li key={p.id} className={`admin-card ${!editing ? "hoverable" : ""}`} style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div className="admin-toprow" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
                              <div className="admin-badges" style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                {p.phase_type === "elim" && p.phase_name ? (
                                  <span className="admin-badge" style={{ background: "rgba(255,196,0,0.15)", border: "1px solid rgba(255,196,0,0.35)" }}>{p.phase_name}</span>
                                ) : (
                                  <span className="admin-badge admin-badge-group">GRUPO {p.group_label}</span>
                                )}
                                <span className="admin-badge admin-badge-time">
                                  {(() => {
                                    const f = new Date(p.match_datetime);
                                    let h = f.getHours();
                                    const m = String(f.getMinutes()).padStart(2, "0");
                                    const ampm = h >= 12 ? "pm" : "am";
                                    h = h % 12 || 12;
                                    return `${h}:${m} ${ampm}`;
                                  })()}
                                </span>
                              </div>
                            </div>
                            <div className="admin-bottomrow">
                              <span>{nameHome}</span>
                              <strong>{haveScore ? `${p.home_score} - ${p.away_score}` : "VS"}</strong>
                              <span>{nameAway}</span>
                            </div>
                            {!editing ? (
                              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                <button onClick={() => empezarEdicion(p)}>Editar</button>
                                <button
                                  onClick={async () => {
                                    if (!window.confirm("¿Eliminar partido?")) return;
                                    await supabase.from("copa_matches").delete().eq("id", p.id);
                                    await recargarTodo();
                                  }}
                                  style={{ background: "rgba(255,0,0,0.25)", borderColor: "rgba(255,0,0,0.6)" }}
                                >
                                  Eliminar
                                </button>
                              </div>
                            ) : (
                              <div className="panel" style={{ padding: 8 }}>
                                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                  <input type="number" placeholder="Home" value={editDraft.home_score ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, home_score: e.target.value }))} />
                                  <input type="number" placeholder="Away" value={editDraft.away_score ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, away_score: e.target.value }))} />
                                  <input type="date" value={editDraft.edit_date || ""} onChange={(e) => setEditDraft((d) => ({ ...d, edit_date: e.target.value }))} />
                                  <input type="time" value={editDraft.edit_time || ""} onChange={(e) => setEditDraft((d) => ({ ...d, edit_time: e.target.value }))} />
                                  <input type="number" value={editDraft.week_number ?? ""} placeholder="Semana" onChange={(e) => setEditDraft((d) => ({ ...d, week_number: e.target.value }))} />
                                </div>
                                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
                                  <button onClick={actualizarEdicion}>Guardar</button>
                                  <button onClick={cancelarEdicion}>Cancelar</button>
                                </div>
                              </div>
                            )}
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

        {adminTab === "equipos" && (
          <div className="panel center-max-900" style={{ marginTop: 0 }}>
            <h3 style={{ textAlign: "center" }}>GESTIÓN DE EQUIPOS (COPA)</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
              <input placeholder="Nombre del equipo" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} style={{ minWidth: 220 }} />
              <select value={nuevoGrupo} onChange={(e) => setNuevoGrupo(e.target.value)}>
                {(grupos.length ? grupos.map((g) => g.code) : ["A", "B", "C", "D", "E"]).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <button onClick={crearEquipo}>Crear equipo</button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Logo</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Nombre</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Grupo</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Subir logo</th>
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
                              const el = e.currentTarget;
                              const fallback = `/logos/${slugify(t.name)}.png`;
                              if (/\.webp(\?.*)?$/i.test(el.src)) el.src = fallback;
                              else el.src = "/logos/_default.png";
                            }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px", minWidth: 220 }}>
                          <input value={name} onChange={(e) => handleEditLocal(t.id, "name", e.target.value)} style={{ width: "100%" }} />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <select value={groupLabel} onChange={(e) => handleEditLocal(t.id, "group_label", e.target.value)}>
                            {(grupos.length ? grupos.map((g) => g.code) : ["A", "B", "C", "D", "E"]).map((code) => (
                              <option key={code} value={code}>
                                {code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="file"
                            accept=".webp,.png,.jpg,.jpeg"
                            onChange={(e) => setLogoFiles((p) => ({ ...p, [t.id]: e.target.files?.[0] || null }))}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button onClick={() => guardarEquipo(t)} disabled={subiendoLogoId === t.id}>
                              {subiendoLogoId === t.id ? "Subiendo..." : "Guardar"}
                            </button>
                            <button
                              onClick={() => eliminarEquipo(t.id)}
                              style={{ background: "rgba(255,0,0,0.25)", borderColor: "rgba(255,0,0,0.6)" }}
                            >
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
      </section>
    </div>
  );
}
