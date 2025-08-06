import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, Edit, Trash2, ImageIcon, PackagePlus } from "lucide-react";
import type { Inventario } from "@shared/schema";

export default function Inventory() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Inventario | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Inventario | null>(null);
  const [restockItem, setRestockItem] = useState<Inventario | null>(null);
  const [restockQuantity, setRestockQuantity] = useState("1");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentActivity } = useAuth();

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/inventario/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Successo",
        description: "Articolo eliminato con successo",
      });
      setItemToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione",
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
            <Package className="h-8 w-8" />
            Magazzino
          </h1>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi Articolo
          </Button>
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
                    {inventory.map((item: Inventario) => (
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
                            >
                              <PackagePlus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingItem(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setItemToDelete(item)}
                            >
                              <Trash2 className="h-4 w-4" />
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
