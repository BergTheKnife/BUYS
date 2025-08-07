import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Activity, Trash2, Lock, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

const adminPasswordSchema = z.object({
  password: z.string().min(1, "Password richiesta"),
});

type AdminPasswordForm = z.infer<typeof adminPasswordSchema>;

interface AdminUser {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  username: string;
  isActive: number;
  emailVerified: string | null;
  createdAt: string;
  activitiesCount: number;
  salesCount: number;
  inventoryCount: number;
}

interface AdminActivity {
  id: string;
  nome: string;
  proprietarioNome: string;
  proprietarioEmail: string;
  membersCount: number;
  inventoryCount: number;
  salesCount: number;
  expensesCount: number;
  createdAt: string;
  hasData: boolean;
}

export function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AdminPasswordForm>({
    resolver: zodResolver(adminPasswordSchema),
    defaultValues: { password: "" },
  });

  // Admin authentication
  const authMutation = useMutation({
    mutationFn: async (data: AdminPasswordForm) => {
      return await apiRequest("POST", "/api/admin/auth", data);
    },
    onSuccess: () => {
      setIsAuthenticated(true);
      toast({
        title: "Accesso admin autorizzato",
        description: "Benvenuto nel pannello amministratore",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Accesso negato",
        description: error.message || "Password amministratore non corretta",
        variant: "destructive",
      });
    },
  });

  // Fetch admin data
  const { data: adminUsers = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated,
  });

  const { data: adminActivities = [], isLoading: activitiesLoading } = useQuery<AdminActivity[]>({
    queryKey: ["/api/admin/activities"],
    enabled: isAuthenticated,
  });

  // Delete mutations
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Utente eliminato",
        description: "L'utente è stato eliminato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore eliminazione",
        description: error.message || "Impossibile eliminare l'utente",
        variant: "destructive",
      });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return await apiRequest("DELETE", `/api/admin/activities/${activityId}`);
    },
    onSuccess: () => {
      toast({
        title: "Attività eliminata",
        description: "L'attività è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore eliminazione",
        description: error.message || "Impossibile eliminare l'attività",
        variant: "destructive",
      });
    },
  });

  const onAuthSubmit = (data: AdminPasswordForm) => {
    authMutation.mutate(data);
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare l'utente ${userName}? Questa azione è irreversibile.`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleDeleteActivity = (activityId: string, activityName: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare l'attività ${activityName}? Questa azione è irreversibile.`)) {
      deleteActivityMutation.mutate(activityId);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Pannello Amministratore</CardTitle>
            <CardDescription>
              Inserisci la password di amministratore per accedere
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onAuthSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password Amministratore</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Inserisci password admin"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={authMutation.isPending}
              >
                {authMutation.isPending ? "Verifica..." : "Accedi"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Pannello Amministratore</h1>
          <p className="text-muted-foreground">Gestione sistema BUYS</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Utenti ({adminUsers.length})
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Attività ({adminActivities.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Alert>
            <Eye className="h-4 w-4" />
            <AlertDescription>
              Gli utenti con dati (inventario, vendite, spese) sono protetti dalla cancellazione automatica.
            </AlertDescription>
          </Alert>

          {usersLoading ? (
            <div className="text-center py-8">Caricamento utenti...</div>
          ) : (
            <div className="grid gap-4">
              {adminUsers.map((user) => (
                <Card key={user.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{user.nome} {user.cognome}</h3>
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "Attivo" : "In attesa verifica"}
                          </Badge>
                          {user.emailVerified && (
                            <Badge variant="outline">Email verificata</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">@{user.username} • {user.email}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{user.activitiesCount} attività</span>
                          <span>{user.salesCount} vendite</span>
                          <span>{user.inventoryCount} prodotti</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(user.salesCount > 0 || user.inventoryCount > 0) ? (
                          <div className="flex items-center gap-1 text-xs text-orange-600">
                            <Lock className="h-3 w-3" />
                            Protetto
                          </div>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id, `${user.nome} ${user.cognome}`)}
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Alert>
            <Eye className="h-4 w-4" />
            <AlertDescription>
              Le attività con dati business sono protette dalla cancellazione automatica.
            </AlertDescription>
          </Alert>

          {activitiesLoading ? (
            <div className="text-center py-8">Caricamento attività...</div>
          ) : (
            <div className="grid gap-4">
              {adminActivities.map((activity) => (
                <Card key={activity.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{activity.nome}</h3>
                          {activity.hasData && (
                            <Badge variant="outline">Dati presenti</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Proprietario: {activity.proprietarioNome} ({activity.proprietarioEmail})
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{activity.membersCount} membri</span>
                          <span>{activity.inventoryCount} prodotti</span>
                          <span>{activity.salesCount} vendite</span>
                          <span>{activity.expensesCount} spese</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activity.hasData ? (
                          <div className="flex items-center gap-1 text-xs text-orange-600">
                            <Lock className="h-3 w-3" />
                            Protetta
                          </div>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteActivity(activity.id, activity.nome)}
                            disabled={deleteActivityMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}