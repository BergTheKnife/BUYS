import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TYPES = [
  "Abbigliamento & Accessori","Calzature","Gioielli & Orologi","Elettronica / Telefonia","Informatica & Periferiche",
  "Casa & Arredo","Sport & Outdoor","Cosmetici & Benessere","Alimentari & Bevande","Libri & Media",
  "Ricambi Auto/Moto","Artigianato / Maker / 3D Printing","Stampa & Personalizzazioni","Digitale / Download","Servizi"
];

const DEFAULT_FLAGS: Record<string, Record<string, boolean>> = {
  "Abbigliamento & Accessori": { production: false, vetrina: false, variants: true, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "Calzature": { production: false, vetrina: false, variants: true, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "Gioielli & Orologi": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "Elettronica / Telefonia": { production: false, vetrina: false, variants: false, serials: true, lots_expiry: false, shipping: true, services: false, digital: false },
  "Informatica & Periferiche": { production: false, vetrina: false, variants: false, serials: true, lots_expiry: false, shipping: true, services: false, digital: false },
  "Casa & Arredo": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "Sport & Outdoor": { production: false, vetrina: false, variants: true, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "Cosmetici & Benessere": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: true, shipping: true, services: false, digital: false },
  "Alimentari & Bevande": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: true, shipping: true, services: false, digital: false },
  "Libri & Media": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "Ricambi Auto/Moto": { production: false, vetrina: false, variants: false, serials: true, lots_expiry: false, shipping: true, services: false, digital: false },
  "Artigianato / Maker / 3D Printing": { production: true, vetrina: true, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "Stampa & Personalizzazioni": { production: true, vetrina: true, variants: false, serials: false, lots_expiry: false, shipping: true, services: false, digital: false },
  "Digitale / Download": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: false, services: false, digital: true },
  "Servizi": { production: false, vetrina: false, variants: false, serials: false, lots_expiry: false, shipping: false, services: true, digital: false }
};

export default function StoreSetup() {
  const { data: current } = useQuery<any>({ queryKey: ['/api/store/profile'] });
  const [storeType, setStoreType] = useState<string>(current?.storeType || "");
  const [currency, setCurrency] = useState<string>(current?.currency || "EUR");
  const [country, setCountry] = useState<string>(current?.country || "IT");
  const [defaultVat, setDefaultVat] = useState<string>(current?.defaultVat || "22.00");
  const [flags, setFlags] = useState<Record<string, boolean>>(current?.featureFlags || {});

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { storeType, currency, country, defaultVat, featureFlags: flags };
      const res = await apiRequest("POST", "/api/store/profile", payload);
      return res;
    }
  });

  const onTypeChange = (t: string) => {
    setStoreType(t);
    setFlags(DEFAULT_FLAGS[t] || {});
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">Configura il tuo Store</h1>

      <div className="space-y-3">
        <div>
          <Label>Tipologia di store</Label>
          <select className="border rounded-md px-3 py-2 w-full" value={storeType} onChange={e=>onTypeChange(e.target.value)}>
            <option value="">Seleziona…</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div><Label>Valuta</Label><Input value={currency} onChange={e=>setCurrency(e.target.value)} /></div>
          <div><Label>Paese</Label><Input value={country} onChange={e=>setCountry(e.target.value)} /></div>
          <div><Label>IVA default %</Label><Input value={defaultVat} onChange={e=>setDefaultVat(e.target.value)} /></div>
        </div>

        {storeType && (
          <div className="border rounded-md p-3">
            <div className="font-medium mb-2">Funzionalità</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(DEFAULT_FLAGS[storeType] || {}).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!flags[k]} onChange={e=>setFlags({...flags, [k]: e.target.checked})} />
                  {k}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={()=>mutation.mutate()} disabled={!storeType}>Salva configurazione</Button>
        </div>
      </div>
    </div>
  );
}
