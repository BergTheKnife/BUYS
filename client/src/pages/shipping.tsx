import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, Plus, Filter, Edit, Trash2, Package, CheckCircle, Clock, ArrowUpDown, ArrowUp, ArrowDown, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Vendita } from "@shared/schema";
import { ImagePreview } from "@/components/ui/image-preview";

// Type for shipping data combining vendite and spedizioni
type ShippingItem = Vendita & {
  spedizione?: {
    id: string;
    speditoConsegnato: number;
    dataSpedizione: Date | null;
  } | null;
};

export default function Shipping() {
  const [filters, setFilters] = useState({
    articolo: "",
    cliente: "",
    stato: "tutti", // tutti, da_spedire, consegnato
    dataInizio: "",
    dataFine: "",
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Vendita | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [selectedSale, setSelectedSale] = useState<Vendita | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<"da_spedire" | "spedito">("da_spedire");
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sales with shipping data
  const { data: sales = [], isLoading } = useQuery<ShippingItem[]>({
    queryKey: ["/api/vendite-con-spedizioni"],
  });

  // Query per recuperare l'inventario per mostrare le immagini
  const { data: inventory = [] } = useQuery<any[]>({
    queryKey: ["/api/inventario"],
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "da_spedire": return "secondary";
      case "spedito": return "default";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "da_spedire": return "Da Spedire";
      case "spedito": return "Spedito";
      default: return "Da Spedire";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "da_spedire": return <Clock className="h-4 w-4" />;
      case "spedito": return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Sorting function
  const handleSort = (key: keyof Vendita) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: keyof Vendita) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ?
      <ArrowUp className="h-4 w-4" /> :
      <ArrowDown className="h-4 w-4" />;
  };

  // Filter only sales with customers (vendutoA not null) and apply filters
  const filteredAndSortedSales = sales
    .filter((sale: Vendita) => {
      // Only show sales with customer info
      if (!sale.vendutoA) return false;

      // Filtro articolo
      if (filters.articolo && filters.articolo.trim() !== "") {
        if (!sale.nomeArticolo.toLowerCase().includes(filters.articolo.toLowerCase().trim())) {
          return false;
        }
      }

      // Filtro cliente
      if (filters.cliente && filters.cliente.trim() !== "") {
        if (!sale.vendutoA.toLowerCase().includes(filters.cliente.toLowerCase().trim())) {
          return false;
        }
      }

      // Filtro stato spedizione
      if (filters.stato && filters.stato !== "tutti") {
        const speditoConsegnato = (sale as ShippingItem).spedizione?.speditoConsegnato || 0;
        const saleStatus = speditoConsegnato === 1 ? "spedito" : "da_spedire";
        if (saleStatus !== filters.stato) {
          return false;
        }
      }

      // Filtro data inizio
      if (filters.dataInizio && filters.dataInizio.trim() !== "") {
        const saleDate = new Date(sale.data);
        const startDate = new Date(filters.dataInizio);
        startDate.setHours(0, 0, 0, 0);
        saleDate.setHours(0, 0, 0, 0);
        if (saleDate < startDate) {
          return false;
        }
      }

      // Filtro data fine
      if (filters.dataFine && filters.dataFine.trim() !== "") {
        const saleDate = new Date(sale.data);
        const endDate = new Date(filters.dataFine);
        saleDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        if (saleDate > endDate) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Convert dates to comparable format
      if (sortConfig.key === 'data') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }

      // Convert numbers for proper comparison
      if (sortConfig.key === 'prezzoVendita' || sortConfig.key === 'margine' || sortConfig.key === 'quantita') {
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

  // Update shipping status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ spedizioneId, status }: { spedizioneId: string, status: string }) => {
      const speditoConsegnato = status === "spedito" ? 1 : 0;
      const response = await apiRequest("PUT", `/api/spedizioni/${spedizioneId}`, {
        speditoConsegnato,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendite-con-spedizioni"] });
      toast({
        title: "Successo",
        description: "Stato spedizione aggiornato con successo",
      });
      setShowStatusDialog(false);
      setSelectedSale(null);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiornamento dello stato",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = () => {
    if (selectedSale && (selectedSale as ShippingItem).spedizione) {
      updateStatusMutation.mutate({
        spedizioneId: (selectedSale as ShippingItem).spedizione!.id,
        status: newStatus,
      });
    }
  };

  // Calculate stats
  const daSpedire = filteredAndSortedSales.filter(sale => !sale.spedizione || sale.spedizione.speditoConsegnato === 0).length;
  const spediti = filteredAndSortedSales.filter(sale => sale.spedizione && sale.spedizione.speditoConsegnato === 1).length;

  if (isLoading) {
    return (
      <div className="page-with-navbar bg-gray-50 dark:bg-gray-900">
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
    <div className="page-with-navbar bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-6 px-4 container-with-navbar">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-8 w-8" />
            Spedizioni e Consegne
          </h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Totale Ordini</p>
                <p className="text-2xl font-bold text-blue-600">{filteredAndSortedSales.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Da Spedire</p>
                <p className="text-2xl font-bold text-orange-600">{daSpedire}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Spediti</p>
                <p className="text-2xl font-bold text-green-600">{spediti}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Articolo</Label>
                <Input
                  placeholder="Cerca per nome..."
                  value={filters.articolo}
                  onChange={(e) => setFilters(prev => ({ ...prev, articolo: e.target.value }))}
                  data-testid="input-filter-articolo"
                />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input
                  placeholder="Cerca cliente..."
                  value={filters.cliente}
                  onChange={(e) => setFilters(prev => ({ ...prev, cliente: e.target.value }))}
                  data-testid="input-filter-cliente"
                />
              </div>
              <div className="space-y-2">
                <Label>Stato</Label>
                <Select value={filters.stato} onValueChange={(value) => setFilters(prev => ({ ...prev, stato: value }))}>
                  <SelectTrigger data-testid="select-filter-stato">
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti</SelectItem>
                    <SelectItem value="da_spedire">Da Spedire</SelectItem>
                    <SelectItem value="spedito">Spedito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Inizio</Label>
                <Input
                  type="date"
                  value={filters.dataInizio}
                  onChange={(e) => setFilters(prev => ({ ...prev, dataInizio: e.target.value }))}
                  data-testid="input-filter-data-inizio"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fine</Label>
                <Input
                  type="date"
                  value={filters.dataFine}
                  onChange={(e) => setFilters(prev => ({ ...prev, dataFine: e.target.value }))}
                  data-testid="input-filter-data-fine"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Table */}
        <Card>
          <CardHeader>
            <CardTitle>Gestione Spedizioni</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAndSortedSales.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Nessuna spedizione trovata</h3>
                <p className="text-muted-foreground">
                  Non ci sono vendite con clienti che richiedono spedizione
                </p>
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
                          Data Vendita
                          {getSortIcon('data')}
                        </button>
                      </TableHead>
                      <TableHead>Immagine</TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('nomeArticolo')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Articolo
                          {getSortIcon('nomeArticolo')}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('taglia')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Taglia
                          {getSortIcon('taglia')}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('quantita')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Quantità
                          {getSortIcon('quantita')}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('vendutoA')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Cliente
                          {getSortIcon('vendutoA')}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('prezzoVendita')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Valore
                          {getSortIcon('prezzoVendita')}
                        </button>
                      </TableHead>
                      <TableHead>Stato Spedizione</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedSales.map((sale: ShippingItem) => {
                      const speditoConsegnato = sale.spedizione?.speditoConsegnato || 0;
                      const status = speditoConsegnato === 1 ? "spedito" : "da_spedire";
                      
                      // Trova l'articolo corrispondente nell'inventario per mostrare l'immagine
                      const correspondingItem = inventory.find((item: any) => 
                        item.id === sale.inventarioId || 
                        (item.nomeArticolo === sale.nomeArticolo && item.taglia === sale.taglia)
                      );
                      
                      return (
                        <TableRow key={sale.id}>
                          <TableCell>{formatDate(sale.data.toString())}</TableCell>
                          <TableCell>
                            {correspondingItem?.immagineUrl ? (
                              <img
                                src={correspondingItem.immagineUrl}
                                alt={sale.nomeArticolo}
                                className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setPreviewImage({ src: correspondingItem.immagineUrl || "", alt: sale.nomeArticolo })}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">{sale.nomeArticolo}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sale.taglia || "N/A"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{sale.quantita}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-blue-600">
                            {sale.vendutoA}
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(sale.prezzoVendita)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(status)} className="flex items-center gap-1 w-fit">
                              {getStatusIcon(status)}
                              {getStatusLabel(status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSale(sale);
                                setNewStatus(status === "da_spedire" ? "spedito" : "da_spedire");
                                setShowStatusDialog(true);
                              }}
                              data-testid={`button-update-status-${sale.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Aggiorna
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Update Dialog */}
        <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiorna Stato Spedizione</DialogTitle>
              <DialogDescription>
                Cambia lo stato di spedizione per questo ordine.
              </DialogDescription>
            </DialogHeader>
            
            {selectedSale && (
              <div className="py-4">
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p><strong>Articolo:</strong> {selectedSale.nomeArticolo}</p>
                  <p><strong>Cliente:</strong> {selectedSale.vendutoA}</p>
                  <p><strong>Valore:</strong> {formatCurrency(selectedSale.prezzoVendita)}</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Nuovo Stato</Label>
                  <Select value={newStatus} onValueChange={(value) => setNewStatus(value as "da_spedire" | "spedito")}>
                    <SelectTrigger data-testid="select-new-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="da_spedire">Da Spedire</SelectItem>
                      <SelectItem value="spedito">Spedito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleStatusUpdate}
                disabled={updateStatusMutation.isPending}
                data-testid="button-confirm-status"
              >
                {updateStatusMutation.isPending ? "Aggiornamento..." : "Aggiorna Stato"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Image Preview */}
        <ImagePreview
          src={previewImage?.src || ""}
          alt={previewImage?.alt || ""}
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
        />
      </div>
    </div>
  );
}