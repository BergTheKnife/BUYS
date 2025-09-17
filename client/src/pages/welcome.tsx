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
import { useLocation, Link } from "wouter";
import { LogIn, UserPlus, AlertCircle } from "lucide-react";
import buysLogoColorPath from "@assets/Buys colore_1754472538088.png";
import { insertUserSchema, loginUserSchema } from "@shared/schema";
import type { InsertUser, LoginUser } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { capitalizeWords } from "@/lib/utils";
import { z } from "zod";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

export default function Welcome() {
  const [isLogin, setIsLogin] = useState(true);
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: "" });
  const [verificationMessage, setVerificationMessage] = useState<string>("");
  const [resendEmail, setResendEmail] = useState<string>("");
  const { user, hasActivity, login, register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Messaggio “registrazione completata”
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("verified") === "success") {
      const message = urlParams.get("message");
      if (message) {
        toast({
          title: "Registrazione Completata",
          description: decodeURIComponent(message),
          variant: "default",
        });
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    }
  }, [toast]);

  // Se loggato → vai avanti
  useEffect(() => {
    if (user) {
      if (hasActivity) setLocation("/dashboard");
      else setLocation("/activity-selection");
    }
  }, [user, hasActivity, setLocation]);

  // ===== LOGIN =====
  const form = useForm<z.infer<typeof loginUserSchema>>({
    resolver: zodResolver(loginUserSchema),
    defaultValues: { emailOrUsername: "", password: "", rememberMe: false },
    mode: "onChange",
  });

  const onLogin = async (values: LoginUser) => {
    try {
      await login(values);
    } catch (error: any) {
      if (error?.code === "EMAIL_NOT_VERIFIED" && error?.email) {
        setVerificationMessage(error.message);
        setResendEmail(error.email);
      } else {
        toast({
          title: "Errore",
          description: error.message || "Credenziali non valide",
          variant: "destructive",
        });
      }
    }
  };

  // ===== USERNAME CHECK =====
  const checkUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest(
        "GET",
        `/api/auth/check-username/${username}`,
      );
      return response.json();
    },
  });

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: "Username deve essere di almeno 3 caratteri",
      });
      return;
    }
    setUsernameStatus({
      checking: true,
      available: null,
      message: "Controllo disponibilità...",
    });
    try {
      const result = await checkUsernameMutation.mutateAsync(username);
      setUsernameStatus({
        checking: false,
        available: result?.available,
        message: result?.available ? "Disponibile ✅" : "Non disponibile ❌",
      });
    } catch {
      setUsernameStatus({
        checking: false,
        available: null,
        message: "Errore nel controllo disponibilità",
      });
    }
  };

  // ===== REGISTRAZIONE =====
  const onRegister = async (values: InsertUser) => {
    try {
      await register(values);
      setIsLogin(true);
      toast({
        title: "Verifica email inviata",
        description: "Controlla la tua casella e clicca sul link di conferma.",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la registrazione",
        variant: "destructive",
      });
    }
  };

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      username: "",
      password: "",
    },
    mode: "onChange",
  });

  // Reinvia verifica
  const resendVerificationMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest(
        "POST",
        "/api/auth/resend-verification",
        { email },
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email inviata",
        description: "Se l’email esiste, è stata inviata una nuova verifica.",
      });
      setVerificationMessage("");
      setResendEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description:
          error.message || "Non è stato possibile reinviare la mail.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4 overflow-x-hidden">
      

      <div className="w-full max-w-md min-w-0">
        <Card className="backdrop-blur-lg bg-white/95 shadow-2xl border-0 overflow-hidden">
          <CardContent className="p-6">
            {/* Header: SOLO logo (niente titoli testuali) */}
            <div className="flex justify-center mb-4">
              <img
                src={buysLogoColorPath}
                alt="BUYS Logo"
                className="h-20 w-auto"
                draggable={false}
              />
            </div>

            {/* Toggle Accedi/Registrati con icone evidenziate quando attive */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex rounded-xl bg-gray-100 p-1 shadow-inner">
                <Button
                  aria-pressed={isLogin}
                  onClick={() => setIsLogin(true)}
                  variant="ghost"
                  className={`text-sm px-4 py-2 rounded-lg transition-all
                    ${isLogin ? "bg-primary text-white shadow-md" : "text-gray-700 hover:bg-white"}
                  `}
                >
                  {/* l’icona eredita il colore del testo, quindi resta evidenziata quando attivo */}
                  <LogIn className="mr-2 h-4 w-4 transition-colors" />
                  Accedi
                </Button>

                <Button
                  aria-pressed={!isLogin}
                  onClick={() => setIsLogin(false)}
                  variant="ghost"
                  className={`text-sm px-4 py-2 rounded-lg transition-all
                    ${!isLogin ? "bg-primary text-white shadow-md" : "text-gray-700 hover:bg-white"}
                  `}
                >
                  <UserPlus className="mr-2 h-4 w-4 transition-colors" />
                  Registrati
                </Button>
              </div>
            </div>

            {/* Form */}
            {isLogin ? (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onLogin)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="emailOrUsername"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="emailOrUsername">
                          Email o Username
                        </Label>
                        <FormControl>
                          <Input
                            id="emailOrUsername"
                            placeholder="Inserisci email o username"
                            autoComplete="username"
                            {...field}
                          />
                        </FormControl>
                        {form.formState.errors.emailOrUsername && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.emailOrUsername.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="password">Password</Label>
                        <FormControl>
                          <PasswordInput
                            id="password"
                            placeholder="La tua password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between">
                    <FormField
                      control={form.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="rememberMe"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <label
                            htmlFor="rememberMe"
                            className="text-sm text-gray-600 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Ricordami
                          </label>
                        </div>
                      )}
                    />
                    <Link href="/forgot-password">
                      <Button type="button" variant="link" className="text-sm">
                        Password dimenticata?
                      </Button>
                    </Link>
                  </div>

                  {/* Avviso verifica + reinvio */}
                  {verificationMessage && (
                    <div className="p-4 border border-orange-200 bg-orange-50 rounded-md">
                      <div className="flex items-start">
                        <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-orange-800 mb-3">
                            {verificationMessage}
                          </p>
                          {resendEmail && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                              onClick={() =>
                                resendVerificationMutation.mutate(resendEmail)
                              }
                              disabled={resendVerificationMutation.isPending}
                            >
                              {resendVerificationMutation.isPending
                                ? "Invio in corso..."
                                : "Reinvia Email di Verifica"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={form.formState.isSubmitting}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Accedi
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...registerForm}>
                {/* Registrazione “no frills” + z-index alto */}
                <form
                  onSubmit={registerForm.handleSubmit(onRegister)}
                  className="space-y-4 relative z-[99999]"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <Label htmlFor="nome">Nome</Label>
                          <FormControl>
                            <Input
                              id="nome"
                              placeholder="Il tuo nome"
                              {...field}
                              onChange={(e) => {
                                const v = capitalizeWords(e.target.value);
                                field.onChange(v);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="cognome"
                      render={({ field }) => (
                        <FormItem>
                          <Label htmlFor="cognome">Cognome</Label>
                          <FormControl>
                            <Input
                              id="cognome"
                              placeholder="Il tuo cognome"
                              {...field}
                              onChange={(e) => {
                                const v = capitalizeWords(e.target.value);
                                field.onChange(v);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* EMAIL – campo semplice */}
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="userEmail">Email</Label>
                        <FormControl>
                          <Input
                            id="userEmail"
                            type="email"
                            placeholder="email@esempio.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="username">Username</Label>
                        <FormControl>
                          <Input
                            id="username"
                            placeholder="Username univoco"
                            autoComplete="username"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value);
                              if (value.length >= 3) {
                                checkUsernameAvailability(value);
                              } else {
                                setUsernameStatus({
                                  checking: false,
                                  available: false,
                                  message:
                                    "Username deve essere di almeno 3 caratteri",
                                });
                              }
                            }}
                          />
                        </FormControl>
                        {usernameStatus.message && (
                          <p
                            className={`text-sm ${usernameStatus.available ? "text-green-600" : "text-red-600"}`}
                          >
                            {usernameStatus.message}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="regPassword">Password</Label>
                        <FormControl>
                          <PasswordInput
                            id="regPassword"
                            placeholder="Min 6 caratteri, 1 maiuscola, 1 numero"
                            showPasswordHint
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={
                      registerForm.formState.isSubmitting ||
                      !usernameStatus.available
                    }
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Registrati
                  </Button>

                  <div className="text-center">
                    <p className="text-sm text-gray-600">Hai già un account?</p>
                    <Button
                      variant="link"
                      className="p-0"
                      onClick={() => setIsLogin(true)}
                    >
                      Accedi
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}