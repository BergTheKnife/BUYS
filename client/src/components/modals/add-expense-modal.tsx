import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { insertSpesaSchema } from "@shared/schema";
import type { InsertSpesa, Spesa } from "@shared/schema";
import { z } from "zod";
import { useEffect } from "react";
import { capitalizeWords } from "@/lib/utils";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingExpense?: Spesa | null;
}

const expenseFormSchema = insertSpesaSchema.extend({
  data: z.string().min(1, "Data richiesta"),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

export function AddExpenseModal({ isOpen, onClose, editingExpense }: AddExpenseModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      voce: "",
      importo: "0",
      categoria: "",
      data: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    if (editingExpense) {
      form.reset({
        voce: editingExpense.voce,
        importo: editingExpense.importo.toString(),
        categoria: editingExpense.categoria,
        data: new Date(editingExpense.data).toISOString().split('T')[0],
      });
    } else {
      form.reset({
        voce: "",
        importo: "0",
        categoria: "",
        data: new Date().toISOString().split('T')[0],
      });
    }
  }, [editingExpense, form]);

  const mutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const url = editingExpense ? `/api/spese/${editingExpense.id}` : "/api/spese";
      const method = editingExpense ? "PUT" : "POST";

      const response = await apiRequest(method, url, {
        ...data,
        data: new Date(data.data).toISOString(),
      });
      return response.json();
    },
    onSuccess: (result: any) => {
      // Action history functionality removed

      queryClient.invalidateQueries({ queryKey: ["/api/spese"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cassa-reinvestimento-balance"] });
      toast({
        title: "Successo",
        description: editingExpense ? "Spesa aggiornata con successo" : "Spesa aggiunta con successo",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvataggio della spesa",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    console.log('Expense form submitted with data:', data);
    console.log('Expense form errors:', form.formState.errors);
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingExpense ? "Modifica Spesa" : "Aggiungi Spesa"}
          </DialogTitle>
          <DialogDescription>
            Inserisci i dettagli della spesa da registrare.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="voce">Voce</Label>
            <Input
              id="voce"
              placeholder="Es. Affitto negozio"
              {...form.register("voce")}
              onChange={(e) => {
                const capitalizedValue = capitalizeWords(e.target.value);
                form.setValue("voce", capitalizedValue);
              }}
            />
            {form.formState.errors.voce && (
              <p className="text-sm text-destructive">
                {form.formState.errors.voce.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="importo">Importo (€)</Label>
            <Input
              id="importo"
              type="number"
              step="0.01"
              placeholder="100.00"
              {...form.register("importo")}
            />
            {form.formState.errors.importo && (
              <p className="text-sm text-destructive">
                {form.formState.errors.importo.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select
              value={form.watch("categoria")}
              onValueChange={(value) => form.setValue("categoria", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fisse">Fisse</SelectItem>
                <SelectItem value="Utenze">Utenze</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Altro">Altro</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Le categorie "Inventario" e "Produzione" sono gestite automaticamente dal sistema
            </p>
            {form.formState.errors.categoria && (
              <p className="text-sm text-destructive">
                {form.formState.errors.categoria.message}
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
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {mutation.isPending
                ? "Salvando..."
                : editingExpense
                  ? "Aggiorna Spesa"
                  : "Salva Spesa"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}