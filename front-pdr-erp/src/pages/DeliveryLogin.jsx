import { useState } from "react";
import { Button } from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Input.jsx";
import { deliveryLogin } from "../lib/api";
import { setDeliverySession } from "../lib/deliverySession";
import brandLogo from "../assets/logo.png";

export default function DeliveryLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await deliveryLogin(email, password, tenantSlug);
      setDeliverySession(session);
      window.location.href = "/delivery/board";
    } catch (err) {
      setError(err.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen-shell">
        <div className="auth-screen-actions">
          <button
            type="button"
            className="auth-mini-link active"
            onClick={() => {
              window.location.href = "/delivery/login";
            }}
          >
            Delivery
          </button>
          <button
            type="button"
            className="auth-mini-link"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            ERP
          </button>
        </div>

        <section className="auth-screen-grid">
          <div className="auth-brand-panel">
            <img className="auth-brand-logo" src={brandLogo} alt="Cheiro Gestor" />
          </div>

          <div className="auth-form-panel">
            <div className="auth-form-card">
              <div className="auth-form-intro">
                <h1>Acesso do entregador</h1>
                <p>Entrada exclusiva para entregas. Aqui o motoboy acompanha apenas os pedidos do seu tenant.</p>
              </div>

              {error ? <div className="state error">{error}</div> : null}

              <form className="auth-form-fields" onSubmit={onSubmit}>
                <label className="auth-field">
                  <span>Tenant / estabelecimento</span>
                  <Input
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="slug do tenant (ex.: planeta-pizza)"
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>Email</span>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="entregador@empresa.com"
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>Senha</span>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    required
                  />
                </label>

                <Button variant="primary" className="auth-submit" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>

              <div className="auth-form-footer">
                <Button
                  type="button"
                  variant="ghost"
                  className="auth-delivery-link"
                  onClick={() => {
                    window.location.href = "/login";
                  }}
                >
                  Voltar para ERP
                </Button>
                <div className="muted auth-footnote">Sem acesso ao PDV: somente entregas e atualizacao de status.</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
