import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { BranchProvider } from "@/hooks/useBranch";
import { BusinessProvider } from "@/hooks/useBusiness";
import { TaxProvider } from "@/hooks/useTaxSettings";
import { ThemeProvider } from "@/hooks/useTheme";
import { ShiftProvider } from "@/hooks/useShift";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import ErrorBoundary from "@/components/ErrorBoundary";
import SessionLockScreen from "@/components/SessionLockScreen";
import SessionWarning from "@/components/SessionWarning";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Branches from "./pages/Branches";
import Reports from "./pages/Reports";
import Customers from "./pages/Customers";
import Settings from "./pages/Settings";
import Parties from "./pages/Parties";
import DebtDashboard from "./pages/DebtDashboard";
import AuditLog from "./pages/AuditLog";
import Analytics from "./pages/Analytics";
import CustomerStatement from "./pages/CustomerStatement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isLocked, showWarning, timeUntilLock, unlock, resetTimer, hasPin } = useSessionTimeout();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isLocked) {
    return <SessionLockScreen onUnlock={unlock} hasPin={hasPin} />;
  }
  
  return (
    <BusinessProvider>
    <BranchProvider>
      <TaxProvider>
        <ShiftProvider>
          {showWarning && (
            <SessionWarning timeUntilLock={timeUntilLock} onStayLoggedIn={resetTimer} />
          )}
          {children}
        </ShiftProvider>
      </TaxProvider>
    </BranchProvider>
    </BusinessProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/parties" element={<ProtectedRoute><Parties /></ProtectedRoute>} />
                <Route path="/debts" element={<ProtectedRoute><DebtDashboard /></ProtectedRoute>} />
                <Route path="/branches" element={<ProtectedRoute><Branches /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/customers/:customerId/statement" element={<ProtectedRoute><CustomerStatement /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
