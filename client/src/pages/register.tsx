import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { UserPlus, ArrowLeft, Check, X, Loader2 } from "lucide-react";
import buysLogoColorPath from "@assets/Buys colore_1754472538088.png";
import { insertUserSchema } from "@shared/schema";
import type { InsertUser } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { capitalizeWords } from "@/lib/utils";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

export default function Register() {
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: "" });
  
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Username availability check mutation
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

  // Registration form
  const form = useForm<InsertUser>({
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

  const onRegister = async (values: InsertUser) => {
    if (!usernameStatus.available) {
      toast({
        title: "Errore",
        description: "Seleziona un username disponibile",
        variant: "destructive",
      });
      return;
    }

    try {
      await register(values);
      toast({
        title: "Registrazione completata! 🎉",
        description: "Controlla la tua casella email e clicca sul link di conferma per attivare l'account.",
        variant: "default",
      });
      setLocation("/");
    } catch (error: any) {
      let errorMessage = error.message || "Si è verificato un errore durante la registrazione";
      
      // Handle database unavailable errors
      if (error.message && (
        error.message.includes('endpoint has been disabled') ||
        error.message.includes('database è temporaneamente in standby') ||
        error.message.includes('serviceUnavailable')
      )) {
        errorMessage = "Il database è temporaneamente in standby. Attendi 10-15 secondi e riprova.";
      }
      
      toast({
        title: "Errore nella registrazione",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4 overflow-x-hidden">
      <div className="w-full max-w-md min-w-0">
        <Card className="backdrop-blur-lg bg-white/95 shadow-2xl border-0 overflow-hidden">
          <CardHeader className="text-center pb-4">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <img
                src={buysLogoColorPath}
                alt="BUYS Logo"
                className="h-16 w-auto"
                draggable={false}
              />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">
              Registrati a BUYS
            </CardTitle>
            <p className="text-sm text-gray-600">
              Crea il tuo account per iniziare a gestire il tuo negozio
            </p>
          </CardHeader>
          
          <CardContent className="p-6 pt-0">
            {/* Back to login link */}
            <div className="mb-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-sm" data-testid="link-back-to-login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Torna al login
                </Button>
              </Link>
            </div>

            {/* Registration form */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onRegister)}
                className="space-y-4"
              >
                {/* Nome e Cognome */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="nome">Nome *</Label>
                        <FormControl>
                          <Input
                            id="nome"
                            placeholder="Il tuo nome"
                            data-testid="input-nome"
                            {...field}
                            onChange={(e) => {
                              const value = capitalizeWords(e.target.value);
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cognome"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="cognome">Cognome *</Label>
                        <FormControl>
                          <Input
                            id="cognome"
                            placeholder="Il tuo cognome"
                            data-testid="input-cognome"
                            {...field}
                            onChange={(e) => {
                              const value = capitalizeWords(e.target.value);
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="email">Email *</Label>
                      <FormControl>
                        <Input
                          id="email"
                          type="email"
                          placeholder="email@esempio.com"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Username con verifica disponibilità */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="username">Username *</Label>
                      <FormControl>
                        <div className="relative">
                          <Input
                            id="username"
                            placeholder="Username univoco"
                            autoComplete="username"
                            data-testid="input-username"
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
                                  message: "Username deve essere di almeno 3 caratteri",
                                });
                              }
                            }}
                          />
                          {/* Icona di stato username */}
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            {usernameStatus.checking && (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            )}
                            {!usernameStatus.checking && usernameStatus.available === true && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                            {!usernameStatus.checking && usernameStatus.available === false && field.value.length >= 3 && (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                      </FormControl>
                      {usernameStatus.message && (
                        <p
                          className={`text-sm ${
                            usernameStatus.available 
                              ? "text-green-600" 
                              : usernameStatus.checking 
                                ? "text-gray-500"
                                : "text-red-600"
                          }`}
                          data-testid="text-username-status"
                        >
                          {usernameStatus.message}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="password">Password *</Label>
                      <FormControl>
                        <PasswordInput
                          id="password"
                          placeholder="Min 6 caratteri, 1 maiuscola, 1 numero"
                          showPasswordHint
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pulsante registrazione */}
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={
                    form.formState.isSubmitting ||
                    !usernameStatus.available ||
                    !form.formState.isValid
                  }
                  data-testid="button-register"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {form.formState.isSubmitting ? "Registrazione..." : "Registrati"}
                </Button>

                {/* Informazioni sui campi obbligatori */}
                <p className="text-xs text-gray-500 text-center">
                  * Campi obbligatori
                </p>

                {/* Link per tornare al login */}
                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-gray-600">Hai già un account?</p>
                  <Link href="/">
                    <Button variant="link" className="p-0" data-testid="link-login">
                      Accedi qui
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}