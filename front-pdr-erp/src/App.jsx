import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import DeliveryLogin from "./pages/DeliveryLogin.jsx";
import DeliveryBoard from "./pages/DeliveryBoard.jsx";
import Pdv from "./pages/Pdv.jsx";
import Cash from "./pages/Cash.jsx";
import Inventory from "./pages/Inventory.jsx";
import Products from "./pages/Products.jsx";
import Categories from "./pages/Categories.jsx";
import Orders from "./pages/Orders.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Kitchen from "./pages/Kitchen.jsx";
import Conversations from "./pages/Conversations.jsx";
import TenantSettings from "./pages/TenantSettings.jsx";
import WhatsappSettings from "./pages/WhatsappSettings.jsx";
import NoPermission from "./pages/NoPermission.jsx";
import Layout from "./components/Layout.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import { getSession } from "./lib/session";

function AuthGuard({ children }) {
  const s = getSession();
  if (!s?.token) return <Navigate to="/login" replace />;
  return children;
}

function RoleGuard({ roles, children }) {
  const s = getSession();
  const role = s?.user?.role || "";
  if (!roles || roles.length === 0) return children;
  if (!roles.includes(role)) return <Navigate to="/no-permission" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/delivery/login" element={<DeliveryLogin />} />
          <Route path="/delivery/board" element={<DeliveryBoard />} />
          <Route path="/no-permission" element={<NoPermission />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<RoleGuard roles={["ADMIN","MANAGER","CASHIER"]}><Dashboard /></RoleGuard>} />
            <Route path="/pdv" element={<RoleGuard roles={["ADMIN","MANAGER","CASHIER"]}><Pdv /></RoleGuard>} />
            <Route path="/cash" element={<RoleGuard roles={["ADMIN","MANAGER","CASHIER"]}><Cash /></RoleGuard>} />
            <Route path="/inventory" element={<RoleGuard roles={["ADMIN","MANAGER"]}><Inventory /></RoleGuard>} />
            <Route path="/products" element={<RoleGuard roles={["ADMIN","MANAGER"]}><Products /></RoleGuard>} />
            <Route path="/categories" element={<RoleGuard roles={["ADMIN","MANAGER"]}><Categories /></RoleGuard>} />
            <Route path="/orders" element={<RoleGuard roles={["ADMIN","MANAGER","CASHIER"]}><Orders /></RoleGuard>} />
            <Route path="/kitchen" element={<RoleGuard roles={["ADMIN","MANAGER","CASHIER","ATTENDANT"]}><Kitchen /></RoleGuard>} />
            <Route path="/conversations" element={<RoleGuard roles={["ADMIN","MANAGER","ATTENDANT"]}><Conversations /></RoleGuard>} />
            <Route path="/settings/tenant" element={<RoleGuard roles={["ADMIN","MANAGER"]}><TenantSettings /></RoleGuard>} />
            <Route path="/settings/whatsapp" element={<RoleGuard roles={["ADMIN","MANAGER"]}><WhatsappSettings /></RoleGuard>} />
          </Route>
          <Route path="*" element={<Navigate to="/pdv" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
