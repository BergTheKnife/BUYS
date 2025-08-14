
import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface ActionHistoryItem {
  id: string;
  timestamp: number;
  description: string;
  data: any;
  previousData?: any; // Per le operazioni di update
  action: 'create' | 'update' | 'delete';
  entityType: 'inventory' | 'sale' | 'expense';
  apiEndpoint?: string; // Endpoint API per l'undo/redo
}

export function useActionHistory(pageKey: string) {
  const [history, setHistory] = useState<ActionHistoryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isPerformingHistoryAction = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutation per le operazioni di undo/redo
  const undoRedoMutation = useMutation({
    mutationFn: async ({ action, data, apiEndpoint }: { 
      action: 'create' | 'update' | 'delete', 
      data: any, 
      apiEndpoint: string 
    }) => {
      let response;
      switch (action) {
        case 'create':
          response = await apiRequest('POST', apiEndpoint, data);
          break;
        case 'update':
          response = await apiRequest('PUT', `${apiEndpoint}/${data.id}`, data);
          break;
        case 'delete':
          response = await apiRequest('DELETE', `${apiEndpoint}/${data.id}`);
          break;
        default:
          throw new Error('Azione non supportata');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries based on pageKey
      if (pageKey === 'inventory') {
        queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      } else if (pageKey === 'sales') {
        queryClient.invalidateQueries({ queryKey: ["/api/vendite"] });
        queryClient.invalidateQueries({ queryKey: ["/api/inventario"] });
      } else if (pageKey === 'expenses') {
        queryClient.invalidateQueries({ queryKey: ["/api/spese"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'operazione di undo/redo",
        variant: "destructive",
      });
    }
  });

  const addAction = useCallback((action: Omit<ActionHistoryItem, 'id' | 'timestamp'>) => {
    if (isPerformingHistoryAction.current) return;

    const newAction: ActionHistoryItem = {
      ...action,
      id: `${pageKey}_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
    };

    setHistory(prev => {
      // Rimuovi tutte le azioni dopo l'indice corrente (se abbiamo fatto undo)
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newAction);
      
      // Mantieni solo le ultime 50 azioni per performance
      return newHistory.slice(-50);
    });

    setCurrentIndex(prev => {
      const newHistoryLength = Math.min(prev + 2, 50); // +2 perché prev era l'indice dell'ultimo elemento
      return newHistoryLength - 1; // Ritorna l'indice dell'ultimo elemento
    });
  }, [pageKey, currentIndex]);

  const canUndo = currentIndex >= 0 && history.length > 0;
  const canRedo = currentIndex < history.length - 1;

  const undo = useCallback(async () => {
    if (!canUndo || isPerformingHistoryAction.current) return;

    isPerformingHistoryAction.current = true;
    const actionToUndo = history[currentIndex];
    
    try {
      // Determina l'operazione inversa
      let inverseAction: 'create' | 'update' | 'delete';
      let dataToUse: any;
      let endpoint = '';

      switch (actionToUndo.entityType) {
        case 'inventory':
          endpoint = '/api/inventario';
          break;
        case 'sale':
          endpoint = '/api/vendite';
          break;
        case 'expense':
          endpoint = '/api/spese';
          break;
      }

      switch (actionToUndo.action) {
        case 'create':
          // Se abbiamo creato qualcosa, l'undo è eliminare
          inverseAction = 'delete';
          dataToUse = actionToUndo.data;
          break;
        case 'update':
          // Se abbiamo aggiornato qualcosa, l'undo è ripristinare i dati precedenti
          inverseAction = 'update';
          dataToUse = actionToUndo.previousData || actionToUndo.data;
          break;
        case 'delete':
          // Se abbiamo eliminato qualcosa, l'undo è ricreare
          inverseAction = 'create';
          dataToUse = { ...actionToUndo.data };
          delete dataToUse.id; // Rimuovi l'ID per permettere la ricreazione
          break;
      }

      await undoRedoMutation.mutateAsync({ 
        action: inverseAction, 
        data: dataToUse, 
        apiEndpoint: endpoint 
      });

      setCurrentIndex(prev => prev - 1);
      toast({
        title: "Undo completato",
        description: `Annullata: ${actionToUndo.description}`,
      });

    } catch (error) {
      console.error('Errore durante undo:', error);
    } finally {
      isPerformingHistoryAction.current = false;
    }
  }, [canUndo, history, currentIndex, undoRedoMutation, toast]);

  const redo = useCallback(async () => {
    if (!canRedo || isPerformingHistoryAction.current) return;

    isPerformingHistoryAction.current = true;
    const actionToRedo = history[currentIndex + 1];
    
    try {
      let endpoint = '';
      switch (actionToRedo.entityType) {
        case 'inventory':
          endpoint = '/api/inventario';
          break;
        case 'sale':
          endpoint = '/api/vendite';
          break;
        case 'expense':
          endpoint = '/api/spese';
          break;
      }

      await undoRedoMutation.mutateAsync({ 
        action: actionToRedo.action, 
        data: actionToRedo.data, 
        apiEndpoint: endpoint 
      });

      setCurrentIndex(prev => prev + 1);
      toast({
        title: "Redo completato",
        description: `Ripetuta: ${actionToRedo.description}`,
      });

    } catch (error) {
      console.error('Errore durante redo:', error);
    } finally {
      isPerformingHistoryAction.current = false;
    }
  }, [canRedo, history, currentIndex, undoRedoMutation, toast]);

  const getCurrentAction = useCallback(() => {
    return currentIndex >= 0 ? history[currentIndex] : null;
  }, [history, currentIndex]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return {
    addAction,
    undo,
    redo,
    canUndo,
    canRedo,
    getCurrentAction,
    clearHistory,
    history,
    currentIndex,
    isPerformingHistoryAction: isPerformingHistoryAction.current,
    isLoading: undoRedoMutation.isPending,
  };
}
