import { clearSession, getSession } from "../lib/session";
import { THEMES, getTheme, setTheme } from "../lib/theme";
import StatusPill from "./StatusPill.jsx";

export default function Topbar({ title, subtitle, onMenuToggle }) {
  const s = getSession();

  return (
    <header className="topbar">
      <button className="btn mobile-menu-btn" onClick={onMenuToggle} aria-label="Abrir menu">
        ===
      </button>

      <div className="topbar-title-wrap">
        <div className="title">{title}</div>
        {subtitle ? <div className="muted" style={{ fontSize: 12 }}>{subtitle}</div> : null}
      </div>

      <div className="topbar-right" style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        <StatusPill />
        <select className="select topbar-theme-select" style={{ width: 190 }} defaultValue={getTheme()} onChange={(e) => setTheme(e.target.value)}>
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <span className="badge topbar-tenant-pill">{s?.tenant?.name || "Sem tenant"}</span>
        <button className="btn topbar-logout-btn" onClick={() => { clearSession(); window.location.href = "/login"; }}>
          Encerrar
        </button>
      </div>
    </header>
  );
}
