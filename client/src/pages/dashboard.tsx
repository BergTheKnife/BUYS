import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  Package,
  Euro,
  Receipt,
  TrendingUp,
  Plus,
  ShoppingCart,
  PlusCircle,
  Calendar,
  Filter
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const { user, currentActivity } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();



  // Force refetch when currentActivity changes
  useEffect(() => {
    if (currentActivity) {
      // Invalidate all activity-dependent queries when activity changes
      const activityQueries = [
        "/api/stats",
        "/api/inventario",
        "/api/vendite",
        "/api/spese",
        "/api/activity-history",
        "/api/top-selling-items",
        "/api/chart-data"
      ];

      activityQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    }
  }, [currentActivity?.id, queryClient]);

  const { data: stats, isLoading } = useQuery<{
    inventoryCount: number;
    totalSales: number;
    totalExpenses: number;
    netMargin: number;
  }>({
    queryKey: ["/api/stats"],
    enabled: !!currentActivity?.id,
  });

  // Fetch activity history
  const [historyFilter, setHistoryFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState<string>();
  const [selectedYear, setSelectedYear] = useState<string>();

  const { data: activityHistory = [], isLoading: isActivitiesLoading } = useQuery<Array<{
    id: string;
    type: 'inventory' | 'sale' | 'expense';
    description: string;
    amount: number;
    data: string;
    details?: any;
  }>>({
    queryKey: ["/api/activity-history", historyFilter, selectedMonth, selectedYear],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('filter', historyFilter);
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedYear) params.append('year', selectedYear);

      const response = await fetch(`/api/activity-history?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!currentActivity?.id,
  });

  // Generate years for filter (current year and last 2 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

  // Generate months
  const months = [
    { value: '1', label: 'Gennaio' },
    { value: '2', label: 'Febbraio' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Aprile' },
    { value: '5', label: 'Maggio' },
    { value: '6', label: 'Giugno' },
    { value: '7', label: 'Luglio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Settembre' },
    { value: '10', label: 'Ottobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Dicembre' }
  ];

  // Fetch top selling items
  const { data: topSellingItems = [] } = useQuery<Array<{
    nomeArticolo: string;
    taglia: string;
    totalQuantity: number;
    totalRevenue: number;
  }>>({
    queryKey: ["/api/top-selling-items"],
    enabled: !!currentActivity?.id,
  });



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };



  const statsCards = [
    {
      title: "Pezzi in Magazzino",
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
        <div className="page-with-navbar">
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
      </div>
    );
  }

  return (
    <div className="page-with-navbar bg-gray-50 dark:bg-gray-900">
      <div>
        <div className="container mx-auto py-6 sm:py-8 lg:py-10 px-3 sm:px-4 lg:px-6 max-w-full container-with-navbar">
          {/* Welcome Header */}
          <div className="mb-8 sm:mb-12">
            <Card className="quick-stats text-white border-0 overflow-hidden">
              <CardContent className="py-8 sm:py-12 lg:py-16 text-center relative">
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-2xl mb-6">
                    <span className="text-3xl sm:text-4xl">👋</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 tracking-tight">
                    Ciao, {user?.nome}!
                  </h1>
                  <p className="text-white/90 text-base sm:text-lg font-medium max-w-md mx-auto">
                    Benvenuto nel tuo centro di controllo aziendale
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    <div className="px-3 py-1 bg-white/10 rounded-full text-sm font-medium">
                      📊 Dashboard
                    </div>
                    <div className="px-3 py-1 bg-white/10 rounded-full text-sm font-medium">
                      🚀 BUYS Pro
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 sm:mb-12">
            {statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="stat-card group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-2xl ${stat.color} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg"></div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-2 tracking-wide uppercase">
                        {stat.title}
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {stat.value}
                      </p>
                      <div className="mt-3 flex items-center text-xs text-green-600 font-medium">
                        <div className="w-1 h-1 bg-green-400 rounded-full mr-2"></div>
                        Aggiornato ora
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Activity and Top Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            <Card className="modern-card">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg sm:text-xl font-bold">Cronologia Attività</CardTitle>
                      <p className="text-sm text-muted-foreground">Panoramica delle tue operazioni</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={historyFilter} onValueChange={setHistoryFilter}>
                      <SelectTrigger className="w-20 sm:w-28 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutto</SelectItem>
                        <SelectItem value="today">Oggi</SelectItem>
                        <SelectItem value="month">Mese</SelectItem>
                        <SelectItem value="year">Anno</SelectItem>
                      </SelectContent>
                    </Select>

                    {historyFilter === 'month' && (
                      <>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                          <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm">
                            <SelectValue placeholder="Mese" />
                          </SelectTrigger>
                          <SelectContent>
                            {months.map(month => (
                              <SelectItem key={month.value} value={month.value}>
                                {month.label.slice(0, 3)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                          <SelectTrigger className="w-16 sm:w-20 text-xs sm:text-sm">
                            <SelectValue placeholder="Anno" />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map(year => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}

                    {historyFilter === 'year' && (
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-20">
                          <SelectValue placeholder="Anno" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map(year => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activityHistory.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {activityHistory.slice(0, 20).map((activity, index) => {
                        const getActivityBadge = () => {
                          if (activity.type === 'inventory') return { text: 'INV', variant: 'secondary' as const };
                          if (activity.type === 'sale') return { text: 'VEN', variant: 'default' as const };
                          return { text: 'SPE', variant: 'destructive' as const };
                        };

                        const badge = getActivityBadge();

                        return (
                          <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
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
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{activity.description}</p>
                                <Badge variant={badge.variant} className="text-xs">
                                  {badge.text}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(activity.data).toLocaleDateString('it-IT', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div className="text-sm font-semibold text-right">
                              {formatCurrency(activity.amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nessuna attività trovata</p>
                      <p className="text-sm">
                        Modifica i filtri per vedere più risultati
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="modern-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold">Articoli Più Venduti</CardTitle>
                    <p className="text-sm text-muted-foreground">I tuoi prodotti di punta</p>
                  </div>
                </div>
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
    </div>
  );
}