import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";
import { AddExpenseModal } from "@/components/modals/add-expense-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, Plus, Edit, Trash2, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Spesa } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery<Spesa[]>({
    queryKey: ["/api/spese"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/spese/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spese"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
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
      case "utenze": return "outline";
      case "marketing": return "destructive";
      default: return "secondary";
    }
  };

  // Filter expenses based on filter criteria
  const filteredExpenses = expenses.filter((expense: Spesa) => {
    if (filters.voce && !expense.voce.toLowerCase().includes(filters.voce.toLowerCase())) {
      return false;
    }
    if (filters.categoria && filters.categoria !== "tutti" && expense.categoria !== filters.categoria) {
      return false;
    }
    if (filters.dataInizio && new Date(expense.data) < new Date(filters.dataInizio)) {
      return false;
    }
    if (filters.dataFine && new Date(expense.data) > new Date(filters.dataFine)) {
      return false;
    }
    if (filters.importoMin && Number(expense.importo) < Number(filters.importoMin)) {
      return false;
    }
    if (filters.importoMax && Number(expense.importo) > Number(filters.importoMax)) {
      return false;
    }
    return true;
  });

  const totalExpenses = filteredExpenses.reduce((sum: number, expense: Spesa) => sum + Number(expense.importo), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
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
                      <TableHead>Data</TableHead>
                      <TableHead>Voce</TableHead>
                      <TableHead>Importo</TableHead>
                      <TableHead>Categoria</TableHead>
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
                            {expense.categoria !== "Aggiunta articolo" && (
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
                            {expense.categoria === "Aggiunta articolo" && (
                              <div className="flex items-center justify-center min-w-[76px] h-9 px-2 text-xs text-muted-foreground bg-gray-100 rounded border">
                                Auto
                              </div>
                            )}
                            {expense.categoria !== "Aggiunta articolo" && (
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
