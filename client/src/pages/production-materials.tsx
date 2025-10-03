import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PackagePlus, Edit, Trash2, FolderArchive, Search } from "lucide-react";
import { useState, useMemo } from "react";

type MaterialRow = {
  id: string; nome: string; unita: string; colore?: string|null; archiviato: number;
  q_totale: string; q_residua: string; costo_unit_medio: string;
};

export default function ProductionMaterials() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: materials = [] } = useQuery<MaterialRow[]>({
    queryKey: ["/api/production/materials"],
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialRow | null>(null);
  const [refillMaterial, setRefillMaterial] = useState<MaterialRow | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<MaterialRow | null>(null);
  const [deleteMode, setDeleteMode] = useState<'archive' | 'permanent' | null>(null);

  // Filter materials based on search query
  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return materials;
    const query = searchQuery.toLowerCase();
    return materials.filter(m => 
      m.nome.toLowerCase().includes(query) ||
      (m.colore?.toLowerCase().includes(query))
    );
  }, [materials, searchQuery]);

  const addMutation = useMutation({
    mutationFn: async (payload: any) => { await apiRequest("POST", "/api/production/materials", payload); },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["/api/production/materials"] }); 
      setOpenAdd(false);
      toast({ title: "Materiale aggiunto", description: "Il materiale è stato creato e la spesa registrata." });
    }
  });

  const refillMutation = useMutation({
    mutationFn: async ({ id, quantita, costoTotale }: any) => {
      await apiRequest("POST", `/api/production/materials/${id}/refill`, { quantita, costoTotale });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/production/materials"] });
      setRefillMaterial(null);
      toast({ title: "Rifornimento effettuato", description: "Il materiale è stato rifornito e la spesa registrata." });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/production/materials/${id}/archive`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/production/materials"] });
      setMaterialToDelete(null);
      setDeleteMode(null);
      toast({ title: "Materiale archiviato", description: "Il materiale è stato archiviato preservando i dati storici." });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/production/materials/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/production/materials"] });
      setMaterialToDelete(null);
      setDeleteMode(null);
      toast({ title: "Materiale eliminato", description: "Il materiale non usato è stato eliminato con ripristino contabile." });
    },
    onError: (error: any) => {
      toast({
        title: "Impossibile eliminare",
        description: error.message || "Il materiale è già stato usato. Puoi solo archiviarlo.",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Materiali di produzione</h1>
        <Button onClick={() => setOpenAdd(true)} data-testid="button-add-material">Aggiungi materiale</Button>
      </div>

      {/* Search filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Cerca materiale per nome o colore..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-materials"
        />
      </div>

      <div className="grid gap-3">
        {filteredMaterials.map((m) => (
          <div key={m.id} className="border rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-medium">{m.nome} {m.colore ? `• ${m.colore}` : ""}</div>
              <div className="text-sm text-muted-foreground">
                Totale: {m.q_totale} {m.unita} • Residuo: {m.q_residua} {m.unita} • Costo medio/unità: €{Number(m.costo_unit_medio || 0).toFixed(4)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setRefillMaterial(m)}
                title="Rifornisci"
                data-testid={`button-refill-${m.id}`}
              >
                <PackagePlus className="h-6 w-6 text-blue-600" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setEditingMaterial(m)}
                title="Modifica"
                data-testid={`button-edit-${m.id}`}
              >
                <Edit className="h-6 w-6 text-green-600" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setMaterialToDelete(m);
                  setDeleteMode(null);
                }}
                title="Elimina"
                data-testid={`button-delete-${m.id}`}
              >
                <Trash2 className="h-6 w-6 text-red-600" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog Aggiungi Materiale */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nuovo materiale</DialogTitle></DialogHeader>
          <AddMaterialForm onSubmit={(payload) => addMutation.mutate(payload)} />
        </DialogContent>
      </Dialog>

      {/* Dialog Modifica Materiale */}
      <Dialog open={!!editingMaterial} onOpenChange={(open) => !open && setEditingMaterial(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Modifica materiale</DialogTitle></DialogHeader>
          {editingMaterial && <EditMaterialForm material={editingMaterial} onClose={() => setEditingMaterial(null)} />}
        </DialogContent>
      </Dialog>

      {/* Dialog Rifornimento */}
      <Dialog open={!!refillMaterial} onOpenChange={(open) => !open && setRefillMaterial(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rifornisci materiale</DialogTitle>
            <DialogDescription>
              {refillMaterial?.nome} {refillMaterial?.colore && `• ${refillMaterial.colore}`}
            </DialogDescription>
          </DialogHeader>
          <RefillForm onSubmit={(q, c) => {
            refillMutation.mutate({ id: refillMaterial!.id, quantita: q, costoTotale: c });
          }} />
        </DialogContent>
      </Dialog>

      {/* Dialog Conferma Eliminazione */}
      <Dialog open={!!materialToDelete && deleteMode === null} onOpenChange={(open) => {
        if (!open) {
          setMaterialToDelete(null);
          setDeleteMode(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Elimina o Archivia Materiale</DialogTitle>
            <DialogDescription>
              Scegli come gestire "{materialToDelete?.nome}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <button
              onClick={() => {
                if (materialToDelete) archiveMutation.mutate(materialToDelete.id);
              }}
              className="w-full border rounded-lg p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex gap-3"
            >
              <FolderArchive className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <div className="font-medium">Archivia</div>
                <div className="text-sm text-muted-foreground">
                  Il materiale viene nascosto ma i dati storici rimangono. La spesa rimane registrata.
                </div>
              </div>
            </button>
            
            <button
              onClick={() => {
                if (materialToDelete) deleteMutation.mutate(materialToDelete.id);
              }}
              className="w-full border rounded-lg p-4 text-left hover:bg-red-50 dark:hover:bg-red-950 transition-colors flex gap-3"
            >
              <Trash2 className="h-5 w-5 text-red-600 mt-1" />
              <div>
                <div className="font-medium text-red-600">Elimina Definitivamente</div>
                <div className="text-sm text-muted-foreground">
                  Solo se MAI usato. Ripristina automaticamente la contabilità eliminando la spesa e restituendo i fondi.
                </div>
              </div>
            </button>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => {
              setMaterialToDelete(null);
              setDeleteMode(null);
            }}>
              Annulla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RefillForm({ onSubmit }: { onSubmit: (q: number, c: number) => void }) {
  const [q, setQ] = useState(""); 
  const [c, setC] = useState("");
  
  return (
    <div className="space-y-3">
      <div><Label>Quantità</Label><Input type="number" value={q} onChange={e=>setQ(e.target.value)} placeholder="es. 1000" /></div>
      <div><Label>Costo totale</Label><Input type="number" step="0.01" value={c} onChange={e=>setC(e.target.value)} placeholder="es. 25.00" /></div>
      <div className="flex justify-end">
        <Button onClick={()=>{ onSubmit(Number(q||0), Number(c||0)); }}>Conferma</Button>
      </div>
    </div>
  );
}

function EditMaterialForm({ material, onClose }: { material: MaterialRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [nome, setNome] = useState(material.nome);
  const [unita, setUnita] = useState(material.unita);
  const [colore, setColore] = useState(material.colore || "");
  
  // Calcola il costo totale attuale
  const costoTotaleAttuale = Number(material.costo_unit_medio) * Number(material.q_residua);
  const [costoTotale, setCostoTotale] = useState(costoTotaleAttuale.toFixed(2));

  const editMutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiRequest("PATCH", `/api/production/materials/${material.id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/production/materials"] });
      qc.invalidateQueries({ queryKey: ["/api/spese"] });
      qc.invalidateQueries({ queryKey: ["/api/cassa-reinvestimento-balance"] });
      toast({ title: "Materiale aggiornato" });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Errore durante l'aggiornamento", 
        variant: "destructive" 
      });
    }
  });

  const nuovoCostoTotale = Number(costoTotale);
  const nuovoCostoUnitario = Number(material.q_residua) > 0 ? nuovoCostoTotale / Number(material.q_residua) : 0;
  const differenzaTotale = nuovoCostoTotale - costoTotaleAttuale;

  return (
    <div className="space-y-3">
      <div><Label>Nome</Label><Input value={nome} onChange={e=>setNome(e.target.value)} /></div>
      <div>
        <Label>Unità di misura</Label>
        <select 
          value={unita} 
          onChange={e=>setUnita(e.target.value)}
          className="w-full border rounded-md px-3 py-2 bg-background"
        >
          <option value="g">Grammi (g)</option>
          <option value="m">Metri (m)</option>
          <option value="pcs">Pezzi (pcs)</option>
        </select>
      </div>
      <div><Label>Colore (facoltativo)</Label><Input value={colore} onChange={e=>setColore(e.target.value)} /></div>
      
      <div className="space-y-2">
        <Label>Costo totale (€)</Label>
        <Input 
          type="number" 
          step="0.01" 
          value={costoTotale} 
          onChange={e=>setCostoTotale(e.target.value)} 
          data-testid="input-material-cost"
        />
        <div className="text-sm text-muted-foreground">
          Quantità residua: {material.q_residua} {material.unita}
        </div>
        <div className="text-sm text-muted-foreground">
          Costo unitario calcolato: €{nuovoCostoUnitario.toFixed(4)} / {material.unita}
        </div>
        {differenzaTotale !== 0 && (
          <div className={`p-3 rounded-md ${differenzaTotale > 0 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200' : 'bg-green-50 dark:bg-green-900/20 border border-green-200'}`}>
            <div className="text-sm font-medium">
              {differenzaTotale > 0 ? '📈 Aumento costo' : '📉 Riduzione costo'}
            </div>
            <div className="text-xs mt-1">
              Differenza totale: €{Math.abs(differenzaTotale).toFixed(2)}
            </div>
            <div className="text-xs mt-2 text-muted-foreground">
              {differenzaTotale > 0 
                ? 'Verrà creata una spesa per la differenza (Cassa Reinvestimento + fondi personali)'
                : 'Verrà registrato un rimborso per la differenza ridotta'
              }
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={() => editMutation.mutate({ 
          nome: nome.trim(), 
          unita, 
          colore: colore.trim() || null,
          nuovoCostoUnitario: nuovoCostoUnitario
        })}>
          Salva
        </Button>
      </div>
    </div>
  );
}

function AddMaterialForm({ onSubmit }: { onSubmit: (payload: any) => void }) {
  const [nome, setNome] = useState(""); 
  const [unita, setUnita] = useState("g");
  const [colore, setColore] = useState(""); 
  const [q, setQ] = useState(""); 
  const [c, setC] = useState("");
  
  const handleSubmit = () => {
    if (!nome.trim()) return;
    const quantita = Number(q) || 0;
    const costo = Number(c) || 0;
    if (quantita <= 0 || costo <= 0) return;
    
    onSubmit({ 
      nome: nome.trim(), 
      unita, 
      colore: colore.trim() || null, 
      quantitaTotale: quantita, 
      costoTotale: costo 
    });
  };
  
  return (
    <div className="space-y-3">
      <div><Label>Nome</Label><Input data-testid="input-material-name" value={nome} onChange={e=>setNome(e.target.value)} /></div>
      <div><Label>Unità</Label>
        <select data-testid="select-material-unit" value={unita} onChange={e=>setUnita(e.target.value)} className="border rounded-md px-3 py-2 w-full">
          <option value="g">grammi (g)</option>
          <option value="m">metri (m)</option>
          <option value="pcs">pezzi (pcs)</option>
        </select>
      </div>
      <div><Label>Colore (facoltativo)</Label><Input data-testid="input-material-color" value={colore} onChange={e=>setColore(e.target.value)} /></div>
      <div><Label>Quantità totale</Label><Input type="number" data-testid="input-material-quantity" value={q} onChange={e=>setQ(e.target.value)} placeholder="es. 10000" /></div>
      <div><Label>Costo totale</Label><Input type="number" step="0.01" data-testid="input-material-cost" value={c} onChange={e=>setC(e.target.value)} placeholder="es. 20.00" /></div>
      <div className="flex justify-end"><Button data-testid="button-create-material" onClick={handleSubmit}>Aggiungi</Button></div>
    </div>
  );
}
