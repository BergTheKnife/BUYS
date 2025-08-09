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
    <div className="min-h-screen-safe bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="page-with-navbar">
        <div className="container mx-auto py-6 sm:py-8 lg:py-10 px-3 sm:px-4 lg:px-6 max-w-full container-with-navbar">
          {/* Welcome Header */}
          <div className="mb-6 sm:mb-8">
            <Card className="bg-primary text-white border-0">
              <CardContent className="py-4 sm:py-6 lg:py-8 text-center">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                  Ciao, {user?.nome}!
                </h1>
                <p className="text-white/80 text-sm sm:text-base">Benvenuto in BUYS - Build Up Your Success</p>
              </CardContent>
            </Card>
          </div>

          {/* Stats Cards */}
          <div className="responsive-grid mb-6 sm:mb-8">
            {statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-3 sm:p-4 lg:p-6">
                    <div className="flex items-center">
                      <div className={`p-2 sm:p-3 rounded-lg ${stat.color} text-white mr-3 sm:mr-4 flex-shrink-0`}>
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                          {stat.title}
                        </p>
                        <p className="text-lg sm:text-xl lg:text-2xl font-bold">{stat.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Activity and Top Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base sm:text-lg">Cronologia Attività</CardTitle>
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
    </div>
  );
}