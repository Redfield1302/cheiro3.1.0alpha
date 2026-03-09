import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { claimDeliveryOrder, listDeliveryOrders, updateDeliveryOrderStatus } from "../lib/api";
import { clearDeliverySession, getDeliverySession } from "../lib/deliverySession";
import { buildGoogleMapsSearchLink, buildWhatsAppLink, montarEnderecoParaMapa } from "../lib/contact.js";

const money = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DeliveryBoard() {
  const toast = useToast();
  const session = getDeliverySession();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const token = session?.token || "";

  async function refresh(background = false) {
    if (!background) setLoading(true);
    setError("");
    try {
      const data = await listDeliveryOrders(token);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Falha ao carregar entregas");
    } finally {
      if (!background) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const t = setInterval(() => refresh(true), 6000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    const ready = [];
    const dispatched = [];
    for (const order of orders) {
      if (order.status === "READY") ready.push(order);
      if (order.status === "DISPATCHED") dispatched.push(order);
    }
    return { ready, dispatched };
  }, [orders]);

  async function claim(orderId) {
    try {
      await claimDeliveryOrder(token, orderId);
      toast.success("Pedido assumido");
      refresh(true);
    } catch (err) {
      toast.error(err.message || "Falha ao assumir pedido");
    }
  }

  async function finish(orderId) {
    try {
      await updateDeliveryOrderStatus(token, orderId, "DELIVERED");
      toast.success("Pedido entregue");
      refresh(true);
    } catch (err) {
      toast.error(err.message || "Falha ao finalizar entrega");
    }
  }

  if (!session?.token) return <Navigate to="/delivery/login" replace />;

  return (
    <div className="content delivery-shell">
      <div className="grid">
        <Card>
          <div className="inline delivery-header">
            <div>
              <div className="section-title">Modulo Entregas</div>
              <div><b>{session.deliveryPerson?.name}</b> - {session.tenant?.name}</div>
              <div className="muted">tenant: {session.tenant?.slug || "-"}</div>
            </div>
            <div className="inline">
              <Button onClick={() => refresh()}>Atualizar</Button>
              <Button
                onClick={() => {
                  clearDeliverySession();
                  window.location.href = "/delivery/login";
                }}
              >
                Sair
              </Button>
            </div>
          </div>
          {loading ? <div className="muted" style={{ marginTop: 8 }}>Carregando...</div> : null}
          {error ? <div className="state error" style={{ marginTop: 8 }}>{error}</div> : null}
        </Card>

        <div className="kitchen-board delivery-board-grid">
          <Card>
            <div className="section-title">Disponiveis (READY)</div>
            <div className="kitchen-column">
              {grouped.ready.map((order) => (
                <Card key={order.id} className="kitchen-card delivery-card">
                  {(() => {
                    const whatsappLink = buildWhatsAppLink(order.customer?.phone);
                    const mapsLink = buildGoogleMapsSearchLink(montarEnderecoParaMapa(order));
                    return (
                      <>
                  <div><b>Pedido:</b> {order.displayId || order.id.slice(0, 6)}</div>
                  <div><b>Cliente:</b> {order.customer?.name || "Nao informado"}</div>
                  <div className="kitchen-meta-line">
                    <b>Telefone:</b> {order.customer?.phone || "-"}
                    {whatsappLink ? (
                      <a className="kitchen-link-btn" href={whatsappLink} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                  <div className="kitchen-meta-line">
                    <b>Endereco:</b> {order.address?.street || "Sem endereco"}
                    {mapsLink ? (
                      <a className="kitchen-link-btn" href={mapsLink} target="_blank" rel="noreferrer">
                        Maps
                      </a>
                    ) : null}
                  </div>
                  <div><b>Total:</b> {money(order.total)}</div>
                  <div style={{ marginTop: 10 }}>
                    <Button variant="primary" onClick={() => claim(order.id)}>Assumir entrega</Button>
                  </div>
                      </>
                    );
                  })()}
                </Card>
              ))}
              {grouped.ready.length === 0 ? <EmptyState title="Sem pedidos prontos" description="Aguardando pedidos READY." /> : null}
            </div>
          </Card>

          <Card>
            <div className="section-title">Em rota (DISPATCHED)</div>
            <div className="kitchen-column">
              {grouped.dispatched.map((order) => (
                <Card key={order.id} className="kitchen-card delivery-card">
                  {(() => {
                    const whatsappLink = buildWhatsAppLink(order.customer?.phone);
                    const mapsLink = buildGoogleMapsSearchLink(montarEnderecoParaMapa(order));
                    return (
                      <>
                  <div><b>Pedido:</b> {order.displayId || order.id.slice(0, 6)}</div>
                  <div><b>Cliente:</b> {order.customer?.name || "Nao informado"}</div>
                  <div className="kitchen-meta-line">
                    <b>Telefone:</b> {order.customer?.phone || "-"}
                    {whatsappLink ? (
                      <a className="kitchen-link-btn" href={whatsappLink} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                  <div className="kitchen-meta-line">
                    <b>Endereco:</b> {order.address?.street || "Sem endereco"}
                    {mapsLink ? (
                      <a className="kitchen-link-btn" href={mapsLink} target="_blank" rel="noreferrer">
                        Maps
                      </a>
                    ) : null}
                  </div>
                  <div><b>Total:</b> {money(order.total)}</div>
                  <div style={{ marginTop: 10 }}>
                    <Button variant="primary" onClick={() => finish(order.id)}>Marcar entregue</Button>
                  </div>
                      </>
                    );
                  })()}
                </Card>
              ))}
              {grouped.dispatched.length === 0 ? <EmptyState title="Sem entregas em rota" description="Nenhum pedido assumido." /> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
