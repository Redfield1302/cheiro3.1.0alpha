import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createOrder, getTenant } from "../lib/api";
import { normalizeAddressForPayload, normalizePhoneForPayload } from "../lib/contact";
import { CopyText } from "../components/CopyText";

const money = (n) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const paymentOptions = [
  { value: "PIX", label: "Pix" },
  { value: "CASH", label: "Dinheiro" },
  { value: "CREDIT", label: "Cartao de credito" },
  { value: "DEBIT", label: "Cartao de debito" }
];

export default function Cart() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem("cg_cart") || "[]"));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [tenantCheckout, setTenantCheckout] = useState({ pixKey: "", deliveryFee: 0, cardFeePercent: 0 });

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0), [cart]);
  const deliveryFee = useMemo(() => Number(tenantCheckout.deliveryFee || 0), [tenantCheckout.deliveryFee]);
  const cardFeeAmount = useMemo(() => {
    if (!["CREDIT", "DEBIT"].includes(paymentMethod)) return 0;
    const percent = Number(tenantCheckout.cardFeePercent || 0);
    if (!percent) return 0;
    return ((subtotal + deliveryFee) * percent) / 100;
  }, [paymentMethod, subtotal, deliveryFee, tenantCheckout.cardFeePercent]);
  const total = useMemo(() => subtotal + deliveryFee + cardFeeAmount, [subtotal, deliveryFee, cardFeeAmount]);

  useEffect(() => {
    getTenant(slug)
      .then((res) => {
        const s = res?.tenant?.checkoutSettings || {};
        setTenantCheckout({
          pixKey: s.pixKey || "",
          deliveryFee: Number(s.deliveryFee || 0),
          cardFeePercent: Number(s.cardFeePercent || 0)
        });
      })
      .catch(() => {});
  }, [slug]);

  function persistCart(nextCart) {
    setCart(nextCart);
    localStorage.setItem("cg_cart", JSON.stringify(nextCart));
  }

  function updateLineQuantity(index, delta) {
    const next = [...cart];
    const line = next[index];
    if (!line) return;
    const qty = Number(line.quantity || 1) + delta;
    if (qty <= 0) {
      next.splice(index, 1);
    } else {
      line.quantity = qty;
      next[index] = line;
    }
    persistCart(next);
  }

  function removeLine(index) {
    const next = cart.filter((_, i) => i !== index);
    persistCart(next);
  }

  function clearCart() {
    persistCart([]);
  }

  async function checkout() {
    if (!cart.length) return;
    if (!String(customerName || "").trim()) {
      setErr("Informe o nome do cliente.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const payload = {
        paymentMethod,
        customerName: customerName.trim(),
        customerPhone: normalizePhoneForPayload(customerPhone) || undefined,
        customerAddress: normalizeAddressForPayload(customerAddress) || undefined,
        customerReference: normalizeAddressForPayload(customerReference) || undefined,
        notes: customerNotes.trim() || undefined,
        mode: "MENU",
        deliveryFee,
        cardFeeAmount,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity || 1),
          notes: line.notes || undefined,
          pizza: line.pizza || undefined,
          modifiers: Array.isArray(line.modifiers) ? line.modifiers : undefined
        }))
      };
      const res = await createOrder(slug, payload);
      localStorage.removeItem("cg_cart");
      setCart([]);
      nav(`/t/${slug}/order/${res.order.id}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="m-app">
      <header className="m-header m-header-minimal">
        <div className="m-header-row">
          <button className="m-icon-btn" onClick={() => nav(-1)} aria-label="Voltar">
            &#8249;
          </button>
          <div className="m-title">Finalizar compra</div>
          <div className="m-icon-btn m-icon-placeholder" />
        </div>
      </header>

      <main className="m-body m-cart-body">
        {err ? <div className="m-surface">{err}</div> : null}

        <section className="m-surface">
          <div className="m-row">
            <strong>Pagamento</strong>
          </div>
          <div className="m-payment-options">
            {paymentOptions.map((option) => (
              <button
                key={option.value}
                className={`m-chip ${paymentMethod === option.value ? "active" : ""}`}
                onClick={() => setPaymentMethod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {paymentMethod === "PIX" && tenantCheckout.pixKey ? (
            <div className="m-field-help">Chave PIX: <CopyText text={tenantCheckout.pixKey} /></div>
          ) : null}
          <div className="m-field-help green">Após copiar a chave pix, enviar comprovante para confirmação do pagamento, para o whatsapp da empresa</div>
        </section>

        <section className="m-surface">
          <div className="m-row">
            <strong>Dados do cliente</strong>
          </div>
          <div className="m-form-grid">
            <div className="m-field-group">
              <label className="m-label">Nome</label>
              <input
                className="m-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="m-field-group">
              <label className="m-label">Telefone</label>
              <input
                className="m-input"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="m-field-group">
              <label className="m-label">Endereco</label>
              <input
                className="m-input"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Rua, numero e bairro"
              />
            </div>
            <div className="m-field-group">
              <label className="m-label">Referencia</label>
              <input
                className="m-input"
                value={customerReference}
                onChange={(e) => setCustomerReference(e.target.value)}
                placeholder="Ponto de referencia"
              />
            </div>
            <div className="m-field-group">
              <label className="m-label">Observacoes</label>
              <textarea
                className="m-textarea"
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Observacoes para o pedido"
              />
            </div>
          </div>
        </section>

        <section className="m-surface">
          <div className="m-row">
            <strong>Resumo do pedido</strong>
            <div className="m-row" style={{ gap: 6 }}>
              <span className="m-muted">{cart.length} item(ns)</span>
              <button className="m-mini-btn" onClick={clearCart} disabled={!cart.length}>
                Limpar
              </button>
            </div>
          </div>
          <div className="m-cart-lines">
            {cart.map((line, idx) => (
              <article key={idx} className="m-cart-line">
                <div className="m-row">
                  <strong>
                    {line.quantity}x {line.name}
                  </strong>
                  <strong>{money(Number(line.price || 0) * Number(line.quantity || 0))}</strong>
                </div>
                {Array.isArray(line.modifiers) && line.modifiers.length ? (
                  <div className="m-cart-mods">{line.modifiers.map((mod) => mod.name).join(", ")}</div>
                ) : null}
                {line.pizza?.sizeName ? (
                  <div className="m-cart-mods">
                    Pizza {line.pizza.sizeName}: {(line.pizza.parts || []).map((p) => p.flavorName).join(" / ")}
                  </div>
                ) : null}
                {line.notes ? <div className="m-cart-notes">Obs: {line.notes}</div> : null}
                <div className="m-line-actions">
                  <div className="m-qty">
                    <button className="m-qty-btn" onClick={() => updateLineQuantity(idx, -1)}>
                      -
                    </button>
                    <strong>{line.quantity}</strong>
                    <button className="m-qty-btn" onClick={() => updateLineQuantity(idx, 1)}>
                      +
                    </button>
                  </div>
                  <button className="m-mini-btn danger" onClick={() => removeLine(idx)}>
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="m-surface">
          <div className="m-row">
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div className="m-row">
            <span>Taxa de entrega</span>
            <strong>{money(deliveryFee)}</strong>
          </div>
          <div className="m-row">
            <span>Taxa de cartao</span>
            <strong>{money(cardFeeAmount)}</strong>
          </div>
          <div className="m-row">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
        </section>
      </main>

      <footer className="m-bottom-nav">
        <div className="m-bottom-row">
          <div className="m-total-block">
            <div className="m-muted">Total</div>
            <strong>{money(total)}</strong>
          </div>
          <button className="m-primary" onClick={checkout} disabled={!cart.length || busy}>
            {busy ? "Enviando..." : "Pagar"}
          </button>
        </div>
      </footer>
    </div>
  );
}
