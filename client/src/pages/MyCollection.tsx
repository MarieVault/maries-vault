import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookmarkX } from "lucide-react";
import EntryCard from "../components/EntryCard";

interface Entry {
  id: number;
  title: string;
  artist: string;
  imageUrl: string;
  type: string;
  tags: string[];
  saved_at: string;
}

export default function MyCollection() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/collections", { credentials: "include" })
      .then(r => r.json())
      .then(data => { setEntries(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <BookmarkX size={48} className="text-muted-foreground" />
        <h1 className="text-xl font-bold">My Collection</h1>
        <p className="text-muted-foreground text-sm">Create a free account to save entries to your personal collection.</p>
        <Link href="/login">
          <Button className="bg-pink-600 hover:bg-pink-700 text-white">Sign up free</Button>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm">← Back to vault</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="flex items-center h-full px-4 max-w-md mx-auto gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="w-9 h-9 rounded-full p-0">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <span className="font-semibold text-sm">My Collection</span>
          <span className="text-xs text-muted-foreground ml-auto">{entries.length} saved</span>
        </div>
      </header>

      <main className="pt-14 pb-8 px-4 max-w-md mx-auto">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <BookmarkX size={48} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold">Nothing saved yet</h2>
            <p className="text-muted-foreground text-sm">Hit the bookmark icon on any entry to save it here.</p>
            <Link href="/">
              <Button variant="outline" size="sm">Browse the vault</Button>
            </Link>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="flex flex-col gap-4 mt-4">
            {entries.map(entry => (
              <EntryCard key={entry.id} entry={entry as any} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
