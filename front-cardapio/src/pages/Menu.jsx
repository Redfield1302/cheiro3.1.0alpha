import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCategories, getProducts, getTenant } from "../lib/api";

const money = (n) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export default function Menu() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [cats, setCats] = useState([]);
  const [catId, setCatId] = useState("__all__");
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);

  function updateCartSummary() {
    const cart = JSON.parse(localStorage.getItem("cg_cart") || "[]");
    setCartCount(cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
    setCartTotal(cart.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0));
  }

  async function load() {
    setErr("");
    const tenantRes = await getTenant(slug);
    setTenant(tenantRes.tenant);

    const categoriesRes = await getCategories(slug);
    const nextCats = categoriesRes.categories || [];
    setCats(nextCats);

    setCatId("__all__");
    const productsRes = await getProducts(slug, "");
    setProducts(productsRes.products || []);
    updateCartSummary();
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [slug]);

  useEffect(() => {
    updateCartSummary();
    const onFocus = () => updateCartSummary();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function changeCategory(id) {
    setCatId(id);
    const selectedCategory = id === "__all__" ? "" : id;
    const res = await getProducts(slug, selectedCategory);
    setProducts(res.products || []);
  }

  function quickAdd(product) {
    if (product.isPizza) {
      nav(`/t/${slug}/p/${product.id}`);
      return;
    }
    const cart = JSON.parse(localStorage.getItem("cg_cart") || "[]");
    const idx = cart.findIndex((line) => line.productId === product.id && !line.modifiers?.length && !line.notes);

    if (idx >= 0) {
      cart[idx].quantity += 1;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: Number(product.price || 0),
        quantity: 1,
        modifiers: []
      });
    }

    localStorage.setItem("cg_cart", JSON.stringify(cart));
    updateCartSummary();
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => `${p.name || ""} ${p.description || ""}`.toLowerCase().includes(term));
  }, [products, search]);

  return (
    <div className="m-app">
      <header className="m-header">
        <div className="m-header-row">
          <button className="m-icon-btn" onClick={() => nav(-1)} aria-label="Voltar">
            &#8249;
          </button>
          <div className="m-title-wrap">
            {tenant?.branding?.restaurantIconUrl || tenant?.logoUrl ? (
              <img className="m-tenant-logo" src={tenant?.branding?.restaurantIconUrl || tenant?.logoUrl} alt={`Logo ${tenant?.name || ""}`} />
            ) : null}
            <div className="m-title">{tenant?.name || slug}</div>
          </div>
          <button className="m-icon-btn" onClick={() => nav(`/t/${slug}/cart`)} aria-label="Carrinho">
            🛒
          </button>
        </div>
        <input
          className="m-search"
          placeholder="Buscar no cardapio"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>

      <main className="m-body">
        {err ? <div className="m-surface">{err}</div> : null}

        <div className="m-cats">
          <button
            className={`m-chip ${catId === "__all__" ? "active" : ""}`}
            onClick={() => changeCategory("__all__")}
          >
            Todas
          </button>
          {cats.map((cat) => (
            <button
              key={cat.id}
              className={`m-chip ${cat.id === catId ? "active" : ""}`}
              onClick={() => changeCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="m-section-title">Produtos</div>
        <div className="m-grid">
          {filtered.map((product) => (
            <article key={product.id} className="m-card">
              <Link
                to={`/t/${slug}/p/${product.id}`}
                style={{ textDecoration: "none", color: "inherit", display: "grid", gap: 8 }}
              >
                {product.imageUrl ? (
                  <img className="m-thumb-img" src={product.imageUrl} alt={product.name} loading="lazy" />
                ) : (
                  <div className="m-thumb" />
                )}
                <div className="m-card-name">{product.name}</div>
                <div className="m-card-desc">{product.description || "Produto da loja"}</div>
              </Link>
              <div className="m-price-row">
                <div className="m-price">{money(product.price)}</div>
                <button className="m-add" onClick={() => quickAdd(product)} aria-label="Adicionar rapido">
                  +
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>

      <footer className="m-bottom-nav">
        <div className="m-bottom-row">
          <div className="m-cart-pill">
            {cartCount} item(ns) • {money(cartTotal)}
          </div>
          <button className="m-primary" onClick={() => nav(`/t/${slug}/cart`)}>
            Ver carrinho
          </button>
        </div>
      </footer>
    </div>
  );
}
