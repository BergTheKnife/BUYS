import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, Package, Search } from "lucide-react";
import { useState, useMemo } from "react";

type MaterialRow = { id: string; nome: string; unita: string; costo_unit_medio: string; q_residua: string };
type BomRow = { materialId: string; quantita: string };
type VetrinaProduct = { 
  id: string; nome: string; categoria?: string; imageUrl?: string; 
  altezza?: string; larghezza?: string; lunghezza?: string; 
  costoOverride?: string; bom?: any[] 
};

export default function Vetrina() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: materials = [] } = useQuery<MaterialRow[]>({ queryKey: ["/api/production/materials"] });
  const { data: products = [] } = useQuery<VetrinaProduct[]>({ queryKey: ["/api/production/vetrina"] });

  const [searchQuery, setSearchQuery] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VetrinaProduct | null>(null);

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.nome.toLowerCase().includes(query) ||
      (p.categoria?.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  const addMutation = useMutation({
    mutationFn: async (formData: FormData) => { 
      const res = await fetch("/api/production/vetrina", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["/api/production/vetrina"] }); 
      setOpenAdd(false);
      toast({ title: "Articolo aggiunto", description: "L'articolo è stato aggiunto alla vetrina." });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/production/vetrina/${id}/archive`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/production/vetrina"] });
      toast({ title: "Articolo archiviato" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/production/vetrina/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/production/vetrina"] });
      toast({ title: "Articolo eliminato" });
    },
    onError: (error: any) => {
      toast({ title: "Impossibile eliminare", description: error.message, variant: "destructive" });
    }
  });

  const groupedProducts = useMemo(() => {
    const groups: Record<string, VetrinaProduct[]> = {};
    filteredProducts.forEach(p => {
      const cat = p.categoria || "Senza categoria";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [filteredProducts]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vetrina</h1>
          <p className="text-sm text-muted-foreground">Aggiungi qui gli articoli che puoi produrre</p>
        </div>
        <Button data-testid="button-add-vetrina" onClick={() => setOpenAdd(true)}>
          Aggiungi Articolo
        </Button>
      </div>

      {/* Search filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Cerca articolo per nome o categoria..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-vetrina"
        />
      </div>

      {Object.entries(groupedProducts).map(([categoria, items]) => (
        <div key={categoria} className="space-y-3">
          <h2 className="font-medium text-lg">{categoria}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(p => (
              <div key={p.id} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`card-vetrina-${p.id}`}>
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-16 w-16 text-gray-400" />
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <h3 className="font-medium text-sm" data-testid={`text-product-name-${p.id}`}>{p.nome}</h3>
                  {(p.altezza || p.larghezza || p.lunghezza) && (
                    <p className="text-xs text-muted-foreground">
                      {[p.altezza && `A: ${p.altezza}cm`, p.larghezza && `L: ${p.larghezza}cm`, p.lunghezza && `P: ${p.lunghezza}cm`].filter(Boolean).join(" • ")}
                    </p>
                  )}
                  {p.costoOverride && (
                    <p className="text-xs font-medium">Costo: €{Number(p.costoOverride).toFixed(2)}</p>
                  )}
                  <p className="text-xs text-muted-foreground" data-testid={`text-bom-${p.id}`}>
                    {p.bom?.length ? `${p.bom.length} materiali` : "Nessun materiale"}
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingProduct(p)} data-testid={`button-edit-${p.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => archiveMutation.mutate(p.id)} data-testid={`button-archive-${p.id}`}>
                      Archivia
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-${p.id}`}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {products.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          Nessun articolo in vetrina. Clicca "Aggiungi Articolo" per iniziare.
        </div>
      )}

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aggiungi Articolo</DialogTitle>
            <DialogDescription>Configura il prodotto che puoi realizzare</DialogDescription>
          </DialogHeader>
          <VetrinaForm materials={materials} onSubmit={(formData) => addMutation.mutate(formData)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Articolo</DialogTitle>
          </DialogHeader>
          {editingProduct && <VetrinaForm materials={materials} product={editingProduct} onClose={() => setEditingProduct(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VetrinaForm({ materials, product, onSubmit, onClose }: { 
  materials: MaterialRow[]; 
  product?: VetrinaProduct;
  onSubmit?: (formData: FormData) => void;
  onClose?: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const [nome, setNome] = useState(product?.nome || "");
  const [categoria, setCategoria] = useState(product?.categoria || "");
  const [altezza, setAltezza] = useState(product?.altezza || "");
  const [larghezza, setLarghezza] = useState(product?.larghezza || "");
  const [lunghezza, setLunghezza] = useState(product?.lunghezza || "");
  const [bom, setBom] = useState<BomRow[]>(product?.bom?.map(b => ({ materialId: b.materialId, quantita: String(b.quantita) })) || []);
  const [costoManuale, setCostoManuale] = useState(product?.costoOverride || "");
  const [immagine, setImmagine] = useState<File | null>(null);

  const costoCalcolato = useMemo(() => {
    let totale = 0;
    bom.forEach(r => {
      const mat = materials.find(m => m.id === r.materialId);
      if (mat) {
        totale += Number(r.quantita || 0) * Number(mat.costo_unit_medio || 0);
      }
    });
    return totale.toFixed(2);
  }, [bom, materials]);

  const costoFinale = costoManuale.trim() ? costoManuale : costoCalcolato;

  const addBomRow = () => {
    if (materials.length === 0) {
      toast({ title: "Nessun materiale disponibile", description: "Crea prima dei materiali di produzione.", variant: "destructive" });
      return;
    }
    setBom([...bom, { materialId: materials[0].id, quantita: "" }]);
  };
  
  const updateBom = (i: number, patch: Partial<BomRow>) => setBom(bom.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeBom = (i: number) => setBom(bom.filter((_, idx) => idx !== i));

  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/production/vetrina/${product!.id}`, { method: "PATCH", body: formData, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/production/vetrina"] });
      toast({ title: "Articolo aggiornato" });
      onClose?.();
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  const handleSubmit = () => {
    if (!nome.trim()) {
      toast({ title: "Nome richiesto", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("nome", nome.trim());
    if (categoria.trim()) formData.append("categoria", categoria.trim());
    if (altezza.trim()) formData.append("altezza", altezza.trim());
    if (larghezza.trim()) formData.append("larghezza", larghezza.trim());
    if (lunghezza.trim()) formData.append("lunghezza", lunghezza.trim());
    formData.append("costoOverride", costoFinale);
    formData.append("bom", JSON.stringify(bom.map(r => ({ materialId: r.materialId, quantita: Number(r.quantita || 0) }))));
    if (immagine) formData.append("immagine", immagine);

    if (product) {
      updateMutation.mutate(formData);
    } else {
      onSubmit?.(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Nome Articolo</Label>
        <Input data-testid="input-product-name" value={nome} onChange={e => setNome(e.target.value)} placeholder="es. Cover per smartphone" />
      </div>

      <div>
        <Label>Categoria (facoltativo)</Label>
        <Input data-testid="input-category" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="es. Accessori" />
      </div>

      <div>
        <Label className="mb-2 block">Dimensioni (facoltative)</Label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Input data-testid="input-altezza" value={altezza} onChange={e => setAltezza(e.target.value)} placeholder="Altezza (cm)" />
          </div>
          <div>
            <Input data-testid="input-larghezza" value={larghezza} onChange={e => setLarghezza(e.target.value)} placeholder="Larghezza (cm)" />
          </div>
          <div>
            <Input data-testid="input-lunghezza" value={lunghezza} onChange={e => setLunghezza(e.target.value)} placeholder="Lunghezza (cm)" />
          </div>
        </div>
      </div>

      <div className="border rounded-md p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label>Materiali Utilizzati</Label>
          <Button variant="secondary" size="sm" data-testid="button-add-bom-material" onClick={addBomRow}>
            Aggiungi materiale
          </Button>
        </div>
        <div className="space-y-2" data-testid="list-bom-materials">
          {bom.map((r, i) => {
            const mat = materials.find(m => m.id === r.materialId);
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-center" data-testid={`row-bom-${i}`}>
                <select 
                  data-testid={`select-material-${i}`} 
                  value={r.materialId} 
                  onChange={e => updateBom(i, { materialId: e.target.value })} 
                  className="col-span-6 border rounded-md px-3 py-2"
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.nome} ({m.unita})</option>
                  ))}
                </select>
                <Input 
                  data-testid={`input-quantita-${i}`} 
                  value={r.quantita} 
                  onChange={e => updateBom(i, { quantita: e.target.value })} 
                  placeholder="Quantità" 
                  className="col-span-3"
                  type="number"
                  step="0.01"
                />
                <div className="col-span-2 text-sm text-muted-foreground">
                  €{mat ? (Number(r.quantita || 0) * Number(mat.costo_unit_medio || 0)).toFixed(2) : "0.00"}
                </div>
                <Button variant="ghost" size="sm" data-testid={`button-remove-bom-${i}`} onClick={() => removeBom(i)} className="col-span-1">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {bom.length === 0 && <div className="text-sm text-muted-foreground">Nessun materiale aggiunto</div>}
        </div>
      </div>

      <div className="border rounded-md p-3 space-y-2">
        <div className="text-sm">
          <span className="font-medium">Costo calcolato dai materiali: </span>
          <span className="text-green-600">€{costoCalcolato}</span>
        </div>
        <div>
          <Label>Costo finale (lascia vuoto per usare il calcolato)</Label>
          <Input 
            data-testid="input-costo-override" 
            value={costoManuale} 
            onChange={e => setCostoManuale(e.target.value)} 
            placeholder={`Calcolato: €${costoCalcolato}`}
            type="number"
            step="0.01"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Questo costo NON genera uscita (già registrata all'acquisto materiali). Verrà usato per calcolare il margine sulla vendita.
        </p>
      </div>

      <div>
        <Label htmlFor="immagine">Immagine Articolo</Label>
        {product?.imageUrl && !immagine && (
          <div className="mt-2 mb-2">
            <img src={product.imageUrl} alt={product.nome} className="w-24 h-24 object-cover rounded-md border" />
          </div>
        )}
        <Input 
          id="immagine" 
          type="file" 
          accept="image/*" 
          data-testid="input-immagine"
          onChange={e => setImmagine(e.target.files?.[0] || null)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        {onClose && <Button variant="outline" onClick={onClose}>Annulla</Button>}
        <Button data-testid="button-create-vetrina" onClick={handleSubmit}>
          {product ? "Salva modifiche" : "Aggiungi Articolo"}
        </Button>
      </div>
    </div>
  );
}
