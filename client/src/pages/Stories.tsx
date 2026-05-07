// Stories.tsx — public discovery feed of all shared stories across apps.
// Cards focus on cover image + title + tags (per Marie's design call).
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, BookOpen } from "lucide-react";

interface PublicStory {
  slug: string;
  app: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  storyUrl: string;
  tags: string[];
  views: number;
  nsfw: boolean;
  createdAt: string;
}

type Filter = "all" | "choice" | "change";

export default function Stories() {
  const [, setLocation] = useLocation();
  const [stories, setStories] = useState<PublicStory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [hideNsfw, setHideNsfw] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("app", filter);
    if (hideNsfw) params.set("nsfw", "0");
    fetch(`/api/stories/public?${params.toString()}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(rows => { setStories(Array.isArray(rows) ? rows : []); setError(null); })
      .catch(() => setError("Failed to load stories"));
  }, [filter, hideNsfw]);

  const appLabel = (app: string) => app === "choice" ? "Choice" : app === "change" ? "Change Room" : app;
  const appColor = (app: string) => app === "choice" ? "bg-pink-500" : app === "change" ? "bg-purple-500" : "bg-gray-500";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="p-1 hover:bg-muted rounded">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-semibold text-base flex-1">Shared Stories</h1>
          <button
            onClick={() => setHideNsfw(v => !v)}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${hideNsfw ? "bg-green-100 text-green-700" : "text-muted-foreground hover:text-foreground"}`}
            title={hideNsfw ? "Showing SFW only" : "Showing all"}
          >
            {hideNsfw ? "SFW only" : "All"}
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2">
          {(["all", "choice", "change"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                filter === f ? "bg-pink-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f === "all" ? "All" : appLabel(f)}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 py-4">
        {error && <p className="text-center text-sm text-red-500 py-8">{error}</p>}
        {!stories && !error && (
          <p className="text-center text-sm text-muted-foreground py-12">Loading…</p>
        )}
        {stories && stories.length === 0 && !error && (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No stories shared yet.</p>
            <p className="text-xs mt-1">Be the first — share an Adventure from Marie's Choice.</p>
          </div>
        )}

        {stories && stories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stories.map(s => (
              <Link key={s.slug} href={`/s/${s.slug}`}>
                <a className="block bg-card rounded-xl border border-border overflow-hidden hover:border-pink-300 transition-colors group">
                  <div className="aspect-[1200/630] bg-gradient-to-br from-pink-100 to-purple-100 relative overflow-hidden">
                    {s.coverUrl ? (
                      <img
                        src={s.coverUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={42} className="text-pink-300" />
                      </div>
                    )}
                    <span className={`absolute top-2 left-2 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full ${appColor(s.app)}`}>
                      {appLabel(s.app)}
                    </span>
                    {s.nsfw && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold text-white bg-pink-600 px-2 py-0.5 rounded-full">
                        NSFW
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h2 className="font-semibold text-sm leading-snug line-clamp-2">{s.title}</h2>
                    {s.tags && s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.tags.slice(0, 5).map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {t}
                          </span>
                        ))}
                        {s.tags.length > 5 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                            +{s.tags.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-2">
                      <span>👁 {s.views || 0}</span>
                    </div>
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
