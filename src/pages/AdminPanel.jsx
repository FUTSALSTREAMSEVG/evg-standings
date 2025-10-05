import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { supabase } from "../supabaseClient";

/* ==================== UTILIDADES ==================== */
function slugify(str = "") {
  return String(str)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/* ==================== COMPONENTE ==================== */
export default function AdminPage({ onExit }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(true);   // RLS OFF => no bloqueamos UI
  const [checkingAdmin, setCheckingAdmin] = useState(false); // no usamos spinner

  // Tabs
  const [activeTab, setActiveTab] = useState("partidos");

  // Datos base
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);

  // Crear partido
  const [grupo, setGrupo] = useState("A");
  const [equipo1, setEquipo1] = useState("");
  const [equipo2, setEquipo2] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [semana, setSemana] = useState(1);

  // Editar partido
  const [editando, setEditando] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  // Filtro semana
  const [semanaAdminSeleccionada, setSemanaAdminSeleccionada] = useState(null);

  // Gestión de Equipos
  const [subiendoLogoId, setSubiendoLogoId] = useState(null);
  const [logoFiles, setLogoFiles] = useState({});
  const [localEdits, setLocalEdits] = useState({});
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoGrupo, setNuevoGrupo] = useState("A");

  // Backups
  const [backups, setBackups] = useState([]); // [{name, ts, pretty}]

  /* =========== ENTRAR RÁPIDO (RLS OFF, sin bloquear UI) =========== */
  const entrarRapido = () => {
    setCheckingAdmin(false);
    setIsAdmin(true);
    setTimeout(() => { verificarAdmin(); }, 0); // verifica en segundo plano
  };

  /* ==================== AUTH + INIT ==================== */
  useEffect(() => {
    let unsubAuth = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      if (data?.session) entrarRapido();

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
        setSession(s || null);
        if (s) entrarRapido();
        else { setIsAdmin(false); setCheckingAdmin(false); }
      });
      unsubAuth = sub?.subscription;
    })();

    recargarTodo();
    recargarBackups();

    const channel = supabase
      .channel("realtime-evg-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, recargarTodo)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, recargarTodo)
      .on("postgres_changes", { event: "*", schema: "public", table: "initial_standings" }, recargarTodo)
      .subscribe();

    return () => {
      try { unsubAuth?.unsubscribe?.(); } catch {}
      try { supabase.removeChannel(channel); } catch {}
      try { supabase.removeAllChannels?.(); } catch {}
    };
  }, []);

  /* ==================== CERRAR SESIÓN ==================== */
  const cerrarSesion = async () => {
    try { await supabase.auth.signOut(); }
    catch (e) { console.warn("signOut error:", e?.message || e); }
    finally {
      try { supabase.removeAllChannels?.(); } catch {}
      setSession(null);
      setIsAdmin(false);
      window.location.reload(); // estado limpio sí o sí
    }
  };

  /* ========== (Opcional) Verificación real en 2º plano ========== */
  const verificarAdmin = async () => {
    try {
      const { data: ures } = await supabase.auth.getUser();
      if (!ures?.user?.id) { setIsAdmin(false); return false; }
      // Si tienes la RPC fn_is_admin activa, úsala:
      const { data, error } = await supabase.rpc("fn_is_admin");
      if (error) { console.warn("fn_is_admin error:", error?.message || error); return true; } // no bloquear
      setIsAdmin(!!data);
      return !!data;
    } catch (e) {
      console.warn("verificarAdmin exception:", e?.message || e);
      return true; // no bloquees UI con RLS OFF
    }
  };

  /* ==================== DATA ==================== */
  const recargarTodo = async () => {
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

  // Fechas utilidades
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

  // Rivales disponibles
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
  /* ==================== PARTIDOS ==================== */
  const guardarPartido = async () => {
    if (!equipo1 || !equipo2 || equipo1 === equipo2 || !fecha || !hora) return;
    const grupoTeams = equipos.filter((t) => t.group_label === grupo);
    const t1 = grupoTeams.find((t) => t.name === equipo1);
    const t2 = grupoTeams.find((t) => t.name === equipo2);
    if (!t1 || !t2) return;

    if ( yaJugaron(t1.id, t2.id) ) {
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
      await recargarTodo();
    } catch (e) {
      alert("Error al crear partido: " + (e?.message || e));
    }
  };

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
      await recargarTodo();
    } catch (e) {
      alert("Error al actualizar partido: " + (e?.message || e));
    }
  };

  const eliminarPartido = async (id) => {
    if (!window.confirm("¿Eliminar partido?")) return;
    try {
      const { error } = await supabase.from("matches").delete().eq("id", Number(id));
      if (error) throw error;
      await recargarTodo();
    } catch (e) {
      alert("No se pudo eliminar el partido: " + (e?.message || e));
    }
  };

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

  /* ==================== EQUIPOS ==================== */
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
      if (up?.error) {
        alert("Error subiendo al Storage: " + up.error.message);
        console.error("Storage upload error:", up.error);
        return null;
      }

      const { data: pub } = supabase.storage.from("team-logos").getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) {
        alert("No se obtuvo URL público del logo (getPublicUrl)");
        return null;
      }

      const upd = await supabase.from("teams").update({ logo_url: publicUrl }).eq("id", teamId);
      if (upd?.error) {
        alert("Error actualizando teams.logo_url: " + upd.error.message);
        console.error("Teams update error:", upd.error);
        return null;
      }
      return publicUrl;
    } catch (e) {
      alert("Excepción durante la subida: " + (e?.message || e));
      console.error(e);
      return null;
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
      else delete payload.logo_url;
    }

    const { error } = await supabase.from("teams").update(payload).eq("id", team.id);
    if (error) {
      alert("No se pudo guardar el equipo: " + error.message);
      return;
    }

    setLocalEdits((p) => { const c = { ...p }; delete c[team.id]; return c; });
    setLogoFiles((p) => { const c = { ...p }; delete c[team.id]; return c; });

    await recargarTodo();
  }

  async function crearEquipo() {
    if (!nuevoNombre.trim()) { alert("Escribe un nombre de equipo."); return; }
    const { error } = await supabase.from("teams")
      .insert([{ name: nuevoNombre.trim(), group_label: nuevoGrupo }]);
    if (error) {
      alert("No se pudo crear el equipo: " + error.message);
      return;
    }
    setNuevoNombre("");
    setNuevoGrupo("A");
    await recargarTodo();
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

      await recargarTodo();
    } catch (e) {
      alert("No se pudo eliminar el equipo: " + (e?.message || e));
    }
  }
  /* ===================== BACKUP (máx 2) & RESET ===================== */

  // Timestamp para nombres
  const tsId = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  // Lista backups
  const recargarBackups = async () => {
    const { data: files, error } = await supabase.storage.from("team-logos")
      .list("_backups", { sortBy: { column: "name", order: "desc" }});
    if (error) { setBackups([]); return; }

    const parseTs = (ts) => {
      const y = ts.slice(0,4), mo = ts.slice(4,6), d = ts.slice(6,8);
      const hh = ts.slice(9,11), mm = ts.slice(11,13), ss = ts.slice(13,15);
      return `${y}-${mo}-${d} ${hh}:${mm}:${ss}`;
    };

    const list = (files || [])
      .filter(f => /^league-\d{8}-\d{6}\.json$/.test(f.name))
      .map(f => {
        const m = f.name.match(/^league-(\d{8}-\d{6})\.json$/);
        const ts = m ? m[1] : null;
        return { name: f.name, ts, pretty: ts ? parseTs(ts) : "—" };
      })
      .sort((a,b)=> (a.name < b.name ? 1 : -1))
      .slice(0, 2);

    setBackups(list);
  };

  // Listar logos del bucket raíz
  const listarLogos = async () => {
    const bucket = supabase.storage.from("team-logos");
    let page = 0;
    const files = [];
    while (true) {
      const { data, error } = await bucket.list("", { limit: 100, offset: 100 * page });
      if (error) break;
      if (!data || data.length === 0) break;
      files.push(...data.filter(f => !f.name.endsWith("/")).map(f => f.name));
      if (data.length < 100) break;
      page++;
    }
    return files;
  };

  const copiarLogos = async (fromPrefix, toPrefix) => {
    const bucket = supabase.storage.from("team-logos");
    if (!fromPrefix) {
      const files = await listarLogos();
      for (const name of files) {
        const fromPath = name;
        const toPath = toPrefix ? `${toPrefix}/${name}` : name;
        const { error } = await bucket.copy(fromPath, toPath);
        if (error) { /* ignora faltantes */ }
      }
    } else {
      let offset = 0;
      while (true) {
        const { data, error } = await bucket.list(fromPrefix, { limit: 100, offset });
        if (error || !data || data.length === 0) break;
        for (const f of data) {
          if (f.name.endsWith("/")) continue;
          const fromPath = `${fromPrefix}/${f.name}`;
          const toPath = toPrefix ? `${toPrefix}/${f.name}` : f.name;
          const { error: e2 } = await bucket.copy(fromPath, toPath);
          if (e2) { /* ignora faltantes */ }
        }
        if (data.length < 100) break;
        offset += 100;
      }
    }
  };

  const borrarTodosLosLogos = async () => {
    const bucket = supabase.storage.from("team-logos");
    const files = await listarLogos();
    if (files.length) await bucket.remove(files.map(n => ({ name: n })));
  };

  const fetchTodo = async () => {
    const { data: teams } = await supabase.from("teams").select("*");
    const { data: standings } = await supabase.from("initial_standings").select("*");
    const { data: matches } = await supabase.from("matches").select("*");
    return { teams: teams || [], standings: standings || [], matches: matches || [] };
  };

  const subirBackupJSON = async (obj, ts) => {
    try {
      const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
      const path = `_backups/league-${ts}.json`;

      const { data, error } = await supabase.storage
        .from("team-logos")
        .upload(path, blob, { upsert: true, contentType: "application/json" });

      if (error) {
        if (/row-level security/i.test(error.message)) {
          throw new Error("Storage RLS bloqueó la subida (revisa policies INSERT en 'team-logos').");
        }
        if (/bucket/i.test(error.message) && /not found/i.test(error.message)) {
          throw new Error("El bucket 'team-logos' no existe (nombre exacto).");
        }
        throw error;
      }
      if (!data?.path) throw new Error("El Storage subió pero no devolvió 'path'.");
      return data.path;
    } catch (e) {
      console.error("subirBackupJSON:", e);
      throw e;
    }
  };

  const crearBackup = async () => {
    const ts = tsId();

    // 1) estado actual
    const data = await fetchTodo();

    // 2) copiar logos actuales -> carpeta del backup
    await copiarLogos("", `team-logos-backup/${ts}`);

    // 3) subir JSON
    await subirBackupJSON({ ts, ...data }, ts);

    // 4) mantener máx 2 (JSON + carpeta logos)
    const { data: files } = await supabase.storage.from("team-logos")
      .list("_backups", { sortBy: { column: "name", order: "desc" }});
    const jsons = (files || [])
      .filter(f => f.name.startsWith("league-") && f.name.endsWith(".json"))
      .map(f => f.name)
      .sort((a,b)=> (a < b ? 1 : -1));
    const sobra = jsons.slice(2);
    for (const name of sobra) {
      await supabase.storage.from("team-logos").remove([`_backups/${name}`]);
      const m = name.match(/^league-(\d{8}-\d{6})\.json$/);
      const folder = m ? `team-logos-backup/${m[1]}` : null;
      if (folder) {
        let page = 0;
        while (true) {
          const { data: sub } = await supabase.storage.from("team-logos").list(folder, { limit: 100, offset: 100 * page });
          if (!sub || sub.length === 0) break;
          await supabase.storage.from("team-logos").remove(sub.map(f => `${folder}/${f.name}`));
          if (sub.length < 100) break;
          page++;
        }
      }
    }

    await recargarBackups();
    return { ts };
  };

  const crearBackupManual = async () => {
    try {
      const { ts } = await crearBackup();
      alert(`Backup creado correctamente (${ts}).`);
    } catch (e) {
      alert("No se pudo crear el backup: " + (e?.message || e));
    }
  };

  const resetearLigaConBackup = async () => {
    const ok = window.confirm(
      "Esto hará un BACKUP y luego borrará TODOS los equipos, posiciones iniciales, partidos y logos. ¿Continuar?"
    );
    if (!ok) return;

    const email = session?.user?.email || "";
    const pass = window.prompt(`Por seguridad, ingresa la CLAVE de ${email} para confirmar:`);
    if (!pass) { alert("Operación cancelada."); return; }

    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (authErr) { alert("Clave incorrecta."); return; }

      await crearBackup();

      const { matches, standings, teams } = await fetchTodo();
      const delByIds = async (table, ids) => {
        for (let i=0;i<ids.length;i+=1000) {
          const batch = ids.slice(i, i+1000);
          const { error } = await supabase.from(table).delete().in("id", batch);
          if (error) throw new Error(error.message);
        }
      };
      if (matches.length) await delByIds("matches", matches.map(m=>m.id));
      if (standings.length) await delByIds("initial_standings", standings.map(s=>s.id));
      if (teams.length) await delByIds("teams", teams.map(t=>t.id));

      await borrarTodosLosLogos();

      alert("Liga reseteada. Todo quedó en 0. Ahora puedes cargar equipos nuevos.");
      await recargarTodo();
      setActiveTab("equipos");
    } catch (e) {
      alert("No se pudo resetear: " + (e?.message || e));
    }
  };
  /* ===================== DESCARGAS & RESTAURACIÓN ===================== */

  // Descargar JSON (nombre amigable)
  const downloadBackup = async (name, tsHint) => {
    try {
      const { data, error } = await supabase.storage.from("team-logos")
        .createSignedUrl(`_backups/${name}`, 60);
      let url = data?.signedUrl;

      if (error || !url) {
        const pub = supabase.storage.from("team-logos").getPublicUrl(`_backups/${name}`);
        url = pub?.data?.publicUrl;
        if (!url) throw new Error("No fue posible generar un enlace de descarga.");
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("No se pudo descargar el backup.");
      const blob = await res.blob();

      const ts = tsHint || (name.match(/^league-(\d{8}-\d{6})\.json$/)?.[1] ?? "FECHA");
      const filename = `EVG-backup-${ts}.json`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert("No fue posible descargar el backup: " + (e?.message || e));
    }
  };

  // Descargar logos (zip) del mismo timestamp
  const ensureJSZip = () =>
    new Promise((resolve, reject) => {
      if (window.JSZip) return resolve(window.JSZip);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => reject(new Error("No se pudo cargar JSZip"));
      document.head.appendChild(s);
    });

  const downloadLogosZip = async (ts) => {
    try {
      if (!ts) { alert("Este backup no tiene timestamp."); return; }
      const JSZip = await ensureJSZip();
      const zip = new JSZip();

      const prefix = `team-logos-backup/${ts}`;
      let offset = 0;
      while (true) {
        const { data, error } = await supabase.storage.from("team-logos")
          .list(prefix, { limit: 100, offset });
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;

        for (const f of data) {
          if (f.name.endsWith("/")) continue;
          const path = `${prefix}/${f.name}`;
          const { data: fileBlob, error: dlErr } = await supabase.storage.from("team-logos").download(path);
          if (dlErr) { console.warn("No se pudo bajar", path, dlErr.message); continue; }
          const arrayBuf = await fileBlob.arrayBuffer();
          zip.file(f.name, arrayBuf);
        }

        if (data.length < 100) break;
        offset += 100;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `EVG-logos-${ts}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert("No se pudo generar el ZIP de logos: " + (e?.message || e));
    }
  };

  // Restaurar desde archivo (.json)
  const restaurarDesdeArchivo = async (fileOrBlob) => {
    try {
      const text = await (fileOrBlob.text ? fileOrBlob.text() : new Response(fileOrBlob).text());
      const backup = JSON.parse(text);

      // Restaurar logos si hay carpeta con ese ts
      if (backup.ts) {
        await copiarLogos(`team-logos-backup/${backup.ts}`, "");
      }

      // Limpiar actuales
      const { matches, standings, teams } = await fetchTodo();
      const delByIds = async (table, ids) => {
        for (let i=0;i<ids.length;i+=1000) {
          const batch = ids.slice(i, i+1000);
          const { error } = await supabase.from(table).delete().in("id", batch);
          if (error) throw new Error(error.message);
        }
      };
      if (matches.length) await delByIds("matches", matches.map(m=>m.id));
      if (standings.length) await delByIds("initial_standings", standings.map(s=>s.id));
      if (teams.length) await delByIds("teams", teams.map(t=>t.id));

      // Insertar respaldo tal cual estaba
      if (backup.teams?.length) {
        const { error } = await supabase.from("teams").insert(backup.teams);
        if (error) throw new Error("Teams: " + error.message);
      }
      if (backup.standings?.length) {
        const { error } = await supabase.from("initial_standings").insert(backup.standings);
        if (error) throw new Error("Initial_standings: " + error.message);
      }
      if (backup.matches?.length) {
        const { error } = await supabase.from("matches").insert(backup.matches);
        if (error) throw new Error("Matches: " + error.message);
      }

      alert("Backup restaurado correctamente.");
      await recargarTodo();
    } catch (e) {
      alert("No se pudo restaurar desde el archivo: " + (e?.message || e));
    }
  };

  // UI helper botón de tabs
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
      {/* HEADER (visual intacto) */}
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
            <button onClick={cerrarSesion}>Cerrar sesión</button>
          )}
        </div>
      </header>

      <section style={{ padding: 16 }}>
        {!session ? (
          <Login onLogged={(s) => { setSession(s); entrarRapido(); }} />
        ) : (
          <>
            {/* Tabs */}
            <div className="center-max-900" style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 14 }}>
              <TabButton id="partidos">Partidos</TabButton>
              <TabButton id="equipos">Gestión de Equipos</TabButton>
              <TabButton id="temporada">Temporada</TabButton>
            </div>

            {/* ======== TEMPORADA ======== */}
            {activeTab === "temporada" && (
              <div className="panel center-max-900" style={{ marginBottom: 16 }}>
                <h3 style={{ textAlign: "center", marginBottom: 10 }}>GESTIÓN DE TEMPORADA</h3>

                <div style={{ textAlign: "center", marginBottom: 14 }}>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>
                    Máximo <strong>2</strong> backups. Puedes <strong>crear</strong>, <strong>descargar</strong> y <strong>restaurar</strong>.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <button onClick={crearBackupManual}>Crear backup ahora</button>
                    <button onClick={resetearLigaConBackup} style={{ background: "#a33" }}>
                      Resetear liga (con backup)
                    </button>
                    <button onClick={async () => {
                      const ok = window.confirm("Esto restaurará el **último** backup guardado en Storage. ¿Continuar?");
                      if (!ok) return;
                      try {
                        if (!backups.length) { alert("No hay backups disponibles."); return; }
                        const last = backups[0];
                        const { data, error } = await supabase.storage.from("team-logos")
                          .download(`_backups/${last.name}`);
                        if (error) throw new Error(error.message);
                        await restaurarDesdeArchivo(data);
                      } catch (e) {
                        alert("No se pudo restaurar: " + (e?.message || e));
                      }
                    }}>
                      Restaurar último backup
                    </button>
                  </div>
                </div>

                {/* Lista de backups (máx 2) */}
                <div className="panel" style={{ maxWidth: 900, margin: "0 auto 12px auto" }}>
                  <h4 style={{ textAlign: "center", marginBottom: 8 }}>Backups recientes (máx 2)</h4>
                  {backups.length === 0 ? (
                    <p style={{ textAlign: "center", opacity: 0.75 }}>No hay backups.</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ opacity: 0.85 }}>
                          <th style={{ textAlign: "left", padding: "6px 8px" }}>Archivo</th>
                          <th style={{ textAlign: "left", padding: "6px 8px" }}>Fecha y hora</th>
                          <th style={{ textAlign: "left", padding: "6px 8px" }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backups.map((bk) => (
                          <tr key={bk.name} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <td style={{ padding: "6px 8px" }}>{bk.name}</td>
                            <td style={{ padding: "6px 8px" }}>{bk.pretty}</td>
                            <td style={{ padding: "6px 8px" }}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <button onClick={() => downloadBackup(bk.name, bk.ts)}>Descargar JSON</button>
                                <button onClick={() => downloadLogosZip(bk.ts)}>Descargar logos</button>
                                <button onClick={async () => {
                                  try {
                                    const { data, error } = await supabase.storage.from("team-logos")
                                      .download(`_backups/${bk.name}`);
                                    if (error) throw new Error(error.message);
                                    await restaurarDesdeArchivo(data);
                                  } catch (e) {
                                    alert("No se pudo restaurar este backup: " + (e?.message || e));
                                  }
                                }}>
                                  Restaurar este
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Restaurar desde archivo (.json) */}
                <div className="panel" style={{ maxWidth: 900, margin: "0 auto" }}>
                  <h4 style={{ textAlign: "center", marginBottom: 8 }}>Restaurar desde archivo (.json)</h4>
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="file"
                      accept="application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ok = window.confirm("Esto reemplazará por completo el estado actual con el del archivo. ¿Continuar?");
                        if (!ok) return;
                        restaurarDesdeArchivo(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8, textAlign: "center" }}>
                    Tip: descarga un backup (JSON + logos ZIP) y podrás restaurar cuando quieras.
                  </p>
                </div>
              </div>
            )}

            {/* ======== GESTIÓN DE EQUIPOS ======== */}
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
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <img
                                  src={srcLogo}
                                  alt={`Logo ${t.name}`}
                                  style={{ width: 36, height: 36, objectFit: "contain", background: "rgba(255,255,255,0.06)", borderRadius: 6 }}
                                  onError={(e) => {
                                    if (srcLogo.endsWith(".webp")) e.currentTarget.src = `/logos/${slugify(t.name)}.png`;
                                    else e.currentTarget.src = "/logos/_default.png";
                                  }}
                                />
                              </div>
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

            {/* ======== PARTIDOS (tarjetas) ======== */}
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

                {/* Filtro Semana */}
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

                {/* LISTA / EDICIÓN (tarjetas) */}
                <div className="center-max-900" style={{ marginTop: 10 }}>
                  {(() => {
                    const ymd = (dt) => {
                      const d = new Date(dt);
                      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                    };
                    const g = {};
                    (partidosFiltrados || []).forEach((m) => {
                      if (!m?.match_datetime) return;
                      const k = ymd(m.match_datetime);
                      g[k] = g[k] || [];
                      g[k].push(m);
                    });
                    const grupos = Object.entries(g).sort(([a],[b]) => a.localeCompare(b));
                    if (!grupos.length) return <p style={{ color: "#bbb", textAlign: "center" }}>No hay partidos para la semana seleccionada.</p>;
                    return grupos.map(([diaKey, arr]) => (
                      <div key={diaKey} style={{ marginBottom: 8 }}>
                        <h4 style={{ color: "#ffffff", opacity: 0.95, textAlign: "center" }}>
                          {(() => {
                            const f = new Date(arr[0].match_datetime);
                            const dias = ["DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO"];
                            const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
                            return `${dias[f.getDay()]} ${f.getDate()} de ${meses[f.getMonth()]}`;
                          })()}
                        </h4>
                        <ul className="cards-grid" style={{ gridTemplateColumns: "minmax(300px, 900px)", justifyContent: "center" }}>
                          {arr.map((p) => {
                            const editing = editando === p.id;
                            const haveScore = p.home_score != null && p.away_score != null;
                            const nameHome = equipos.find((t) => t.id === p.home_team)?.name || "??";
                            const nameAway = equipos.find((t) => t.id === p.away_team)?.name || "??";

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
                                    <span className="admin-badge admin-badge-time">{(() => {
                                      const f = new Date(p.match_datetime);
                                      let h = f.getHours();
                                      const m = String(f.getMinutes()).padStart(2, "0");
                                      const ampm = h >= 12 ? "pm" : "am";
                                      h = h % 12 || 12;
                                      return `${h}:${m} ${ampm}`;
                                    })()}</span>
                                  </div>
                                </div>

                                {/* Nombres + marcador */}
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

/* ==================== LOGIN ==================== */
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
                onLogged(data.session || null); // el padre llama entrarRapido()
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
