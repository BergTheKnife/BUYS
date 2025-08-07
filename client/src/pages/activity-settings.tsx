import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Building2, Edit, Lock, Trash2, Settings, LogOut, Users, UserPlus, UserMinus, Mail, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { z } from "zod";

const updateActivityNameSchema = z.object({
  nome: z.string().min(1, "Nome attività richiesto").max(100, "Nome troppo lungo"),
});

const changeActivityPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password attuale richiesta"),
  newPassword: z.string()
    .min(6, "La nuova password deve essere di almeno 6 caratteri")
    .regex(/(?=.*[A-Z])/, "La password deve contenere almeno una lettera maiuscola")
    .regex(/(?=.*\d)/, "La password deve contenere almeno un numero"),
});

const deleteActivitySchema = z.object({
  password: z.string().min(1, "Password richiesta per eliminare l'attività"),
});

const addMemberSchema = z.object({
  emailOrUsername: z.string().min(1, "Email o username richiesto"),
});

type UpdateActivityName = z.infer<typeof updateActivityNameSchema>;
type ChangeActivityPassword = z.infer<typeof changeActivityPasswordSchema>;
type DeleteActivity = z.infer<typeof deleteActivitySchema>;
type AddMember = z.infer<typeof addMemberSchema>;

interface ActivityMember {
  userId: string;
  nome: string;
  cognome: string;
  email: string;
  username: string;
  joinedAt: string;
  isOwner: boolean;
}

export default function ActivitySettings() {
  const { currentActivity, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddMember, setShowAddMember] = useState(false);
  
  const isOwner = currentActivity?.proprietarioId === user?.id;

  // Fetch activity members
  const { data: activityMembers = [] } = useQuery<ActivityMember[]>({
    queryKey: ["/api/activity-members", currentActivity?.id],
    enabled: !!currentActivity?.id && isOwner,
  });

  const nameForm = useForm<UpdateActivityName>({
    resolver: zodResolver(updateActivityNameSchema),
    defaultValues: {
      nome: currentActivity?.nome || "",
    },
  });

  const passwordForm = useForm<ChangeActivityPassword>({
    resolver: zodResolver(changeActivityPasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  const deleteForm = useForm<DeleteActivity>({
    resolver: zodResolver(deleteActivitySchema),
    defaultValues: {
      password: "",
    },
  });

  const addMemberForm = useForm<AddMember>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      emailOrUsername: "",
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: async (data: UpdateActivityName) => {
      const response = await apiRequest("PUT", `/api/activities/${currentActivity?.id}/name`, data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Nome attività aggiornato",
        description: "Il nome dell'attività è stato modificato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      nameForm.reset({ nome: data.activity.nome });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiornamento del nome",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangeActivityPassword) => {
      const response = await apiRequest("PUT", `/api/activities/${currentActivity?.id}/password`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password cambiata",
        description: "La password dell'attività è stata aggiornata",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel cambio password",
        variant: "destructive",
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: AddMember) => {
      return await apiRequest("POST", `/api/activities/${currentActivity?.id}/members`, data);
    },
    onSuccess: () => {
      toast({
        title: "Membro aggiunto",
        description: "Il nuovo membro è stato aggiunto all'attività",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-members", currentActivity?.id] });
      addMemberForm.reset();
      setShowAddMember(false);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiunta del membro",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/activities/${currentActivity?.id}/members/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Membro rimosso",
        description: "Il membro è stato rimosso dall'attività",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-members", currentActivity?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella rimozione del membro",
        variant: "destructive",
      });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (data: DeleteActivity) => {
      const response = await apiRequest("DELETE", `/api/activities/${currentActivity?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Attività eliminata",
        description: "L'attività è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      // Redirect to activity selection after deletion
      window.location.href = "/attivita";
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione dell'attività",
        variant: "destructive",
      });
    },
  });

  const leaveActivityMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/activities/${currentActivity?.id}/leave`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Attività abbandonata",
        description: "Hai abbandonato l'attività con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      // Redirect to activity selection after leaving
      window.location.href = "/attivita";
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'abbandono dell'attività",
        variant: "destructive",
      });
    },
  });

  const onLeaveActivity = async () => {
    if (confirm("Sei sicuro di voler abbandonare questa attività? Non potrai più accedere ai dati finché non ti unisci di nuovo.")) {
      await leaveActivityMutation.mutateAsync();
    }
  };

  const onUpdateName = async (data: UpdateActivityName) => {
    await updateNameMutation.mutateAsync(data);
  };

  const onChangePassword = async (data: ChangeActivityPassword) => {
    await changePasswordMutation.mutateAsync(data);
  };

  const onAddMember = (data: AddMember) => {
    addMemberMutation.mutate(data);
  };

  const onRemoveMember = (userId: string, memberName: string) => {
    if (window.confirm(`Sei sicuro di voler rimuovere ${memberName} dall'attività?`)) {
      removeMemberMutation.mutate(userId);
    }
  };

  const onDeleteActivity = async (data: DeleteActivity) => {
    if (confirm("Sei sicuro di voler eliminare questa attività? Questa azione non può essere annullata e tutti i dati associati verranno persi.")) {
      await deleteActivityMutation.mutateAsync(data);
    }
  };

  if (!currentActivity) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Nessuna attività selezionata</h2>
            <p className="text-muted-foreground">
              Seleziona un'attività per accedere alle impostazioni
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Impostazioni Attività</h1>
          </div>
          <p className="text-muted-foreground">
            Gestisci le impostazioni per <strong>{currentActivity.nome}</strong>
          </p>
        </div>

        <div className="space-y-6">
          {/* Nome Attività */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Nome Attività
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={nameForm.handleSubmit(onUpdateName)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Attività</Label>
                  <Input
                    id="nome"
                    placeholder="Nome dell'attività"
                    {...nameForm.register("nome")}
                  />
                  {nameForm.formState.errors.nome && (
                    <p className="text-sm text-destructive">
                      {nameForm.formState.errors.nome.message}
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  disabled={updateNameMutation.isPending}
                  className="w-full"
                >
                  {updateNameMutation.isPending ? "Aggiornamento..." : "Aggiorna Nome"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Separator />

          {/* Cambio Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Cambia Password Attività
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Password Attuale</Label>
                  <PasswordInput
                    id="currentPassword"
                    placeholder="Password attuale dell'attività"
                    {...passwordForm.register("currentPassword")}
                  />
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nuova Password</Label>
                  <PasswordInput
                    id="newPassword"
                    placeholder="Nuova password dell'attività"
                    showPasswordHint={true}
                    {...passwordForm.register("newPassword")}
                  />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={changePasswordMutation.isPending}
                  className="w-full"
                >
                  {changePasswordMutation.isPending ? "Aggiornamento..." : "Cambia Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Separator />

          {/* Gestione Membri - Solo per il Proprietario */}
          {isOwner && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Gestione Membri
                    </CardTitle>
                    <CardDescription>
                      Aggiungi o rimuovi membri dall'attività (solo proprietario)
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowAddMember(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Aggiungi Membro
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {activityMembers.length > 0 ? (
                  <div className="space-y-3">
                    {activityMembers.map((member) => (
                      <div key={member.userId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">
                              {member.nome} {member.cognome}
                              {member.isOwner && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Proprietario</span>}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              {member.email}
                              <span>•</span>
                              @{member.username}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Unito il {new Date(member.joinedAt).toLocaleDateString('it-IT')}
                            </div>
                          </div>
                        </div>
                        {!member.isOwner && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onRemoveMember(member.userId, `${member.nome} ${member.cognome}`)}
                            disabled={removeMemberMutation.isPending}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun membro presente oltre al proprietario</p>
                    <p className="text-sm">Aggiungi membri per collaborare sull'attività</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dialog per Aggiungere Membro */}
          <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Aggiungi Nuovo Membro</DialogTitle>
                <DialogDescription>
                  Inserisci l'email o l'username dell'utente che vuoi aggiungere all'attività
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={addMemberForm.handleSubmit(onAddMember)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailOrUsername">Email o Username</Label>
                  <Input
                    id="emailOrUsername"
                    placeholder="es. mario@email.com o mario123"
                    {...addMemberForm.register("emailOrUsername")}
                  />
                  {addMemberForm.formState.errors.emailOrUsername && (
                    <p className="text-sm text-destructive">
                      {addMemberForm.formState.errors.emailOrUsername.message}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddMember(false)}>
                    Annulla
                  </Button>
                  <Button type="submit" disabled={addMemberMutation.isPending}>
                    {addMemberMutation.isPending ? "Aggiunta..." : "Aggiungi Membro"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Separator />

          {/* Abbandona/Elimina Attività */}
          {!isOwner && (
            <Card className="border-orange-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <LogOut className="h-5 w-5" />
                  Abbandona Attività
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                    <p className="text-sm text-orange-800 font-medium mb-2">ℹ️ Informazioni</p>
                    <p className="text-sm text-orange-700">
                      Abbandonando l'attività non perderai i dati, ma non potrai più accedervi finché non ti unirai di nuovo.
                      Solo il proprietario può eliminare definitivamente l'attività.
                    </p>
                  </div>
                  
                  <Button 
                    onClick={onLeaveActivity}
                    variant="outline"
                    disabled={leaveActivityMutation.isPending}
                    className="w-full border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400"
                  >
                    {leaveActivityMutation.isPending ? "Abbandono..." : "Abbandona Attività"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isOwner && (
            <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Elimina Attività (Solo Proprietario)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                  <p className="text-sm text-destructive font-medium mb-2">⚠️ Attenzione!</p>
                  <p className="text-sm text-muted-foreground">
                    L'eliminazione dell'attività è permanente e comporterà la perdita di tutti i dati associati: 
                    inventario, vendite, spese e statistiche. Questa operazione non può essere annullata.
                  </p>
                </div>
                
                <form onSubmit={deleteForm.handleSubmit(onDeleteActivity)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deletePassword">Conferma con Password Attività</Label>
                    <PasswordInput
                      id="deletePassword"
                      placeholder="Password dell'attività"
                      {...deleteForm.register("password")}
                    />
                    {deleteForm.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {deleteForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  
                  <Button 
                    type="submit" 
                    variant="destructive"
                    disabled={deleteActivityMutation.isPending}
                    className="w-full"
                  >
                    {deleteActivityMutation.isPending ? "Eliminazione..." : "Elimina Attività Definitivamente"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
          )}

          <div className="flex justify-center pt-8">
            <Button variant="outline" onClick={() => window.history.back()}>
              Torna Indietro
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}