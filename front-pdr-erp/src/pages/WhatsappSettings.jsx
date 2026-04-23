import { useEffect, useMemo, useState } from "react";
import PageState from "../components/PageState.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Input.jsx";
import {
  connectWhatsappSession,
  disconnectWhatsappSession,
  getWhatsappQr,
  getWhatsappSession,
  saveWhatsappSessionConfig,
  sendWhatsappTest
} from "../lib/api";
import { useToast } from "../components/ui/Toast.jsx";

const STATUS_LABEL = {
  DISCONNECTED: "Desconectado",
  CONNECTING: "Conectando",
  QR_REQUIRED: "Aguardando QR",
  CONNECTED: "Conectado",
  ERROR: "Erro"
};

function qrSrc(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("data:image")) return value;
  return `data:image/png;base64,${value}`;
}

export default function WhatsappSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [session, setSession] = useState(null);
  const [qrCodeBase64, setQrCodeBase64] = useState("");

  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [botEnabled, setBotEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [testPhone, setTestPhone] = useState("");
  const [testText, setTestText] = useState("Teste de integracao WhatsApp");

  async function refresh(options = {}) {
    const { background = false } = options;
    if (!background) {
      setLoading(true);
      setErr("");
    }

    try {
      const current = await getWhatsappSession();
      setSession(current || null);

      if (current) {
        setApiBaseUrl((prev) => prev || String(current.apiBaseUrl || ""));
        setInstanceName((prev) => prev || String(current.instanceName || ""));
        setBotEnabled(Boolean(current.botEnabled));
        setNotificationsEnabled(Boolean(current.notificationsEnabled));
      }

      const qrData = await getWhatsappQr().catch(() => null);
      setQrCodeBase64(String(qrData?.qrCodeBase64 || ""));
    } catch (e) {
      setErr(e.message);
    } finally {
      if (!background) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const status = String(session?.status || "");
    if (!["CONNECTING", "QR_REQUIRED"].includes(status)) return undefined;

    const timer = setInterval(() => {
      refresh({ background: true });
    }, 5000);

    return () => clearInterval(timer);
  }, [session?.status]);

  async function onSaveConfig() {
    try {
      setSaving(true);
      await saveWhatsappSessionConfig({
        apiBaseUrl,
        apiKey,
        instanceName,
        webhookSecret,
        botEnabled,
        notificationsEnabled
      });
      toast.success("Configuracao WhatsApp salva");
      setApiKey("");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function onConnect() {
    try {
      setSaving(true);
      await connectWhatsappSession();
      toast.success("Solicitacao de conexao enviada");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDisconnect() {
    try {
      setSaving(true);
      await disconnectWhatsappSession();
      toast.success("Instancia desconectada");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function onSendTest() {
    try {
      setSaving(true);
      await sendWhatsappTest({ phone: testPhone, text: testText });
      toast.success("Mensagem de teste enviada");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const status = String(session?.status || "DISCONNECTED");
  const statusLabel = STATUS_LABEL[status] || status;
  const qrImage = qrSrc(qrCodeBase64);
  const hasSession = Boolean(session);

  const statusClass = useMemo(() => {
    if (status === "CONNECTED") return "ok";
    if (status === "ERROR") return "error";
    return "";
  }, [status]);

  return (
    <div className="grid wa-page">
      <PageState loading={loading} error={err} />

      <Card>
        <div className="inline" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <div className="section-title">Integracao WhatsApp</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Configure sua instancia da Evolution API e conecte via QR Code.
            </div>
          </div>
          <span className={`badge ${statusClass}`}>
            <span className="dot" />
            {statusLabel}
          </span>
        </div>
      </Card>

      <div className="wa-shell">
        <Card className="wa-config-card">
          <div className="section-title">Conexao</div>
          <div className="grid" style={{ marginTop: 10, gap: 10 }}>
            <label className="wa-field">
              <span>URL da Evolution API</span>
              <Input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://sua-evolution-api.com" />
            </label>

            <label className="wa-field">
              <span>API Key</span>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={hasSession ? "Informe para atualizar" : "apikey"} />
            </label>

            <label className="wa-field">
              <span>Nome da instancia</span>
              <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="tenant-minhapizzaria" />
            </label>

            <label className="wa-field">
              <span>Webhook secret (opcional)</span>
              <Input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="segredo de validacao" />
            </label>

            <div className="wa-checks">
              <label className="inline">
                <input type="checkbox" checked={botEnabled} onChange={(e) => setBotEnabled(e.target.checked)} />
                Bot de atendimento ativo
              </label>
              <label className="inline">
                <input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />
                Notificacoes de cliente ativas
              </label>
            </div>

            <div className="inline wa-actions">
              <Button variant="primary" onClick={onSaveConfig} disabled={saving || !apiBaseUrl || (!hasSession && !apiKey)}>
                {saving ? "Salvando..." : "Salvar configuracao"}
              </Button>
              <Button onClick={onConnect} disabled={saving || !hasSession}>Conectar QR</Button>
              <Button onClick={onDisconnect} disabled={saving || !hasSession}>Desconectar</Button>
              <Button variant="ghost" onClick={() => refresh()}>Atualizar</Button>
            </div>
          </div>
        </Card>

        <Card className="wa-qr-card">
          <div className="section-title">Escaneie para entrar</div>
          <div className="muted" style={{ marginTop: 8 }}>
            1. Abra o WhatsApp no celular.
            <br />
            2. Toque em Dispositivos conectados.
            <br />
            3. Escaneie o QR code para vincular.
          </div>

          <div className="wa-qr-box">
            {qrImage ? <img src={qrImage} alt="QR Code WhatsApp" className="wa-qr-image" /> : <div className="wa-qr-empty">QR indisponivel no momento</div>}
          </div>

          <div className="muted" style={{ fontSize: 12 }}>
            O QR atualiza automaticamente enquanto a sessao estiver em conexao.
          </div>
        </Card>
      </div>

      <Card>
        <div className="section-title">Teste de envio</div>
        <div className="grid" style={{ marginTop: 10, gap: 10 }}>
          <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Telefone (ex: 5511999999999)" />
          <Input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="Mensagem de teste" />
          <div className="inline">
            <Button onClick={onSendTest} disabled={saving || !testPhone || !testText}>Enviar teste</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
