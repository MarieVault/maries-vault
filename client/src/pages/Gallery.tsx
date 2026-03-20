import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { ArrowLeft, Images, ImageIcon, CheckSquare, Square, Loader2 } from "lucide-react";

interface GalleryImage {
  filename: string;
  path: string;
  url: string;
  createdAt: string;
}

export default function Gallery() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState<"card" | "sequence" | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveTags, setSaveTags] = useState("AI gen");

  useEffect(() => {
    fetch("/api/gallery")
      .then(r => r.json())
      .then(data => {
        setImages(data);
        setLoading(false);
      })
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

  const selectedList = images.filter(img => selected.has(img.url));

  const handleSave = async () => {
    if (!saveTitle.trim()) {
      toast({ variant: "destructive", title: "Title required" });
      return;
    }
    if (selectedList.length === 0) {
      toast({ variant: "destructive", title: "Select at least one image" });
      return;
    }

    const tags = saveTags.split(",").map(t => t.trim()).filter(Boolean);
    const isSequence = showSaveDialog === "sequence" || selectedList.length > 1;
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

      toast({
        title: "Saved to Vault!",
        description: `"${saveTitle}" saved as ${type}. Opening...`,
        duration: 3000,
      });

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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="flex items-center justify-between h-full px-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="p-0 h-8 w-8">
            <ArrowLeft size={16} />
          </Button>
          <span className="font-semibold text-sm">AI Image Gallery</span>
          <span className="text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selected` : `${images.length} images`}
          </span>
        </div>
      </header>

      <div className="pt-14 px-3 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Images size={48} className="mx-auto mb-4 opacity-30" />
            <p>No generated images found.</p>
            <p className="text-sm mt-1">Images from NovelAI and Nano Banana will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {images.map(img => {
              const isSelected = selected.has(img.url);
              return (
                <div
                  key={img.url}
                  className={`relative aspect-square cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                    isSelected ? "border-purple-500 opacity-100" : "border-transparent opacity-90 hover:opacity-100"
                  }`}
                  onClick={() => toggleSelect(img.url)}
                >
                  <img
                    src={img.url}
                    alt={img.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Selection indicator */}
                  <div className={`absolute top-1 right-1 transition-opacity ${isSelected ? "opacity-100" : "opacity-0"}`}>
                    <div className="bg-purple-500 rounded-full p-0.5">
                      <CheckSquare size={14} className="text-white" />
                    </div>
                  </div>
                  {/* Order badge for sequences */}
                  {isSelected && selectedList.length > 1 && (
                    <div className="absolute top-1 left-1 bg-black/70 text-white text-xs rounded px-1">
                      {selectedList.findIndex(i => i.url === img.url) + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom action bar — shown when images are selected */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setShowSaveDialog("card"); setSaveTitle(""); }}
              disabled={selected.size !== 1}
            >
              <ImageIcon size={16} className="mr-2" />
              Save as Card
            </Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              onClick={() => { setShowSaveDialog("sequence"); setSaveTitle(""); }}
            >
              <Images size={16} className="mr-2" />
              Save as Sequence ({selected.size})
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            {selected.size === 1 ? "Select more images to create a sequence" : `${selected.size} images → sequence`}
          </p>
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-5 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">
              {showSaveDialog === "sequence" || selectedList.length > 1 ? "Save Sequence" : "Save Card"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedList.length} image{selectedList.length > 1 ? "s" : ""} selected
            </p>

            {/* Preview strip */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
              {selectedList.slice(0, 6).map(img => (
                <img
                  key={img.url}
                  src={img.url}
                  className="h-14 w-14 object-cover rounded flex-shrink-0"
                  alt=""
                />
              ))}
              {selectedList.length > 6 && (
                <div className="h-14 w-14 bg-muted rounded flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                  +{selectedList.length - 6}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input
                  value={saveTitle}
                  onChange={e => setSaveTitle(e.target.value)}
                  placeholder="e.g. Prism at the Beach"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
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
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={handleSave} disabled={saving || !saveTitle.trim()}>
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Save to Vault
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
