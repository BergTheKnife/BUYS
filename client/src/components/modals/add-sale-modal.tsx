
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type InventarioItem = { id: string; nomeArticolo: string; taglia?: string | null; quantita: number; costo: string };
type ShowcaseItem = { id: string; nomeArticolo: string };

export function AddSaleModal({ open, onOpenChange, editingSale }: { open: boolean; onOpenChange: (v: boolean)=>void; editingSale?: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [origine, setOrigine] = useState<"Magazzino" | "Vetrina">("Magazzino");
  const [inventarioId, setInventarioId] = useState<string>("");
  const [showcaseId, setShowcaseId] = useState<string>("");
  const [quantita, setQuantita] = useState<number>(1);
  const [prezzo, setPrezzo] = useState<string>("");
  const [vendutoA, setVendutoA] = useState<string>("");
  const [incassato, setIncassato] = useState<boolean>(false);
  const [incassatoDa, setIncassatoDa] = useState<string>("");
  const [incassatoSu, setIncassatoSu] = useState<string>("");
  const [data, setData] = useState<string>(new Date().toISOString().slice(0,10));

  const { data: inventario = [] } = useQuery({
    queryKey: ["/api/inventario"],
    queryFn: async () => (await apiRequest("GET", "/api/inventario")).json() as Promise<InventarioItem[]>,
  });

  const { data: vetrina = [] } = useQuery({
    queryKey: ["/api/produzione/vetrina"],
    queryFn: async () => (await apiRequest("GET", "/api/produzione/vetrina")).json() as Promise<ShowcaseItem[]>,
  });

  useEffect(() => {
    if (inventario[0] && !inventarioId) setInventarioId(inventario[0].id);
    if (vetrina[0] && !showcaseId) setShowcaseId(vetrina[0].id);
  }, [inventario, vetrina]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (origine === "Magazzino") {
        const res = await apiRequest("POST", "/api/vendite", {
          inventarioId,
          quantita,
          prezzoVendita: prezzo,
          vendutoA,
          incassato: incassato ? 1 : 0,
          incassatoDa: incassato ? (incassatoDa || "Cliente") : null,
          incassatoSu: incassato ? (incassatoSu || "Cassa") : null,
          data,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/vendite/vetrina", {
          showcaseId,
          quantita,
          prezzoVendita: prezzo,
          vendutoA,
          incassato: incassato ? 1 : 0,
          incassatoDa: incassato ? (incassatoDa || "Cliente") : null,
          incassatoSu: incassato ? (incassatoSu || "Cassa") : null,
          data,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vendite"] });
      qc.invalidateQueries({ queryKey: ["/api/inventario"] });
      qc.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Successo", description: "Vendita registrata con successo" });
      onOpenChange(false);
      // reset basic fields
      setPrezzo(""); setQuantita(1); setVendutoA(""); setIncassato(false); setIncassatoDa(""); setIncassatoSu("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuova Vendita</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            <Label>Origine articolo</Label>
            <Select value={origine} onValueChange={(v)=>setOrigine(v as any)}>
              <SelectTrigger><SelectValue placeholder="Seleziona origine" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Magazzino">Magazzino</SelectItem>
                <SelectItem value="Vetrina">Vetrina</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {origine === "Magazzino" ? (
            <div className="grid grid-cols-1 gap-2">
              <Label>Articolo (magazzino)</Label>
              <Select value={inventarioId} onValueChange={setInventarioId}>
                <SelectTrigger><SelectValue placeholder="Seleziona articolo" /></SelectTrigger>
                <SelectContent>
                  {inventario.map(it => (
                    <SelectItem key={it.id} value={it.id}>{it.nomeArticolo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <Label>Articolo (vetrina)</Label>
              <Select value={showcaseId} onValueChange={setShowcaseId}>
                <SelectTrigger><SelectValue placeholder="Seleziona articolo" /></SelectTrigger>
                <SelectContent>
                  {vetrina.map(it => (
                    <SelectItem key={it.id} value={it.id}>{it.nomeArticolo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Quantità</Label><Input type="number" min="1" value={quantita} onChange={e=>setQuantita(parseInt(e.target.value || "1"))} /></div>
            <div><Label>Prezzo (€)</Label><Input type="number" step="0.01" value={prezzo} onChange={e=>setPrezzo(e.target.value)} /></div>
          </div>

          <div><Label>Venduto a (facoltativo)</Label><Input value={vendutoA} onChange={e=>setVendutoA(e.target.value)} /></div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 flex items-center gap-2">
              <input id="incassato" type="checkbox" checked={incassato} onChange={e=>setIncassato(e.target.checked)} />
              <Label htmlFor="incassato">Incassato</Label>
            </div>
            <div><Label>Incassato da</Label><Input value={incassatoDa} disabled={!incassato} onChange={e=>setIncassatoDa(e.target.value)} /></div>
            <div><Label>Incassato su</Label><Input value={incassatoSu} disabled={!incassato} onChange={e=>setIncassatoSu(e.target.value)} /></div>
          </div>

          <div><Label>Data</Label><Input type="date" value={data} onChange={e=>setData(e.target.value)} /></div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={()=>onOpenChange(false)}>Annulla</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={()=>mutation.mutate()} disabled={!prezzo || quantita<1}>
              {mutation.isPending ? "Registrando..." : "Registra Vendita"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
