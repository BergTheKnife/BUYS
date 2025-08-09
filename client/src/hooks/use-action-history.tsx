
import { useState, useRef, useCallback } from 'react';

export interface ActionHistoryItem {
  id: string;
  timestamp: number;
  description: string;
  data: any;
  action: 'create' | 'update' | 'delete';
  entityType: 'inventory' | 'sale' | 'expense';
}

export function useActionHistory(pageKey: string) {
  const [history, setHistory] = useState<ActionHistoryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isPerformingHistoryAction = useRef(false);

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

    setCurrentIndex(prev => prev + 1);
  }, [pageKey, currentIndex]);

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < history.length - 1;

  const undo = useCallback(async () => {
    if (!canUndo) return null;

    isPerformingHistoryAction.current = true;
    const actionToUndo = history[currentIndex];
    setCurrentIndex(prev => prev - 1);
    
    setTimeout(() => {
      isPerformingHistoryAction.current = false;
    }, 100);

    return actionToUndo;
  }, [canUndo, history, currentIndex]);

  const redo = useCallback(async () => {
    if (!canRedo) return null;

    isPerformingHistoryAction.current = true;
    const actionToRedo = history[currentIndex + 1];
    setCurrentIndex(prev => prev + 1);
    
    setTimeout(() => {
      isPerformingHistoryAction.current = false;
    }, 100);

    return actionToRedo;
  }, [canRedo, history, currentIndex]);

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
    history: history.slice(0, currentIndex + 1), // Solo le azioni fino all'indice corrente
    isPerformingHistoryAction: isPerformingHistoryAction.current,
  };
}
