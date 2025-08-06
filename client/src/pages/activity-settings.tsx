import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Building2, Edit, Lock, Trash2, Settings, LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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

type UpdateActivityName = z.infer<typeof updateActivityNameSchema>;
type ChangeActivityPassword = z.infer<typeof changeActivityPasswordSchema>;
type DeleteActivity = z.infer<typeof deleteActivitySchema>;

export default function ActivitySettings() {
  const { currentActivity, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isOwner = currentActivity?.proprietarioId === user?.id;

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