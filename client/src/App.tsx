import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/auth";
import Welcome from "@/pages/welcome";
import ActivitySelection from "@/pages/activity-selection";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Sales from "@/pages/sales";
import Expenses from "@/pages/expenses";
import Balance from "@/pages/balance";
import Profile from "@/pages/profile";
import ActivitySettings from "@/pages/activity-settings";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/attivita" component={ActivitySelection} />
      <Route path="/dashboard" component={() => <ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/inventario" component={() => <ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/vendite" component={() => <ProtectedRoute><Sales /></ProtectedRoute>} />
      <Route path="/spese" component={() => <ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/bilancio" component={() => <ProtectedRoute><Balance /></ProtectedRoute>} />
      <Route path="/profilo" component={() => <ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/impostazioni-attivita" component={() => <ProtectedRoute><ActivitySettings /></ProtectedRoute>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
