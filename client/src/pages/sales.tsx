import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Navbar } from "@/components/layout/navbar";
import { AddSaleModal } from "@/components/modals/add-sale-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart, Plus, Filter, Repeat, Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Vendita } from "@shared/schema";

export default function Sales() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    articolo: "",
    dataInizio: "",
    dataFine: "",
    incassatoDa: "",
    incassatoSu: "",
    taglia: "",
  });
  const [repeatSale, setRepeatSale] = useState<Vendita | null>(null);
  const [editingSale, setEditingSale] = useState<Vendita | null>(null);
  const [deleteSale, setDeleteSale] = useState<Vendita | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sales = [], isLoading } = useQuery<Vendita[]>({
    queryKey: ["/api/vendite"],
  });

  // Fetch activity members for filters
  const { data: activityMembers = [] } = useQuery<Array<{
    id: string;
    nome: string;
    cognome: string;
    displayName: string;
  }>>({
    queryKey: ["/api/activity-members"],
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

  const getPaymentMethodVariant = (method: string) => {
    switch (method.toLowerCase()) {
      case "contanti": return "default";
      case "carta": return "secondary";
      case "bonifico": return "outline";
      default: return "default";
    }
  };

  // Filter sales based on filter criteria
  const filteredSales = sales.filter((sale: Vendita) => {
    if (filters.articolo && !sale.nomeArticolo.toLowerCase().includes(filters.articolo.toLowerCase())) {
      return false;
    }
    if (filters.incassatoDa && filters.incassatoDa !== "tutti" && sale.incassatoDa !== filters.incassatoDa) {
      return false;
    }
    if (filters.incassatoSu && filters.incassatoSu !== "tutti" && sale.incassatoSu !== filters.incassatoSu) {
      return false;
    }
    if (filters.taglia && !sale.taglia.toLowerCase().includes(filters.taglia.toLowerCase())) {
      return false;
    }
    if (filters.dataInizio && new Date(sale.data) < new Date(filters.dataInizio)) {
      return false;
    }
    if (filters.dataFine && new Date(sale.data) > new Date(filters.dataFine)) {
      return false;
    }
    return true;
  });

  const totalSales = filteredSales.reduce((sum: number, sale: Vendita) => sum + (Number(sale.prezzoVendita) * Number(sale.quantita)), 0);
  const totalMargin = filteredSales.reduce((sum: number, sale: Vendita) => sum + Number(sale.margine), 0);

  // Repeat sale mutation
  const repeatSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const response = await apiRequest("POST", "/api/vendite", saleData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Successo",
        description: "Vendita ripetuta con successo",
      });
      setRepeatSale(null);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella ripetizione della vendita",
        variant: "destructive",
      });
    },
  });

  // Delete sale mutation
  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const response = await apiRequest("DELETE", `/api/vendite/${saleId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Successo",
        description: "Vendita eliminata con successo",
      });
      setDeleteSale(null);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione della vendita",
        variant: "destructive",
      });
    },
  });

  const handleRepeatSale = () => {
    if (repeatSale) {
      repeatSaleMutation.mutate({
        nomeArticolo: repeatSale.nomeArticolo,
        taglia: repeatSale.taglia,
        prezzoVendita: repeatSale.prezzoVendita,
        quantita: repeatSale.quantita,
        incassatoDa: repeatSale.incassatoDa,
        incassatoSu: repeatSale.incassatoSu,
        data: new Date().toISOString()
      });
    }
  };

  const handleDeleteSale = () => {
    if (deleteSale) {
      deleteSaleMutation.mutate(deleteSale.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto py-8 px-4 page-with-navbar">
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

      <div className="container mx-auto py-8 px-4 page-with-navbar">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8" />
            Vendite
          </h1>
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-green-600">
            <Plus className="h-4 w-4 mr-2" />
            Registra Vendita
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Valore Totale Vendite</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSales)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Margine Totale</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalMargin)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Numero Vendite</p>
                <p className="text-2xl font-bold">{filteredSales.length}</p>
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
                <Label>Articolo</Label>
                <Input
                  placeholder="Cerca per nome..."
                  value={filters.articolo}
                  onChange={(e) => setFilters(prev => ({ ...prev, articolo: e.target.value }))}
                />
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
                <Label>Taglia</Label>
                <Input
                  placeholder="Cerca per taglia..."
                  value={filters.taglia}
                  onChange={(e) => setFilters(prev => ({ ...prev, taglia: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Incassato Da</Label>
                <Select value={filters.incassatoDa} onValueChange={(value) => setFilters(prev => ({ ...prev, incassatoDa: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti</SelectItem>
                    {activityMembers.map((member) => (
                      <SelectItem key={member.id} value={member.displayName}>
                        {member.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Incassato Su</Label>
                <Select value={filters.incassatoSu} onValueChange={(value) => setFilters(prev => ({ ...prev, incassatoSu: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti</SelectItem>
                    <SelectItem value="bonifico">Bonifico</SelectItem>
                    <SelectItem value="contanti">Contanti</SelectItem>
                    <SelectItem value="carta">Carta</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="vinted">Vinted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Table */}
        <Card>
          <CardHeader>
            <CardTitle>Storico Vendite</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSales.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Nessuna vendita registrata</h3>
                <p className="text-muted-foreground mb-4">
                  Inizia registrando la tua prima vendita
                </p>
                <Button onClick={() => setIsAddModalOpen(true)} className="bg-green-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Registra Prima Vendita
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Articolo</TableHead>
                      <TableHead>Taglia</TableHead>
                      <TableHead>Quantità</TableHead>
                      <TableHead>Prezzo Vendita</TableHead>
                      <TableHead>Incassato Da</TableHead>
                      <TableHead>Incassato Su</TableHead>
                      <TableHead>Margine</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale: Vendita) => (
                      <TableRow key={sale.id}>
                        <TableCell>{formatDate(sale.data.toString())}</TableCell>
                        <TableCell className="font-semibold">
                          {sale.nomeArticolo}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{sale.taglia}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.quantita}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(sale.prezzoVendita)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{sale.incassatoDa}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPaymentMethodVariant(sale.incassatoSu)}>
                            {sale.incassatoSu}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          {formatCurrency(sale.margine)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRepeatSale(sale)}
                              title="Ripeti vendita"
                              className="min-w-[36px] h-9 p-2"
                            >
                              <Repeat className="h-6 w-6 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingSale(sale)}
                              title="Modifica vendita"
                              className="min-w-[36px] h-9 p-2"
                            >
                              <Edit className="h-6 w-6 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteSale(sale)}
                              title="Elimina vendita"
                              className="min-w-[36px] h-9 p-2"
                            >
                              <Trash2 className="h-6 w-6 text-red-600" />
                            </Button>
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

        <AddSaleModal
          isOpen={isAddModalOpen || !!editingSale}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingSale(null);
          }}
          editingSale={editingSale}
        />

        {/* Repeat Sale Dialog */}
        <Dialog open={!!repeatSale} onOpenChange={() => setRepeatSale(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Ripeti Vendita</DialogTitle>
              <DialogDescription>
                Conferma per ripetere questa vendita con i dati originali.
              </DialogDescription>
            </DialogHeader>
            {repeatSale && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Articolo:</span> {repeatSale.nomeArticolo}
                  </div>
                  <div>
                    <span className="font-medium">Taglia:</span> {repeatSale.taglia}
                  </div>
                  <div>
                    <span className="font-medium">Quantità:</span> {repeatSale.quantita}
                  </div>
                  <div>
                    <span className="font-medium">Prezzo:</span> {formatCurrency(repeatSale.prezzoVendita)}
                  </div>
                  <div>
                    <span className="font-medium">Incassato Da:</span> {repeatSale.incassatoDa}
                  </div>
                  <div>
                    <span className="font-medium">Incassato Su:</span> {repeatSale.incassatoSu}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRepeatSale(null)}>
                Annulla
              </Button>
              <Button 
                onClick={handleRepeatSale}
                disabled={repeatSaleMutation.isPending}
              >
                {repeatSaleMutation.isPending ? "Ripetendo..." : "Conferma Ripetizione"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Sale Dialog */}
        <Dialog open={!!deleteSale} onOpenChange={() => setDeleteSale(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Elimina Vendita</DialogTitle>
              <DialogDescription>
                Sei sicuro di voler eliminare questa vendita? L'azione ripristinerà la quantità nell'inventario e non può essere annullata.
              </DialogDescription>
            </DialogHeader>
            {deleteSale && (
              <div className="grid gap-4 py-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Articolo:</span> {deleteSale.nomeArticolo}
                    </div>
                    <div>
                      <span className="font-medium">Taglia:</span> {deleteSale.taglia}
                    </div>
                    <div>
                      <span className="font-medium">Quantità:</span> {deleteSale.quantita}
                    </div>
                    <div>
                      <span className="font-medium">Prezzo:</span> {formatCurrency(deleteSale.prezzoVendita)}
                    </div>
                    <div>
                      <span className="font-medium">Data:</span> {formatDate(deleteSale.data.toString())}
                    </div>
                    <div>
                      <span className="font-medium">Margine:</span> {formatCurrency(deleteSale.margine)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteSale(null)}>
                Annulla
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteSale}
                disabled={deleteSaleMutation.isPending}
              >
                {deleteSaleMutation.isPending ? "Eliminando..." : "Elimina Vendita"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}