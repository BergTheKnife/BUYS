
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type StoreConfig = {
  id?: string;
  tipologiaStore: string;
  valuta: string;
  paese: string;
  ivaPredefinita: string;
  produzione: number;
  vetrina: number;
  varianti: number;
  serialiImei: number;
  lottiScadenze: number;
  spedizioni: number;
  servizi: number;
  digitale: number;
};

const TIPI = [
  { name: "Abbigliamento & Accessori", flags: { spedizioni: 1, produzione: 0, vetrina: 0, varianti: 1 } },
  { name: "Calzature", flags: { spedizioni: 1, produzione: 0, vetrina: 0 } },
  { name: "Gioielli & Orologi", flags: { spedizioni: 1, produzione: 0, vetrina: 0 } },
  { name: "Elettronica / Telefonia", flags: { spedizioni: 1, serialiImei: 1 } },
  { name: "Informatica & Periferiche", flags: { spedizioni: 1, serialiImei: 1 } },
  { name: "Casa & Arredo", flags: { spedizioni: 1 } },
  { name: "Sport & Outdoor", flags: { spedizioni: 1, varianti: 1 } },
  { name: "Cosmetici & Benessere", flags: { spedizioni: 1, lottiScadenze: 1 } },
  { name: "Alimentari & Bevande", flags: { spedizioni: 1, lottiScadenze: 1 } },
  { name: "Libri & Media", flags: { spedizioni: 1 } },
  { name: "Ricambi Auto/Moto", flags: { spedizioni: 1, serialiImei: 1 } },
  { name: "Artigianato / Maker / Stampa 3D", flags: { spedizioni: 1, produzione: 1, vetrina: 1 } },
  { name: "Stampa & Personalizzazioni", flags: { spedizioni: 1, produzione: 1, vetrina: 1 } },
  { name: "Digitale / Download", flags: { spedizioni: 0, produzione: 0, vetrina: 0, digitale: 1 } },
  { name: "Servizi", flags: { spedizioni: 0, produzione: 0, vetrina: 0, servizi: 1 } },
];

export default function ImpostaStorePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: cfg } = useQuery({
    queryKey: ["/api/store-config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/store-config");
      return res.json() as Promise<StoreConfig | null>;
    },
  });

  const [form, setForm] = useState<StoreConfig>({
    tipologiaStore: "Abbigliamento & Accessori",
    valuta: "EUR",
    paese: "IT",
    ivaPredefinita: "22.00",
    produzione: 0, vetrina: 0, varianti: 0, serialiImei: 0, lottiScadenze: 0, spedizioni: 1, servizi: 0, digitale: 0,
  });

  useEffect(() => {
    if (cfg) setForm(cfg);
  }, [cfg]);

  const saveMutation = useMutation({
    mutationFn: async (data: StoreConfig) => {
      const res = await apiRequest("POST", "/api/store-config", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/store-config"] });
      qc.invalidateQueries({ queryKey: ["/api/navigation"] });
      toast({ title: "Impostazioni salvate", description: "Lo store è stato aggiornato." });
    },
  });

  function applyPreset(name: string) {
    const preset = TIPI.find(t => t.name === name);
    const base = {
      produzione: 0, vetrina: 0, varianti: 0, serialiImei: 0, lottiScadenze: 0, spedizioni: 1, servizi: 0, digitale: 0,
    };
    setForm(f => ({
      ...f,
      tipologiaStore: name,
      ...base,
      ...(preset?.flags || {}),
    }));
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Imposta Store</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipologia di store</Label>
                <Select value={form.tipologiaStore} onValueChange={(v) => applyPreset(v)}>
                  <SelectTrigger><SelectValue placeholder="Seleziona tipologia" /></SelectTrigger>
                  <SelectContent>
                    {TIPI.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valuta</Label>
                <Input value={form.valuta} onChange={(e) => setForm({ ...form, valuta: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Paese</Label>
                <Input value={form.paese} onChange={(e) => setForm({ ...form, paese: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>IVA predefinita (%)</Label>
                <Input type="number" step="0.01" value={form.ivaPredefinita} onChange={(e) => setForm({ ...form, ivaPredefinita: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ["Produzione","produzione"],
                ["Vetrina","vetrina"],
                ["Varianti (taglie, colori…)","varianti"],
                ["Seriali / IMEI","serialiImei"],
                ["Lotti e Scadenze","lottiScadenze"],
                ["Spedizioni","spedizioni"],
                ["Servizi","servizi"],
                ["Digitale / Download","digitale"],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="font-medium">{label}</Label>
                  <Switch checked={(form as any)[key] === 1} onCheckedChange={(v) => setForm({ ...form, [key]: v ? 1 : 0 } as any)} />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button onClick={() => saveMutation.mutate(form)} className="bg-green-600 hover:bg-green-700">Salva</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
