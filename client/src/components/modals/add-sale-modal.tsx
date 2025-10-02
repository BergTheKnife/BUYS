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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertVenditaSchema } from "@shared/schema";
import type { InsertVendita, Inventario, Vendita } from "@shared/schema";
import { z } from "zod";
import { capitalizeWords } from "@/lib/utils";
import { Calculator } from "lucide-react";

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSale?: Vendita | null;
}

const saleFormSchema = z.object({
  inventarioId: z.string().optional(),
  productionProductId: z.string().optional(),
  quantita: z.number().min(1, "Quantità richiesta"),
  prezzoVendita: z.string().min(1, "Prezzo richiesto"),
  vendutoA: z.string().optional(),
  incassato: z.number(),
  incassatoDa: z.string().optional(),
  incassatoSu: z.string().optional(),
  data: z.string().min(1, "Data richiesta"),
  origine: z.string().default("magazzino"),
}).refine((data) => {
  // Se origine è magazzino, richiedi inventarioId
  if (data.origine === "magazzino" && !data.inventarioId) {
    return false;
  }
  // Se origine è vetrina, richiedi productionProductId
  if (data.origine === "vetrina" && !data.productionProductId) {
    return false;
  }
  return true;
}, {
  message: "Seleziona un articolo",
  path: ["inventarioId"],
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

type VetrinaProduct = {
  id: string; nome: string; categoria?: string; costoOverride?: string;
  imageUrl?: string; bom?: any[];
};

export function AddSaleModal({ isOpen, onClose, editingSale }: AddSaleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [salePreview, setSalePreview] = useState<SalePreview | null>(null);
  const [isCalculatingPreview, setIsCalculatingPreview] = useState(false);
  const [origine, setOrigine] = useState<"magazzino" | "vetrina">("magazzino");

  const { data: inventory = [] } = useQuery<Inventario[]>({
    queryKey: ["/api/inventario"],
    enabled: isOpen && origine === "magazzino",
  });

  const { data: vetrinaProducts = [] } = useQuery<VetrinaProduct[]>({
    queryKey: ["/api/production/vetrina"],
    enabled: isOpen && origine === "vetrina",
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
      productionProductId: undefined,
      quantita: 1,
      prezzoVendita: "0",
      vendutoA: undefined,
      incassato: 0,
      incassatoDa: "",
      incassatoSu: "",
      data: new Date().toISOString().split('T')[0],
      origine: "magazzino",
    },
  });

  // Reset form when editingSale changes
  React.useEffect(() => {
    if (editingSale) {
      const editOrigine = editingSale.origine || "magazzino";
      setOrigine(editOrigine as "magazzino" | "vetrina");
      form.reset({
        inventarioId: editingSale.inventarioId,
        productionProductId: (editingSale as any).productionProductId,
        quantita: editingSale.quantita,
        prezzoVendita: editingSale.prezzoVendita.toString(),
        vendutoA: editingSale.vendutoA ?? undefined,
        incassato: editingSale.incassato ?? 0,
        incassatoDa: editingSale.incassatoDa ?? undefined,
        incassatoSu: editingSale.incassatoSu ?? undefined,
        data: new Date(editingSale.data).toISOString().split('T')[0],
        origine: editOrigine,
      });
    } else {
      form.reset({
        inventarioId: "",
        productionProductId: undefined,
        quantita: 1,
        prezzoVendita: "0",
        vendutoA: undefined,
        incassato: 0,
        incassatoDa: "",
        incassatoSu: "",
        data: new Date().toISOString().split('T')[0],
        origine: "magazzino",
      });
      setOrigine("magazzino");
    }
  }, [editingSale, form]);

  const selectedItem = origine === "magazzino" 
    ? inventory.find((item: Inventario) => item.id === form.watch("inventarioId"))
    : null;

  const selectedVetrina = origine === "vetrina"
    ? vetrinaProducts.find(p => p.id === form.watch("productionProductId"))
    : null;

  // Watch form values for preview calculation
  const watchedValues = form.watch();
  const { inventarioId, productionProductId, quantita, prezzoVendita } = watchedValues;

  // Calculate preview when relevant values change
  useEffect(() => {
    const calculatePreview = async () => {
      // Skip if editing or missing required data
      if (editingSale || !quantita || !prezzoVendita || quantita <= 0 || Number(prezzoVendita) <= 0) {
        setSalePreview(null);
        return;
      }

      // For magazzino, need inventarioId
      if (origine === "magazzino" && !inventarioId) {
        setSalePreview(null);
        return;
      }

      // For vetrina, need productionProductId
      if (origine === "vetrina" && !productionProductId) {
        setSalePreview(null);
        return;
      }

      setIsCalculatingPreview(true);
      try {
        let response;
        if (origine === "magazzino") {
          response = await apiRequest("POST", "/api/vendite/preview", {
            inventarioId,
            quantita: parseInt(quantita.toString()),
            prezzoVendita: prezzoVendita
          });
        } else {
          response = await apiRequest("POST", "/api/vendite/preview-vetrina", {
            productionProductId,
            quantita: parseInt(quantita.toString()),
            prezzoVendita: prezzoVendita
          });
        }
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
  }, [inventarioId, productionProductId, quantita, prezzoVendita, editingSale, origine]);

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

      const payload: any = {
        quantita: data.quantita,
        prezzoVendita: data.prezzoVendita,
        vendutoA: data.vendutoA,
        incassato: data.incassato,
        incassatoDa: data.incassatoDa,
        incassatoSu: data.incassatoSu,
        data: data.data,
        origine: data.origine,
      };

      if (data.origine === "magazzino") {
        payload.inventarioId = data.inventarioId;
      } else {
        payload.productionProductId = data.productionProductId;
      }

      const response = await apiRequest(method, url, payload);
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Successo",
        description: editingSale ? "Vendita aggiornata con successo" : "Vendita registrata con successo",
      });
      onClose();
      form.reset({
        inventarioId: "",
        productionProductId: undefined,
        quantita: 1,
        prezzoVendita: "0",
        vendutoA: undefined,
        incassato: 0,
        incassatoDa: "",
        incassatoSu: "",
        data: new Date().toISOString().split('T')[0],
        origine: "magazzino",
      });
      setOrigine("magazzino");
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
              : "Seleziona l'origine e i dettagli della vendita."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Origine selection */}
          {!editingSale && (
            <div className="space-y-2">
              <Label>Origine Vendita</Label>
              <RadioGroup 
                value={origine} 
                onValueChange={(value) => {
                  setOrigine(value as "magazzino" | "vetrina");
                  form.setValue("origine", value);
                  form.setValue("inventarioId", "");
                  form.setValue("productionProductId", undefined);
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="magazzino" id="r-magazzino" data-testid="radio-magazzino" />
                  <Label htmlFor="r-magazzino" className="font-normal">Magazzino</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="vetrina" id="r-vetrina" data-testid="radio-vetrina" />
                  <Label htmlFor="r-vetrina" className="font-normal">Vetrina</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Magazzino selection */}
          {origine === "magazzino" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="inventarioId">Articolo Magazzino</Label>
                <Select 
                  value={form.watch("inventarioId")} 
                  onValueChange={(value) => form.setValue("inventarioId", value)}
                >
                  <SelectTrigger data-testid="select-articolo">
                    <SelectValue placeholder="Seleziona articolo" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventory
                      .filter((item: Inventario) => {
                        // For editing, include the currently selected item even if quantity is 0
                        if (editingSale && editingSale.inventarioId === item.id) {
                          return true;
                        }
                        // For new sales, only show items with quantity > 0
                        return item.quantita > 0;
                      })
                      .map((item: Inventario) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nomeArticolo} - {item.taglia} (Qta: {item.quantita})
                        {editingSale && editingSale.inventarioId === item.id && item.quantita === 0 ? ' - ESAURITO' : ''}
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
                    {editingSale && (
                      <span className="text-muted-foreground ml-1">
                        (+ {editingSale.quantita} dalla vendita corrente)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Vetrina selection */}
          {origine === "vetrina" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="productionProductId">Articolo Vetrina</Label>
                <Select 
                  value={form.watch("productionProductId")} 
                  onValueChange={(value) => form.setValue("productionProductId", value)}
                >
                  <SelectTrigger data-testid="select-vetrina-product">
                    <SelectValue placeholder="Seleziona articolo da vetrina" />
                  </SelectTrigger>
                  <SelectContent>
                    {vetrinaProducts.map((prod: VetrinaProduct) => (
                      <SelectItem key={prod.id} value={prod.id}>
                        {prod.nome} {prod.categoria ? `• ${prod.categoria}` : ""}
                        {prod.costoOverride ? ` • €${Number(prod.costoOverride).toFixed(2)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.productionProductId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.productionProductId.message}
                  </p>
                )}
              </div>

              {selectedVetrina && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex gap-3">
                    {selectedVetrina.imageUrl && (
                      <img src={selectedVetrina.imageUrl} alt={selectedVetrina.nome} className="w-20 h-20 object-cover rounded-md border" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{selectedVetrina.nome}</p>
                      {selectedVetrina.categoria && <p className="text-sm text-muted-foreground">{selectedVetrina.categoria}</p>}
                      {selectedVetrina.costoOverride && (
                        <p className="text-sm"><strong>Costo:</strong> {formatCurrency(Number(selectedVetrina.costoOverride))}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedVetrina.bom?.length ? `${selectedVetrina.bom.length} materiali utilizzati` : "Nessun materiale"}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La vendita scalerà automaticamente i materiali utilizzati (FIFO)
                  </p>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantita">Quantità Venduta</Label>
            <Input
              id="quantita"
              data-testid="input-quantita-venduta"
              type="number"
              min="1"
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
              data-testid="input-prezzo-vendita"
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

          <div className="space-y-2">
            <Label htmlFor="vendutoA">Venduto A (Cliente)</Label>
            <Input
              id="vendutoA"
              data-testid="input-venduto-a"
              type="text"
              placeholder="Es. Mario Rossi, Cliente online, etc."
              {...form.register("vendutoA")}
              onChange={(e) => {
                const capitalizedValue = capitalizeWords(e.target.value);
                form.setValue("vendutoA", capitalizedValue);
              }}
            />
            {form.formState.errors.vendutoA && (
              <p className="text-sm text-destructive">
                {form.formState.errors.vendutoA.message}
              </p>
            )}
          </div>

          {/* Sale Preview - only for magazzino */}
          {!editingSale && origine === "magazzino" && salePreview && (
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

          {isCalculatingPreview && !editingSale && origine === "magazzino" && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calculator className="h-4 w-4 animate-pulse" />
                Calcolo margine in corso...
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="incassato">Incassato</Label>
            <Select 
              value={form.watch("incassato")?.toString() || "0"} 
              onValueChange={(value) => {
                const numValue = parseInt(value);
                form.setValue("incassato", numValue);
                // Clear conditional fields when setting to NO
                if (numValue === 0) {
                  form.setValue("incassatoDa", "");
                  form.setValue("incassatoSu", "");
                }
              }}
            >
              <SelectTrigger data-testid="select-incassato">
                <SelectValue placeholder="Seleziona stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">NO</SelectItem>
                <SelectItem value="1">SI</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.incassato && (
              <p className="text-sm text-destructive">
                {form.formState.errors.incassato.message}
              </p>
            )}
          </div>

          {/* Conditional fields - only show when incassato = 1 (SI) */}
          {form.watch("incassato") === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="incassatoDa">Incassato Da</Label>
                <Select 
                  value={form.watch("incassatoDa")} 
                  onValueChange={(value) => form.setValue("incassatoDa", value)}
                >
                  <SelectTrigger data-testid="select-incassato-da">
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
                  <SelectTrigger data-testid="select-incassato-su">
                    <SelectValue placeholder="Seleziona metodo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contanti">Contanti</SelectItem>
                    <SelectItem value="Carta">Carta</SelectItem>
                    <SelectItem value="Bonifico">Bonifico</SelectItem>
                    <SelectItem value="PayPal">PayPal</SelectItem>
                    <SelectItem value="Vinted">Vinted</SelectItem>
                    <SelectItem value="Revolut">Revolut</SelectItem>
                    <SelectItem value="Subito">Subito</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.incassatoSu && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.incassatoSu.message}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              data-testid="input-data"
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
