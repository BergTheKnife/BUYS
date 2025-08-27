import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { User, InsertUser, LoginUser } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  currentActivity: any | null;
  hasActivity: boolean;
  login: (credentials: LoginUser) => Promise<void>;
  register: (userData: InsertUser) => Promise<void>;
  logout: () => Promise<void>;
  switchActivity: (activityId: string) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  const { data: authData, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  // Auto-login mutation with remember token
  const autoLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/auto-login");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      // Silently fail auto-login - user will see login form
      console.log('Auto-login failed:', error.message);
    },
  });

  // Attempt auto-login on app start if no session exists
  useEffect(() => {
    if (!autoLoginAttempted && !isLoading && !authData?.user) {
      setAutoLoginAttempted(true);
      autoLoginMutation.mutate();
    }
  }, [authData, isLoading, autoLoginAttempted]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginUser & { rememberMe?: boolean }) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Don't redirect automatically - let the ProtectedRoute handle activity selection
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const response = await apiRequest("POST", "/api/auth/register", userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Don't redirect automatically - let the ProtectedRoute handle activity selection
    },
  });

  const switchActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await apiRequest("PUT", "/api/activities/switch", { activityId });
    },
    onSuccess: () => {
      // Invalidate all activity-specific data queries
      const activityQueries = [
        "/api/stats",
        "/api/inventario",
        "/api/vendite",
        "/api/spese",
        "/api/recent-activities",
        "/api/top-selling-items",
        "/api/chart-data"
      ];

      activityQueries.forEach(queryKey => {
        queryClient.removeQueries({ queryKey: [queryKey] });
      });

      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
    },
  });

  const user = (authData as { user?: User })?.user || null;
  const currentActivity = (authData as { currentActivity?: any })?.currentActivity || null;
  const hasActivity = !!currentActivity;

  // Prefetch critical data when user has an activity
  useEffect(() => {
    if (hasActivity && currentActivity?.id) {
      // Prefetch main pages data to make navigation instant
      queryClient.prefetchQuery({
        queryKey: ["/api/inventario"],
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
      queryClient.prefetchQuery({
        queryKey: ["/api/vendite"],
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
      queryClient.prefetchQuery({
        queryKey: ["/api/spese"],
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
      queryClient.prefetchQuery({
        queryKey: ["/api/stats"],
        staleTime: 2 * 60 * 1000, // 2 minutes
      });
    }
  }, [hasActivity, currentActivity?.id, queryClient]);

  const value = {
    user,
    currentActivity,
    hasActivity,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    switchActivity: switchActivityMutation.mutateAsync,
    isLoading: isLoading || loginMutation.isPending || registerMutation.isPending || switchActivityMutation.isPending,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}