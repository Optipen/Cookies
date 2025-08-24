import { useCallback } from "react";

export function useToast(setState) {
  const toast = useCallback((msg, tone = "info", options = {}) => {
    const id = Math.random().toString(36).slice(2);
    setState((s) => ({ ...s, toasts: [...s.toasts, { id, msg, tone }] }));
    const duration = options.ms || 2800;
    setTimeout(() => setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) })), duration);
  }, [setState]);

  return { toast };
}



