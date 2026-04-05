import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface MangaEntry {
  id: number;
  title: string;
  image_url: string;
  artist: string;
  tags: string[];
  type: "comic" | "sequence";
  gallery_url: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  comic: "Comic",
  sequence: "Sequence",
};

const TYPE_COLOURS: Record<string, string> = {
  comic: "bg-blue-600",
  sequence: "bg-purple-600",
};

export default function MangaList() {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showTags, setShowTags] = useState(false);

  const { data: entries = [], isLoading } = useQuery<MangaEntry[]>({
    queryKey: ["/api/mangalist"],
  });

  // Collect all tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach(e => (e.tags || []).forEach(t => {
      if (t && !["twitter", "imported"].includes(t)) tagSet.add(t);
    }));
    return Array.from(tagSet).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const title = (e.title || "").toLowerCase();
      const artist = (e.artist || "").toLowerCase();
      const q = search.toLowerCase();
      if (q && !title.includes(q) && !artist.includes(q)) return false;
      if (activeTag && !(e.tags || []).includes(activeTag)) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      return true;
    });
  }, [entries, search, activeTag, typeFilter]);

  function entryUrl(e: MangaEntry) {
    if (e.gallery_url) return e.gallery_url;
    return e.type === "sequence" ? `/sequence/${e.id}` : `/entry/${e.id}`;
  }

  function isExternal(url: string) {
    return url.startsWith("http") || url.startsWith("/farhad");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Filters — compact sticky bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-2 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          {/* Row 1: back link + title + count */}
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" className="text-gray-400 hover:text-white text-sm">← Vault</Link>
            <span className="text-white font-bold">Manga List</span>
            <span className="text-gray-500 text-xs ml-auto">
              {isLoading ? "Loading…" : `${filtered.length} / ${entries.length}`}
            </span>
          </div>
          {/* Row 2: search + type + tags toggle */}
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="search"
              placeholder="Search title or artist…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 flex-1 min-w-0"
            />
            {["all", "comic", "sequence"].map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                  typeFilter === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {t === "all" ? "All" : TYPE_LABELS[t]}
              </button>
            ))}
            <button
              onClick={() => setShowTags(s => !s)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                showTags || activeTag ? "bg-pink-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {activeTag ? `#${activeTag} ✕` : "Tags"}
            </button>
          </div>
          {/* Tag pills — collapsed by default */}
          {showTags && (
            <div className="flex flex-wrap gap-1 mt-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => { setActiveTag(activeTag === tag ? null : tag); setShowTags(false); }}
                  className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                    activeTag === tag ? "bg-pink-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No results found.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-gray-400 text-left">
                  <th className="px-3 py-2 w-12"></th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Artist</th>
                  <th className="px-3 py-2 hidden md:table-cell">Tags</th>
                  <th className="px-3 py-2 w-20">Type</th>
                  <th className="px-3 py-2 w-16 hidden sm:table-cell"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const url = entryUrl(e);
                  const ext = isExternal(url);
                  const cleanTags = (e.tags || []).filter(t => !["twitter","imported"].includes(t));
                  return (
                    <tr
                      key={e.id}
                      className={`border-t border-gray-800 hover:bg-gray-900 transition-colors ${
                        i % 2 === 0 ? "bg-gray-950" : "bg-gray-900/40"
                      }`}
                    >
                      {/* Thumb */}
                      <td className="px-3 py-2">
                        {ext ? (
                          <a href={url} target={url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                            {e.image_url ? <img src={e.image_url} alt="" className="w-10 h-12 object-cover rounded border border-gray-700 hover:border-blue-400 transition-colors" loading="lazy" /> : <div className="w-10 h-12 bg-gray-800 rounded border border-gray-700" />}
                          </a>
                        ) : (
                          <Link href={url}>
                            {e.image_url ? <img src={e.image_url} alt="" className="w-10 h-12 object-cover rounded border border-gray-700 hover:border-blue-400 transition-colors" loading="lazy" /> : <div className="w-10 h-12 bg-gray-800 rounded border border-gray-700" />}
                          </Link>
                        )}
                      </td>
                      {/* Title */}
                      <td className="px-3 py-2 font-medium max-w-xs">
                        {ext ? (
                          <a href={url} target={url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="text-white hover:text-blue-300 line-clamp-2 leading-snug transition-colors">
                            {e.title}
                          </a>
                        ) : (
                          <Link href={url} className="text-white hover:text-blue-300 line-clamp-2 leading-snug transition-colors">
                            {e.title}
                          </Link>
                        )}
                      </td>
                      {/* Artist */}
                      <td className="px-3 py-2 text-gray-400 hidden sm:table-cell whitespace-nowrap">
                        {e.artist || "—"}
                      </td>
                      {/* Tags */}
                      <td className="px-3 py-2 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {cleanTags.slice(0, 4).map(tag => (
                            <button
                              key={tag}
                              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                              className="px-1.5 py-0.5 bg-gray-800 hover:bg-pink-700 text-gray-400 hover:text-white rounded text-xs transition-colors"
                            >
                              {tag}
                            </button>
                          ))}
                          {cleanTags.length > 4 && (
                            <span className="text-gray-600 text-xs">+{cleanTags.length - 4}</span>
                          )}
                        </div>
                      </td>
                      {/* Type badge */}
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${TYPE_COLOURS[e.type] || "bg-gray-700"}`}>
                          {TYPE_LABELS[e.type] || e.type}
                        </span>
                      </td>
                      {/* Read link */}
                      <td className="px-3 py-2 hidden sm:table-cell">
                        {ext ? (
                          <a
                            href={url}
                            target={url.startsWith("http") ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 font-semibold text-xs"
                          >
                            Read →
                          </a>
                        ) : (
                          <Link href={url} className="text-blue-400 hover:text-blue-300 font-semibold text-xs">
                            Read →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
