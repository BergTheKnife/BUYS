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

  // Fetch recent activities
  const { data: recentActivities = [] } = useQuery<Array<{
    id: string;
    type: 'sale' | 'expense' | 'inventory';
    description: string;
    amount?: number;
    data: string;
  }>>({
    queryKey: ["/api/recent-activities"],
  });

  // Fetch top selling items
  const { data: topSellingItems = [] } = useQuery<Array<{
    nomeArticolo: string;
    taglia: string;
    totalQuantity: number;
    totalRevenue: number;
  }>>({
    queryKey: ["/api/top-selling-items"],
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
      color: "bg-primary",
    },
    {
      title: "Vendite Totali",
      value: formatCurrency(stats?.totalSales || 0),
      icon: Euro,
      color: "bg-secondary",
    },
    {
      title: "Spese Totali",
      value: formatCurrency(stats?.totalExpenses || 0),
      icon: Receipt,
      color: "bg-accent",
    },
    {
      title: "Margine Netto",
      value: formatCurrency(stats?.netMargin || 0),
      icon: TrendingUp,
      color: "bg-secondary",
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
          <Card className="bg-primary text-white border-0">
            <CardContent className="py-8 text-center">
              <h1 className="text-3xl font-bold mb-2">
                Ciao, {user?.nome}!
              </h1>
              <p className="text-white/80">
                Benvenuto in BUYS - Build Up Your Store
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

        {/* Activity and Top Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Attività Recente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.length > 0 ? (
                  recentActivities.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded-full ${
                        activity.type === 'sale' ? 'bg-green-100 text-green-600' :
                        activity.type === 'expense' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {activity.type === 'sale' ? <ShoppingCart className="h-4 w-4" /> :
                         activity.type === 'expense' ? <Receipt className="h-4 w-4" /> :
                         <Package className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.data).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                      {activity.amount && (
                        <div className="text-sm font-semibold">
                          {formatCurrency(activity.amount)}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessuna attività recente</p>
                    <p className="text-sm">
                      Inizia aggiungendo articoli al magazzino o registrando vendite
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Articoli Più Venduti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topSellingItems.length > 0 ? (
                  topSellingItems.slice(0, 5).map((item, index) => (
                    <div key={`${item.nomeArticolo}-${item.taglia}`} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.nomeArticolo}</p>
                        <p className="text-xs text-muted-foreground">Taglia: {item.taglia}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{item.totalQuantity} venduti</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.totalRevenue)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessuna vendita ancora</p>
                    <p className="text-sm">
                      Le statistiche di vendita appariranno qui dopo le prime vendite
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
