import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SellFromVetrinaPage() {
  const { data: vetrina = [] } = useQuery<any[]>({ queryKey: ["/api/production/vetrina"] });
  const [productId, setProductId] = useState<string>("");
  const [quantita, setQuantita] = useState<string>("1");
  const [prezzoVendita, setPrezzo] = useState<string>("");
  const [vendutoA, setVendutoA] = useState<string>("");
  const [incassato, setIncassato] = useState<number>(0);
  const [incassatoDa, setIncassatoDa] = useState<string>("");
  const [incassatoSu, setIncassatoSu] = useState<string>("");
  const [data, setData] = useState<string>("");

  const mutation = useMutation({
    mutationFn: async () => {
      const prep = await apiRequest("POST", "/api/production/prepare-from-vetrina", {
        productId, quantita: Number(quantita||1)
      });
      const sale = await apiRequest("POST", "/api/vendite", {
        inventarioId: prep.inventarioId,
        quantita: Number(quantita||1),
        prezzoVendita,
        vendutoA,
        incassato,
        incassatoDa,
        incassatoSu,
        data: data || undefined
      });
      return sale;
    }
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Vendita da Vetrina</h1>

      <div className="space-y-3 max-w-md">
        <div>
          <Label>Prodotto (Vetrina)</Label>
          <select className="border rounded-md px-3 py-2 w-full" value={productId} onChange={e=>setProductId(e.target.value)}>
            <option value="">Seleziona…</option>
            {vetrina.map((p:any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div><Label>Quantità</Label><Input value={quantita} onChange={e=>setQuantita(e.target.value)} /></div>
        <div><Label>Prezzo di vendita</Label><Input value={prezzoVendita} onChange={e=>setPrezzo(e.target.value)} /></div>
        <div><Label>Venduto a (facoltativo)</Label><Input value={vendutoA} onChange={e=>setVendutoA(e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Incassato (0/1)</Label><Input value={incassato} onChange={e=>setIncassato(Number(e.target.value)||0)} /></div>
          <div><Label>Incassato da</Label><Input value={incassatoDa} onChange={e=>setIncassatoDa(e.target.value)} /></div>
          <div><Label>Incassato su</Label><Input value={incassatoSu} onChange={e=>setIncassatoSu(e.target.value)} /></div>
        </div>
        <div><Label>Data (YYYY-MM-DD)</Label><Input value={data} onChange={e=>setData(e.target.value)} /></div>
        <div className="flex justify-end"><Button onClick={()=>mutation.mutate()} disabled={!productId || !quantita || !prezzoVendita}>Registra vendita</Button></div>
      </div>
    </div>
  );
}
