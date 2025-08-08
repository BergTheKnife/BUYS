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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertVenditaSchema } from "@shared/schema";
import type { InsertVendita, Inventario, Vendita } from "@shared/schema";
import { z } from "zod";
import { capitalizeWords } from "@/lib/utils";

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSale?: Vendita | null;
}

const saleFormSchema = insertVenditaSchema.extend({
  data: z.string().min(1, "Data richiesta"),
});

type SaleFormData = z.infer<typeof saleFormSchema>;

export function AddSaleModal({ isOpen, onClose, editingSale }: AddSaleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    defaultValues: editingSale ? {
      inventarioId: editingSale.inventarioId,
      quantita: editingSale.quantita,
      prezzoVendita: editingSale.prezzoVendita,
      incassatoDa: editingSale.incassatoDa,
      incassatoSu: editingSale.incassatoSu,
      data: new Date(editingSale.data).toISOString().split('T')[0],
    } : {
      inventarioId: "",
      quantita: 1,
      prezzoVendita: "0",
      incassatoDa: "",
      incassatoSu: "",
      data: new Date().toISOString().split('T')[0],
    },
  });

  const selectedItem = inventory.find((item: Inventario) => item.id === form.watch("inventarioId"));

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Successo",
        description: editingSale ? "Vendita aggiornata con successo" : "Vendita registrata con successo",
      });
      onClose();
      form.reset();
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
      <DialogContent className="sm:max-w-[500px]">
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
                <strong>Costo articolo:</strong> {new Intl.NumberFormat("it-IT", {
                  style: "currency",
                  currency: "EUR",
                }).format(Number(selectedItem.costo))}
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