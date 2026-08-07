import { lazy, Suspense } from "react";
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
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import { CommandPaletteProvider } from "@/hooks/useCommandPalette";
import { SubscriptionGate } from "@/components/subscription/SubscriptionGate";
// Eager: landing, auth, primary POS (kept fast on cold boot)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { FEATURES } from "./lib/feature-flags";

// Lazy: everything else code-splits into its own chunk
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Branches = lazy(() => import("./pages/Branches"));
const Reports = lazy(() => import("./pages/Reports"));
const Customers = lazy(() => import("./pages/Customers"));
const Settings = lazy(() => import("./pages/Settings"));
const Parties = lazy(() => import("./pages/Parties"));
const DebtDashboard = lazy(() => import("./pages/DebtDashboard"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Analytics = lazy(() => import("./pages/Analytics"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const CustomerStatement = lazy(() => import("./pages/CustomerStatement"));
const Warehouse = lazy(() => import("./pages/Warehouse"));
const Promotions = lazy(() => import("./pages/Promotions"));
const SmartInventory = lazy(() => import("./pages/SmartInventory"));
const More = lazy(() => import("./pages/More"));
const Install = lazy(() => import("./pages/Install"));
const Observability = lazy(() => import("./pages/Observability"));
const Subscription = lazy(() => import("./pages/Subscription"));
const BillingAdmin = lazy(() => import("./pages/BillingAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      retry: 1,
    },
    mutations: { retry: 0 },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex gap-1">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isLocked, showWarning, timeUntilLock, unlock, resetTimer, hasPin } = useSessionTimeout();
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-14 h-14 bg-gradient-hero rounded-2xl flex items-center justify-center shadow-glow">
          <svg className="w-7 h-7 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><rect width="20" height="5" x="2" y="7"/></svg>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
          ))}
        </div>
        <span className="text-sm text-muted-foreground font-medium">Loading DukaOS</span>
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
          <CommandPaletteProvider>
            <SubscriptionGate>
              {showWarning && (
                <SessionWarning timeUntilLock={timeUntilLock} onStayLoggedIn={resetTimer} />
              )}
              {children}
            </SubscriptionGate>
          </CommandPaletteProvider>
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
        <PWAUpdatePrompt />
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/accept-invite" element={<AcceptInvite />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/parties" element={<ProtectedRoute>{FEATURES.parties ? <Parties /> : <Navigate to="/more" replace />}</ProtectedRoute>} />
                <Route path="/debts" element={<ProtectedRoute><DebtDashboard /></ProtectedRoute>} />
                <Route path="/branches" element={<ProtectedRoute><Branches /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/command-center" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />
                <Route path="/customers/:customerId/statement" element={<ProtectedRoute><CustomerStatement /></ProtectedRoute>} />
                <Route path="/warehouse" element={<ProtectedRoute>{FEATURES.warehouse ? <Warehouse /> : <Navigate to="/more" replace />}</ProtectedRoute>} />
                <Route path="/promotions" element={<ProtectedRoute>{FEATURES.promotions ? <Promotions /> : <Navigate to="/more" replace />}</ProtectedRoute>} />
                <Route path="/smart-inventory" element={<ProtectedRoute>{FEATURES.smartInventory ? <SmartInventory /> : <Navigate to="/more" replace />}</ProtectedRoute>} />
                <Route path="/more" element={<ProtectedRoute><More /></ProtectedRoute>} />
                <Route path="/install" element={<Install />} />
                <Route path="/observability" element={<ProtectedRoute><Observability /></ProtectedRoute>} />
                <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
                <Route path="/admin/billing" element={<ProtectedRoute><BillingAdmin /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
