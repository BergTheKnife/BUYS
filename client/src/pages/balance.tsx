import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown, Calculator, Download, FileText, Mail, BarChart3, LineChart } from "lucide-react";
import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement
);

export default function Balance() {
  const [period, setPeriod] = useState("month");
  const [chartView, setChartView] = useState("line");

  const { data: stats, isLoading } = useQuery<{
    inventoryCount: number;
    totalSales: number;
    totalExpenses: number;
    netMargin: number;
  }>({
    queryKey: ["/api/stats"],
  });

  // Fetch chart data
  const { data: chartData } = useQuery<{
    salesData: Array<{date: string, amount: number}>;
    expensesData: Array<{date: string, amount: number}>;
    marginData: Array<{date: string, amount: number}>;
    months: string[];
  }>({
    queryKey: ["/api/chart-data"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Andamento Finanziario - Ultimi 6 Mesi'
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return '€' + value.toLocaleString('it-IT');
          }
        }
      }
    }
  };

  const lineChartData = chartData ? {
    labels: chartData.months,
    datasets: [
      {
        label: 'Vendite',
        data: chartData.salesData.map(d => d.amount),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Spese',
        data: chartData.expensesData.map(d => d.amount),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Margine',
        data: chartData.marginData.map(d => d.amount),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  } : null;

  const barChartData = chartData ? {
    labels: chartData.months,
    datasets: [
      {
        label: 'Vendite',
        data: chartData.salesData.map(d => d.amount),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
      {
        label: 'Spese',
        data: chartData.expensesData.map(d => d.amount),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
      {
        label: 'Margine',
        data: chartData.marginData.map(d => d.amount),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  } : null;

  const exportToCSV = () => {
    if (!stats) return;

    const csvData = [
      ["Tipo", "Importo"],
      ["Entrate", stats.totalSales.toString()],
      ["Uscite", stats.totalExpenses.toString()],
      ["Margine Netto", stats.netMargin.toString()],
    ];

    const csvContent = csvData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bilancio_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Bilancio
          </h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-green-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="h-8 w-8 mr-2" />
                <h3 className="text-xl font-semibold">Entrate</h3>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(stats?.totalSales || 0)}</p>
              <p className="text-green-100 text-sm">Vendite totali questo periodo</p>
            </CardContent>
          </Card>

          <Card className="bg-red-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-2">
                <TrendingDown className="h-8 w-8 mr-2" />
                <h3 className="text-xl font-semibold">Uscite</h3>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(stats?.totalExpenses || 0)}</p>
              <p className="text-red-100 text-sm">Spese totali questo periodo</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-2">
                <Calculator className="h-8 w-8 mr-2" />
                <h3 className="text-xl font-semibold">Margine</h3>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(stats?.netMargin || 0)}</p>
              <p className="text-blue-100 text-sm">Guadagno netto questo periodo</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart Area */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Andamento Finanziario</CardTitle>
                <div className="flex space-x-2">
                  <Button 
                    variant={chartView === "line" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setChartView("line")}
                  >
                    <LineChart className="h-4 w-4 mr-1" />
                    Linea
                  </Button>
                  <Button 
                    variant={chartView === "bar" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setChartView("bar")}
                  >
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Barre
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {chartData && (chartView === "line" ? lineChartData : barChartData) ? (
                    chartView === "line" ? (
                      <Line data={lineChartData!} options={chartOptions} />
                    ) : (
                      <Bar data={barChartData!} options={chartOptions} />
                    )
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">Caricamento dati...</h3>
                        <p className="text-muted-foreground">
                          Preparazione del grafico finanziario
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Azioni</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={exportToCSV}
                  className="w-full" 
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Esporta CSV
                </Button>
                <Button className="w-full" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Stampa Report
                </Button>
                <Button className="w-full" variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Invia via Email
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Periodo Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seleziona Periodo</label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Questo mese</SelectItem>
                      <SelectItem value="quarter">Ultimi 3 mesi</SelectItem>
                      <SelectItem value="semester">Ultimi 6 mesi</SelectItem>
                      <SelectItem value="year">Quest'anno</SelectItem>
                      <SelectItem value="total">Totale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-2 space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Periodo selezionato: <span className="font-medium">
                      {period === "month" && "Questo mese"}
                      {period === "quarter" && "Ultimi 3 mesi"}
                      {period === "semester" && "Ultimi 6 mesi"}
                      {period === "year" && "Quest'anno"}
                      {period === "total" && "Dall'inizio"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Analisi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Margine di Profitto</p>
                    <p className="text-2xl font-bold">
                      {stats?.totalSales ? ((stats.netMargin / stats.totalSales) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Vendita Media</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency((stats?.totalSales || 0) / Math.max(1, new Date().getDate()))}
                    </p>
                    <p className="text-xs text-muted-foreground">per giorno</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
