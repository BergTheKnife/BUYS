
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Mail, AlertCircle, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { forgotPasswordSchema, type ForgotPassword } from "@shared/schema";

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPassword>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      emailOrUsername: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPassword) => {
      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.message || 'Errore nella richiesta');
        }
        
        return result;
      } catch (error) {
        console.error('Forgot password error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data?.needsVerification) {
        toast({
          title: "Account non verificato",
          description: "Completa prima la verifica email per richiedere il reset password.",
          variant: "destructive",
        });
        return;
      }
      setSubmitted(true);
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      toast({
        title: "Errore",
        description: error?.message || "Errore nella richiesta di reset password",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: ForgotPassword) => {
    forgotPasswordMutation.mutate(data);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-xl">Email Inviata</CardTitle>
            <CardDescription>
              Se l'account esiste, riceverai un'email con le istruzioni per il reset della password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border border-blue-200 bg-blue-50 rounded-md">
                <div className="flex items-start">
                  <Mail className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Controlla la tua email</p>
                    <p className="mt-1">
                      Il link per reimpostare la password è valido per 24 ore.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Recupera Password
          </CardTitle>
          <CardDescription>
            Inserisci la tua email o username per ricevere le istruzioni di reset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="emailOrUsername"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email o Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="La tua email o username" 
                        {...field} 
                        disabled={forgotPasswordMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={forgotPasswordMutation.isPending}
              >
                {forgotPasswordMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Invia Email di Reset
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

          <div className="mt-6 p-4 border border-amber-200 bg-amber-50 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Informazioni importanti:</p>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>Il link di reset è valido per 24 ore</li>
                  <li>Controlla anche la cartella spam</li>
                  <li>Puoi richiedere un nuovo reset se necessario</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
