import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Store,
  Home,
  Package,
  ShoppingCart,
  Receipt,
  TrendingUp,
  User,
  LogOut,
  Menu,
  Building2,
  ChevronDown,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import buysLogoWhitePath from "@assets/Buys bianco_1754472538088.png";
import buysLogoColorPath from "@assets/Buys colore_1754472538088.png";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Magazzino", href: "/inventario", icon: Package },
  { name: "Vendite", href: "/vendite", icon: ShoppingCart },
  { name: "Spese", href: "/spese", icon: Receipt },
  { name: "Bilancio", href: "/bilancio", icon: TrendingUp },
];

export function Navbar() {
  const { user, currentActivity, logout } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const NavigationItems = ({ mobile = false, onItemClick }: { mobile?: boolean; onItemClick?: () => void }) => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href;
        return (
          <Button
            key={item.name}
            variant={isActive ? "secondary" : "ghost"}
            className={`${mobile ? "w-full justify-start" : ""} ${
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
            <Icon className="h-4 w-4 mr-2" />
            {item.name}
          </Button>
        );
      })}
    </>
  );

  return (
    <nav className="bg-primary text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10 p-2"
            onClick={() => setLocation("/dashboard")}
          >
            <img 
              src={buysLogoWhitePath} 
              alt="BUYS" 
              className="h-14 w-auto"
            />
          </Button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <NavigationItems />
          </div>

          {/* Activity Selector & User Menu */}
          <div className="flex items-center space-x-4">
            {/* Activity Dropdown */}
            {currentActivity && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-white hover:bg-white/10">
                    <Building2 className="h-4 w-4 mr-2" />
                    {currentActivity.nome}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation("/attivita")}>
                    <Store className="h-4 w-4 mr-2" />
                    Cambia Attività
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  <User className="h-4 w-4 mr-2" />
                  {user?.username}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLocation("/profilo")}>
                  <User className="h-4 w-4 mr-2" />
                  Profilo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-white dark:bg-gray-900">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <img 
                      src={buysLogoColorPath} 
                      alt="BUYS - Build Up Your Store" 
                      className="h-20 w-auto"
                    />
                  </div>
                  
                  {/* Navigation */}
                  <div className="flex flex-col space-y-1 flex-1">
                    <NavigationItems mobile />
                  </div>
                  
                  {/* Activity info and user info section */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    {/* Current Activity */}
                    {currentActivity && (
                      <div className="flex items-center space-x-2 mb-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-md">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {currentActivity.nome}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Attività corrente
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mb-3 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950"
                      onClick={() => setLocation("/attivita")}
                    >
                      <Store className="h-4 w-4 mr-2" />
                      Cambia Attività
                    </Button>

                    {/* User Info */}
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user?.nome} {user?.cognome}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          @{user?.username}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Esci
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
