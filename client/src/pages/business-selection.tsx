import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, LogIn, Users } from "lucide-react";
import { useLocation } from "wouter";
import { insertAttivitaSchema, joinAttivitaSchema, type InsertAttivita, type JoinAttivita, type Attivita } from "@shared/schema";
import buysBiancoLogo from "@assets/Buys bianco_1754472538088.png";

export default function BusinessSelection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("create");

  // Get user's businesses
  const { data: userBusinesses = [], isLoading: loadingBusinesses } = useQuery<Attivita[]>({
    queryKey: ["/api/user-businesses"],
  });

  // Create business form
  const createForm = useForm<InsertAttivita & { password: string }>({
    resolver: zodResolver(insertAttivitaSchema.extend({
      password: insertAttivitaSchema.shape.passwordHash,
    })),
    defaultValues: {
      nome: "",
      password: "",
    },
  });

  // Join business form  
  const joinForm = useForm<JoinAttivita>({
    resolver: zodResolver(joinAttivitaSchema),
    defaultValues: {
      nome: "",
      password: "",
    },
  });

  // Create business mutation
  const createBusinessMutation = useMutation({
    mutationFn: async (data: InsertAttivita & { password: string }) => {
      return await apiRequest("/api/businesses", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (business) => {
      toast({
        title: "Successo",
        description: `Attività "${business.nome}" creata con successo!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-businesses"] });
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

  // Join business mutation
  const joinBusinessMutation = useMutation({
    mutationFn: async (data: JoinAttivita) => {
      return await apiRequest("/api/businesses/join", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (business) => {
      toast({
        title: "Successo",
        description: `Ti sei unito all'attività "${business.nome}"!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-businesses"] });
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

  // Select business mutation
  const selectBusinessMutation = useMutation({
    mutationFn: async (businessId: string) => {
      return await apiRequest("/api/select-business", {
        method: "POST",
        body: JSON.stringify({ businessId }),
      });
    },
    onSuccess: () => {
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

  const onCreateSubmit = (data: InsertAttivita & { password: string }) => {
    createBusinessMutation.mutate(data);
  };

  const onJoinSubmit = (data: JoinAttivita) => {
    joinBusinessMutation.mutate(data);
  };

  const selectBusiness = (businessId: string) => {
    selectBusinessMutation.mutate(businessId);
  };

  if (loadingBusinesses) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src={buysBiancoLogo} 
              alt="BUYS Logo" 
              className="h-20 w-auto bg-primary p-3 rounded-lg"
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Benvenuto in BUYS
          </h1>
          <p className="text-xl text-gray-600">
            Seleziona o crea la tua attività per iniziare
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Existing Businesses */}
          {userBusinesses.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Le Tue Attività
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userBusinesses.map((business) => (
                    <Card key={business.id} className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">{business.nome}</h3>
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Creata il {new Date(business.createdAt).toLocaleDateString('it-IT')}
                        </p>
                        <Button 
                          className="w-full" 
                          onClick={() => selectBusiness(business.id)}
                          disabled={selectBusinessMutation.isPending}
                        >
                          {selectBusinessMutation.isPending ? "Caricamento..." : "Accedi"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create or Join Business */}
          <Card>
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="create" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Crea Attività
                  </TabsTrigger>
                  <TabsTrigger value="join" className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Accedi ad Attività
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="space-y-4">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-semibold mb-2">Crea una Nuova Attività</h2>
                    <p className="text-gray-600">
                      Crea la tua attività e inizia a gestire inventario, vendite e spese
                    </p>
                  </div>

                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                      <FormField
                        control={createForm.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Attività</FormLabel>
                            <FormControl>
                              <Input placeholder="Inserisci il nome della tua attività" {...field} />
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
                                placeholder="Password per proteggere l'attività (min. 6 caratteri)" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
                        size="lg"
                        disabled={createBusinessMutation.isPending}
                      >
                        {createBusinessMutation.isPending ? "Creazione..." : "Crea Attività"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="join" className="space-y-4">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-semibold mb-2">Accedi ad un'Attività Esistente</h2>
                    <p className="text-gray-600">
                      Inserisci i dati per unirti ad un'attività già creata
                    </p>
                  </div>

                  <Form {...joinForm}>
                    <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-4">
                      <FormField
                        control={joinForm.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Attività</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome dell'attività a cui vuoi accedere" {...field} />
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
                            <FormLabel>Password Attività</FormLabel>
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
                      <Button 
                        type="submit" 
                        className="w-full" 
                        size="lg"
                        disabled={joinBusinessMutation.isPending}
                      >
                        {joinBusinessMutation.isPending ? "Accesso..." : "Accedi all'Attività"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}