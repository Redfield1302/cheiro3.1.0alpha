import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

const titles = {
  "/dashboard": { title: "Dashboard", subtitle: "Indicadores de vendas, CMV e margem" },
  "/pdv": { title: "PDV", subtitle: "Venda rapida de balcao" },
  "/cash": { title: "Caixa", subtitle: "Abertura, fechamento e movimentos" },
  "/inventory": { title: "Estoque", subtitle: "Insumos e movimentacoes" },
  "/products": { title: "Produtos", subtitle: "Catalogo interno" },
  "/kitchen": { title: "Cozinha", subtitle: "Acompanhe e atualize o preparo por tenant" },
  "/conversations": { title: "Atendimento", subtitle: "Inbox e mensagens" },
  "/settings/whatsapp": { title: "WhatsApp", subtitle: "Conexao por QR, bot e notificacoes de clientes" }
};

export default function Layout() {
  const loc = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const meta = titles[loc.pathname] || { title: "Cheio Gestor", subtitle: "" };

  useEffect(() => {
    setMobileNavOpen(false);
  }, [loc.pathname]);

  return (
    <div className="app">
      <Sidebar isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="main">
        <Topbar title={meta.title} subtitle={meta.subtitle} onMenuToggle={() => setMobileNavOpen((v) => !v)} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
