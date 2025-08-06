import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Store, User, Lock, Mail, UserPlus, LogIn, Check, X, AlertCircle } from "lucide-react";
import buysLogoColorPath from "@assets/Buys colore_1754472538088.png";
import { insertUserSchema, loginUserSchema } from "@shared/schema";
import type { InsertUser, LoginUser } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

export default function Welcome() {
  const [isLogin, setIsLogin] = useState(true);
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: "" });
  const { user, hasActivity, login, register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect logic - automatic for returning users with activities
  useEffect(() => {
    if (user && hasActivity) {
      setLocation("/dashboard");
    } else if (user && !hasActivity && user.lastActivityId) {
      // User had an activity before, try to auto-switch to dashboard
      setLocation("/dashboard");
    } else if (user && !hasActivity && !user.lastActivityId) {
      // First time user, show activity selection
      setLocation("/attivita");
    }
  }, [user, hasActivity, setLocation]);

  const loginForm = useForm<LoginUser>({
    resolver: zodResolver(loginUserSchema),
    defaultValues: {
      emailOrUsername: "",
      password: "",
    },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      username: "",
      password: "",
    },
  });

  const onLogin = async (data: LoginUser) => {
    try {
      await login(data);
      toast({
        title: "Accesso effettuato",
        description: "Benvenuto in BUYS!",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Credenziali non valide",
        variant: "destructive",
      });
    }
  };

  const checkUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest("GET", `/api/auth/check-username/${username}`);
      return response.json();
    },
  });

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameStatus({ checking: false, available: false, message: "Username deve essere di almeno 3 caratteri" });
      return;
    }

    setUsernameStatus({ checking: true, available: null, message: "Controllo disponibilità..." });
    
    try {
      const result = await checkUsernameMutation.mutateAsync(username);
      setUsernameStatus({
        checking: false,
        available: result.available,
        message: result.message
      });
    } catch (error) {
      setUsernameStatus({ checking: false, available: false, message: "Errore nel controllo" });
    }
  };

  const onRegister = async (data: InsertUser) => {
    try {
      // Final username check before registration
      if (!usernameStatus.available) {
        toast({
          title: "Errore",
          description: "Username non disponibile",
          variant: "destructive",
        });
        return;
      }

      await register(data);
      toast({
        title: "Registrazione completata",
        description: "Account creato con successo!",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la registrazione",
        variant: "destructive",
      });
    }
  };



  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-lg bg-white/95 shadow-2xl border-0">
          <CardContent className="p-8">
            <div className="text-center mb-4">
              <div className="mb-2">
                <img 
                  src={buysLogoColorPath} 
                  alt="BUYS - Build Up Your Store" 
                  className="w-80 h-auto mx-auto max-w-full"
                />
              </div>
            </div>

            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailOrUsername">Email o Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="emailOrUsername"
                      className="pl-10"
                      placeholder="Inserisci email o username"
                      {...loginForm.register("emailOrUsername")}
                    />
                  </div>
                  {loginForm.formState.errors.emailOrUsername && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.emailOrUsername.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                    <PasswordInput
                      id="password"
                      className="pl-10"
                      placeholder="Inserisci password"
                      {...loginForm.register("password")}
                    />
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" />
                  <Label htmlFor="remember" className="text-sm">
                    Ricorda le mie credenziali
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Accedi
                </Button>

                <div className="text-center">
                  <span className="text-muted-foreground">Non hai un account? </span>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0"
                    onClick={() => setIsLogin(false)}
                  >
                    Registrati
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      placeholder="Nome"
                      {...registerForm.register("nome")}
                    />
                    {registerForm.formState.errors.nome && (
                      <p className="text-sm text-destructive">
                        {registerForm.formState.errors.nome.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cognome">Cognome</Label>
                    <Input
                      id="cognome"
                      placeholder="Cognome"
                      {...registerForm.register("cognome")}
                    />
                    {registerForm.formState.errors.cognome && (
                      <p className="text-sm text-destructive">
                        {registerForm.formState.errors.cognome.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-10"
                      placeholder="email@esempio.com"
                      {...registerForm.register("email")}
                    />
                  </div>
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      className="pl-10 pr-10"
                      placeholder="Username univoco"
                      {...registerForm.register("username", {
                        onChange: (e) => {
                          const value = e.target.value;
                          if (value.length >= 3) {
                            checkUsernameAvailability(value);
                          } else {
                            setUsernameStatus({ checking: false, available: false, message: "Username deve essere di almeno 3 caratteri" });
                          }
                        }
                      })}
                    />
                    <div className="absolute right-3 top-3">
                      {usernameStatus.checking && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      )}
                      {!usernameStatus.checking && usernameStatus.available === true && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                      {!usernameStatus.checking && usernameStatus.available === false && usernameStatus.message && (
                        <X className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  </div>
                  {usernameStatus.message && (
                    <p className={`text-sm ${usernameStatus.available ? 'text-green-600' : 'text-destructive'}`}>
                      {usernameStatus.message}
                    </p>
                  )}
                  {registerForm.formState.errors.username && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regPassword">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                    <PasswordInput
                      id="regPassword"
                      className="pl-10"
                      placeholder="Password sicura"
                      showPasswordHint={true}
                      {...registerForm.register("password")}
                    />
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  disabled={registerForm.formState.isSubmitting || !usernameStatus.available}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Registrati
                </Button>



                <div className="text-center">
                  <span className="text-muted-foreground">Hai già un account? </span>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0"
                    onClick={() => {
                      setIsLogin(true);
                      setUsernameStatus({ checking: false, available: null, message: "" });
                    }}
                  >
                    Accedi
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
