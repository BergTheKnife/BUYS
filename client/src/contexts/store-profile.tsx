import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

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
  const { currentActivity } = useAuth();
  
  const { data } = useQuery<StoreProfile>({ 
    queryKey: ['/api/store/profile'],
    enabled: !!currentActivity?.id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  
  return <StoreProfileContext.Provider value={data || null}>{children}</StoreProfileContext.Provider>;
}

export function useStoreProfile() {
  return useContext(StoreProfileContext);
}
