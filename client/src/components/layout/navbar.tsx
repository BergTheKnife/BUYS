
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Menu, Home, Package, ShoppingCart, Truck, Receipt, TrendingUp, Wallet, Wrench, Store } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type StoreConfig = {
  tipologiaStore: string;
  produzione: number;
  vetrina: number;
  spedizioni: number;
};

export function Navbar() {
  const { user, currentActivity, setLocation, location, handleLogout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Carica store-config per mostrare voci dinamiche
  const { data: cfg } = useQuery({
    queryKey: ["/api/store-config"],
    queryFn: async () => (await apiRequest("GET", "/api/store-config")).json() as Promise<StoreConfig | null>,
  });

  const navigation = useMemo(() => {
    const base = [
      { name: "Dashboard", href: "/dashboard", icon: Home },
      { name: "Magazzino", href: "/inventario", icon: Package },
      { name: "Vendite", href: "/vendite", icon: ShoppingCart },
      ...(cfg?.spedizioni === 1 ? [{ name: "Spedizioni", href: "/spedizioni", icon: Truck }] : [] as any),
      { name: "Spese", href: "/spese", icon: Receipt },
      { name: "Bilancio", href: "/bilancio", icon: TrendingUp },
      { name: "Gestione Finanziaria", href: "/gestione-finanziaria", icon: Wallet },
      ...(cfg?.produzione === 1 ? [
        { name: "Materiali", href: "/produzione/materiali", icon: Wrench },
        { name: "Vetrina", href: "/produzione/vetrina", icon: Store },
      ] : [] as any),
    ];
    return base;
  }, [cfg]);

  const NavigationItems = ({ mobile = false, onItemClick }: { mobile?: boolean; onItemClick?: () => void }) => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href;
        return (
          <Button
            key={item.name}
            variant={isActive ? "secondary" : "ghost"}
            className={`${mobile ? "w-full justify-start py-4" : "py-3 px-4 text-base"} ${
              mobile
                ? isActive
                  ? "bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800"
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
                : isActive
                  ? "bg-white/20 text-white"
                  : "text-white/90 hover:text-white hover:bg-white/10"
            }`}
            onClick={() => {
              setLocation(item.href);
              onItemClick?.();
            }}
          >
            <Icon className={`${mobile ? "h-4 w-4" : "h-5 w-5"} mr-2`} />
            {item.name}
          </Button>
        );
      })}
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 text-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden lg:inline-flex text-white" onClick={() => setLocation("/dashboard")}>
              <Home className="h-5 w-5 mr-2" /> BUYS
            </Button>

            {/* TOP NAV: Imposta Store */}
            <Button variant="ghost" className="text-white" onClick={() => setLocation("/imposta-store")}>
              Imposta Store
            </Button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Desktop items (left sidebar replicates; but here we keep header light) */}
            <div className="hidden lg:flex items-center gap-1">
              <NavigationItems />
            </div>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white">Account</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem disabled>{user?.email}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/imposta-store")}>Imposta Store</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <Button variant="ghost" size="icon" className="lg:hidden text-white" onClick={() => setMobileMenuOpen(v => !v)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-2 border-t border-white/10">
            <NavigationItems mobile onItemClick={() => setMobileMenuOpen(false)} />
          </div>
        )}
      </div>
    </header>
  );
}
