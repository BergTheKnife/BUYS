import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
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
import { insertInventarioSchema } from "@shared/schema";
import type { InsertInventario, Inventario } from "@shared/schema";
import { useEffect } from "react";
import { capitalizeWords } from "@/lib/utils";

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem?: Inventario | null;
}

export function AddItemModal({ isOpen, onClose, editingItem }: AddItemModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertInventario & { immagine?: FileList }>({
    resolver: zodResolver(insertInventarioSchema.extend({
      immagine: z.any().optional(),
    })),
    defaultValues: {
      nomeArticolo: "",
      taglia: "",
      costo: "0",
      quantita: 1,
      lunghezza: "",
      larghezza: "",
      altezza: "",
    },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        nomeArticolo: editingItem.nomeArticolo,
        taglia: editingItem.taglia || "",
        costo: editingItem.costo.toString(),
        quantita: editingItem.quantita,
        lunghezza: editingItem.lunghezza ? editingItem.lunghezza.toString() : "",
        larghezza: editingItem.larghezza ? editingItem.larghezza.toString() : "",
        altezza: editingItem.altezza ? editingItem.altezza.toString() : "",
      });
    } else {
      form.reset({
        nomeArticolo: "",
        taglia: "",
        costo: "0",
        quantita: 1,
        lunghezza: "",
        larghezza: "",
        altezza: "",
      });
    }
  }, [editingItem, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = editingItem ? `/api/inventario/${editingItem.id}` : "/api/inventario";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        body: data,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore nel salvataggio");
      }

      return response.json();
    },
    onSuccess: (result: Inventario, variables: FormData) => {
      // Action history functionality removed

      queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spese"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-history"] });
      toast({
        title: "Successo",
        description: editingItem ? "Articolo aggiornato con successo" : "Articolo aggiunto con successo",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvataggio",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertInventario & { immagine?: FileList }) => {
    console.log('Form submitted with data:', data);
    console.log('Form errors:', form.formState.errors);

    const formData = new FormData();
    formData.append("nomeArticolo", data.nomeArticolo);
    if (data.taglia) formData.append("taglia", data.taglia);
    formData.append("costo", data.costo);
    formData.append("quantita", data.quantita.toString());
    if (data.lunghezza) formData.append("lunghezza", data.lunghezza.toString());
    if (data.larghezza) formData.append("larghezza", data.larghezza.toString());
    if (data.altezza) formData.append("altezza", data.altezza.toString());

    if (data.immagine && data.immagine.length > 0) {
      formData.append("immagine", data.immagine[0]);
    }

    console.log('Submitting FormData...');
    mutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "Modifica Articolo" : "Aggiungi Articolo"}
          </DialogTitle>
          <DialogDescription>
            Inserisci i dettagli dell'articolo da aggiungere all'inventario.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomeArticolo">Nome Articolo</Label>
              <Input
                id="nomeArticolo"
                data-testid="input-nome-articolo"
                placeholder="Es. T-shirt Blu"
                {...form.register("nomeArticolo")}
                onChange={(e) => {
                  const capitalizedValue = capitalizeWords(e.target.value);
                  form.setValue("nomeArticolo", capitalizedValue);
                }}
              />
              {form.formState.errors.nomeArticolo && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.nomeArticolo.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="taglia">Taglia (Facoltativo)</Label>
              <Select
                value={form.watch("taglia") || ""}
                onValueChange={(value) => form.setValue("taglia", value === "" ? undefined : value)}
              >
                <SelectTrigger data-testid="select-taglia">
                  <SelectValue placeholder="Seleziona taglia (opzionale)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuna taglia</SelectItem>
                  <SelectItem value="XS">XS</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="M">M</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="XL">XL</SelectItem>
                  <SelectItem value="XXL">XXL</SelectItem>
                  <SelectItem value="28">28</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="32">32</SelectItem>
                  <SelectItem value="34">34</SelectItem>
                  <SelectItem value="36">36</SelectItem>
                  <SelectItem value="38">38</SelectItem>
                  <SelectItem value="40">40</SelectItem>
                  <SelectItem value="42">42</SelectItem>
                  <SelectItem value="44">44</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.taglia && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.taglia.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costo">Costo (€)</Label>
              <Input
                id="costo"
                data-testid="input-costo"
                type="number"
                step="0.01"
                placeholder="15.00"
                {...form.register("costo")}
              />
              {form.formState.errors.costo && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.costo.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantita">Quantità</Label>
              <Input
                id="quantita"
                data-testid="input-quantita"
                type="number"
                min="0"
                placeholder="10"
                {...form.register("quantita", { valueAsNumber: true })}
              />
              {form.formState.errors.quantita && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.quantita.message}
                </p>
              )}
            </div>
          </div>

          {/* Dimensioni fisiche */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lunghezza">Lunghezza (cm)</Label>
              <Input
                id="lunghezza"
                data-testid="input-lunghezza"
                type="number"
                step="0.1"
                min="0"
                placeholder="Es. 30.5"
                {...form.register("lunghezza")}
              />
              {form.formState.errors.lunghezza && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.lunghezza.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="larghezza">Larghezza (cm)</Label>
              <Input
                id="larghezza"
                data-testid="input-larghezza"
                type="number"
                step="0.1"
                min="0"
                placeholder="Es. 20.0"
                {...form.register("larghezza")}
              />
              {form.formState.errors.larghezza && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.larghezza.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="altezza">Altezza (cm)</Label>
              <Input
                id="altezza"
                data-testid="input-altezza"
                type="number"
                step="0.1"
                min="0"
                placeholder="Es. 1.5"
                {...form.register("altezza")}
              />
              {form.formState.errors.altezza && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.altezza.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="immagine">
              Immagine {editingItem && "(lascia vuoto per mantenere l'immagine attuale)"}
            </Label>
            {editingItem && editingItem.immagineUrl && (
              <div className="mb-2">
                <p className="text-sm text-muted-foreground mb-2">Immagine attuale:</p>
                <img
                  src={editingItem.immagineUrl}
                  alt={editingItem.nomeArticolo}
                  className="w-20 h-20 object-cover rounded-lg border"
                />
              </div>
            )}
            <Input
              id="immagine"
              type="file"
              accept="image/*"
              data-testid="input-immagine"
              {...form.register("immagine")}
            />
            {form.formState.errors.immagine && (
              <p className="text-sm text-destructive">
                {form.formState.errors.immagine.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Salvando..."
                : editingItem
                  ? "Aggiorna Articolo"
                  : "Salva Articolo"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}