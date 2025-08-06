import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/layout/navbar";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Plus, 
  Users, 
  Lock,
  ArrowRight
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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

export default function ActivitySelection() {
  const [view, setView] = useState<'selection' | 'create' | 'join'>('selection');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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

  const createActivityMutation = useMutation({
    mutationFn: async (data: CreateActivityForm) => {
      return await apiRequest("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Attività creata",
        description: "La tua nuova attività è stata creata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const joinActivityMutation = useMutation({
    mutationFn: async (data: JoinActivityForm) => {
      return await apiRequest("/api/activities/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Accesso effettuato",
        description: "Sei entrato nell'attività con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
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

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <div className="container mx-auto py-8 px-4 max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Plus className="h-6 w-6" />
                Crea Nuova Attività
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                            placeholder="Es. Boutique Milano"
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
                        <FormLabel>Password Attività</FormLabel>
                        <FormControl>
                          <Input 
                            type="password"
                            placeholder="Minimo 6 caratteri"
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
                      onClick={() => setView('selection')}
                      className="flex-1"
                    >
                      Indietro
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createActivityMutation.isPending}
                      className="flex-1"
                    >
                      {createActivityMutation.isPending ? "Creazione..." : "Crea Attività"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <div className="container mx-auto py-8 px-4 max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-6 w-6" />
                Accedi a un'Attività
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                          <Input 
                            type="password"
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
                      onClick={() => setView('selection')}
                      className="flex-1"
                    >
                      Indietro
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
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto py-12 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <Building2 className="h-20 w-20 mx-auto mb-6 text-primary" />
          <h1 className="text-4xl font-bold mb-4">
            Benvenuto in BUYS
          </h1>
          <p className="text-xl text-muted-foreground mb-12">
            Scegli come iniziare la tua esperienza di gestione business
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setView('create')}>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-semibold mb-2">Crea una nuova attività</h3>
                <p className="text-muted-foreground mb-4">
                  Inizia da zero con la tua nuova attività commerciale
                </p>
                <ArrowRight className="h-5 w-5 mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setView('join')}>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-semibold mb-2">Accedi a un'attività esistente</h3>
                <p className="text-muted-foreground mb-4">
                  Unisciti a un'attività già creata da qualcun altro
                </p>
                <ArrowRight className="h-5 w-5 mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}