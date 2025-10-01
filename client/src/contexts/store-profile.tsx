import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

type StoreProfile = {
  id?: string;
  storeType?: string;
  featureFlags?: Record<string, boolean>;
  currency?: string;
  country?: string;
  defaultVat?: string;
};

const StoreProfileContext = createContext<StoreProfile | null>(null);

export function StoreProfileProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery<StoreProfile>({ queryKey: ['/api/store/profile'] });
  return <StoreProfileContext.Provider value={data || null}>{children}</StoreProfileContext.Provider>;
}

export function useStoreProfile() {
  return useContext(StoreProfileContext);
}
