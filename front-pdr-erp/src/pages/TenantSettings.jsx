import { useEffect, useMemo, useRef, useState } from "react";
import PageState from "../components/PageState.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Input } from "../components/ui/Input.jsx";
import { Button } from "../components/ui/Button.jsx";
import { createDeliveryAgent, getTenantMe, listDeliveryAgents, updateDeliveryAgent, updateTenantMe } from "../lib/api";
import { useToast } from "../components/ui/Toast.jsx";

const DAYS = [
  { key: "mon", label: "Segunda" },
  { key: "tue", label: "Terca" },
  { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" },
  { key: "fri", label: "Sexta" },
  { key: "sat", label: "Sabado" },
  { key: "sun", label: "Domingo" }
];

function defaultHours() {
  return DAYS.map((d) => ({ day: d.key, open: "18:00", close: "23:00", closed: d.key === "sun" }));
}

function readFileAsDataUrl(file, onDone) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result || ""));
  reader.readAsDataURL(file);
}

export default function TenantSettings() {
  const toast = useToast();
  const logoFileRef = useRef(null);

  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("dados");
  const [logoUrl, setLogoUrl] = useState("");
  const [hours, setHours] = useState(defaultHours());
  const [pixKey, setPixKey] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [cardFeePercent, setCardFeePercent] = useState("0");
  const [deliveryAgents, setDeliveryAgents] = useState([]);
  const [deliveryAgentId, setDeliveryAgentId] = useState("");
  const [deliveryAgentName, setDeliveryAgentName] = useState("");
  const [deliveryAgentEmail, setDeliveryAgentEmail] = useState("");
  const [deliveryAgentPhone, setDeliveryAgentPhone] = useState("");
  const [deliveryAgentPassword, setDeliveryAgentPassword] = useState("");

  async function refresh() {
    setErr("");
    setLoading(true);
    try {
      const [data, agents] = await Promise.all([
        getTenantMe(),
        listDeliveryAgents().catch(() => [])
      ]);
      setTenant(data);
      setDeliveryAgents(Array.isArray(agents) ? agents : []);
      setLogoUrl(data.logoUrl || "");
      setPixKey(data?.checkoutSettings?.pixKey || "");
      setDeliveryFee(String(data?.checkoutSettings?.deliveryFee ?? 0));
      setCardFeePercent(String(data?.checkoutSettings?.cardFeePercent ?? 0));
      const existing = data?.rulesJson?.openingHours;
      if (Array.isArray(existing) && existing.length > 0) {
        setHours(
          DAYS.map((d) => {
            const row = existing.find((x) => x.day === d.key) || {};
            return {
              day: d.key,
              open: row.open || "18:00",
              close: row.close || "23:00",
              closed: Boolean(row.closed)
            };
          })
        );
      } else {
        setHours(defaultHours());
      }
      const firstAgent = (Array.isArray(agents) ? agents : [])[0] || null;
      setDeliveryAgentId(firstAgent?.id || "");
      setDeliveryAgentName(firstAgent?.name || "");
      setDeliveryAgentEmail(firstAgent?.email || "");
      setDeliveryAgentPhone(firstAgent?.phone || "");
      setDeliveryAgentPassword("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const hoursMap = useMemo(() => Object.fromEntries(hours.map((h) => [h.day, h])), [hours]);

  useEffect(() => {
    const selected = deliveryAgents.find((a) => a.id === deliveryAgentId);
    if (!selected) return;
    setDeliveryAgentName(selected.name || "");
    setDeliveryAgentEmail(selected.email || "");
    setDeliveryAgentPhone(selected.phone || "");
    setDeliveryAgentPassword("");
  }, [deliveryAgentId, deliveryAgents]);

  async function saveHours() {
    try {
      setSaving(true);
      await updateTenantMe({ openingHours: hours });
      toast.success("Horarios atualizados");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDados() {
    try {
      setSaving(true);
      await updateTenantMe({
        logoUrl,
        checkoutSettings: {
          pixKey,
          deliveryFee: Number(deliveryFee || 0),
          cardFeePercent: Number(cardFeePercent || 0)
        }
      });
      toast.success("Dados atualizados");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDeliveryAgent() {
    try {
      setSaving(true);
      if (!deliveryAgentName || !deliveryAgentEmail) {
        toast.error("Nome e email do motoboy sao obrigatorios");
        return;
      }

      if (deliveryAgentId) {
        await updateDeliveryAgent(deliveryAgentId, {
          name: deliveryAgentName,
          email: deliveryAgentEmail,
          phone: deliveryAgentPhone,
          password: deliveryAgentPassword || undefined
        });
        toast.success("Credenciais do motoboy atualizadas");
      } else {
        if (!deliveryAgentPassword) {
          toast.error("Informe senha para criar o motoboy");
          return;
        }
        await createDeliveryAgent({
          name: deliveryAgentName,
          email: deliveryAgentEmail,
          phone: deliveryAgentPhone,
          password: deliveryAgentPassword
        });
        toast.success("Motoboy criado");
      }

      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid" style={{ maxWidth: 840 }}>
      <PageState loading={loading} error={err} />

      <Card>
        <div className="inline" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div className="section-title">Opcoes do estabelecimento</div>
          <div className="inline">
            <Button variant={tab === "dados" ? "primary" : "default"} onClick={() => setTab("dados")}>Dados</Button>
            <Button variant={tab === "horarios" ? "primary" : "default"} onClick={() => setTab("horarios")}>Horarios</Button>
          </div>
        </div>
      </Card>

      {tab === "dados" ? (
        <Card>
          <div className="section-title">Dados do estabelecimento</div>
          <div className="grid" style={{ marginTop: 10 }}>
            <Input value={tenant?.name || ""} placeholder="nome" readOnly />
            <Input value={tenant?.slug || ""} placeholder="slug" readOnly />
            <Input value={tenant?.segment || ""} placeholder="segmento" readOnly />

            <div className="field-help">
              <div className="section-title">Logo (URL)</div>
              <div className="muted">Imagem exibida no ERP e no cardapio digital.</div>
            </div>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="logo url" />
            <input
              ref={logoFileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => readFileAsDataUrl(e.target.files?.[0], setLogoUrl)}
            />
            <div className="inline">
              <Button onClick={() => logoFileRef.current?.click()}>Selecionar imagem do dispositivo</Button>
              <Button variant="ghost" onClick={() => setLogoUrl("")}>Limpar imagem</Button>
            </div>
            {logoUrl ? <img src={logoUrl} alt="Logo preview" style={{ width: 92, height: 92, borderRadius: 10, objectFit: "cover" }} /> : null}

            <div className="field-help">
              <div className="section-title">Chave Pix</div>
              <div className="muted">Chave exibida no checkout quando o cliente seleciona PIX.</div>
            </div>
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="ex.: email, telefone ou chave aleatoria" />

            <div className="field-help">
              <div className="section-title">Taxa de entrega</div>
              <div className="muted">Valor fixo somado ao total no modo delivery.</div>
            </div>
            <Input type="number" step="0.01" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="ex.: 5.00" />

            <div className="field-help">
              <div className="section-title">Taxa de cartao (%)</div>
              <div className="muted">Percentual aplicado em pagamentos credito/debito.</div>
            </div>
            <Input type="number" step="0.01" value={cardFeePercent} onChange={(e) => setCardFeePercent(e.target.value)} placeholder="ex.: 3.99" />

            <div className="field-help" style={{ marginTop: 6 }}>
              <div className="section-title">Credenciais do motoboy</div>
              <div className="muted">Este login acessa somente o painel de entregas.</div>
            </div>
            <select
              className="select"
              value={deliveryAgentId}
              onChange={(e) => setDeliveryAgentId(e.target.value)}
            >
              <option value="">Novo motoboy</option>
              {deliveryAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
            <Input value={deliveryAgentName} onChange={(e) => setDeliveryAgentName(e.target.value)} placeholder="Nome do motoboy" />
            <Input value={deliveryAgentEmail} onChange={(e) => setDeliveryAgentEmail(e.target.value)} placeholder="Email do motoboy" />
            <Input value={deliveryAgentPhone} onChange={(e) => setDeliveryAgentPhone(e.target.value)} placeholder="Telefone do motoboy" />
            <Input
              type="password"
              value={deliveryAgentPassword}
              onChange={(e) => setDeliveryAgentPassword(e.target.value)}
              placeholder={deliveryAgentId ? "Nova senha (opcional)" : "Senha (obrigatoria)"}
            />
            <div className="inline">
              <Button variant="primary" onClick={saveDados} disabled={saving}>{saving ? "Salvando..." : "Salvar dados"}</Button>
              <Button onClick={saveDeliveryAgent} disabled={saving}>{saving ? "Salvando..." : "Salvar motoboy"}</Button>
              <Button variant="ghost" onClick={refresh}>Recarregar</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="section-title">Horarios de funcionamento</div>
          <div className="grid" style={{ marginTop: 10 }}>
            {DAYS.map((d) => {
              const row = hoursMap[d.key] || { day: d.key, open: "18:00", close: "23:00", closed: false };
              return (
                <div key={d.key} className="state" style={{ display: "grid", gap: 8 }}>
                  <div className="inline" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <b>{d.label}</b>
                    <label className="inline" style={{ fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={row.closed}
                        onChange={(e) => {
                          setHours((prev) => prev.map((h) => (h.day === d.key ? { ...h, closed: e.target.checked } : h)));
                        }}
                      />
                      Fechado
                    </label>
                  </div>
                  <div className="inline" style={{ gap: 8 }}>
                    <Input
                      type="time"
                      value={row.open}
                      disabled={row.closed}
                      onChange={(e) => {
                        setHours((prev) => prev.map((h) => (h.day === d.key ? { ...h, open: e.target.value } : h)));
                      }}
                    />
                    <Input
                      type="time"
                      value={row.close}
                      disabled={row.closed}
                      onChange={(e) => {
                        setHours((prev) => prev.map((h) => (h.day === d.key ? { ...h, close: e.target.value } : h)));
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="inline">
              <Button variant="primary" onClick={saveHours} disabled={saving}>{saving ? "Salvando..." : "Salvar horarios"}</Button>
              <Button variant="ghost" onClick={refresh}>Recarregar</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
