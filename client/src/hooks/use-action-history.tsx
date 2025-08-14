
// Hook rimosso - funzionalità undo/redo eliminata
export function useActionHistory() {
  return {
    addAction: () => {},
    undo: () => {},
    redo: () => {},
    canUndo: false,
    canRedo: false,
    getCurrentAction: () => null,
    clearHistory: () => {},
    history: [],
    currentIndex: -1,
    isPerformingHistoryAction: false,
    isLoading: false,
  };
}
