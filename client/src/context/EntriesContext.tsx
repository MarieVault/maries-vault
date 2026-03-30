import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRandomEntry } from "../lib/entryUtils";
import { useAuth } from "./AuthContext";
import type { Entry } from "@shared/schema";

export type FeedMode = "global" | "myvault";

interface EntriesContextType {
  entries: Entry[];
  currentEntry: Entry | null;
  isLoading: boolean;
  error: string | null;
  feedMode: FeedMode;
  setFeedMode: (mode: FeedMode) => void;
  rerollEntry: () => void;
  updateEntryTitle: (id: number, title: string) => void;
}

const EntriesContext = createContext<EntriesContextType | undefined>(undefined);

export function useEntriesContext() {
  const context = useContext(EntriesContext);
  if (!context) throw new Error("useEntriesContext must be used within an EntriesProvider");
  return context;
}

export function EntriesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<Entry | null>(null);
  const [feedMode, setFeedModeState] = useState<FeedMode>("global");

  const setFeedMode = (mode: FeedMode) => {
    // Only allow myvault if authenticated
    if (mode === "myvault" && !isAuthenticated) return;
    setFeedModeState(mode);
    setCurrentEntry(null); // reset current on feed switch
  };

  // Switch back to global if user logs out
  useEffect(() => {
    if (!isAuthenticated && feedMode === "myvault") {
      setFeedModeState("global");
    }
  }, [isAuthenticated, feedMode]);

  const globalQuery = useQuery({
    queryKey: ["/api/entries"],
    staleTime: 5 * 60 * 1000,
    enabled: feedMode === "global",
  });

  const myVaultQuery = useQuery({
    queryKey: ["/api/entries/myvault"],
    staleTime: 2 * 60 * 1000,
    enabled: feedMode === "myvault" && isAuthenticated,
  });

  const activeData = feedMode === "myvault" ? myVaultQuery.data : globalQuery.data;
  const isLoading = feedMode === "myvault" ? myVaultQuery.isLoading : globalQuery.isLoading;
  const error = feedMode === "myvault" ? myVaultQuery.error : globalQuery.error;

  useEffect(() => {
    if (activeData && Array.isArray(activeData)) {
      setEntries(activeData as Entry[]);
      if (!currentEntry && (activeData as Entry[]).length > 0) {
        const lastId = feedMode === "global" ? localStorage.getItem('lastEntryId') : null;
        const lastIdNum = lastId ? parseInt(lastId, 10) : undefined;
        const randomEntry = getRandomEntry(activeData as Entry[], lastIdNum);
        setCurrentEntry(randomEntry);
        if (feedMode === "global") localStorage.setItem('lastEntryId', randomEntry.id.toString());
      }
    } else if (activeData && Array.isArray(activeData) && (activeData as Entry[]).length === 0) {
      setEntries([]);
      setCurrentEntry(null);
    }
  }, [activeData, feedMode]);

  const rerollEntry = () => {
    if (entries.length === 0) return;
    const newEntry = getRandomEntry(entries, currentEntry?.id);
    setCurrentEntry(newEntry);
    if (feedMode === "global") localStorage.setItem('lastEntryId', newEntry.id.toString());
  };

  const updateEntryTitle = (id: number, title: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, title } : e));
    if (currentEntry?.id === id) setCurrentEntry(prev => prev ? { ...prev, title } : null);
  };

  return (
    <EntriesContext.Provider value={{
      entries,
      currentEntry,
      isLoading,
      error: (error as any)?.message || null,
      feedMode,
      setFeedMode,
      rerollEntry,
      updateEntryTitle,
    }}>
      {children}
    </EntriesContext.Provider>
  );
}
