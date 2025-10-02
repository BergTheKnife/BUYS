import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Store, Save } from "lucide-react";

const STORE_TYPES = [
  {
    value: "abbigliamento",
    label: "Abbigliamento & Accessori",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: true,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "calzature",
    label: "Calzature",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: true,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "gioielli",
    label: "Gioielli & Orologi",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "elettronica",
    label: "Elettronica / Telefonia",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: true,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "informatica",
    label: "Informatica & Periferiche",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: true,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "casa",
    label: "Casa & Arredo",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "sport",
    label: "Sport & Outdoor",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: true,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "cosmetici",
    label: "Cosmetici & Benessere",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: false,
      hasLottiScadenze: true,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "alimentari",
    label: "Alimentari & Bevande",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: false,
      hasLottiScadenze: true,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "libri",
    label: "Libri & Media",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "ricambi",
    label: "Ricambi Auto/Moto",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: true,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "artigianato",
    label: "Artigianato / Maker / Stampa 3D",
    defaults: {
      hasProduzione: true,
      hasVetrina: true,
      hasVarianti: false,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "stampa",
    label: "Stampa & Personalizzazioni",
    defaults: {
      hasProduzione: true,
      hasVetrina: true,
      hasVarianti: false,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: true,
      hasServizi: false,
      hasDigitale: false,
    }
  },
  {
    value: "digitale",
    label: "Digitale / Download",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: false,
      hasServizi: false,
      hasDigitale: true,
    }
  },
  {
    value: "servizi",
    label: "Servizi",
    defaults: {
      hasProduzione: false,
      hasVetrina: false,
      hasVarianti: false,
      hasSeriali: false,
      hasLottiScadenze: false,
      hasSpedizioni: false,
      hasServizi: true,
      hasDigitale: false,
    }
  },
];

export default function StoreSetup() {
  const { currentActivity } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [formData, setFormData] = useState({
    tipologiaStore: "",
    valuta: "EUR",
    paese: "IT",
    ivaPredefinita: "22.00",
    hasProduzione: false,
    hasVetrina: false,
    hasVarianti: false,
    hasSeriali: false,
    hasLottiScadenze: false,
    hasSpedizioni: true,
    hasServizi: false,
    hasDigitale: false,
  });

  const { data: profile } = useQuery({
    queryKey: ["/api/store/profile"],
    enabled: !!currentActivity,
  });

  useEffect(() => {
    if (profile && typeof profile === 'object') {
      const p = profile as any;
      const flags = p.featureFlags || {};
      setFormData({
        tipologiaStore: p.storeType || "",
        valuta: p.currency || "EUR",
        paese: p.country || "IT",
        ivaPredefinita: p.defaultVat || "22.00",
        hasProduzione: !!flags.production,
        hasVetrina: !!flags.vetrina,
        hasVarianti: !!flags.variants,
        hasSeriali: !!flags.serials,
        hasLottiScadenze: !!flags.lots_expiry,
        hasSpedizioni: !!flags.shipping,
        hasServizi: !!flags.services,
        hasDigitale: !!flags.digital,
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/store/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/profile"] });
      toast({
        title: "✅ Configurazione salvata",
        description: "Le impostazioni dello store sono state aggiornate.",
      });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    },
  });

  const handleStoreTypeChange = (value: string) => {
    const storeType = STORE_TYPES.find(t => t.value === value);
    if (storeType) {
      setFormData(prev => ({
        ...prev,
        tipologiaStore: value,
        ...storeType.defaults,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tipologiaStore) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Seleziona una tipologia di store",
      });
      return;
    }
    
    // Prepara i feature flags per il backend
    const featureFlags = {
      production: formData.hasProduzione,
      vetrina: formData.hasVetrina,
      variants: formData.hasVarianti,
      serials: formData.hasSeriali,
      lots_expiry: formData.hasLottiScadenze,
      shipping: formData.hasSpedizioni,
      services: formData.hasServizi,
      digital: formData.hasDigitale,
    };
    
    mutation.mutate({
      storeType: formData.tipologiaStore,
      currency: formData.valuta,
      country: formData.paese,
      defaultVat: formData.ivaPredefinita,
      featureFlags,
    });
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-6 w-6" />
            Imposta Store
          </CardTitle>
          <CardDescription>
            Configura il tipo di attività e le funzionalità attive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipologia Store */}
            <div className="space-y-2">
              <Label htmlFor="tipologiaStore">Tipologia di Store *</Label>
              <Select
                value={formData.tipologiaStore}
                onValueChange={handleStoreTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipologia..." />
                </SelectTrigger>
                <SelectContent>
                  {STORE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valuta e Paese */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valuta">Valuta</Label>
                <Input
                  id="valuta"
                  value={formData.valuta}
                  onChange={e => setFormData(prev => ({ ...prev, valuta: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paese">Paese</Label>
                <Input
                  id="paese"
                  value={formData.paese}
                  onChange={e => setFormData(prev => ({ ...prev, paese: e.target.value }))}
                />
              </div>
            </div>

            {/* IVA */}
            <div className="space-y-2">
              <Label htmlFor="iva">IVA Predefinita (%)</Label>
              <Input
                id="iva"
                type="number"
                step="0.01"
                value={formData.ivaPredefinita}
                onChange={e => setFormData(prev => ({ ...prev, ivaPredefinita: e.target.value }))}
              />
            </div>

            {/* Funzionalità Attive */}
            <div className="space-y-4">
              <Label className="text-base">Funzionalità Attive</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="produzione"
                    checked={formData.hasProduzione}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasProduzione: !!checked }))}
                  />
                  <label htmlFor="produzione" className="text-sm cursor-pointer">
                    Produzione
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="vetrina"
                    checked={formData.hasVetrina}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasVetrina: !!checked }))}
                  />
                  <label htmlFor="vetrina" className="text-sm cursor-pointer">
                    Vetrina
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="varianti"
                    checked={formData.hasVarianti}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasVarianti: !!checked }))}
                  />
                  <label htmlFor="varianti" className="text-sm cursor-pointer">
                    Varianti (taglie, colori...)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="seriali"
                    checked={formData.hasSeriali}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasSeriali: !!checked }))}
                  />
                  <label htmlFor="seriali" className="text-sm cursor-pointer">
                    Seriali / IMEI
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lotti"
                    checked={formData.hasLottiScadenze}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasLottiScadenze: !!checked }))}
                  />
                  <label htmlFor="lotti" className="text-sm cursor-pointer">
                    Lotti e Scadenze
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="spedizioni"
                    checked={formData.hasSpedizioni}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasSpedizioni: !!checked }))}
                  />
                  <label htmlFor="spedizioni" className="text-sm cursor-pointer">
                    Spedizioni
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="servizi"
                    checked={formData.hasServizi}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasServizi: !!checked }))}
                  />
                  <label htmlFor="servizi" className="text-sm cursor-pointer">
                    Servizi
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="digitale"
                    checked={formData.hasDigitale}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasDigitale: !!checked }))}
                  />
                  <label htmlFor="digitale" className="text-sm cursor-pointer">
                    Digitale / Download
                  </label>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {mutation.isPending ? "Salvataggio..." : "Salva Configurazione"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
