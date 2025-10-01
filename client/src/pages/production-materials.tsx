import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

type MaterialRow = {
  id: string; nome: string; unita: string; colore?: string|null; archiviato: number;
  q_totale: string; q_residua: string; costo_unit_medio: string;
};

export default function ProductionMaterials() {
  const qc = useQueryClient();
  const { data: materials = [] } = useQuery<MaterialRow[]>({
    queryKey: ["/api/production/materials"],
  });

  const [openAdd, setOpenAdd] = useState(false);
  const addMutation = useMutation({
    mutationFn: async (payload: any) => { await apiRequest("POST", "/api/production/materials", payload); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/production/materials"] }); setOpenAdd(false); }
  });

  const refillMutation = useMutation({
    mutationFn: async ({ id, quantita, costoTotale }: any) => {
      await apiRequest("POST", `/api/production/materials/${id}/refill`, { quantita, costoTotale });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/production/materials"] })
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/production/materials/${id}/archive`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/production/materials"] })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/production/materials/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/production/materials"] })
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Materiali di produzione</h1>
        <Button onClick={() => setOpenAdd(true)}>Aggiungi materiale</Button>
      </div>

      <div className="grid gap-3">
        {materials.map((m) => (
          <div key={m.id} className="border rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-medium">{m.nome} {m.colore ? `• ${m.colore}` : ""}</div>
              <div className="text-sm text-muted-foreground">
                Totale: {m.q_totale} {m.unita} • Residuo: {m.q_residua} {m.unita} • Costo medio/unità: {Number(m.costo_unit_medio || 0).toFixed(4)}
              </div>
            </div>
            <div className="flex gap-2">
              <RefillButton onSubmit={(q, c) => refillMutation.mutate({ id: m.id, quantita: q, costoTotale: c })} />
              <Button variant="secondary" onClick={() => archiveMutation.mutate(m.id)}>Archivia</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate(m.id)}>Elimina (se mai usato)</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nuovo materiale</DialogTitle></DialogHeader>
          <AddMaterialForm onSubmit={(payload) => addMutation.mutate(payload)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RefillButton({ onSubmit }: { onSubmit: (q: number, c: number) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(""); const [c, setC] = useState("");
  return (
    <>
      <Button onClick={() => setOpen(true)}>Rifornisci</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Rifornisci materiale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Quantità</Label><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="es. 1000" /></div>
            <div><Label>Costo totale</Label><Input value={c} onChange={e=>setC(e.target.value)} placeholder="es. 25.00" /></div>
            <div className="flex justify-end">
              <Button onClick={()=>{ onSubmit(Number(q||0), Number(c||0)); setOpen(false); }}>Conferma</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddMaterialForm({ onSubmit }: { onSubmit: (payload: any) => void }) {
  const [nome, setNome] = useState(""); const [unita, setUnita] = useState("g");
  const [colore, setColore] = useState(""); const [q, setQ] = useState(""); const [c, setC] = useState("");
  return (
    <div className="space-y-3">
      <div><Label>Nome</Label><Input value={nome} onChange={e=>setNome(e.target.value)} /></div>
      <div><Label>Unità</Label>
        <select value={unita} onChange={e=>setUnita(e.target.value)} className="border rounded-md px-3 py-2 w-full">
          <option value="g">grammi (g)</option>
          <option value="m">metri (m)</option>
          <option value="pcs">pezzi (pcs)</option>
        </select>
      </div>
      <div><Label>Colore (facoltativo)</Label><Input value={colore} onChange={e=>setColore(e.target.value)} /></div>
      <div><Label>Quantità totale</Label><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="es. 10000" /></div>
      <div><Label>Costo totale</Label><Input value={c} onChange={e=>setC(e.target.value)} placeholder="es. 20.00" /></div>
      <div className="flex justify-end"><Button onClick={()=>onSubmit({ nome, unita, colore, quantitaTotale: q, costoTotale: c })}>Crea</Button></div>
    </div>
  );
}
