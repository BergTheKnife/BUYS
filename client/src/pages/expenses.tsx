import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus, Filter, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AddExpenseModal } from "@/components/modals/add-expense-modal";
import { Navbar } from "@/components/layout/navbar";
import { capitalizeWords } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
// Hook undo/redo rimosso
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Spesa } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Expenses() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Spesa | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Spesa | null>(null);
  const [filters, setFilters] = useState({
    voce: "",
    categoria: "",
    dataInizio: "",
    dataFine: "",
    importoMin: "",
    importoMax: "",
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Spesa | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Hook undo/redo rimosso

  const { data: expenses = [], isLoading } = useQuery<Spesa[]>({
    queryKey: ["/api/spese"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/spese/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spese"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cassa-reinvestimento-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cassa-reinvestimento-balance"] });
      toast({
        title: "Successo",
        description: "Spesa eliminata con successo",
      });
      setExpenseToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("it-IT");
  };

  const getCategoryVariant = (category: string) => {
    switch (category.toLowerCase()) {
      case "fisse": return "secondary";
      case "inventario": return "default";
      case "produzione": return "default";
      case "utenze": return "outline";
      case "marketing": return "destructive";
      default: return "secondary";
    }
  };

  // Sorting function
  const handleSort = (key: keyof Spesa) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: keyof Spesa) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ?
      <ArrowUp className="h-4 w-4" /> :
      <ArrowDown className="h-4 w-4" />;
  };

  // Filter and sort expenses based on filter criteria
  const filteredExpenses = expenses.filter((expense: Spesa) => {
    // Filtro voce
    if (filters.voce && filters.voce.trim() !== "") {
      if (!expense.voce.toLowerCase().includes(filters.voce.toLowerCase().trim())) {
        return false;
      }
    }

    // Filtro categoria
    if (filters.categoria && filters.categoria !== "tutti" && filters.categoria.trim() !== "") {
      if (expense.categoria !== filters.categoria) {
        return false;
      }
    }

    // Filtro data inizio
    if (filters.dataInizio && filters.dataInizio.trim() !== "") {
      const expenseDate = new Date(expense.data);
      const startDate = new Date(filters.dataInizio);
      expenseDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      if (expenseDate < startDate) {
        return false;
      }
    }

    // Filtro data fine
    if (filters.dataFine && filters.dataFine.trim() !== "") {
      const expenseDate = new Date(expense.data);
      const endDate = new Date(filters.dataFine);
      expenseDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      if (expenseDate > endDate) {
        return false;
      }
    }

    // Filtro importo minimo
    if (filters.importoMin && filters.importoMin.trim() !== "") {
      const minAmount = parseFloat(filters.importoMin);
      const expenseAmount = parseFloat(expense.importo.toString());
      if (!isNaN(minAmount) && !isNaN(expenseAmount) && expenseAmount < minAmount) {
        return false;
      }
    }

    // Filtro importo massimo
    if (filters.importoMax && filters.importoMax.trim() !== "") {
      const maxAmount = parseFloat(filters.importoMax);
      const expenseAmount = parseFloat(expense.importo.toString());
      if (!isNaN(maxAmount) && !isNaN(expenseAmount) && expenseAmount > maxAmount) {
        return false;
      }
    }

    return true;
  })
  .sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue: any = a[sortConfig.key];
    let bValue: any = b[sortConfig.key];

    // Convert dates to comparable format
    if (sortConfig.key === 'data') {
      aValue = new Date(aValue as string | Date).getTime();
      bValue = new Date(bValue as string | Date).getTime();
    }

    // Convert numbers for proper comparison
    if (sortConfig.key === 'importo') {
      aValue = Number(aValue);
      bValue = Number(bValue);
    }

    if (aValue != null && bValue != null && aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue != null && bValue != null && aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const totalExpenses = filteredExpenses.reduce((sum: number, expense: Spesa) => sum + Number(expense.importo), 0);

  const handleDownloadExcel = async () => {
    try {
      const response = await apiRequest("GET", "/api/export/expenses/excel");

      if (!response.ok) {
        throw new Error("Errore nel download del file Excel");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `spese_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Successo",
        description: "File Excel scaricato con successo",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nel download del file Excel",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="page-with-navbar bg-gray-50">
        <div className="container mx-auto py-8 px-4 container-with-navbar">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-with-navbar bg-gray-50">
      <Navbar />

      <div className="container mx-auto py-6 px-4 container-with-navbar">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Receipt className="h-8 w-8" />
            Spese
          </h1>
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-yellow-600">
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi Spesa
          </Button>
        </div>

        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Spese Totali</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Numero Spese</p>
                <p className="text-2xl font-bold">{filteredExpenses.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Media Mensile</p>
                <p className="text-2xl font-bold">{formatCurrency(totalExpenses / Math.max(1, new Date().getMonth() + 1))}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>Voce</Label>
                <Input
                  placeholder="Cerca per voce..."
                  value={filters.voce}
                  onChange={(e) => setFilters(prev => ({ ...prev, voce: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={filters.categoria} onValueChange={(value) => setFilters(prev => ({ ...prev, categoria: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutte</SelectItem>
                    <SelectItem value="Fisse">Fisse</SelectItem>
                    <SelectItem value="Inventario">Inventario</SelectItem>
                    <SelectItem value="Utenze">Utenze</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Varie">Varie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Inizio</Label>
                <Input
                  type="date"
                  value={filters.dataInizio}
                  onChange={(e) => setFilters(prev => ({ ...prev, dataInizio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fine</Label>
                <Input
                  type="date"
                  value={filters.dataFine}
                  onChange={(e) => setFilters(prev => ({ ...prev, dataFine: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Importo Min</Label>
                <Input
                  type="number"
                  placeholder="€ 0"
                  value={filters.importoMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, importoMin: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Importo Max</Label>
                <Input
                  type="number"
                  placeholder="€ 1000"
                  value={filters.importoMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, importoMax: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pulsante Excel sotto i filtri */}
        {filteredExpenses.length > 0 && (
          <div className="flex justify-end mb-4">
            <Button onClick={handleDownloadExcel} variant="outline" className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
              <Download className="h-4 w-4 mr-2" />
              Scarica Excel
            </Button>
          </div>
        )}

        {/* Controlli undo/redo rimossi */}

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Elenco Spese</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Nessuna spesa registrata</h3>
                <p className="text-muted-foreground mb-4">
                  Inizia registrando la tua prima spesa
                </p>
                <Button onClick={() => setIsAddModalOpen(true)} className="bg-yellow-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Prima Spesa
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          onClick={() => handleSort('data')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Data
                          {getSortIcon('data')}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('voce')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Voce
                          {getSortIcon('voce')}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('importo')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Importo
                          {getSortIcon('importo')}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('categoria')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Categoria
                          {getSortIcon('categoria')}
                        </button>
                      </TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense: Spesa) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDate(expense.data.toString())}</TableCell>
                        <TableCell className="font-semibold">
                          {expense.voce}
                        </TableCell>
                        <TableCell className="font-semibold text-red-600">
                          {formatCurrency(expense.importo)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getCategoryVariant(expense.categoria)}>
                            {expense.categoria}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {(expense.categoria !== "Aggiunta articolo" && expense.categoria !== "Inventario") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingExpense(expense)}
                                title="Modifica spesa"
                                className="min-w-[36px] h-9 p-2"
                              >
                                <Edit className="h-6 w-6 text-green-600" />
                              </Button>
                            )}
                            {(expense.categoria === "Aggiunta articolo" || expense.categoria === "Inventario") && (
                              <div className="flex items-center justify-center min-w-[76px] h-9 px-2 text-xs text-muted-foreground bg-gray-100 rounded border">
                                Auto
                              </div>
                            )}
                            {(expense.categoria !== "Aggiunta articolo" && expense.categoria !== "Inventario") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setExpenseToDelete(expense)}
                                title="Elimina spesa"
                                className="min-w-[36px] h-9 p-2"
                              >
                                <Trash2 className="h-6 w-6 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AddExpenseModal
          isOpen={isAddModalOpen || !!editingExpense}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingExpense(null);
          }}
          editingExpense={editingExpense}
        />

        <AlertDialog open={!!expenseToDelete} onOpenChange={() => setExpenseToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare la spesa "{expenseToDelete?.voce}"?
                Questa azione non può essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => expenseToDelete && deleteMutation.mutate(expenseToDelete.id)}
                disabled={deleteMutation.isPending}
              >
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}