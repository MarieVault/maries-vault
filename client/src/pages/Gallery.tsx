import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { ArrowLeft, Images, ImageIcon, CheckSquare, Loader2, Heart, X } from "lucide-react";

interface GalleryImage {
  filename: string;
  path: string;
  url: string;
  createdAt: string;
}

const FAVOURITES_KEY = "gallery_favourites";

function loadFavourites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveFavourites(favs: Set<string>) {
  localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...favs]));
}

export default function Gallery() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [favourites, setFavourites] = useState<Set<string>>(loadFavourites);
  const [saving, setSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState<"card" | "sequence" | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveTags, setSaveTags] = useState("AI gen");
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  useEffect(() => {
    fetch("/api/gallery")
      .then(r => r.json())
      .then(data => { setImages(data); setLoading(false); })
      .catch(() => {
        toast({ variant: "destructive", title: "Error", description: "Failed to load gallery" });
        setLoading(false);
      });
  }, []);

  const toggleSelect = (url: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleFavourite = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavourites(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      saveFavourites(next);
      return next;
    });
  };

  const displayImages = showFavsOnly ? images.filter(img => favourites.has(img.url)) : images;
  const selectedList = images.filter(img => selected.has(img.url));

  const openSaveDialog = (mode: "card" | "sequence") => {
    if (selectedList.length === 0) {
      toast({ variant: "destructive", title: "Select at least one image first" });
      return;
    }
    if (mode === "card" && selectedList.length > 1) {
      toast({ variant: "destructive", title: "Select just one image for a card", description: "Or use Save as Sequence for multiple." });
      return;
    }
    setSaveTitle("");
    setShowSaveDialog(mode);
  };

  const handleSave = async () => {
    if (!saveTitle.trim()) {
      toast({ variant: "destructive", title: "Title required" });
      return;
    }
    const tags = saveTags.split(",").map(t => t.trim()).filter(Boolean);
    const isSequence = showSaveDialog === "sequence";
    const type = isSequence ? "sequence" : "image";
    const urls = selectedList.map(i => i.url);

    setSaving(true);
    try {
      const entry = await apiRequest("POST", "/api/entries", {
        title: saveTitle,
        imageUrl: urls[0],
        sequenceImages: isSequence ? urls : [],
        type,
        artist: "AI Gen",
        tags,
        userId: 7,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      const id = entry.id;
      const vaultUrl = isSequence ? `/sequence/${id}` : `/image/${id}`;

      toast({ title: "Saved to Vault!", description: `"${saveTitle}" saved. Opening...`, duration: 2500 });
      setTimeout(() => setLocation(vaultUrl), 1500);
      setShowSaveDialog(null);
      setSelected(new Set());
      setSaveTitle("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="flex items-center justify-between h-full px-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="p-0 h-8 w-8">
            <ArrowLeft size={16} />
          </Button>
          <span className="font-semibold text-sm">AI Image Gallery</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFavsOnly(v => !v)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${showFavsOnly ? "bg-pink-100 text-pink-600" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Heart size={13} fill={showFavsOnly ? "currentColor" : "none"} />
              {favourites.size > 0 && <span>{favourites.size}</span>}
            </button>
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : `${displayImages.length} images`}
            </span>
          </div>
        </div>
      </header>

      <div className="pt-14 px-3 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : displayImages.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Images size={48} className="mx-auto mb-4 opacity-30" />
            <p>{showFavsOnly ? "No favourites yet. Tap ❤️ on images to heart them." : "No generated images found."}</p>
          </div>
        ) : (
          <>
            {/* Hint text */}
            <p className="text-xs text-muted-foreground text-center mt-2 mb-2">
              Tap image to select · ❤️ to favourite · then save below
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {displayImages.map(img => {
                const isSelected = selected.has(img.url);
                const isFav = favourites.has(img.url);
                const selIdx = selectedList.findIndex(i => i.url === img.url);

                return (
                  <div
                    key={img.url}
                    className={`relative aspect-square cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                      isSelected ? "border-purple-500 scale-[0.97]" : "border-transparent hover:border-purple-200"
                    }`}
                    onClick={() => toggleSelect(img.url)}
                  >
                    <img
                      src={img.url}
                      alt={img.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Selection overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                        <div className="bg-purple-600 rounded-full p-1">
                          <CheckSquare size={16} className="text-white" />
                        </div>
                      </div>
                    )}

                    {/* Order badge */}
                    {isSelected && selectedList.length > 1 && (
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs font-bold rounded px-1.5 py-0.5">
                        {selIdx + 1}
                      </div>
                    )}

                    {/* Heart button */}
                    <button
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                      onClick={(e) => toggleFavourite(img.url, e)}
                    >
                      <Heart
                        size={13}
                        className={isFav ? "text-pink-400" : "text-white/70"}
                        fill={isFav ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-3">
        <div className="max-w-2xl mx-auto space-y-2">
          {selected.size === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-1">
              Tap images above to select them, then save to vault
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {selected.size} image{selected.size > 1 ? "s" : ""} selected
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={() => openSaveDialog("card")}
              disabled={selected.size !== 1}
            >
              <ImageIcon size={15} className="mr-1.5" />
              Save as Card
            </Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => openSaveDialog("sequence")}
              disabled={selected.size < 1}
            >
              <Images size={15} className="mr-1.5" />
              Save as Sequence {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
              <X size={11} /> Clear selection
            </button>
          )}
        </div>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-5 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">
              {showSaveDialog === "sequence" ? "Save as Sequence" : "Save as Card"}
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              {selectedList.length} image{selectedList.length > 1 ? "s" : ""} · artist: AI Gen
            </p>

            {/* Preview strip */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
              {selectedList.slice(0, 6).map(img => (
                <img key={img.url} src={img.url} className="h-14 w-14 object-cover rounded flex-shrink-0" alt="" />
              ))}
              {selectedList.length > 6 && (
                <div className="h-14 w-14 bg-muted rounded flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                  +{selectedList.length - 6}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
                <Input
                  value={saveTitle}
                  onChange={e => setSaveTitle(e.target.value)}
                  placeholder="e.g. Prism at the Beach"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && saveTitle.trim()) handleSave(); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags (comma separated)</label>
                <Input
                  value={saveTags}
                  onChange={e => setSaveTags(e.target.value)}
                  placeholder="AI gen, prism, beach"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowSaveDialog(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                onClick={handleSave}
                disabled={saving || !saveTitle.trim()}
              >
                {saving && <Loader2 size={14} className="animate-spin mr-2" />}
                Save to Vault
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
