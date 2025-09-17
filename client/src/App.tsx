import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute, UserOnlyRoute } from "@/lib/auth";
import Welcome from "@/pages/welcome";
import ActivitySelection from "@/pages/activity-selection";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Sales from "@/pages/sales";
import Expenses from "@/pages/expenses";
import Balance from "@/pages/balance";
import FinancialManagement from "@/pages/financial-management";
import Shipping from "@/pages/shipping";
import Profile from "@/pages/profile";
import ActivitySettings from "@/pages/activity-settings";
import { AdminPage } from "@/pages/admin";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";

function HomeRedirect() {
  const { user, hasActivity, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (user && hasActivity) {
      // User is authenticated and has an activity - go to dashboard
      setLocation("/dashboard");
    } else if (user && !hasActivity) {
      // User is authenticated but no activity - go to activity selection
      setLocation("/attivita");
    }
    // If no user, stay on welcome page
  }, [user, hasActivity, isLoading, setLocation]);

  // Show welcome page while redirecting or for unauthenticated users
  return <Welcome />;
}

function AppContent() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      <div className={user ? "pt-20 sm:pt-24" : ""}>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/attivita" component={ActivitySelection} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password/:token" component={ResetPassword} />
          <Route path="/dashboard" component={() => <ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/inventario" component={() => <ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="/vendite" component={() => <ProtectedRoute><Sales /></ProtectedRoute>} />
          <Route path="/spese" component={() => <ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/spedizioni" component={() => <ProtectedRoute><Shipping /></ProtectedRoute>} />
          <Route path="/bilancio" component={() => <ProtectedRoute><Balance /></ProtectedRoute>} />
          <Route path="/gestione-finanziaria" component={() => <ProtectedRoute><FinancialManagement /></ProtectedRoute>} />
          <Route path="/profilo" component={() => <UserOnlyRoute><Profile /></UserOnlyRoute>} />
          <Route path="/impostazioni-attivita" component={() => <ProtectedRoute><ActivitySettings /></ProtectedRoute>} />
          <Route path="/admin" component={() => <UserOnlyRoute><AdminPage /></UserOnlyRoute>} />
          <Route path="*" component={NotFound} />
        </Switch>
      </div>
    </>
  );
}


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;