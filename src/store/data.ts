// All JSON under public/data is fetched once at startup (spec/01-SPEC.md §6).
import { create } from "zustand";
import { DATA_FILES, type Data } from "../lib/types";

interface DataState { data: Data | null; loading: boolean; error: string | null; progress: number; load: () => Promise<void> }

export const useData = create<DataState>((set, get) => ({
  data: null, loading: false, error: null, progress: 0,
  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null, progress: 0, data: null });
    try {
      let done = 0;
      const parts = await Promise.all(DATA_FILES.map(async (f) => {
        const r = await fetch(`./data/${f}.json`, { cache: "no-cache" });
        if (!r.ok) throw new Error(`${f}.json: HTTP ${r.status}`);
        const json = await r.json();
        set({ progress: ++done / DATA_FILES.length });
        return [f, json] as const;
      }));
      set({ data: Object.fromEntries(parts) as unknown as Data, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));

/** Use inside views rendered after the data gate in App.tsx. */
export const useD = () => useData((s) => s.data) as Data;
