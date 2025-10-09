
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface PrelevaCassaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saldoCassa: number;
  membri?: Array<{ id: string; nome: string; cognome: string }>;
}

export function PrelevaCassaModal({ open, onOpenChange, saldoCassa, membri }: PrelevaCassaModalProps) {
  const [importo, setImporto] = useState("");
  const [tipo, setTipo] = useState("");
  const [memberId, setMemberId] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createWithdrawal = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/equity/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Prelievo effettuato con successo" });
      queryClient.invalidateQueries({ queryKey: ["equity-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["cassa-reinvestimento"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setImporto("");
    setTipo("");
    setMemberId("");
    setDescrizione("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(importo);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Errore", description: "Importo non valido", variant: "destructive" });
      return;
    }

    if (amount > saldoCassa) {
      toast({ title: "Errore", description: "Saldo cassa insufficiente", variant: "destructive" });
      return;
    }

    if (!tipo) {
      toast({ title: "Errore", description: "Seleziona un tipo di prelievo", variant: "destructive" });
      return;
    }

    if (membri && membri.length > 0 && !memberId && (tipo === 'RIMBORSO' || tipo === 'DIVIDENDO')) {
      toast({ title: "Errore", description: "Seleziona un membro", variant: "destructive" });
      return;
    }

    createWithdrawal.mutate({
      importo: amount,
      tipo,
      memberId: memberId || undefined,
      descrizione: descrizione || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Preleva da cassa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="importo">Importo *</Label>
            <Input
              id="importo"
              type="number"
              step="0.01"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              placeholder="0.00"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Saldo disponibile: €{saldoCassa.toFixed(2)}
            </p>
          </div>

          <div>
            <Label htmlFor="tipo">Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo} required>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RIMBORSO">Rimborso investimento iniziale</SelectItem>
                <SelectItem value="DIVIDENDO">Distribuzione margine (dividendi)</SelectItem>
                <SelectItem value="ALTRO">Altro prelievo socio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {membri && membri.length > 0 && (
            <div>
              <Label htmlFor="membro">Membro {(tipo === 'RIMBORSO' || tipo === 'DIVIDENDO') ? '*' : ''}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona membro" />
                </SelectTrigger>
                <SelectContent>
                  {membri.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} {m.cognome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="descrizione">Descrizione (opzionale)</Label>
            <Textarea
              id="descrizione"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Note aggiuntive..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={createWithdrawal.isPending}>
              {createWithdrawal.isPending ? "Elaborazione..." : "Conferma prelievo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
