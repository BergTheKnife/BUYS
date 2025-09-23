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
import { LogIn, AlertCircle } from "lucide-react";
import buysLogoColorPath from "@assets/Buys colore_1754472538088.png";
import { loginUserSchema } from "@shared/schema";
import type { LoginUser } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

export default function Welcome() {
  const [verificationMessage, setVerificationMessage] = useState<string>("");
  const [resendEmail, setResendEmail] = useState<string>("");
  const { user, hasActivity, login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
        description: "Se l'email esiste, è stata inviata una nuova verifica.",
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-orange-50 flex items-center justify-center p-4 overflow-x-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-purple-400/20 to-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-orange-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="w-full max-w-md min-w-0 relative z-10">
        <Card className="glass-card shadow-2xl border-0 overflow-hidden backdrop-blur-xl">
          <CardContent className="p-8">
            {/* Header: SOLO logo with modern styling */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-orange-600/20 rounded-2xl blur-2xl"></div>
                <img
                  src={buysLogoColorPath}
                  alt="BUYS Logo"
                  className="h-24 w-auto relative z-10 drop-shadow-lg"
                  draggable={false}
                />
              </div>
              <h1 className="gradient-text text-2xl font-bold mt-4 text-center">
                Build Up Your Store
              </h1>
              <p className="text-muted-foreground text-sm mt-2 text-center">
                La piattaforma completa per il tuo business
              </p>
            </div>

            {/* Form di login */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onLogin)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="emailOrUsername"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <Label htmlFor="emailOrUsername" className="text-sm font-semibold text-gray-700">
                        Email o Username
                      </Label>
                      <FormControl>
                        <div className="relative">
                          <Input
                            id="emailOrUsername"
                            placeholder="Inserisci email o username"
                            autoComplete="username"
                            data-testid="input-email-username"
                            className="h-12 pl-4 pr-4 border-2 border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm transition-all duration-300 focus:border-primary/50 focus:shadow-lg focus:shadow-primary/10 hover:border-gray-300"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      {form.formState.errors.emailOrUsername && (
                        <p className="text-sm text-destructive font-medium">
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
                    <FormItem className="space-y-3">
                      <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                        Password
                      </Label>
                      <FormControl>
                        <div className="relative">
                          <PasswordInput
                            id="password"
                            placeholder="La tua password"
                            data-testid="input-password"
                            className="h-12 pl-4 pr-12 border-2 border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm transition-all duration-300 focus:border-primary/50 focus:shadow-lg focus:shadow-primary/10 hover:border-gray-300"
                            {...field}
                          />
                        </div>
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
                          data-testid="checkbox-remember-me"
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
                    <Button type="button" variant="link" className="text-sm" data-testid="link-forgot-password">
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
                            data-testid="button-resend-verification"
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
                  className="w-full h-14 text-base font-semibold mt-6"
                  disabled={form.formState.isSubmitting}
                  data-testid="button-login"
                  size="lg"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  {form.formState.isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Accesso in corso...
                    </>
                  ) : (
                    "Accedi"
                  )}
                </Button>

                {/* Link per la registrazione */}
                <div className="text-center pt-6 border-t border-gray-200/50 mt-6">
                  <p className="text-sm text-gray-600 mb-3">Non hai ancora un account?</p>
                  <Link href="/registrati">
                    <Button 
                      variant="outline" 
                      className="w-full h-12 font-semibold border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5" 
                      data-testid="link-register"
                    >
                      Registrati qui
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