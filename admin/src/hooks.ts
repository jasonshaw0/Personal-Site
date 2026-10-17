import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";
export function useResource<T>(path: string | null, interval = 0) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: Boolean(path) });
  const [revision, setRevision] = useState(0);
  const previousPath = useRef(path);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const load = async () => {
      const changed = previousPath.current !== path;
      previousPath.current = path;
      setState((previous) => ({
        data: changed ? undefined : previous.data,
        loading: changed || !previous.data,
        error: undefined,
      }));
      try {
        const data = await api<T>(path, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ data, loading: false });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            error: errorMessage(error),
            loading: false,
          }));
      }
    };
    void load();
    const timer = interval
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") void load();
        }, interval)
      : undefined;
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [path, revision, interval]);
  return { ...state, refresh: () => setRevision((value) => value + 1) };
}
