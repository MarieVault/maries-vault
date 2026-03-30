import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, BookOpen, Bookmark, Star, Image, Crown } from "lucide-react";

interface UserRow {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  entries: number;
  saved: number;
  ratings: number;
  archived: number;
}

interface Stats {
  total_users: number;
  total_entries: number;
  total_saves: number;
  total_ratings: number;
  comics: number;
  sequences: number;
  images: number;
  stories: number;
}

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    Promise.all([
      fetch("/api/admin/users", { credentials: "include" }).then(r => r.json()),
      fetch("/api/admin/stats", { credentials: "include" }).then(r => r.json()),
    ]).then(([u, s]) => {
      setUsers(u);
      setStats(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isAuthenticated, user]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  const formatDate = (ts: string) => ts ? new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : "—";

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="flex items-center h-full px-4 max-w-2xl mx-auto gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="w-9 h-9 rounded-full p-0">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <span className="font-semibold text-sm flex items-center gap-1.5">
            <Crown size={14} className="text-yellow-500" /> Admin Dashboard
          </span>
        </div>
      </header>

      <main className="pt-16 pb-10 px-4 max-w-2xl mx-auto space-y-6">

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <StatCard icon={<Users size={18} className="text-indigo-500" />} label="Total users" value={stats.total_users} />
            <StatCard icon={<BookOpen size={18} className="text-orange-500" />} label="Total entries" value={stats.total_entries} />
            <StatCard icon={<Bookmark size={18} className="text-pink-500" />} label="Total saves" value={stats.total_saves} />
            <StatCard icon={<Star size={18} className="text-yellow-500" />} label="Total ratings" value={stats.total_ratings} />
          </div>
        )}

        {/* Entry type breakdown */}
        {stats && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Image size={14} /> Entry types
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { label: "Comics", val: stats.comics },
                { label: "Sequences", val: stats.sequences },
                { label: "Images", val: stats.images },
                { label: "Stories", val: stats.stories },
              ].map(({ label, val }) => (
                <div key={label} className="bg-muted rounded-lg py-2">
                  <div className="font-bold text-base">{val}</div>
                  <div className="text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Users size={14} /> Users ({users.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {users.map(u => (
              <div key={u.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {u.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{u.username}</span>
                    {u.role === 'admin' && (
                      <Crown size={11} className="text-yellow-500" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email || "—"} · joined {formatDate(u.createdAt)}</div>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground shrink-0 text-right">
                  <span title="Entries uploaded">📁 {u.entries}</span>
                  <span title="Saved entries">🔖 {u.saved}</span>
                  <span title="Ratings given">⭐ {u.ratings}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
