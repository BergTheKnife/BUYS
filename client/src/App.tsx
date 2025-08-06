import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/auth";
import Welcome from "@/pages/welcome";
import BusinessSelection from "@/pages/business-selection";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Sales from "@/pages/sales";
import Expenses from "@/pages/expenses";
import Balance from "@/pages/balance";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Welcome} />
      <Route path="/business-selection" component={() => <ProtectedRoute><BusinessSelection /></ProtectedRoute>} />
      <Route path="/dashboard" component={() => <ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/inventario" component={() => <ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/vendite" component={() => <ProtectedRoute><Sales /></ProtectedRoute>} />
      <Route path="/spese" component={() => <ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/bilancio" component={() => <ProtectedRoute><Balance /></ProtectedRoute>} />
      <Route path="/profilo" component={() => <ProtectedRoute><Profile /></ProtectedRoute>} />
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
