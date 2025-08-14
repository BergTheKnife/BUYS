
import { useState, useRef, useCallback, useEffect } from 'react';
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
      // REDO: Determina l'operazione inversa dell'UNDO che è stato fatto
      let redoAction: 'create' | 'update' | 'delete';
      let dataToUse: any;
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

      switch (actionToRedo.action) {
        case 'create':
          // Se l'azione originale era create, il redo è ricreare (l'undo aveva eliminato)
          redoAction = 'create';
          dataToUse = { ...actionToRedo.data };
          delete dataToUse.id; // Rimuovi l'ID per permettere la ricreazione
          break;
        case 'update':
          // Se l'azione originale era update, il redo è applicare di nuovo l'update
          redoAction = 'update';
          dataToUse = actionToRedo.data;
          break;
        case 'delete':
          // Se l'azione originale era delete, il redo è eliminare di nuovo (l'undo aveva ricreato)
          redoAction = 'delete';
          dataToUse = actionToRedo.data;
          break;
      }

      await undoRedoMutation.mutateAsync({ 
        action: redoAction, 
        data: dataToUse, 
        apiEndpoint: endpoint 
      });

      setCurrentIndex(prev => prev + 1);
      toast({
        title: "Redo completato",
        description: `Ripetuta: ${actionToRedo.description}`,
      });

    } catch (error) {
      console.error('Errore durante redo:', error);
      toast({
        title: "Errore Redo",
        description: "Impossibile ripetere l'azione",
        variant: "destructive",
      });
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

  // Cleanup delle azioni scadute (15 minuti)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
      setHistory(prev => {
        const filteredHistory = prev.filter(action => action.timestamp > fifteenMinutesAgo);
        // Se la cronologia è cambiata, aggiorna l'indice corrente
        if (filteredHistory.length !== prev.length && currentIndex >= 0) {
          const newIndex = Math.min(currentIndex, filteredHistory.length - 1);
          setCurrentIndex(newIndex);
        }
        return filteredHistory;
      });
    }, 30000); // Controlla ogni 30 secondi per maggior reattività

    return () => clearInterval(cleanupInterval);
  }, [currentIndex]);

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
