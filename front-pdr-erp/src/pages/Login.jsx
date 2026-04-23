import { useState } from "react";
import { login } from "../lib/api";
import { setSession } from "../lib/session";
import { Button } from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Input.jsx";
import brandLogo from "../assets/logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await login(email, password);
      setSession(res);
      window.location.href = "/pdv";
    } catch (e2) {
      setErr(e2.message);
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
              window.location.href = "/login";
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className="auth-mini-link"
            onClick={() => {
              window.location.href = "/register";
            }}
          >
            Register
          </button>
        </div>

        <section className="auth-screen-grid">
          <div className="auth-brand-panel">
            <img className="auth-brand-logo" src={brandLogo} alt="Cheiro Gestor" />
          </div>

          <div className="auth-form-panel">
            <div className="auth-form-card">
              <div className="auth-form-intro">
                <h1>Acesso ao ERP</h1>
                <p>Entre com seu email e senha para acessar o PDV, cozinha, pedidos e configuracoes.</p>
              </div>

              {err ? <div className="state error">{err}</div> : null}

              <form onSubmit={onSubmit} className="auth-form-fields">
                <label className="auth-field">
                  <span>Email</span>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@empresa.com"
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>Sua senha</span>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
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
                    window.location.href = "/delivery/login";
                  }}
                >
                  Login entregador
                </Button>
                <div className="muted auth-footnote">Sessao persistente e tenant automatico apos o login.</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
