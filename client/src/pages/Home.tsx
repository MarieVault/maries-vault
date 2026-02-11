import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useEntriesContext } from "../context/EntriesContext";
import { useAuth } from "../context/AuthContext";
import Splash from "../components/Splash";
import EntryCard from "../components/EntryCard";
import Logo from "../components/Logo";
import { Button } from "@/components/ui/button";
import { Dice1, Users, Lock, Grid3X3, Square, Plus, Heart, Tag, Trophy } from "lucide-react";
import type { Entry } from "@shared/schema";

export default function Home() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState<'single' | 'feed'>('single');
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  const { currentEntry, isLoading, error, rerollEntry, entries } = useEntriesContext();

  // Create shuffled feed entries when in feed mode
  const [feedEntries, setFeedEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (entries.length > 0 && viewMode === 'feed') {
      // Create a shuffled copy of all entries
      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      setFeedEntries(shuffled);
    }
  }, [entries, viewMode]);

  const handleSplashComplete = () => {
    // The authentication is now handled by the auth context
    // No need to set localStorage flags anymore
  };

  const handleReroll = () => {
    setIsDiceRolling(true);

    setTimeout(() => {
      if (viewMode === 'single') {
        rerollEntry();
      } else {
        // Reshuffle the feed
        if (entries.length > 0) {
          const shuffled = [...entries].sort(() => Math.random() - 0.5);
          setFeedEntries(shuffled);
        }
      }

      // Stop dice rolling animation after 700ms
      setTimeout(() => {
        setIsDiceRolling(false);
      }, 700);
    }, 100);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'single' ? 'feed' : 'single');
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        handleReroll();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show splash screen if not authenticated
  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-800 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-white text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Splash onComplete={handleSplashComplete} />;
  }

  return (
    <div className="min-h-screen bg-background transition-opacity duration-500">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="flex items-center justify-between h-full px-4 max-w-md mx-auto">
          <Logo />
          
          <div className="flex items-center space-x-2">
            <Link href="/create">
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 rounded-full p-0 hover:bg-muted transition-all duration-200"
                aria-label="Create new entry"
              >
                <Plus size={16} className="text-green-600" />
              </Button>
            </Link>
            
            <Link href="/artists">
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 rounded-full p-0 hover:bg-muted transition-all duration-200"
                aria-label="View artists"
              >
                <Users size={16} className="text-indigo-600" />
              </Button>
            </Link>

            <Button
              onClick={toggleViewMode}
              size="sm"
              variant="ghost"
              className="w-10 h-10 rounded-full p-0 hover:bg-muted transition-all duration-200"
              aria-label={`Switch to ${viewMode === 'single' ? 'feed' : 'single'} view`}
            >
              {viewMode === 'single' ? (
                <Grid3X3 size={16} className="text-indigo-600" />
              ) : (
                <Square size={16} className="text-indigo-600" />
              )}
            </Button>
            
            <Button
              onClick={handleReroll}
              size="sm"
              className={`w-10 h-10 rounded-full p-0 shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 ${
                isDiceRolling 
                  ? 'animate-pulse bg-gradient-to-r from-pink-400 via-red-400 to-pink-500 shadow-pink-200' 
                  : 'bg-primary hover:bg-primary/90'
              }`}
              aria-label={viewMode === 'single' ? 'Re-roll for new entry' : 'Shuffle feed'}
              disabled={isLoading || isDiceRolling}
            >
              {isDiceRolling ? (
                <span className="text-lg drop-shadow-sm">💖</span>
              ) : (
                <span className="text-lg">🎲</span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-6 px-4 max-w-md mx-auto">
        {error ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Lock className="text-2xl text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">🔒 The vault is empty</h3>
            <p className="text-gray-500 text-sm">Come back later when new entries are added.</p>
            <p className="text-red-500 text-xs mt-2">Error: {error}</p>
          </div>
        ) : isLoading ? (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
            <div className="w-full h-56 bg-gray-200"></div>
            <div className="p-4 space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="flex space-x-2">
                <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
              </div>
            </div>
          </div>
        ) : viewMode === 'single' ? (
          currentEntry ? (
            <EntryCard entry={currentEntry} />
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Lock className="text-2xl text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">🔒 The vault is empty</h3>
              <p className="text-gray-500 text-sm">Come back later when new entries are added.</p>
            </div>
          )
        ) : (
          /* Feed View */
          <div className="space-y-6">
            {feedEntries.length > 0 ? (
              feedEntries.map((entry) => (
                <EntryCard key={`feed-${entry.id}`} entry={entry} />
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Grid3X3 className="text-2xl text-gray-400" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Loading feed...</h3>
                <p className="text-gray-500 text-sm">Preparing your randomized vault feed.</p>
              </div>
            )}
          </div>
        )}

        {/* Only show Browse section in single view mode */}
        {viewMode === 'single' && (
          <div className="mt-8 space-y-4">
            <div className="p-4 bg-white rounded-xl shadow-lg">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                <Users className="text-indigo-600" size={16} />
                <span>Browse Artists</span>
              </h3>
              <p className="text-gray-600 text-sm mb-3">Explore artwork by different artists</p>
              <Link href="/artists">
                <Button 
                  variant="outline" 
                  className="w-full" 
                >
                  Artists Gallery
                </Button>
              </Link>
            </div>
            
            <div className="p-4 bg-white rounded-xl shadow-lg">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                <Tag className="text-indigo-600" size={16} />
                <span>Browse Tags</span>
              </h3>
              <p className="text-gray-600 text-sm mb-3">Discover artwork by themes and categories</p>
              <Link href="/tags">
                <Button 
                  variant="outline" 
                  className="w-full" 
                >
                  Tags Gallery
                </Button>
              </Link>
            </div>

            <div className="p-4 bg-white rounded-xl shadow-lg">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                <Trophy className="text-yellow-600" size={16} />
                <span>Artist Rankings</span>
              </h3>
              <p className="text-gray-600 text-sm mb-3">See top artists ranked by weighted ratings</p>
              <Link href="/artist-rankings">
                <Button
                  variant="outline"
                  className="w-full"
                >
                  Artist Rankings
                </Button>
              </Link>
            </div>



          </div>
        )}
      </main>
    </div>
  );
}