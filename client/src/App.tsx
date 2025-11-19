import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { PRListPage } from "./pages/PRListPage";
import { PRDetailPage } from "./pages/PRDetailPage";
import { ToastContainer, ToastMessage } from "./components/ToastContainer";
import { useState } from "react";

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: ToastMessage) => {
    setToasts((prev) => [...prev, toast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/prs" replace /> : <Navigate to="/login" replace />
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/prs"
          element={
            <ProtectedRoute>
              <PRListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/prs/:id"
          element={
            <ProtectedRoute>
              <PRDetailPage onToast={addToast} />
            </ProtectedRoute>
          }
        />
      </Routes>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

