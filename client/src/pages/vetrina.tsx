import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

type MaterialLite = { id: string; nome: string; unita: string; q_residua?: string };
type BomRow = { materialId: string; quantita: string };

export default function Vetrina() {
  const qc = useQueryClient();
  const { data: materials = [] } = useQuery<any[]>({ queryKey: ["/api/production/materials"] });
  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/production/vetrina"] });

  const [openAdd, setOpenAdd] = useState(false);
  const addMutation = useMutation({
    mutationFn: async (payload: any) => { await apiRequest("POST", "/api/production/vetrina", payload); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/production/vetrina"] }); setOpenAdd(false); }
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/production/vetrina/${id}/archive`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/production/vetrina"] })
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vetrina</h1>
        <Button onClick={()=>setOpenAdd(true)}>Nuovo in Vetrina</Button>
      </div>

      <div className="grid gap-3">
        {products.map((p:any) => (
          <div key={p.id} className="border rounded-md p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{p.nome} {p.categoria ? `• ${p.categoria}` : ""}</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={()=>archiveMutation.mutate(p.id)}>Archivia</Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {p.bom?.length ? `${p.bom.length} materiali in BOM` : "Nessun materiale associato"}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Nuova scheda in Vetrina</DialogTitle></DialogHeader>
          <AddVetrinaForm materials={materials} onSubmit={(payload:any)=>addMutation.mutate(payload)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddVetrinaForm({ materials, onSubmit }: { materials: MaterialLite[]; onSubmit: (payload: any)=>void }) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [altezza, setAltezza] = useState("");
  const [larghezza, setLarghezza] = useState("");
  const [lunghezza, setLunghezza] = useState("");
  const [costoOverride, setCostoOverride] = useState("");
  const [bom, setBom] = useState<BomRow[]>([]);

  const addBomRow = () => setBom([...bom, { materialId: materials[0]?.id || "", quantita: "" }]);
  const updateBom = (i: number, patch: Partial<BomRow>) => setBom(bom.map((r, idx)=> idx===i ? { ...r, ...patch } : r));
  const removeBom = (i: number) => setBom(bom.filter((_, idx)=> idx!==i));

  return (
    <div className="space-y-3">
      <div><Label>Nome</Label><Input value={nome} onChange={e=>setNome(e.target.value)} /></div>
      <div><Label>Categoria (facoltativa)</Label><Input value={categoria} onChange={e=>setCategoria(e.target.value)} /></div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label>Altezza</Label><Input value={altezza} onChange={e=>setAltezza(e.target.value)} placeholder="cm" /></div>
        <div><Label>Larghezza</Label><Input value={larghezza} onChange={e=>setLarghezza(e.target.value)} placeholder="cm" /></div>
        <div><Label>Lunghezza</Label><Input value={lunghezza} onChange={e=>setLunghezza(e.target.value)} placeholder="cm" /></div>
      </div>

      <div className="border rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Materiali (BOM)</div>
          <Button variant="secondary" onClick={addBomRow}>Aggiungi materiale</Button>
        </div>
        <div className="space-y-2">
          {bom.map((r, i)=> (
            <div key={i} className="grid grid-cols-3 gap-2 items-center">
              <select value={r.materialId} onChange={e=>updateBom(i, { materialId: e.target.value })} className="border rounded-md px-3 py-2">
                {materials.map((m:any) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <Input value={r.quantita} onChange={e=>updateBom(i, { quantita: e.target.value })} placeholder="Quantità" />
              <Button variant="ghost" onClick={()=>removeBom(i)}>Rimuovi</Button>
            </div>
          ))}
          {bom.length === 0 && <div className="text-sm text-muted-foreground">Nessun materiale aggiunto</div>}
        </div>
      </div>

      <div><Label>Costo (override facoltativo)</Label><Input value={costoOverride} onChange={e=>setCostoOverride(e.target.value)} placeholder="es. 2.50" /></div>
      <div className="flex justify-end">
        <Button onClick={()=>onSubmit({ nome, categoria, altezza, larghezza, lunghezza, costoOverride, bom: bom.map(r=>({ materialId: r.materialId, quantita: r.quantita })) })}>Crea scheda</Button>
      </div>
    </div>
  );
}
