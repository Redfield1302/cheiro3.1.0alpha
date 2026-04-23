import { useEffect, useMemo, useRef, useState } from "react";
import { addItem, checkout, createCart, getCart, getPizzaConfig, getTenantMe, listCategories, listPdvProducts, removeItem } from "../lib/api";
import PageState from "../components/PageState.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import brandLogo from "../assets/logo.png";

const money = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyPlain = (n) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MODES = [
  { id: "RAPIDA", label: "Venda Rapida" },
  { id: "DELIVERY", label: "Venda Delivery" },
  { id: "BALCAO", label: "Venda Balcao" }
];

export default function Pdv() {
  const toast = useToast();
  const searchRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cartId, setCartId] = useState("");
  const [cart, setCart] = useState(null);
  const [pay, setPay] = useState("PIX");
  const [search, setSearch] = useState("");
  const [catId, setCatId] = useState("ALL");
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [comanda, setComanda] = useState("");
  const [deliveryPerson, setDeliveryPerson] = useState("Renato Almeida");
  const [history, setHistory] = useState([]);

  const [pizzaOpen, setPizzaOpen] = useState(false);
  const [pizzaLoading, setPizzaLoading] = useState(false);
  const [pizzaErr, setPizzaErr] = useState("");
  const [pizzaProduct, setPizzaProduct] = useState(null);
  const [pizzaSizes, setPizzaSizes] = useState([]);
  const [pizzaFlavors, setPizzaFlavors] = useState([]);
  const [pizzaSizeName, setPizzaSizeName] = useState("");
  const [pizzaSelected, setPizzaSelected] = useState([]);

  const [billingOpen, setBillingOpen] = useState(false);
  const [needChange, setNeedChange] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [billingSubmitting, setBillingSubmitting] = useState(false);
  const [tenantCheckout, setTenantCheckout] = useState({ pixKey: "", deliveryFee: 0, cardFeePercent: 0 });

  const subtotal = Number(cart?.subtotal || 0);
  const total = Number(cart?.total || 0);
  const deliveryFee = mode === "DELIVERY" ? Number(tenantCheckout.deliveryFee || 0) : 0;
  const cardFeeAmount =
    ["CREDIT", "DEBIT"].includes(pay) && Number(tenantCheckout.cardFeePercent || 0)
      ? ((subtotal + deliveryFee) * Number(tenantCheckout.cardFeePercent || 0)) / 100
      : 0;
  const totalWithFees = subtotal + deliveryFee + cardFeeAmount;
  const itemCount = useMemo(() => (cart?.items || []).reduce((acc, item) => acc + Number(item.quantity || 0), 0), [cart]);

  async function initCart(nextMode = mode) {
    setErr("");
    setLoading(true);
    try {
      const [ps, cs, c, tenantData] = await Promise.all([
        listPdvProducts(),
        listCategories({ active: "true" }).catch(() => []),
        createCart(),
        getTenantMe().catch(() => null)
      ]);
      setProducts(ps);
      setCategories(cs);
      setCartId(c.cartId);
      setCart(await getCart(c.cartId));
      if (tenantData?.checkoutSettings) {
        setTenantCheckout({
          pixKey: tenantData.checkoutSettings.pixKey || "",
          deliveryFee: Number(tenantData.checkoutSettings.deliveryFee || 0),
          cardFeePercent: Number(tenantData.checkoutSettings.cardFeePercent || 0)
        });
      }
      setSearch("");
      setCatId("ALL");
      setComanda(String(Math.floor(Math.random() * 900) + 100));
      setMode(nextMode);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (!cartId) return;
    setCart(await getCart(cartId));
  }

  useEffect(() => {
    setHistory(JSON.parse(localStorage.getItem("cg_pdv_history") || "[]"));
  }, []);

  useEffect(() => {
    if (productModalOpen && searchRef.current) searchRef.current.focus();
  }, [productModalOpen, mode]);

  const filtered = products.filter((p) => {
    const byCat = catId === "ALL" ? true : p.categoryId === catId;
    const bySearch = (p.name || "").toLowerCase().includes(search.toLowerCase());
    return byCat && bySearch;
  });

  async function decItem(it) {
    if (it.quantity <= 1) {
      await removeItem(cartId, it.id);
      return refresh();
    }
    await removeItem(cartId, it.id);
    await addItem(cartId, it.productId, it.quantity - 1);
    return refresh();
  }

  function saveHistory(entry) {
    const next = [entry, ...history].slice(0, 5);
    setHistory(next);
    localStorage.setItem("cg_pdv_history", JSON.stringify(next));
  }

  async function startFlow(nextMode) {
    await initCart(nextMode);
    setProductModalOpen(true);
  }

  async function onSelectProduct(product) {
    if (!product?.isPizza) {
      return addItem(cartId, product.id, 1).then(refresh).catch((e) => setErr(e.message));
    }

    setPizzaOpen(true);
    setPizzaLoading(true);
    setPizzaErr("");
    setPizzaProduct(product);
    setPizzaSelected([]);
    try {
      const cfg = await getPizzaConfig(product.id);
      const sizes = cfg.sizes || [];
      setPizzaSizes(sizes);
      setPizzaFlavors(cfg.flavors || []);
      setPizzaSizeName(sizes[0]?.name || "");
    } catch (e) {
      setPizzaErr(e.message);
    } finally {
      setPizzaLoading(false);
    }
  }

  const selectedSize = pizzaSizes.find((s) => String(s.name) === String(pizzaSizeName)) || null;
  const maxFlavors = Number(selectedSize?.maxFlavors || 1);

  const flavorOptions = pizzaFlavors.map((f) => ({
    name: f.name,
    description: f.description || "",
    price: Number((f.prices || {})[pizzaSizeName] || 0)
  }));

  const pizzaValue = (() => {
    if (!pizzaSelected.length) return 0;
    const values = flavorOptions.filter((f) => pizzaSelected.includes(f.name)).map((f) => Number(f.price || 0));
    return values.length ? Math.max(...values) : 0;
  })();

  function toggleFlavor(name) {
    setPizzaSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= maxFlavors) return prev;
      return [...prev, name];
    });
  }

  function buildFraction(count) {
    if (count <= 1) return "1/1";
    if (count === 2) return "1/2";
    if (count === 3) return "1/3";
    return "1/4";
  }

  async function confirmPizza() {
    if (!pizzaProduct) return;
    if (!pizzaSizeName) return setPizzaErr("Selecione o tamanho");
    if (!pizzaSelected.length) return setPizzaErr("Selecione ao menos 1 sabor");

    const fraction = buildFraction(pizzaSelected.length);
    const pizza = {
      sizeName: pizzaSizeName,
      parts: pizzaSelected.map((name) => ({ fraction, flavorName: name }))
    };

    try {
      await addItem(cartId, pizzaProduct.id, 1, pizza);
      await refresh();
      setPizzaOpen(false);
      setPizzaErr("");
      toast.success(`Pizza adicionada (${money(pizzaValue)})`);
    } catch (e) {
      setPizzaErr(e.message);
    }
  }

  function openBilling() {
    if (!cart?.items?.length) {
      toast.error("Adicione produtos antes de faturar");
      return;
    }
    setBillingOpen(true);
  }

  async function finalizeSale() {
    try {
      setBillingSubmitting(true);
      if (pay === "CASH" && needChange) {
        const received = Number(cashReceived || 0);
        const due = Number(totalWithFees || total || 0);
        if (!Number.isFinite(received) || received < due) {
          toast.error("Valor recebido deve ser maior ou igual ao total");
          setBillingSubmitting(false);
          return;
        }
      }

      const closed = await checkout(cartId, pay, {
        customerName,
        customerPhone,
        customerAddress,
        customerReference,
        customerNotes,
        comanda,
        mode,
        deliveryFee,
        cardFeeAmount
      });
      saveHistory({
        id: closed.id,
        total: closed.total,
        createdAt: new Date().toISOString(),
        mode,
        payment: pay
      });
      setBillingOpen(false);
      setProductModalOpen(false);
      setTimeout(() => window.print(), 120);
      setCart(null);
      setCartId("");
      setMode("");
    } catch (e) {
      setErr(e.message);
      toast.error(e.message);
    } finally {
      setBillingSubmitting(false);
    }
  }

  return (
    <div className="pdv-shell pdv-launcher-shell">
      <PageState loading={loading} error={err} />

      <section className="card pdv-launcher-card">
        <div className="pdv-launcher-hero">
          <div className="pdv-launcher-brand">
            <img className="pdv-launcher-logo" src={brandLogo} alt="Cheiro Gestor" />
            <div className="pdv-launcher-brand-copy">
              <div className="pdv-launcher-brand-title">Nova venda</div>
              <div className="muted">Escolha o fluxo ideal para iniciar o atendimento no PDV.</div>
            </div>
          </div>

          
        </div>

        <div className="pdv-launcher-actions">
          {MODES.map((m) => (
            <button key={m.id} className="pdv-launcher-btn" onClick={() => startFlow(m.id)}>
              <span className="pdv-launcher-btn-title">{m.label}</span>
              <span className="pdv-launcher-btn-subtitle">Abrir atendimento</span>
            </button>
          ))}
        </div>
      </section>

      <Modal open={productModalOpen} title={mode ? `PDV - ${MODES.find((m) => m.id === mode)?.label || mode}` : "PDV"} onClose={() => setProductModalOpen(false)}>
        <div className={`pdv-modal-shell ${mode === "DELIVERY" ? "is-delivery" : ""}`}>
          <section className="pdv-modal-form">
            <div className="pdv-panel-head">
              <div>
                <div className="section-title">Dados do cliente</div>
                <div className="muted">Preencha os dados essenciais antes de faturar.</div>
              </div>
              <div className="pdv-mode-badge">{MODES.find((m) => m.id === mode)?.label || mode}</div>
            </div>

            <label className="pdv-field">
              <span>Nome do cliente</span>
              <input className="input" placeholder="Nome do cliente" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </label>

            <label className="pdv-field">
              <span>Telefone</span>
              <input className="input" placeholder="(00) 00000-0000" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </label>

            <label className="pdv-field">
              <span>Endereco</span>
              <input className="input" placeholder="Rua, numero e bairro" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </label>

            <label className="pdv-field">
              <span>Referencia</span>
              <input className="input" placeholder="Ponto de referencia" value={customerReference} onChange={(e) => setCustomerReference(e.target.value)} />
            </label>

            <label className="pdv-field">
              <span>Observacoes</span>
              <textarea className="input" rows={3} placeholder="Observacoes do pedido" value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
            </label>

            <div className="pdv-inline-fields">
              <label className="pdv-field">
                <span>Comanda</span>
                <input className="input" placeholder="Comanda" value={comanda} onChange={(e) => setComanda(e.target.value)} />
              </label>

              <label className="pdv-field">
                <span>Entregador</span>
                <select className="select" value={deliveryPerson} onChange={(e) => setDeliveryPerson(e.target.value)}>
                  <option value="Renato Almeida">Renato Almeida</option>
                  <option value="Carlos">Carlos</option>
                  <option value="Equipe">Equipe</option>
                </select>
              </label>
            </div>
          </section>

          <section className="pdv-modal-catalog">
            <div className="pdv-panel-head">
              <div>
                <div className="section-title">Catalogo</div>
                <div className="muted">Busque produtos e toque para adicionar.</div>
              </div>
              <div className="pdv-count-badge">{filtered.length} itens</div>
            </div>

            <div className="pdv-modal-search">
              <input
                ref={searchRef}
                className="input"
                placeholder="Pesquisar produto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="pdv-categories">
              <button className={`pdv-cat-chip ${catId === "ALL" ? "active" : ""}`} onClick={() => setCatId("ALL")}>todas</button>
              {categories.map((c) => (
                <button key={c.id} className={`pdv-cat-chip ${catId === c.id ? "active" : ""}`} onClick={() => setCatId(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>

            <div className="pdv-modal-products">
              {filtered.map((p) => (
                <button key={p.id} className="pdv-modal-product-card" onClick={() => onSelectProduct(p)}>
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="pdv-modal-product-image" /> : <div className="pdv-modal-product-image pdv-modal-product-image-placeholder" />}
                  <div className="pdv-modal-product-name">{p.name}</div>
                  <div className="pdv-modal-product-price">{money(p.price)}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="pdv-modal-summary">
            <div className="pdv-panel-head">
              <div>
                <div className="section-title">Resumo da comanda</div>
                <div className="muted">Confira itens, totais e avance para o faturamento.</div>
              </div>
              <div className="pdv-count-badge">{itemCount} itens</div>
            </div>

            <div className="print-ticket pdv-inline-ticket">
              <div className="print-ticket-title">SIMPLES CONFERENCIA DA CONTA</div>
              <div className="print-center">{new Date().toLocaleString()}</div>
              <hr />
              <div>{customerName || "Nao informado"}</div>
              <div>{customerPhone || "-"}</div>
              <div>{customerAddress || "-"}</div>
              <div>{customerReference || "-"}</div>
              <div>Comanda: {comanda || "-"}</div>
              <div>Entregador: {deliveryPerson || "-"}</div>
              <hr />
              {(cart?.items || []).map((it) => (
                <div key={it.id}>
                  <div className="print-line-3">
                    <div>{it.quantity} {it.name}</div>
                    <div>{moneyPlain(it.unitPrice)}</div>
                    <div>{moneyPlain(it.totalPrice)}</div>
                  </div>
                  {(it.modifiers || []).map((m) => (
                    <div key={`${it.id}-${m.id || `${m.groupName}-${m.name}`}`} className="print-modifier-line">
                      + {m.name}
                    </div>
                  ))}
                </div>
              ))}
              <hr />
              <div className="print-line"><span>Subtotal</span><b>{moneyPlain(subtotal || 0)}</b></div>
              <div className="print-line"><span>Entrega</span><b>{moneyPlain(deliveryFee || 0)}</b></div>
              <div className="print-line"><span>Taxa cartao</span><b>{moneyPlain(cardFeeAmount || 0)}</b></div>
              <div className="print-line"><b>TOTAL:</b><b>{moneyPlain(totalWithFees || total || 0)}</b></div>
            </div>

            <div className="pdv-modal-summary-actions">
              <button className="btn" onClick={() => window.print()} disabled={!cart?.items?.length}>Imprimir</button>
              <button className="btn" onClick={() => toast.success("Comanda enviada para cozinha")} disabled={!cart?.items?.length}>enviar cozinha</button>
              <button className="btn btn-primary" onClick={openBilling} disabled={!cart?.items?.length}>Faturar</button>
            </div>
          </section>
        </div>
      </Modal>

      <section className="print-ticket print-only">
        <div className="print-ticket-title">SIMPLES CONFERENCIA DA CONTA</div>
        <div className="print-center">{new Date().toLocaleString()}</div>
        <div className="print-center">*** NAO E DOCUMENTO FISCAL ***</div>
        <hr />
        <div>{customerName || "Nao informado"}</div>
        <div>{customerPhone || "-"}</div>
        <div>{customerAddress || "-"}</div>
        <div>{customerReference || "-"}</div>
        <div>{customerNotes || "-"}</div>
        <div>Comanda: {comanda || "-"}</div>
        <div>Entregador: {deliveryPerson || "-"}</div>
        <div className="print-center">(Pedido N.: {cartId ? cartId.slice(0, 8) : "--"})</div>
        <hr />
        <div className="print-head">
          <div>ITEM</div>
          <div>V.Unit</div>
          <div>Total</div>
        </div>
        {(cart?.items || []).map((it) => (
          <div key={it.id}>
            <div className="print-line-3">
              <div>{it.quantity} {it.name}</div>
              <div>{moneyPlain(it.unitPrice)}</div>
              <div>{moneyPlain(it.totalPrice)}</div>
            </div>
            {(it.modifiers || []).map((m) => (
              <div key={`${it.id}-${m.id || `${m.groupName}-${m.name}`}`} className="print-modifier-line">
                + {m.name}
              </div>
            ))}
            {it.notes && !(it.modifiers?.length && String(it.notes).toLowerCase().startsWith("pizza "))
              ? <div className="print-notes-line">obs: {it.notes}</div>
              : null}
          </div>
        ))}
        <hr />
        <div className="print-line"><b>TOTAL:</b><b>{moneyPlain(subtotal || 0)}</b></div>
        <div className="print-line"><b>+ ENTREGA:</b><b>{moneyPlain(deliveryFee || 0)}</b></div>
        <div className="print-line"><b>+ TAXA CARTAO:</b><b>{moneyPlain(cardFeeAmount || 0)}</b></div>
        <div className="print-line"><b>= TOTAL A PAGAR:</b><b>{moneyPlain(totalWithFees || total || 0)}</b></div>
        <div className="print-line"><b>PAGAMENTO:</b><b>{pay}</b></div>
        {pay === "PIX" && tenantCheckout.pixKey ? <div className="print-line"><b>CHAVE PIX:</b><b>{tenantCheckout.pixKey}</b></div> : null}
        <hr />
        <div>Usuario: {customerName || "operador"}</div>
      </section>

      <Modal open={pizzaOpen} title={`Montar pizza - ${pizzaProduct?.name || ""}`} onClose={() => setPizzaOpen(false)}>
        <div className="grid">
          {pizzaLoading ? <div className="state">Carregando configuracao...</div> : null}
          {pizzaErr ? <div className="state error">{pizzaErr}</div> : null}

          {!pizzaLoading ? (
            <>
              <div className="inline">
                <div style={{ minWidth: 120 }}>Tamanho</div>
                <select className="select" value={pizzaSizeName} onChange={(e) => { setPizzaSizeName(e.target.value); setPizzaSelected([]); }}>
                  {pizzaSizes.map((s) => (
                    <option key={s.id || s.name} value={s.name}>{s.name} (ate {s.maxFlavors} sabores)</option>
                  ))}
                </select>
              </div>

              <div className="state">
                Tamanho: <b>{pizzaSizeName || "-"}</b> | Max sabores: <b>{maxFlavors}</b> | Selecionados: <b>{pizzaSelected.length}</b>
              </div>

              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 8 }}>
                {flavorOptions.map((f) => {
                  const checked = pizzaSelected.includes(f.name);
                  const blocked = !checked && pizzaSelected.length >= maxFlavors;
                  return (
                    <label
                      key={f.name}
                      className="state"
                      style={{ opacity: blocked ? 0.6 : 1, cursor: blocked ? "not-allowed" : "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={blocked}
                        onChange={() => toggleFlavor(f.name)}
                        style={{ marginRight: 8 }}
                      />
                      <span>
                        {f.name} - {money(f.price)}
                        {f.description ? <span className="muted" style={{ display: "block", marginLeft: 22 }}>{f.description}</span> : null}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="state">
                Valor da pizza (maior sabor): <b>{money(pizzaValue)}</b>
              </div>

              <div className="inline">
                <button className="btn btn-primary" onClick={confirmPizza}>Confirmar item</button>
                <button className="btn" onClick={() => setPizzaOpen(false)}>Cancelar</button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal open={billingOpen} title="Pagamento" onClose={() => setBillingOpen(false)}>
        <div className="pdv-checkout-modal">
          <div className="pdv-panel-head">
            <div>
              <div className="section-title">Pagamento</div>
              <div className="muted">Defina a forma de pagamento e finalize o pedido.</div>
            </div>
            <div className="pdv-count-badge">{money(totalWithFees || total || 0)}</div>
          </div>

          <div className="field-help">
            <div className="section-title">Forma de pagamento</div>
            <select className="select" value={pay} onChange={(e) => setPay(e.target.value)}>
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="CREDIT">Credito</option>
              <option value="DEBIT">Debito</option>
              <option value="MEAL_VOUCHER">Vale</option>
            </select>
          </div>

          {pay === "PIX" && tenantCheckout.pixKey ? (
            <div className="state">
              Chave PIX: <b>{tenantCheckout.pixKey}</b>
            </div>
          ) : null}

          {pay === "CASH" ? (
            <>
              <label className="inline">
                <input type="checkbox" checked={needChange} onChange={(e) => setNeedChange(e.target.checked)} />
                Tem troco?
              </label>
              {needChange ? (
                <div className="field-help">
                  <div className="section-title">Valor recebido</div>
                  <input className="input" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="Ex.: 100,00" />
                  <div className="muted">
                    Troco: {money(Math.max(0, Number(cashReceived || 0) - Number(totalWithFees || total || 0)))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="state">
            Total a faturar: <b>{money(totalWithFees || total || 0)}</b>
          </div>

          <div className="pdv-checkout-actions">
            <button className="btn btn-primary" onClick={finalizeSale} disabled={billingSubmitting}>
              {billingSubmitting ? "Finalizando..." : "Finalizar"}
            </button>
            <button className="btn" onClick={() => setBillingOpen(false)}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
