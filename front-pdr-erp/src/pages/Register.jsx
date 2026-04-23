import { useState } from "react";
import { Button } from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Input.jsx";
import { register } from "../lib/api";
import { setSession } from "../lib/session";
import brandLogo from "../assets/logo.png";

export default function Register() {
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const session = await register({
        tenantName,
        tenantSlug,
        name,
        email,
        password
      });
      setSession(session);
      window.location.href = "/dashboard";
    } catch (e2) {
      setErr(e2.message || "Erro ao criar conta");
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
            className="auth-mini-link"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className="auth-mini-link active"
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
                <h1>Criar estabelecimento</h1>
                <p>Cadastre o tenant e o usuario administrador para iniciar a operacao no ERP.</p>
              </div>

              {err ? <div className="state error">{err}</div> : null}

              <form onSubmit={onSubmit} className="auth-form-fields">
                <label className="auth-field">
                  <span>Nome do estabelecimento</span>
                  <Input
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Ex.: Planeta Pizza"
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>Slug do tenant</span>
                  <Input
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="Ex.: planeta-pizza"
                  />
                </label>

                <label className="auth-field">
                  <span>Nome do administrador</span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>Email de acesso</span>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@empresa.com"
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>Senha</span>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo de 6 caracteres"
                    minLength={6}
                    required
                  />
                </label>

                <Button variant="primary" className="auth-submit" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar conta"}
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
                  Voltar para login
                </Button>
                <div className="muted auth-footnote">Ao concluir, voce entra direto no ambiente do seu estabelecimento.</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
