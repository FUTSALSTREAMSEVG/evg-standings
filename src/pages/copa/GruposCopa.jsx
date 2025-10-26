import React, { useMemo } from "react";
import PropTypes from "prop-types";

function slugify(s=""){return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)+/g,"");}
const localWebp = (name) => `/logos/${slugify(name)}.webp`;
const localPng  = (name) => `/logos/${slugify(name)}.png`;

function onErr(e){
  const img = e.currentTarget;
  const name = img.getAttribute("data-name")||"";
  if (/\.webp(\?.*)?$/i.test(img.src)) img.src = localPng(name);
  else { img.style.visibility="hidden"; img.style.width="0px"; img.style.height="0px"; }
}

const Panel = ({ title, items }) => (
  <div className="panel">
    <h2>{title}</h2>
    <ul className="logos-5col" style={{ display:"grid", gridTemplateColumns:"repeat(5,minmax(0,1fr))", gap:10, listStyle:"none", margin:0, padding:0 }}>
      {items.map((t) => (
        <li key={t.id} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.10)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", padding:10 }}>
          <img className="logo-grid-img"  key={`${t.id}-${t.logo_url || ""}`} src={t.logo_url || localWebp(t.name)} alt={`Logo ${t.name}`} data-name={t.name} onError={onErr} style={{ width:"100%", height:"auto", aspectRatio:"1/1", objectFit:"contain" }}/>
        </li>
      ))}
    </ul>
  </div>
);

export default function GruposCopa({ equipos }) {
  const grupos = useMemo(() => {
    const map = new Map();
    (equipos || []).forEach(t => {
      const g = (t.group_label || "").toUpperCase();
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(t);
    });
    for (const arr of map.values()) arr.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
    return Object.fromEntries([...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
  }, [equipos]);

  return (
    <section style={{ padding: "12px 8px" }}>
      <div className="grupos-2col" style={{ display:"grid", gap:14, gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))" }}>
        {Object.entries(grupos).map(([code, items]) => (
          <Panel key={code} title={`GRUPO ${code}`} items={items} />
        ))}
      </div>
    </section>
  );
}

GruposCopa.propTypes = { equipos: PropTypes.array.isRequired };
