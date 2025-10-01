
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

type Material = {
  id: string;
  nomeMateriale: string;
  unita: string;
  colore?: string | null;
  quantitaResidua: number;
  costoMedioPerUnita: number;
  scadenzaProssima?: string | null;
};

export default function MaterialiPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: materials = [] } = useQuery({
    queryKey: ["/api/produzione/materiali"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/produzione/materiali");
      return res.json() as Promise<Material[]>;
    },
  });

  const [openAdd, setOpenAdd] = useState(false);
  const [openRefill, setOpenRefill] = useState<string | null>(null);

  // Add material form state
  const [mNome, setMNome] = useState("");
  const [mUnita, setMUnita] = useState<"grammi (g)" | "metri (m)" | "pezzi (pz)">( "grammi (g)" );
  const [mColore, setMColore] = useState("");
  const [mQt, setMQt] = useState<number>(0);
  const [mCosto, setMCosto] = useState<number>(0);
  const [mLotto, setMLotto] = useState("");
  const [mScad, setMScad] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/produzione/materiali", {
        nomeMateriale: mNome,
        unita: mUnita,
        colore: mColore || null,
        quantitaTotale: mQt,
        costoTotale: mCosto,
        lotto: mLotto || null,
        scadenza: mScad || null,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/produzione/materiali"] });
      setOpenAdd(false);
      toast({ title: "Materiale aggiunto", description: "Contabilità aggiornata correttamente." });
    },
  });

  const refillMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/produzione/materiali/${id}/rifornisci`, {
        quantitaTotale: mQt,
        costoTotale: mCosto,
        lotto: mLotto || null,
        scadenza: mScad || null,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/produzione/materiali"] });
      setOpenRefill(null);
      toast({ title: "Rifornimento registrato", description: "Nuovo lotto creato." });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/produzione/materiali/${id}/archivia`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/produzione/materiali"] });
      toast({ title: "Materiale archiviato", description: "Resta nello storico, nessun movimento contabile." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/produzione/materiali/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/produzione/materiali"] });
      toast({ title: "Materiale eliminato", description: "Rollback contabile effettuato (deposito cassa + cancellazione lotti)." });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Materiali</h1>
          <Button onClick={() => setOpenAdd(true)} className="bg-blue-600 hover:bg-blue-700">Aggiungi</Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Elenco materiali</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Unità</TableHead>
                  <TableHead>Colore</TableHead>
                  <TableHead>Quantità residua</TableHead>
                  <TableHead>Costo medio/unità</TableHead>
                  <TableHead>Scadenza più vicina</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{m.nomeMateriale}</TableCell>
                    <TableCell>{m.unita}</TableCell>
                    <TableCell>{m.colore || "-"}</TableCell>
                    <TableCell>{m.quantitaResidua}</TableCell>
                    <TableCell>€ {m.costoMedioPerUnita.toFixed(4)}</TableCell>
                    <TableCell>{m.scadenzaProssima ? new Date(m.scadenzaProssima).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" onClick={() => { setOpenRefill(m.id); setMQt(0); setMCosto(0); setMLotto(""); setMScad(""); }}>Rifornisci</Button>
                      <Button variant="outline" onClick={() => archiveMutation.mutate(m.id)}>Archivia</Button>
                      <Button variant="destructive" onClick={() => deleteMutation.mutate(m.id)}>Elimina (solo se mai usato)</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add Material Dialog */}
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Aggiungi materiale</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 gap-3">
              <div><Label>Nome materiale</Label><Input value={mNome} onChange={e=>setMNome(e.target.value)} /></div>
              <div><Label>Unità</Label>
                <select className="w-full h-10 rounded-md border px-3 bg-background" value={mUnita} onChange={(e)=>setMUnita(e.target.value as any)}>
                  <option>grammi (g)</option>
                  <option>metri (m)</option>
                  <option>pezzi (pz)</option>
                </select>
              </div>
              <div><Label>Colore (facoltativo)</Label><Input value={mColore} onChange={e=>setMColore(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Quantità totale</Label><Input type="number" step="0.001" value={mQt} onChange={e=>setMQt(parseFloat(e.target.value))} /></div>
                <div><Label>Costo totale (€)</Label><Input type="number" step="0.01" value={mCosto} onChange={e=>setMCosto(parseFloat(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Lotto (facoltativo)</Label><Input value={mLotto} onChange={e=>setMLotto(e.target.value)} /></div>
                <div><Label>Scadenza (se richiesta)</Label><Input type="date" value={mScad} onChange={e=>setMScad(e.target.value)} /></div>
              </div>
              <div className="flex justify-end"><Button className="bg-green-600 hover:bg-green-700" onClick={()=>addMutation.mutate()}>Salva</Button></div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Refill Dialog */}
        <Dialog open={!!openRefill} onOpenChange={(v)=>{ if(!v) setOpenRefill(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Rifornisci</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Quantità totale</Label><Input type="number" step="0.001" value={mQt} onChange={e=>setMQt(parseFloat(e.target.value))} /></div>
                <div><Label>Costo totale (€)</Label><Input type="number" step="0.01" value={mCosto} onChange={e=>setMCosto(parseFloat(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Lotto (facoltativo)</Label><Input value={mLotto} onChange={e=>setMLotto(e.target.value)} /></div>
                <div><Label>Scadenza (se richiesta)</Label><Input type="date" value={mScad} onChange={e=>setMScad(e.target.value)} /></div>
              </div>
              <div className="flex justify-end"><Button className="bg-green-600 hover:bg-green-700" onClick={()=>openRefill && refillMutation.mutate(openRefill)}>Salva</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
