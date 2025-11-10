import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRandomEntry } from "../lib/entryUtils";
import type { Entry } from "@shared/schema";

interface EntriesContextType {
  entries: Entry[];
  currentEntry: Entry | null;
  isLoading: boolean;
  error: string | null;
  rerollEntry: () => void;
  updateEntryTitle: (id: number, title: string) => void;
}

const EntriesContext = createContext<EntriesContextType | undefined>(undefined);

export function useEntriesContext() {
  const context = useContext(EntriesContext);
  if (!context) {
    throw new Error("useEntriesContext must be used within an EntriesProvider");
  }
  return context;
}

interface EntriesProviderProps {
  children: ReactNode;
}

export function EntriesProvider({ children }: EntriesProviderProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<Entry | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/entries"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (data && Array.isArray(data)) {
      setEntries(data);
      
      // Set initial random entry if we don't have one
      if (!currentEntry && data.length > 0) {
        const lastId = localStorage.getItem('lastEntryId');
        const lastIdNum = lastId ? parseInt(lastId, 10) : undefined;
        const randomEntry = getRandomEntry(data, lastIdNum);
        setCurrentEntry(randomEntry);
        localStorage.setItem('lastEntryId', randomEntry.id.toString());
      }
    }
  }, [data, currentEntry]);

  const rerollEntry = () => {
    if (entries.length === 0) return;
    
    const newEntry = getRandomEntry(entries, currentEntry?.id);
    setCurrentEntry(newEntry);
    localStorage.setItem('lastEntryId', newEntry.id.toString());
  };

  const updateEntryTitle = (id: number, title: string) => {
    // Update entries array
    setEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, title } : entry
    ));
    
    // Update current entry if it matches
    if (currentEntry?.id === id) {
      setCurrentEntry(prev => prev ? { ...prev, title } : null);
    }
  };

  const contextValue: EntriesContextType = {
    entries,
    currentEntry,
    isLoading,
    error: error?.message || null,
    rerollEntry,
    updateEntryTitle,
  };

  return (
    <EntriesContext.Provider value={contextValue}>
      {children}
    </EntriesContext.Provider>
  );
}
