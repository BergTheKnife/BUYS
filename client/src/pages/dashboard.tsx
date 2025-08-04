import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Package,
  Euro,
  Receipt,
  TrendingUp,
  Plus,
  ShoppingCart,
  PlusCircle,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery<{
    inventoryCount: number;
    totalSales: number;
    totalExpenses: number;
    netMargin: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const statsCards = [
    {
      title: "Articoli in Magazzino",
      value: stats?.inventoryCount || 0,
      icon: Package,
      color: "bg-blue-500",
    },
    {
      title: "Vendite Totali",
      value: formatCurrency(stats?.totalSales || 0),
      icon: Euro,
      color: "bg-green-500",
    },
    {
      title: "Spese Totali",
      value: formatCurrency(stats?.totalExpenses || 0),
      icon: Receipt,
      color: "bg-yellow-500",
    },
    {
      title: "Margine Netto",
      value: formatCurrency(stats?.netMargin || 0),
      icon: TrendingUp,
      color: "bg-purple-500",
    },
  ];

  const quickActions = [
    {
      title: "Aggiungi Articolo",
      description: "Inserisci un nuovo capo nel magazzino",
      icon: PlusCircle,
      action: () => setLocation("/inventario"),
      color: "bg-blue-600 hover:bg-blue-700",
    },
    {
      title: "Registra Vendita",
      description: "Registra una vendita e aggiorna l'inventario",
      icon: ShoppingCart,
      action: () => setLocation("/vendite"),
      color: "bg-green-600 hover:bg-green-700",
    },
    {
      title: "Aggiungi Spesa",
      description: "Inserisci una nuova spesa aziendale",
      icon: Receipt,
      action: () => setLocation("/spese"),
      color: "bg-yellow-600 hover:bg-yellow-700",
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto py-8 px-4">
        {/* Welcome Header */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
            <CardContent className="py-8 text-center">
              <h1 className="text-3xl font-bold mb-2">
                Ciao, {user?.nome}!
              </h1>
              <p className="text-blue-100">
                Ecco il riassunto della tua attività
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-lg ${stat.color} text-white mr-4`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Azioni Rapide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={index}
                      onClick={action.action}
                      className={`${action.color} text-white p-6 h-auto flex flex-col items-center justify-center space-y-2`}
                    >
                      <Icon className="h-8 w-8" />
                      <div className="text-center">
                        <div className="font-semibold">{action.title}</div>
                        <div className="text-sm opacity-90">{action.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attività Recente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessuna attività recente</p>
                  <p className="text-sm">
                    Inizia aggiungendo articoli al magazzino o registrando vendite
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
