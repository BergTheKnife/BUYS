
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ArrowLeft, Lock, CheckCircle, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { resetPasswordSchema, type ResetPassword } from "@shared/schema";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const [resetCompleted, setResetCompleted] = useState(false);
  const [tokenError, setTokenError] = useState<string>("");
  const { toast } = useToast();

  const form = useForm<ResetPassword>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPassword) => {
      if (!token) {
        throw new Error('Token mancante');
      }

      const response = await fetch(`/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Errore nel reset password');
      }
      
      return result;
    },
    onSuccess: () => {
      setResetCompleted(true);
      toast({
        title: "Password Aggiornata",
        description: "La password è stata cambiata con successo. Ora puoi accedere.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Errore nel reset della password";
      setTokenError(errorMessage);
      toast({
        title: "Errore",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: ResetPassword) => {
    resetPasswordMutation.mutate(data);
  };

  // Check if token is provided
  useEffect(() => {
    if (!token) {
      setTokenError("Token di reset mancante o non valido");
    }
  }, [token]);

  if (!token || tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-red-50 to-pink-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-red-600">Token Non Valido</CardTitle>
            <CardDescription>
              {tokenError || "Il link di reset password non è valido o è scaduto."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <Link href="/forgot-password">
                  <Button className="w-full">
                    Richiedi Nuovo Reset
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Torna al Login
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-xl">Password Aggiornata</CardTitle>
            <CardDescription>
              La tua password è stata cambiata con successo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border border-green-200 bg-green-50 rounded-md">
                <div className="text-sm text-green-800">
                  <p className="font-medium">✅ Operazione completata</p>
                  <p className="mt-1">
                    Ora puoi accedere al tuo account con la nuova password.
                  </p>
                </div>
              </div>
              
              <div className="text-center">
                <Link href="/">
                  <Button className="w-full">
                    <Lock className="mr-2 h-4 w-4" />
                    Accedi Ora
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Nuova Password
          </CardTitle>
          <CardDescription>
            Inserisci la tua nuova password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuova Password</FormLabel>
                    <FormControl>
                      <PasswordInput 
                        placeholder="Inserisci la nuova password" 
                        {...field} 
                        disabled={resetPasswordMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                    <div className="text-xs text-gray-600 mt-1">
                      La password deve contenere almeno 6 caratteri, una lettera maiuscola e un numero.
                    </div>
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Aggiornamento...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Aggiorna Password
                  </>
                )}
              </Button>

              <div className="text-center">
                <Link href="/">
                  <Button variant="ghost" type="button">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Torna al Login
                  </Button>
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
