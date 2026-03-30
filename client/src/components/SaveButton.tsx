import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "../context/AuthContext";

interface SaveButtonProps {
  entryId: number;
  size?: "sm" | "default";
  showLabel?: boolean;
}

export default function SaveButton({ entryId, size = "sm", showLabel = false }: SaveButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!checked) {
      fetch(`/api/collections/check/${entryId}`, { credentials: "include" })
        .then(r => r.json())
        .then(d => { setSaved(d.saved); setChecked(true); })
        .catch(() => setChecked(true));
    }
  }, [entryId, checked]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      // Send them straight to the register tab
      navigate("/login?mode=register");
      return;
    }

    setLoading(true);
    try {
      const method = saved ? "DELETE" : "POST";
      const res = await fetch(`/api/collections/${entryId}`, {
        method,
        credentials: "include",
      });
      const data = await res.json();
      setSaved(data.saved);
      toast({
        title: saved ? "Removed from collection" : "Saved to your vault",
        description: saved ? "" : "Find it in My Collection.",
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
