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
import { Package, Plus, Edit, Trash2, ImageIcon, PackagePlus, Filter } from "lucide-react";
import type { Inventario } from "@shared/schema";
import { useActionHistory } from "@/hooks/use-action-history";
import { ActionHistoryControls } from "@/components/ui/action-history-controls";

export default function Inventory() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Inventario | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Inventario | null>(null);
  const [restockItem, setRestockItem] = useState<Inventario | null>(null);
  const [restockQuantity, setRestockQuantity] = useState("1");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentActivity } = useAuth();
  const { addAction, undo, redo, canUndo, canRedo } = useActionHistory('inventory');

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

  // Applica i filtri all'inventario
  const filteredInventory = useMemo(() => {
    return inventory.filter((item: Inventario) => {
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
    });
  }, [inventory, filters]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Salva i dati dell'articolo prima di eliminarlo per l'undo
      const itemToDelete = inventory?.find((item: any) => item.id === id);
      if (itemToDelete) {
        addAction({
          description: `Eliminato: ${itemToDelete.nomeArticolo} - ${itemToDelete.taglia}`,
          data: itemToDelete,
          action: 'delete',
          entityType: 'inventory'
        });
      }

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
    mutationFn: async ({ id, quantita }: { id: string; quantita: number }) => {
      const response = await apiRequest("POST", `/api/inventario/${id}/restock`, { quantita });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spese"] });
      toast({
        title: "Successo",
        description: "Rifornimento completato con successo",
      });
      setRestockItem(null);
      setRestockQuantity("1");
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
        quantita: parseInt(restockQuantity) 
      });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo articolo?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleUndo = async () => {
    const actionToUndo = await undo();
    if (actionToUndo) {
      if (actionToUndo.action === 'delete' && actionToUndo.entityType === 'inventory') {
        // Ricrea l'articolo eliminato
        try {
          const formData = new FormData();
          formData.append('nomeArticolo', actionToUndo.data.nomeArticolo);
          formData.append('taglia', actionToUndo.data.taglia);
          formData.append('costo', actionToUndo.data.costo);
          formData.append('quantita', actionToUndo.data.quantita.toString());

          await apiRequest("POST", "/api/inventario", formData);
          queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
          queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

          toast({
            title: "Azione annullata",
            description: `Articolo "${actionToUndo.data.nomeArticolo}" ripristinato`,
          });
        } catch (error: any) {
          toast({
            title: "Errore",
            description: "Impossibile annullare l'azione",
            variant: "destructive",
          });
        }
      }
    }
  };

  const handleRedo = async () => {
    const actionToRedo = await redo();
    if (actionToRedo) {
      // Implementa la logica di redo se necessario
      toast({
        title: "Azione ripetuta",
        description: actionToRedo.description,
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

      <div className="container mx-auto py-6 px-4 page-with-navbar container-with-navbar">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              Magazzino
            </h1>
            <ActionHistoryControls 
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
          </div>
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
                      <TableHead>Nome Articolo</TableHead>
                      <TableHead>Taglia</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead>Quantità</TableHead>
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
                              className="w-16 h-16 object-cover rounded-lg"
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
                Costo per pezzo: {restockItem && formatCurrency(restockItem.costo)}
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
              {restockItem && (
                <div className="text-sm text-muted-foreground">
                  <p>Quantità attuale: {restockItem.quantita}</p>
                  <p>Nuova quantità: {restockItem.quantita + parseInt(restockQuantity || "0")}</p>
                  <p>Costo rifornimento: {formatCurrency(Number(restockItem.costo) * parseInt(restockQuantity || "0"))}</p>
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
      </div>
    </div>
  );
}