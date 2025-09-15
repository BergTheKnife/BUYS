import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";
import { AddItemModal } from "@/components/modals/add-item-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Package, Plus, Edit, Trash2, ImageIcon, PackagePlus, Filter, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import type { Inventario } from "@shared/schema";
// Hook undo/redo rimosso
import { ImagePreview } from "@/components/ui/image-preview";

export default function Inventory() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Inventario | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Inventario | null>(null);
  const [restockItem, setRestockItem] = useState<Inventario | null>(null);
  const [restockQuantity, setRestockQuantity] = useState("1");
  const [restockNewCost, setRestockNewCost] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Inventario | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentActivity } = useAuth();
  // Hook undo/redo rimosso
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  
  // Toggle per nascondere articoli terminati
  const [hideOutOfStock, setHideOutOfStock] = useState(false);

  // Filtri
  const [filters, setFilters] = useState({
    nomeArticolo: "",
    taglia: "",
    costoMin: "",
    costoMax: "",
    quantitaMin: "",
    quantitaMax: "",
    disponibilita: "tutti" // tutti, disponibili, esauriti, scorte_basse
  });

  // Force refetch when currentActivity changes
  useEffect(() => {
    if (currentActivity) {
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
    }
  }, [currentActivity?.id, queryClient]);

  const { data: inventory = [], isLoading } = useQuery<Inventario[]>({
    queryKey: ["/api/inventario"],
    enabled: !!currentActivity?.id,
  });

  // Query per ottenere le vendite per calcolare le quantità vendute
  const { data: sales = [] } = useQuery<any[]>({
    queryKey: ["/api/vendite"],
    enabled: !!currentActivity?.id,
  });

  // Sorting function
  const handleSort = (key: keyof Inventario) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: keyof Inventario) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  // Calcola le quantità vendute per ogni articolo
  const soldQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    
    sales.forEach((sale: any) => {
      const key = `${sale.nomeArticolo}-${sale.taglia}`;
      const currentSold = quantities.get(key) || 0;
      quantities.set(key, currentSold + sale.quantita);
    });
    
    return quantities;
  }, [sales]);

  // Applica i filtri e ordinamento all'inventario
  const filteredInventory = useMemo(() => {
    return inventory.filter((item: Inventario) => {
      // Filtro per articoli terminati
      if (hideOutOfStock && item.quantita === 0) {
        return false;
      }

      // Filtro per nome articolo
      if (filters.nomeArticolo && !item.nomeArticolo.toLowerCase().includes(filters.nomeArticolo.toLowerCase())) {
        return false;
      }

      // Filtro per taglia
      if (filters.taglia && !item.taglia.toLowerCase().includes(filters.taglia.toLowerCase())) {
        return false;
      }

      // Filtro per costo minimo
      if (filters.costoMin && Number(item.costo) < Number(filters.costoMin)) {
        return false;
      }

      // Filtro per costo massimo
      if (filters.costoMax && Number(item.costo) > Number(filters.costoMax)) {
        return false;
      }

      // Filtro per quantità minima
      if (filters.quantitaMin && item.quantita < Number(filters.quantitaMin)) {
        return false;
      }

      // Filtro per quantità massima
      if (filters.quantitaMax && item.quantita > Number(filters.quantitaMax)) {
        return false;
      }

      // Filtro per disponibilità
      if (filters.disponibilita === "disponibili" && item.quantita === 0) {
        return false;
      }
      if (filters.disponibilita === "esauriti" && item.quantita > 0) {
        return false;
      }
      if (filters.disponibilita === "scorte_basse" && item.quantita > 3) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Convert numbers for proper comparison
      if (sortConfig.key === 'costo' || sortConfig.key === 'quantita') {
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
  }, [inventory, filters, sortConfig, hideOutOfStock]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/inventario/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Successo",
        description: "Articolo eliminato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione dell'articolo",
        variant: "destructive",
      });
    },
  });

  const restockMutation = useMutation({
    mutationFn: async ({ id, quantita, costo }: { id: string; quantita: number; costo?: string }) => {
      const response = await apiRequest("POST", `/api/inventario/${id}/restock`, { quantita, costo });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spese"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cassa-reinvestimento-balance"] });
      toast({
        title: "Successo",
        description: "Rifornimento completato con successo",
      });
      setRestockItem(null);
      setRestockQuantity("1");
      setRestockNewCost("");
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel rifornimento",
        variant: "destructive",
      });
    },
  });

  const handleRestock = () => {
    if (restockItem && restockQuantity) {
      restockMutation.mutate({ 
        id: restockItem.id, 
        quantita: parseInt(restockQuantity),
        costo: restockNewCost || undefined
      });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo articolo?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleExcelDownload = async () => {
    try {
      const response = await apiRequest("GET", "/api/export/inventory/excel");
      
      if (!response.ok) {
        throw new Error("Errore nel download del file Excel");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
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




  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(amount));
  };

  const getQuantityVariant = (quantity: number) => {
    if (quantity === 0) return "destructive";
    if (quantity <= 3) return "secondary";
    if (quantity <= 10) return "default";
    return "default";
  };

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
      <Navbar />

      <div className="container mx-auto py-6 px-4 container-with-navbar">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Magazzino
          </h1>
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600">
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi Articolo
          </Button>
        </div>

        {/* Filtri */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mobile-first layout with proper spacing */}
            <div className="space-y-4">
              {/* Prima riga - Ricerca principale */}
              <div className="space-y-2">
                <Label>Nome Articolo</Label>
                <Input
                  placeholder="Cerca per nome..."
                  value={filters.nomeArticolo}
                  onChange={(e) => setFilters(prev => ({ ...prev, nomeArticolo: e.target.value }))}
                  className="w-full"
                />
              </div>

              {/* Seconda riga - Taglia e Disponibilità */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Taglia</Label>
                  <Input
                    placeholder="Cerca per taglia..."
                    value={filters.taglia}
                    onChange={(e) => setFilters(prev => ({ ...prev, taglia: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Disponibilità</Label>
                  <Select value={filters.disponibilita} onValueChange={(value) => setFilters(prev => ({ ...prev, disponibilita: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tutti" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tutti">Tutti</SelectItem>
                      <SelectItem value="disponibili">Disponibili</SelectItem>
                      <SelectItem value="esauriti">Esauriti</SelectItem>
                      <SelectItem value="scorte_basse">Scorte Basse (≤3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Terza riga - Range Costi */}
              <div className="space-y-2">
                <Label>Range Costi</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="€ Min"
                    value={filters.costoMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, costoMin: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="€ Max"
                    value={filters.costoMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, costoMax: e.target.value }))}
                  />
                </div>
              </div>

              {/* Quarta riga - Range Quantità */}
              <div className="space-y-2">
                <Label>Range Quantità</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Qta Min"
                    value={filters.quantitaMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, quantitaMin: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="Qta Max"
                    value={filters.quantitaMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, quantitaMax: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Azioni e risultati */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => setFilters({
                  nomeArticolo: "",
                  taglia: "",
                  costoMin: "",
                  costoMax: "",
                  quantitaMin: "",
                  quantitaMax: "",
                  disponibilita: "tutti"
                })}
                className="w-full sm:w-auto"
              >
                Cancella Filtri
              </Button>
              <div className="text-sm text-muted-foreground text-center sm:text-left">
                Risultati: <span className="font-medium">{filteredInventory.length}</span> di <span className="font-medium">{inventory.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Toggle per nascondere articoli terminati */}
        <div className="flex items-center space-x-3 mb-4">
          <Switch
            id="hide-out-of-stock"
            checked={hideOutOfStock}
            onCheckedChange={setHideOutOfStock}
          />
          <Label htmlFor="hide-out-of-stock" className="text-sm font-medium">
            Nascondi articoli terminati
          </Label>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inventario Articoli</CardTitle>
          </CardHeader>
          <CardContent>
            {inventory.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Nessun articolo presente</h3>
                <p className="text-muted-foreground mb-4">
                  Inizia aggiungendo il tuo primo articolo al magazzino
                </p>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Primo Articolo
                </Button>
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Nessun articolo trovato</h3>
                <p className="text-muted-foreground mb-4">
                  Prova a modificare i filtri per trovare gli articoli desiderati
                </p>
                <Button 
                  variant="outline"
                  onClick={() => setFilters({
                    nomeArticolo: "",
                    taglia: "",
                    costoMin: "",
                    costoMax: "",
                    quantitaMin: "",
                    quantitaMax: "",
                    disponibilita: "tutti"
                  })}
                >
                  Cancella Filtri
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Immagine</TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('nomeArticolo')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Nome Articolo
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
                          onClick={() => handleSort('costo')}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          Costo
                          {getSortIcon('costo')}
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
                      <TableHead>Vendute</TableHead>
                      <TableHead>Valore Totale</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item: Inventario) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.immagineUrl ? (
                            <img
                              src={item.immagineUrl}
                              alt={item.nomeArticolo}
                              className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setPreviewImage({ src: item.immagineUrl || "", alt: item.nomeArticolo })}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {item.nomeArticolo}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.taglia}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(item.costo)}</TableCell>
                        <TableCell>
                          <Badge variant={getQuantityVariant(item.quantita)}>
                            {item.quantita}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-green-600">
                            {soldQuantities.get(`${item.nomeArticolo}-${item.taglia}`) || 0}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(Number(item.costo) * item.quantita)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRestockItem(item)}
                              title="Rifornisci"
                              className="min-w-[36px] h-9 p-2"
                            >
                              <PackagePlus className="h-6 w-6 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingItem(item)}
                              title="Modifica"
                              className="min-w-[36px] h-9 p-2"
                            >
                              <Edit className="h-6 w-6 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setItemToDelete(item)}
                              title="Elimina"
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

        {/* Pulsante Excel in fondo alla pagina */}
        {inventory.length > 0 && (
          <div className="flex justify-center mt-6">
            <Button onClick={handleExcelDownload} variant="outline" className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
              <Download className="h-4 w-4 mr-2" />
              Scarica Excel
            </Button>
          </div>
        )}

        <AddItemModal
          isOpen={isAddModalOpen || !!editingItem}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingItem(null);
          }}
          editingItem={editingItem}
        />

        <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare "{itemToDelete?.nomeArticolo}"? 
                Questa azione non può essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
                disabled={deleteMutation.isPending}
              >
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!restockItem} onOpenChange={() => setRestockItem(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Rifornisci Articolo</DialogTitle>
              <DialogDescription>
                Aggiungi quantità per "{restockItem?.nomeArticolo} - {restockItem?.taglia}".
                <br />
                Costo attuale per pezzo: {restockItem && formatCurrency(restockItem.costo)}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="quantity" className="text-right">
                  Quantità
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="newCost" className="text-right">
                  Nuovo Costo
                </Label>
                <Input
                  id="newCost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={restockItem?.costo}
                  value={restockNewCost}
                  onChange={(e) => setRestockNewCost(e.target.value)}
                  className="col-span-3"
                />
              </div>
              {restockItem && (
                <div className="text-sm text-muted-foreground">
                  <p>Quantità attuale: {restockItem.quantita}</p>
                  <p>Nuova quantità: {restockItem.quantita + parseInt(restockQuantity || "0")}</p>
                  <p>Costo per pezzo: {formatCurrency(Number(restockNewCost || restockItem.costo))}</p>
                  <p>Costo rifornimento: {formatCurrency(Number(restockNewCost || restockItem.costo) * parseInt(restockQuantity || "0"))}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestockItem(null)}>
                Annulla
              </Button>
              <Button 
                onClick={handleRestock}
                disabled={restockMutation.isPending || !restockQuantity || parseInt(restockQuantity) <= 0}
              >
                {restockMutation.isPending ? "Rifornendo..." : "Rifornisci"}
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