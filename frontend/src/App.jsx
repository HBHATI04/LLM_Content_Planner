import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/landing";
import Auth from "./pages/auth";
import Dashboard from "./pages/dashboard";
import Admin from "./pages/admin";
import ProtectedRoute from "./components/protectedRoute";
import Verify from "./pages/verify";
import OAuthSuccess from "./pages/oauthSuccess";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/verify/:token" element={<Verify />} />
        <Route path="/oauth-success" element={<OAuthSuccess />} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;