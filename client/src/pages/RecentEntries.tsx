import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Loader2, Filter } from "lucide-react";
import { useEntriesContext } from "../context/EntriesContext";
import EntryCard from "../components/EntryCard";

export default function RecentEntries() {
  const { entries, isLoading } = useEntriesContext();
  const [unratedOnly, setUnratedOnly] = useState(true);

  const recentEntries = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    let filtered = [...entries];
    if (unratedOnly) {
      filtered = filtered.filter(e => (e as any).userRating == null);
    }
    return filtered
      .sort((a, b) => b.id - a.id)
      .slice(0, 100);
  }, [entries, unratedOnly]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin h-8 w-8 text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft size={16} className="mr-2" />
            Back to Home
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Clock className="text-purple-600" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Recently Added</h1>
              <p className="text-sm text-gray-500">
                {recentEntries.length} {unratedOnly ? "unrated" : "recent"} entries — newest first
              </p>
            </div>
          </div>
          <Button
            variant={unratedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setUnratedOnly(!unratedOnly)}
            className={unratedOnly ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Filter size={14} className="mr-1" />
            {unratedOnly ? "Unrated Only" : "Show All"}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {recentEntries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Clock className="mx-auto mb-4 text-gray-300" size={48} />
          <p>{unratedOnly ? "No unrated entries — everything's rated!" : "No entries yet. Start by adding some!"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recentEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
