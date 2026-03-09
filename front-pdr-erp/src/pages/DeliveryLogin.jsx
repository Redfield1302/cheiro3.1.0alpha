import { useState } from "react";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Input } from "../components/ui/Input.jsx";
import { deliveryLogin } from "../lib/api";
import { setDeliverySession } from "../lib/deliverySession";

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
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <Card style={{ width: "min(420px, 100%)" }}>
        <h2 style={{ marginTop: 0 }}>Login Entregador</h2>
        <div className="muted">Acesso apenas ao modulo de entregas.</div>
        {error ? <div className="state error" style={{ marginTop: 12 }}>{error}</div> : null}
        <form className="grid" style={{ marginTop: 12 }} onSubmit={onSubmit}>
          <Input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="slug do tenant (ex: minhapizzaria)" />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" required />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha" required />
          <Button variant="primary" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
        </form>
      </Card>
    </div>
  );
}
