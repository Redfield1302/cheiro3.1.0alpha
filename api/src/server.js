require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const { ensureSeed } = require("./core/ensureSeed");

const authRoutes = require("./http/routes/authRoutes");
const categoriesRoutes = require("./http/routes/categoriesRoutes");
const productsRoutes = require("./http/routes/productsRoutes");
const inventoryRoutes = require("./http/routes/inventoryRoutes");
const pdvRoutes = require("./http/routes/pdvRoutes");
const cashRoutes = require("./http/routes/cashRoutes");
const menuRoutes = require("./http/routes/menuRoutes");
const tenantRoutes = require("./http/routes/tenantRoutes");
const ordersRoutes = require("./http/routes/ordersRoutes");
const conversationsRoutes = require("./http/routes/conversationsRoutes");
const kitchenRoutes = require("./http/routes/kitchenRoutes");
const deliveryRoutes = require("./http/routes/deliveryRoutes");
const whatsappRoutes = require("./http/routes/whatsappRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.get("/health", (req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/login", authRoutes); // compat
app.use("/api/tenant", tenantRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/pdv", pdvRoutes);
app.use("/api/cash", cashRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/whatsapp", whatsappRoutes);

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload muito grande. Limite de 5MB por requisicao." });
  }
  return next(err);
});

app.use((req, res) => res.status(404).json({ error: "Rota nao encontrada" }));

async function start() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  if (process.env.NODE_ENV === "development") {
    await ensureSeed(prisma);
  }

  await prisma.$disconnect();

  const HOST = process.env.HOST || "0.0.0.0";

  const server = app.listen(PORT, HOST, () => {
    console.log(`API v6.0.0 rodando em http://${HOST}:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Porta ${PORT} ja esta em uso. Verifique processo duplicado no container.`);
      process.exit(1);
    }
    console.error("Erro ao iniciar servidor:", err);
    process.exit(1);
  });
}

start();

module.exports = app;
