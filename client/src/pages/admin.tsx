import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Building2, 
  Trash2, 
  Shield, 
  Calendar,
  Mail,
  User,
  Settings
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface AdminUser {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  username: string;
  createdAt: string;
  isActive: number;
  emailVerified: boolean;
  activities: Array<{
    activityId: string;
    nome: string;
    proprietarioId: string;
    joinedAt: string;
  }>;
}

interface AdminActivity {
  id: string;
  nome: string;
  proprietarioId: string;
  createdAt: string;
  proprietarioNome: string;
  proprietarioCognome: string;
  proprietarioEmail: string;
  proprietarioUsername: string;
  members: Array<{
    userId: string;
    nome: string;
    cognome: string;
    email: string;
    username: string;
    joinedAt: string;
  }>;
}

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("users");

  const { data: users, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<AdminActivity[]>({
    queryKey: ["/api/admin/activities"],
    retry: false,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Utente eliminato",
        description: "L'utente è stato eliminato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activities"] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione dell'utente",
        variant: "destructive",
      });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await apiRequest("DELETE", `/api/admin/activities/${activityId}`);
    },
    onSuccess: () => {
      toast({
        title: "Attività eliminata",
        description: "L'attività è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione dell'attività",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (userId: string, userEmail: string) => {
    if (confirm(`Sei sicuro di voler eliminare l'utente ${userEmail}? Questa azione eliminerà anche tutte le attività create da questo utente e non può essere annullata.`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleDeleteActivity = (activityId: string, activityName: string) => {
    if (confirm(`Sei sicuro di voler eliminare l'attività "${activityName}"? Tutti i dati associati (inventario, vendite, spese) verranno persi definitivamente.`)) {
      deleteActivityMutation.mutate(activityId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-6 w-6 text-red-600" />
            <h1 className="text-2xl font-bold">Pannello di Amministrazione</h1>
            <Badge variant="destructive">Solo Sviluppatore</Badge>
          </div>
          <p className="text-muted-foreground">
            Gestione utenti e attività dell'applicazione BUYS
          </p>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Utenti ({users?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Attività ({activities?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid gap-4">
                {users?.map((user) => (
                  <Card key={user.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5" />
                          <div>
                            <CardTitle className="text-lg">
                              {user.nome} {user.cognome}
                            </CardTitle>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Mail className="h-4 w-4" />
                              {user.email}
                              <span>•</span>
                              @{user.username}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "Attivo" : "Non Verificato"}
                          </Badge>
                          <Badge variant={user.emailVerified ? "default" : "destructive"}>
                            {user.emailVerified ? "Email Verificata" : "Email Non Verificata"}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4" />
                          Registrato: {format(new Date(user.createdAt), "dd MMMM yyyy 'alle' HH:mm", { locale: it })}
                        </div>
                        
                        {user.activities && user.activities.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Attività ({user.activities.length}):</h4>
                            <div className="space-y-2">
                              {user.activities.map((activity) => (
                                <div key={activity.activityId} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    <span className="font-medium">{activity.nome}</span>
                                    {activity.proprietarioId === user.id && (
                                      <Badge variant="secondary" className="text-xs">Proprietario</Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(activity.joinedAt), "dd/MM/yyyy", { locale: it })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activities" className="space-y-4">
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid gap-4">
                {activities?.map((activity) => (
                  <Card key={activity.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5" />
                          <div>
                            <CardTitle className="text-lg">{activity.nome}</CardTitle>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <User className="h-4 w-4" />
                              Proprietario: {activity.proprietarioNome} {activity.proprietarioCognome}
                              <span>•</span>
                              {activity.proprietarioEmail}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {activity.members.length} membri
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteActivity(activity.id, activity.nome)}
                            disabled={deleteActivityMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4" />
                          Creata: {format(new Date(activity.createdAt), "dd MMMM yyyy 'alle' HH:mm", { locale: it })}
                        </div>
                        
                        {activity.members && activity.members.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Membri ({activity.members.length}):</h4>
                            <div className="space-y-2">
                              {activity.members.map((member) => (
                                <div key={member.userId} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span className="font-medium">{member.nome} {member.cognome}</span>
                                    <span className="text-sm text-muted-foreground">@{member.username}</span>
                                    {member.userId === activity.proprietarioId && (
                                      <Badge variant="secondary" className="text-xs">Proprietario</Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(member.joinedAt), "dd/MM/yyyy", { locale: it })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}