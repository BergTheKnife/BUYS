
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Material = { id: string; nomeMateriale: string; unita: string };
type Showcase = { id: string; nomeArticolo: string; categoria?: string | null; costoPrevisto: string };

export default function VetrinaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: showcase = [] } = useQuery({
    queryKey: ["/api/produzione/vetrina"],
    queryFn: async () => (await apiRequest("GET", "/api/produzione/vetrina")).json() as Promise<Showcase[]>,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["/api/produzione/materiali"],
    queryFn: async () => (await apiRequest("GET", "/api/produzione/materiali")).json(),
  });

  const [openAdd, setOpenAdd] = useState(false);
  const [nome, setNome] = useState("");
  const [cat, setCat] = useState("");
  const [altezza, setAltezza] = useState("");
  const [larghezza, setLarghezza] = useState("");
  const [lunghezza, setLunghezza] = useState("");
  const [links, setLinks] = useState<{ materialId: string; quantitaPerPezzo: number }[]>([]);

  function addLink() {
    if (!materials[0]) return;
    setLinks([...links, { materialId: materials[0].id, quantitaPerPezzo: 1 }]);
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/produzione/vetrina", {
        nomeArticolo: nome,
        categoria: cat || null,
        altezza: altezza || null,
        larghezza: larghezza || null,
        lunghezza: lunghezza || null,
        materiali: links,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/produzione/vetrina"] });
      setOpenAdd(false);
      setLinks([]);
      toast({ title: "Articolo aggiunto in vetrina", description: "Costo previsto calcolato automaticamente." });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/produzione/vetrina/${id}/archivia`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/produzione/vetrina"] });
      toast({ title: "Articolo archiviato", description: "Resta nello storico." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/produzione/vetrina/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/produzione/vetrina"] });
      toast({ title: "Articolo eliminato", description: "Nessun uso registrato, eliminazione definitiva." });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Vetrina</h1>
          <Button onClick={() => setOpenAdd(true)} className="bg-blue-600 hover:bg-blue-700">Aggiungi</Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Articoli in vetrina</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Materiali collegati</TableHead>
                  <TableHead>Costo previsto</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showcase.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.nomeArticolo}</TableCell>
                    <TableCell>{s.categoria || "-"}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>€ {s.costoPrevisto}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" onClick={() => archiveMutation.mutate(s.id)}>Archivia</Button>
                      <Button variant="destructive" onClick={() => deleteMutation.mutate(s.id)}>Elimina (solo se mai usato)</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add Dialog */}
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Aggiungi articolo in vetrina</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={nome} onChange={e=>setNome(e.target.value)} /></div>
              <div><Label>Categoria</Label><Input value={cat} onChange={e=>setCat(e.target.value)} /></div>
              <div><Label>Altezza (cm)</Label><Input type="number" step="0.01" value={altezza} onChange={e=>setAltezza(e.target.value)} /></div>
              <div><Label>Larghezza (cm)</Label><Input type="number" step="0.01" value={larghezza} onChange={e=>setLarghezza(e.target.value)} /></div>
              <div><Label>Lunghezza (cm)</Label><Input type="number" step="0.01" value={lunghezza} onChange={e=>setLunghezza(e.target.value)} /></div>

              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Materiali necessari</Label>
                  <Button variant="outline" onClick={addLink}>Aggiungi materiale</Button>
                </div>
                <div className="space-y-2">
                  {links.map((lnk, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                      <select className="h-10 rounded-md border px-3 bg-background" value={lnk.materialId} onChange={(e)=>{
                        const v = e.target.value;
                        setLinks(links.map((l,i)=> i===idx ? { ...l, materialId: v } : l));
                      }}>
                        {materials.map((m: any) => <option key={m.id} value={m.id}>{m.nomeMateriale}</option>)}
                      </select>
                      <div className="flex items-center gap-2">
                        <Label className="min-w-[140px]">Quantità per pezzo</Label>
                        <Input type="number" step="0.001" value={lnk.quantitaPerPezzo} onChange={(e)=>{
                          const v = parseFloat(e.target.value);
                          setLinks(links.map((l,i)=> i===idx ? { ...l, quantitaPerPezzo: v } : l));
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button className="bg-green-600 hover:bg-green-700" onClick={()=>addMutation.mutate()}>Salva</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
