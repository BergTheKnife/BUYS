import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Store, User, Lock, Mail, UserPlus, LogIn } from "lucide-react";
import { insertUserSchema, loginUserSchema } from "@shared/schema";
import type { InsertUser, LoginUser } from "@shared/schema";

export default function Welcome() {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register } = useAuth();
  const { toast } = useToast();

  const loginForm = useForm<LoginUser>({
    resolver: zodResolver(loginUserSchema),
    defaultValues: {
      emailOrUsername: "",
      password: "",
    },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      username: "",
      password: "",
    },
  });

  const onLogin = async (data: LoginUser) => {
    try {
      await login(data);
      toast({
        title: "Accesso effettuato",
        description: "Benvenuto in DAVALB!",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Credenziali non valide",
        variant: "destructive",
      });
    }
  };

  const onRegister = async (data: InsertUser) => {
    try {
      await register(data);
      toast({
        title: "Registrazione completata",
        description: "Account creato con successo!",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la registrazione",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-lg bg-white/95 shadow-2xl border-0">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-primary mb-3 flex items-center justify-center gap-2">
                <Store className="h-8 w-8" />
                DAVALB
              </h1>
              <p className="text-muted-foreground">
                Gestione semplificata per il tuo commercio
              </p>
            </div>

            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailOrUsername">Email o Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="emailOrUsername"
                      className="pl-10"
                      placeholder="Inserisci email o username"
                      {...loginForm.register("emailOrUsername")}
                    />
                  </div>
                  {loginForm.formState.errors.emailOrUsername && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.emailOrUsername.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      className="pl-10"
                      placeholder="Inserisci password"
                      {...loginForm.register("password")}
                    />
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" />
                  <Label htmlFor="remember" className="text-sm">
                    Ricorda le mie credenziali
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Accedi
                </Button>

                <div className="text-center">
                  <span className="text-muted-foreground">Non hai un account? </span>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0"
                    onClick={() => setIsLogin(false)}
                  >
                    Registrati
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      placeholder="Nome"
                      {...registerForm.register("nome")}
                    />
                    {registerForm.formState.errors.nome && (
                      <p className="text-sm text-destructive">
                        {registerForm.formState.errors.nome.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cognome">Cognome</Label>
                    <Input
                      id="cognome"
                      placeholder="Cognome"
                      {...registerForm.register("cognome")}
                    />
                    {registerForm.formState.errors.cognome && (
                      <p className="text-sm text-destructive">
                        {registerForm.formState.errors.cognome.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-10"
                      placeholder="email@esempio.com"
                      {...registerForm.register("email")}
                    />
                  </div>
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      className="pl-10"
                      placeholder="Username univoco"
                      {...registerForm.register("username")}
                    />
                  </div>
                  {registerForm.formState.errors.username && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regPassword">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="regPassword"
                      type="password"
                      className="pl-10"
                      placeholder="Password sicura"
                      {...registerForm.register("password")}
                    />
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={registerForm.formState.isSubmitting}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Registrati
                </Button>

                <div className="text-center">
                  <span className="text-muted-foreground">Hai già un account? </span>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0"
                    onClick={() => setIsLogin(true)}
                  >
                    Accedi
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
