import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
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
  Settings,
  Building2,
  ChevronDown,
  Plus,
  UserPlus,
  Edit,
  Lock,
  Shield
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Activity } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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

// Form schemas
const createActivitySchema = z.object({
  nome: z.string().min(1, "Nome attività richiesto").max(100, "Nome troppo lungo"),
  password: z.string().min(6, "Password deve essere di almeno 6 caratteri"),
});

const joinActivitySchema = z.object({
  nome: z.string().min(1, "Nome attività richiesto"),
  password: z.string().min(1, "Password richiesta"),
});

type CreateActivityForm = z.infer<typeof createActivitySchema>;
type JoinActivityForm = z.infer<typeof joinActivitySchema>;

export function Navbar() {
  const { user, currentActivity, hasActivity, logout, switchActivity } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for modals
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [showJoinActivity, setShowJoinActivity] = useState(false);
  
  // Fetch user's activities
  const { data: userActivities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    enabled: !!user,
  });
  
  // Forms for modals
  const createForm = useForm<CreateActivityForm>({
    resolver: zodResolver(createActivitySchema),
    defaultValues: {
      nome: "",
      password: "",
    },
  });

  const joinForm = useForm<JoinActivityForm>({
    resolver: zodResolver(joinActivitySchema),
    defaultValues: {
      nome: "",
      password: "",
    },
  });
  
  // Mutations
  const createActivityMutation = useMutation({
    mutationFn: async (data: CreateActivityForm) => {
      return await apiRequest("POST", "/api/activities", data);
    },
    onSuccess: async () => {
      toast({
        title: "Attività creata",
        description: "La tua nuova attività è stata creata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setShowCreateActivity(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella creazione dell'attività",
        variant: "destructive",
      });
    },
  });

  const joinActivityMutation = useMutation({
    mutationFn: async (data: JoinActivityForm) => {
      return await apiRequest("POST", "/api/activities/join", data);
    },
    onSuccess: async () => {
      toast({
        title: "Accesso effettuato",
        description: "Accesso all'attività effettuato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setShowJoinActivity(false);
      joinForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'accesso all'attività",
        variant: "destructive",
      });
    },
  });
  
  const onCreateSubmit = (data: CreateActivityForm) => {
    createActivityMutation.mutate(data);
  };
  
  const onJoinSubmit = (data: JoinActivityForm) => {
    joinActivityMutation.mutate(data);
  };

  // Don't show navigation items if user doesn't have an activity selected
  const showNavigation = hasActivity;

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
    <nav className="bg-primary text-white shadow-lg fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Logo */}
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10 p-1 sm:p-2 min-h-[52px] flex items-center"
            onClick={() => setLocation("/dashboard")}
          >
            <img 
              src={buysLogoWhitePath} 
              alt="BUYS" 
              className="h-12 sm:h-16 w-auto"
            />
          </Button>

          {/* Desktop Navigation - only show if user has activity */}
          {showNavigation && (
            <div className="hidden lg:flex items-center space-x-2">
              <NavigationItems />
            </div>
          )}

          {/* Activity Selector & User Menu */}
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-5">
            {/* Activity Dropdown */}
            {currentActivity && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-white hover:bg-white/10 min-h-[52px] text-sm sm:text-base px-3 sm:px-4 py-3">
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                    <span className="hidden xs:block sm:hidden lg:block truncate max-w-[100px] sm:max-w-[140px]">
                      {currentActivity.nome}
                    </span>
                    <span className="xs:hidden sm:block lg:hidden">
                      {currentActivity.nome.slice(0, 10)}...
                    </span>
                    <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 ml-2 flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* Switch Activity - Show other activities if user has multiple */}
                  {userActivities.length > 1 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Cambia Attività
                      </div>
                      {userActivities
                        .filter(activity => activity.id !== currentActivity.id)
                        .map((activity) => (
                          <DropdownMenuItem 
                            key={activity.id}
                            onClick={() => switchActivity(activity.id)}
                          >
                            <Store className="h-4 w-4 mr-2" />
                            {activity.nome}
                          </DropdownMenuItem>
                        ))
                      }
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  {/* Create New Activity */}
                  <DropdownMenuItem onClick={() => setShowCreateActivity(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crea nuova attività
                  </DropdownMenuItem>
                  
                  {/* Join Activity */}
                  <DropdownMenuItem onClick={() => setShowJoinActivity(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Unisciti ad un'attività
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Gestione Attività
                  </div>
                  <DropdownMenuItem onClick={() => setLocation("/impostazioni-attivita")}>
                    <Settings className="h-4 w-4 mr-2" />
                    Impostazioni
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-white/10 min-h-[52px] text-sm sm:text-base px-3 sm:px-4 py-3">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                  <span className="hidden sm:block truncate max-w-[120px]">{user?.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLocation("/profilo")}>
                  <User className="h-4 w-4 mr-2" />
                  Profilo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/admin")}>
                  <Shield className="h-4 w-4 mr-2" />
                  <span className="text-blue-600 font-medium">Amministratore</span>
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
                <Button variant="ghost" size="icon" className="lg:hidden text-white hover:bg-white/10 min-h-[52px] w-12 px-3">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] xs:w-[300px] sm:w-[400px] bg-white dark:bg-gray-900">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <img 
                      src={buysLogoColorPath} 
                      alt="BUYS - Build Up Your Store" 
                      className="h-20 w-auto"
                    />
                  </div>
                  
                  {/* Navigation - only show if user has activity */}
                  {showNavigation && (
                    <div className="flex flex-col space-y-1 flex-1">
                      <NavigationItems mobile />
                    </div>
                  )}
                  
                  {/* Activity info and user info section */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">


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

      {/* Create Activity Modal */}
      <Dialog open={showCreateActivity} onOpenChange={setShowCreateActivity}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Crea nuova attività</DialogTitle>
            <DialogDescription>
              Crea una nuova attività per la tua azienda
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Attività</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Es. Negozio di Abbigliamento"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput 
                        placeholder="Password per l'attività"
                        showPasswordHint={true}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateActivity(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  disabled={createActivityMutation.isPending}
                  className="flex-1"
                >
                  {createActivityMutation.isPending ? "Creazione..." : "Crea"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Join Activity Modal */}
      <Dialog open={showJoinActivity} onOpenChange={setShowJoinActivity}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Unisciti ad un'attività</DialogTitle>
            <DialogDescription>
              Accedi ad un'attività esistente
            </DialogDescription>
          </DialogHeader>
          
          <Form {...joinForm}>
            <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-4">
              <FormField
                control={joinForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Attività</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nome dell'attività esistente"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={joinForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput 
                        placeholder="Password dell'attività"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowJoinActivity(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  disabled={joinActivityMutation.isPending}
                  className="flex-1"
                >
                  {joinActivityMutation.isPending ? "Accesso..." : "Accedi"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
