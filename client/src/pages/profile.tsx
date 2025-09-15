import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/layout/navbar";
import { ProfileUploader } from "@/components/ProfileUploader";
import { useAuth } from "@/hooks/use-auth";
import { capitalizeWords } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Edit3, Save, X, Trash2, Key } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Profile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [formData, setFormData] = useState({
    nome: user?.nome || "",
    cognome: user?.cognome || "",
    email: user?.email || "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('/api/profile/update', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "Profilo aggiornato",
        description: "Le informazioni del profilo sono state salvate con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiornamento del profilo",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest('/api/auth/password', 'PUT', data);
    },
    onSuccess: () => {
      toast({
        title: "Password aggiornata",
        description: "La tua password è stata cambiata con successo",
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsChangingPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel cambio password",
        variant: "destructive",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/auth/account', 'DELETE', {});
    },
    onSuccess: () => {
      toast({
        title: "Account eliminato",
        description: "Il tuo account è stato eliminato con successo",
      });
      // Redirect to home after successful deletion
      window.location.href = '/';
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione dell'account",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({
      nome: user?.nome || "",
      cognome: user?.cognome || "",
      email: user?.email || "",
    });
    setIsEditing(false);
  };

  const handlePasswordSave = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Errore",
        description: "La nuova password e la conferma non corrispondono",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Errore",
        description: "La nuova password deve essere di almeno 6 caratteri",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const handlePasswordCancel = () => {
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setIsChangingPassword(false);
  };

  const handleImageUpdate = (imageUrl: string) => {
    // Image update is handled by the ProfileUploader component
    // This callback is called when image is successfully updated
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <User className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Caricamento profilo...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Profilo Utente</h1>
            <p className="text-gray-600">
              Gestisci le informazioni del tuo profilo e le impostazioni dell'account
            </p>
          </div>

          {/* Profile Image */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Foto Profilo
              </CardTitle>
              <CardDescription>
                Carica una foto profilo per personalizzare il tuo account
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ProfileUploader
                currentImageUrl={user?.profileImageUrl || undefined}
                onImageUpdate={handleImageUpdate}
              />
            </CardContent>
          </Card>

          {/* Profile Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5" />
                    Informazioni Personali
                  </CardTitle>
                  <CardDescription>
                    Le tue informazioni di base del profilo
                  </CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Modifica
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  {isEditing ? (
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => {
                        const capitalizedValue = capitalizeWords(e.target.value);
                        setFormData(prev => ({ ...prev, nome: capitalizedValue }));
                      }}
                      placeholder="Il tuo nome"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-md border">
                      {user.nome}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cognome">Cognome</Label>
                  {isEditing ? (
                    <Input
                      id="cognome"
                      value={formData.cognome}
                      onChange={(e) => {
                        const capitalizedValue = capitalizeWords(e.target.value);
                        setFormData(prev => ({ ...prev, cognome: capitalizedValue }));
                      }}
                      placeholder="Il tuo cognome"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-md border">
                      {user.cognome}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="La tua email"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-md border">
                    {user.email}
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleSave} 
                    disabled={updateProfileMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateProfileMutation.isPending ? "Salvando..." : "Salva"}
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Annulla
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Account</CardTitle>
              <CardDescription>
                Dettagli sull'account e statistiche
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md border">
                    {user.username}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data Registrazione</Label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md border">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('it-IT') : 'N/A'}
                  </div>
                </div>
              </div>


            </CardContent>
          </Card>

          {/* Password Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Gestione Password
              </CardTitle>
              <CardDescription>
                Cambia la tua password per mantenere l'account sicuro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isChangingPassword ? (
                <Button 
                  onClick={() => setIsChangingPassword(true)}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Cambia Password
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Password Attuale</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Inserisci la password attuale"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nuova Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Inserisci la nuova password (min. 6 caratteri)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Conferma Nuova Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Conferma la nuova password"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={handlePasswordSave} 
                      disabled={changePasswordMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {changePasswordMutation.isPending ? "Salvando..." : "Salva Password"}
                    </Button>
                    <Button variant="outline" onClick={handlePasswordCancel}>
                      <X className="h-4 w-4 mr-2" />
                      Annulla
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Zona di Pericolo</CardTitle>
              <CardDescription>
                Azioni permanenti che non possono essere annullate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Elimina Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro di voler eliminare il tuo account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione non può essere annullata. Verranno eliminati permanentemente:
                      <br />• Il tuo account utente
                      <br />• Tutte le attività di cui sei proprietario
                      <br />• Tutto l'inventario, vendite e spese associate
                      <br />• La tua partecipazione alle attività di altri utenti
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteAccountMutation.mutate()}
                      disabled={deleteAccountMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteAccountMutation.isPending ? "Eliminando..." : "Elimina Account"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}