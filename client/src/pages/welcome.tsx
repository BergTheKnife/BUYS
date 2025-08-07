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
  const [verificationMessage, setVerificationMessage] = useState<string>('');
  const [resendEmail, setResendEmail] = useState<string>(''); // Store email for resend
  const { user, hasActivity, login, register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Check for verification success message from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'success') {
      const message = urlParams.get('message');
      if (message) {
        toast({
          title: "Registrazione Completata",
          description: decodeURIComponent(message),
          variant: "default",
        });
        // Clean up URL params
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [toast]);

  // Welcome page now only handles form submission, not redirects
  // Redirects are handled by HomeRedirect component in App.tsx

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
      // Check if it's a verification error
      if (error.message?.includes("Account non verificato")) {
        setVerificationMessage("Il tuo account necessita di verifica email. Controlla la tua casella di posta e clicca sul link ricevuto.");
        // Use userEmail from server response if available, fallback to emailOrUsername
        const emailForResend = error.userEmail || data.emailOrUsername;
        setResendEmail(emailForResend);
        // Don't show toast for verification error - handled in UI instead
      } else {
        toast({
          title: "Errore",
          description: error.message || "Credenziali non valide",
          variant: "destructive",
        });
      }
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

  const resendVerificationMutation = useMutation({
    mutationKey: ['resend-verification'],
    mutationFn: async (email: string) => {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Errore di rete' }));
        throw new Error(error.message);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Inviata",
        description: "Email di verifica inviata nuovamente. Controlla la tua casella di posta.",
      });
      setVerificationMessage('');
      setResendEmail('');
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'invio dell'email",
        variant: "destructive",
      });
    }
  });

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

      const response = await apiRequest("POST", "/api/auth/register", data);
      const result = await response.json();
      
      if (result.message?.includes("Controlla la tua email")) {
        setVerificationMessage(`Registrazione completata! Abbiamo inviato un'email di verifica a ${data.email}. Clicca sul link nella email per attivare il tuo account.`);
        toast({
          title: "Verifica Email Necessaria",
          description: "Controlla la tua email per il link di verifica",
        });
      } else {
        toast({
          title: "Registrazione completata",
          description: "Account creato con successo!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la registrazione",
        variant: "destructive",
      });
    }
  };



  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4 overflow-x-hidden">
      <div className="w-full max-w-md min-w-0">
        <Card className="backdrop-blur-lg bg-white/95 shadow-2xl border-0 overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center mb-4">
              <div className="mb-2 flex justify-center">
                <img 
                  src={buysLogoColorPath} 
                  alt="BUYS - Build Up Your Store" 
                  className="w-72 sm:w-80 h-auto max-w-full object-contain"
                  style={{ maxWidth: 'calc(100vw - 6rem)' }}
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

                {/* Show verification message and resend button */}
                {verificationMessage && (
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded-md">
                    <div className="flex items-start">
                      <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-orange-800 mb-3">{verificationMessage}</p>
                        {resendEmail && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                            onClick={() => resendVerificationMutation.mutate(resendEmail)}
                            disabled={resendVerificationMutation.isPending}
                          >
                            {resendVerificationMutation.isPending ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600 mr-2"></div>
                                Invio in corso...
                              </>
                            ) : (
                              <>
                                <Mail className="mr-2 h-3 w-3" />
                                Reinvia Email di Verifica
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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
