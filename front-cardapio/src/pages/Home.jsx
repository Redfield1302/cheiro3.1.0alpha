import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTenant } from "../lib/api";

const money = (n) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const DAY_LABEL = {
  sun: "Dom",
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sab"
};

const DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const PAYMENT_LABEL = {
  PIX: "Pix",
  DEBIT: "cartao debito",
  CREDIT: "cartao credito",
  CASH: "dinheiro"
};

export default function Home() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getTenant(slug)
      .then((res) => setTenant(res.tenant))
      .catch((e) => setErr(e.message));
  }, [slug]);

  const openingHours = Array.isArray(tenant?.rulesJson?.openingHours) ? tenant.rulesJson.openingHours : [];
  const orderedDays = DAY_ORDER.map((key) => openingHours.find((d) => d.day === key)).filter(Boolean);
  const daysToRender = orderedDays.length
    ? orderedDays
    : DAY_ORDER.map((day) => ({ day, open: "16:00", close: "23:59", closed: day === "sun" }));
  const deliveryEta = tenant?.rulesJson?.home?.deliveryEta || "35/40 min";
  const minimumOrder = tenant?.rulesJson?.home?.minimumOrder || 25;
  const paymentMethods = Array.isArray(tenant?.rulesJson?.home?.paymentMethods) && tenant.rulesJson.home.paymentMethods.length
    ? tenant.rulesJson.home.paymentMethods
    : ["PIX", "DEBIT", "CREDIT"];

  return (
    <div className="m-app m-home-figma-bg">
      <main className="m-home-figma-wrap">
        {err ? <div className="m-surface">{err}</div> : null}
        <section className="m-home-figma-card">
          <header
            className="m-home-hero m-home-hero-figma"
            style={tenant?.branding?.heroImageUrl ? { backgroundImage: `url(${tenant.branding.heroImageUrl})` } : undefined}
          />

          <div className="m-home-figma-head">
            <div className="m-home-figma-icon-wrap">
              {tenant?.branding?.restaurantIconUrl || tenant?.logoUrl ? (
                <img className="m-home-logo m-home-logo-figma" src={tenant?.branding?.restaurantIconUrl || tenant?.logoUrl} alt={`Logo ${tenant?.name || ""}`} />
              ) : (
                <div className="m-home-logo m-home-logo-figma m-home-fallback-icon" />
              )}
            </div>
            <div>
              <h1 className="m-home-figma-title">{tenant?.name || "Cardapio Digital"}</h1>
             { /*<!--<p className="m-home-figma-subtitle">sabores e sensacoes</p>-->*/ }
            </div>
          </div>

          <div className="m-home-figma-meta">
            <div className="m-home-figma-meta-item">â—· {deliveryEta}</div>
            <div className="m-home-figma-meta-item">R$ {money(minimumOrder).replace("R$", "").trim()} pedido minimo</div>
          </div>

          <div className="m-home-figma-block">
            <h2 className="m-home-figma-block-title">Funcionamos nesses dias.</h2>
            <div className="m-home-figma-hours">
              {daysToRender.map((d) => (
                <div key={d.day} className="m-home-figma-hour-row">
                  <span>{DAY_LABEL[d.day] || d.day}</span>
                  <span>{d.closed ? "Fechado" : `${String(d.open || "16:00").slice(0, 5)} as ${String(d.close || "23:59").slice(0, 5)}`}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="m-home-figma-block">
            <h2 className="m-home-figma-block-title">Formas de pagamento</h2>
            <div className="m-home-figma-payments">
              {paymentMethods.map((method) => (
                <span key={method} className="m-home-figma-chip">
                  {PAYMENT_LABEL[method] || String(method).toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        </section>
        <div className="m-home-figma-footer">
          <button className="m-primary m-primary-block m-home-figma-cta" onClick={() => nav(`/t/${slug}/menu`)}>
            Ver cardapio
          </button>
        </div>
      </main>
    </div>
  );
}
