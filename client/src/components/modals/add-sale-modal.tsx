import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertVenditaSchema } from "@shared/schema";
import type { InsertVendita, Inventario, Vendita } from "@shared/schema";
import { z } from "zod";
import { capitalizeWords } from "@/lib/utils";
import { useActionHistory } from "@/hooks/use-action-history";
import { Calculator } from "lucide-react";

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSale?: Vendita | null;
}

const saleFormSchema = insertVenditaSchema.extend({
  data: z.string().min(1, "Data richiesta"),
});

type SaleFormData = z.infer<typeof saleFormSchema>;

interface BatchDetail {
  batchId: string | null;
  costoUnitario: number;
  quantitaUsata: number;
  marginePartial: number;
  dataAcquisto?: string;
}

interface SalePreview {
  margineTotal: number;
  batchDetails: BatchDetail[];
}

export function AddSaleModal({ isOpen, onClose, editingSale }: AddSaleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addAction } = useActionHistory('sales');
  const [salePreview, setSalePreview] = useState<SalePreview | null>(null);
  const [isCalculatingPreview, setIsCalculatingPreview] = useState(false);

  const { data: inventory = [] } = useQuery<Inventario[]>({
    queryKey: ["/api/inventario"],
    enabled: isOpen,
  });

  // Fetch activity members for "incassato da" dropdown
  const { data: activityMembers = [] } = useQuery<Array<{
    id: string;
    nome: string;
    cognome: string;
    displayName: string;
  }>>({
    queryKey: ["/api/activity-members"],
    enabled: isOpen,
  });

  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      inventarioId: "",
      quantita: 1,
      prezzoVendita: "0",
      incassatoDa: "",
      incassatoSu: "",
      data: new Date().toISOString().split('T')[0],
    },
  });

  // Reset form when editingSale changes
  React.useEffect(() => {
    if (editingSale) {
      form.reset({
        inventarioId: editingSale.inventarioId,
        quantita: editingSale.quantita,
        prezzoVendita: editingSale.prezzoVendita.toString(),
        incassatoDa: editingSale.incassatoDa,
        incassatoSu: editingSale.incassatoSu,
        data: new Date(editingSale.data).toISOString().split('T')[0],
      });
    } else {
      form.reset({
        inventarioId: "",
        quantita: 1,
        prezzoVendita: "0",
        incassatoDa: "",
        incassatoSu: "",
        data: new Date().toISOString().split('T')[0],
      });
    }
  }, [editingSale, form]);

  const selectedItem = inventory.find((item: Inventario) => item.id === form.watch("inventarioId"));

  // Watch form values for preview calculation
  const watchedValues = form.watch();
  const { inventarioId, quantita, prezzoVendita } = watchedValues;

  // Calculate preview when relevant values change
  useEffect(() => {
    const calculatePreview = async () => {
      if (!inventarioId || !quantita || !prezzoVendita || quantita <= 0 || Number(prezzoVendita) <= 0 || editingSale) {
        setSalePreview(null);
        return;
      }

      setIsCalculatingPreview(true);
      try {
        const response = await apiRequest("POST", "/api/vendite/preview", {
          inventarioId,
          quantita: parseInt(quantita.toString()),
          prezzoVendita: prezzoVendita
        });
        const previewData = await response.json();
        setSalePreview(previewData);
      } catch (error) {
        console.error('Preview calculation failed:', error);
        setSalePreview(null);
      } finally {
        setIsCalculatingPreview(false);
      }
    };

    const timeoutId = setTimeout(calculatePreview, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [inventarioId, quantita, prezzoVendita, editingSale]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const mutation = useMutation({
    mutationFn: async (data: SaleFormData) => {
      console.log('Sale form data being sent:', data);
      const method = editingSale ? "PUT" : "POST";
      const url = editingSale ? `/api/vendite/${editingSale.id}` : "/api/vendite";

      const response = await apiRequest(method, url, {
        inventarioId: data.inventarioId,
        quantita: data.quantita,
        prezzoVendita: data.prezzoVendita,
        incassatoDa: data.incassatoDa,
        incassatoSu: data.incassatoSu,
        data: data.data,
      });
      return response.json();
    },
    onSuccess: (result: any) => {
      // Registra l'azione per undo/redo
      const itemName = selectedItem ? `${selectedItem.nomeArticolo} - ${selectedItem.taglia}` : 'Articolo';

      if (editingSale) {
        // Update operation - salva i dati precedenti  
        addAction({
          description: `Modificata vendita: ${itemName}`,
          data: { ...result, nomeArticolo: itemName.split(' - ')[0], taglia: itemName.split(' - ')[1] },
          previousData: { ...editingSale, nomeArticolo: itemName.split(' - ')[0], taglia: itemName.split(' - ')[1] },
          action: 'update',
          entityType: 'sale'
        });
      } else {
        // Create operation
        addAction({
          description: `Creata vendita: ${itemName}`,
          data: { ...result, nomeArticolo: itemName.split(' - ')[0], taglia: itemName.split(' - ')[1] },
          action: 'create',
          entityType: 'sale'
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/vendite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Successo",
        description: editingSale ? "Vendita aggiornata con successo" : "Vendita registrata con successo",
      });
      onClose();
      form.reset({
        inventarioId: "",
        quantita: 1,
        prezzoVendita: "0",
        incassatoDa: "",
        incassatoSu: "",
        data: new Date().toISOString().split('T')[0],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella registrazione della vendita",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SaleFormData) => {
    console.log('Sale form submitted with data:', data);
    console.log('Sale form errors:', form.formState.errors);
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSale ? "Modifica Vendita" : "Registra Vendita"}</DialogTitle>
          <DialogDescription>
            {editingSale 
              ? "Modifica i dettagli della vendita selezionata."
              : "Seleziona un articolo e inserisci i dettagli della vendita."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="inventarioId">Articolo</Label>
            <Select 
              value={form.watch("inventarioId")} 
              onValueChange={(value) => form.setValue("inventarioId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona articolo" />
              </SelectTrigger>
              <SelectContent>
                {inventory
                  .filter((item: Inventario) => item.quantita > 0)
                  .map((item: Inventario) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nomeArticolo} - {item.taglia} (Qta: {item.quantita})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.inventarioId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.inventarioId.message}
              </p>
            )}
          </div>

          {selectedItem && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Costo medio articolo:</strong> {formatCurrency(Number(selectedItem.costo))}
              </p>
              <p className="text-sm">
                <strong>Quantità disponibile:</strong> {selectedItem.quantita}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantita">Quantità Venduta</Label>
            <Input
              id="quantita"
              type="number"
              min="1"
              max={selectedItem?.quantita || 1}
              {...form.register("quantita", { valueAsNumber: true })}
            />
            {form.formState.errors.quantita && (
              <p className="text-sm text-destructive">
                {form.formState.errors.quantita.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prezzoVendita">Prezzo Vendita (€)</Label>
            <Input
              id="prezzoVendita"
              type="number"
              step="0.01"
              placeholder="25.00"
              {...form.register("prezzoVendita")}
            />
            {form.formState.errors.prezzoVendita && (
              <p className="text-sm text-destructive">
                {form.formState.errors.prezzoVendita.message}
              </p>
            )}
          </div>

          {/* Sale Preview */}
          {!editingSale && salePreview && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calculator className="h-4 w-4" />
                  Calcolo Margine FIFO
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Questo calcolo mostra esattamente quali lotti verranno utilizzati per questa vendita
                </div>
                
                {salePreview.batchDetails.map((batch, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        Lotto {index + 1} {batch.batchId ? `(ID: ${batch.batchId.slice(-8)})` : '(Costo medio)'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {batch.quantitaUsata} pz × {formatCurrency(batch.costoUnitario)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${batch.marginePartial >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(batch.marginePartial)}
                      </div>
                      <div className="text-xs text-muted-foreground">margine</div>
                    </div>
                  </div>
                ))}
                
                <Separator />
                
                <div className="flex justify-between items-center font-medium">
                  <span>Margine Totale:</span>
                  <span className={`text-lg ${salePreview.margineTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(salePreview.margineTotal)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {isCalculatingPreview && !editingSale && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calculator className="h-4 w-4 animate-pulse" />
                Calcolo margine in corso...
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="incassatoDa">Incassato Da</Label>
            <Select 
              value={form.watch("incassatoDa")} 
              onValueChange={(value) => form.setValue("incassatoDa", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona persona" />
              </SelectTrigger>
              <SelectContent>
                {activityMembers.map((member) => (
                  <SelectItem key={member.id} value={member.displayName}>
                    {member.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.incassatoDa && (
              <p className="text-sm text-destructive">
                {form.formState.errors.incassatoDa.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="incassatoSu">Incassato Su</Label>
            <Select 
              value={form.watch("incassatoSu")} 
              onValueChange={(value) => form.setValue("incassatoSu", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona metodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Contanti">Contanti</SelectItem>
                <SelectItem value="Carta">Carta</SelectItem>
                <SelectItem value="Bonifico">Bonifico</SelectItem>
                <SelectItem value="PayPal">PayPal</SelectItem>
                <SelectItem value="Vinted">Vinted</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.incassatoSu && (
              <p className="text-sm text-destructive">
                {form.formState.errors.incassatoSu.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              {...form.register("data")}
            />
            {form.formState.errors.data && (
              <p className="text-sm text-destructive">
                {form.formState.errors.data.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {mutation.isPending ? "Registrando..." : "Registra Vendita"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}