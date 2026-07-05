import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "../context/AuthContext";
import { queryClient } from "../lib/queryClient";

interface SaveButtonProps {
  entryId: number;
  size?: "sm" | "default";
  showLabel?: boolean;
}

export default function SaveButton({ entryId, size = "sm", showLabel = false }: SaveButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);

  // One shared query for the whole feed — React Query dedupes every SaveButton
  // instance into a single /api/collections/ids request instead of one
  // /api/collections/check per card.
  const { data: savedIds } = useQuery<number[]>({
    queryKey: ["/api/collections/ids"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const r = await fetch("/api/collections/ids", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const saved = (savedIds ?? []).includes(entryId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      // Send them straight to the register tab
      navigate("/login?mode=register");
      return;
    }

    const wasSaved = saved;
    setLoading(true);
    try {
      const res = await fetch(`/api/collections/${entryId}`, {
        method: wasSaved ? "DELETE" : "POST",
        credentials: "include",
      });
      const data = await res.json();
      // Update the shared cache so every button for this entry re-derives.
      queryClient.setQueryData<number[]>(["/api/collections/ids"], (old = []) =>
        data.saved ? Array.from(new Set([...old, entryId])) : old.filter((id) => id !== entryId)
      );
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({
        title: wasSaved ? "Removed from collection" : "Saved to your vault",
        description: wasSaved ? "" : "Find it in My Collection.",
      });
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={`transition-all duration-200 ${saved ? "text-pink-500 hover:text-pink-600" : "text-muted-foreground hover:text-pink-400"}`}
      title={isAuthenticated ? (saved ? "Remove from collection" : "Save to My Vault") : "Login to save"}
    >
      {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      {showLabel && (
        <span className="ml-1 text-xs">{saved ? "Saved" : "Save"}</span>
      )}
    </Button>
  );
}
