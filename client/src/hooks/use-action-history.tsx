
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

    setCurrentIndex(prev => {
      // Calcola il nuovo indice basato sulla nuova lunghezza
      const newHistory = history.slice(0, prev + 1);
      newHistory.push(newAction);
      const finalHistory = newHistory.slice(-50);
      return finalHistory.length - 1;
    });
  }, [pageKey, currentIndex, history]);

  const canUndo = currentIndex >= 0 && history.length > 0;
  const canRedo = currentIndex < history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return null;

    const actionToUndo = history[currentIndex];
    setCurrentIndex(prev => prev - 1);
    
    return actionToUndo;
  }, [canUndo, history, currentIndex]);

  const redo = useCallback(() => {
    if (!canRedo) return null;

    const actionToRedo = history[currentIndex + 1];
    setCurrentIndex(prev => prev + 1);
    
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
    history,
    currentIndex,
    isPerformingHistoryAction: isPerformingHistoryAction.current,
  };
}
