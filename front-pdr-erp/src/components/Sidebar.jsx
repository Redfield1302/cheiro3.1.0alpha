import { NavLink } from "react-router-dom";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/pdv", label: "PDV", icon: "🧾" },
  { to: "/cash", label: "Caixa", icon: "💰" },
  { to: "/inventory", label: "Estoque", icon: "📦" },
  { to: "/products", label: "Produtos", icon: "🛒" },
  { to: "/categories", label: "Categorias", icon: "📂" },
  { to: "/orders", label: "Pedidos", icon: "📋" },
  { to: "/kitchen", label: "Cozinha", icon: "👨‍🍳" },
  { to: "/conversations", label: "Atendimento", icon: "💬" }
];

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  return (
    <>
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="brand brand-compact">
        <div className="brand-mini-text">Cheiro Gestor</div>
      </div>

      <nav className="nav nav-compact" style={{ marginTop: 8 }}>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} onClick={onClose} className={({ isActive }) => (isActive ? "active pdv-rail-link" : "pdv-rail-link")}>
            <span className="pdv-rail-icon" aria-hidden="true">{it.icon}</span>
            <span className="pdv-rail-label">{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom-actions">
        <NavLink className={({ isActive }) => (isActive ? "pdv-rail-link active" : "pdv-rail-link")} to="/settings/whatsapp" onClick={onClose}>
          <span className="pdv-rail-icon rail-whatsapp-icon" aria-hidden="true">WA</span>
          <span className="pdv-rail-label">WhatsApp</span>
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "pdv-rail-link active" : "pdv-rail-link")} to="/settings/tenant" onClick={onClose}>
          <span className="pdv-rail-icon" aria-hidden="true">::</span>
          <span className="pdv-rail-label">Estabelecimento</span>
        </NavLink>
        <a className="pdv-rail-link" href="/t/minhapizzaria" target="_blank" rel="noreferrer">
          <span className="pdv-rail-icon" aria-hidden="true">-></span>
          <span className="pdv-rail-label">Cardapio</span>
        </a>
      </div>
    </aside>
    {isOpen ? <button className="mobile-overlay" onClick={onClose} aria-label="Fechar menu" /> : null}
    </>
  );
}
