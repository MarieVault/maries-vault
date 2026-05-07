import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, BookOpen, Bookmark, Star, Image, Crown, HardDrive, Check, X, AlertTriangle, Globe } from "lucide-react";

interface UserRow {
  id: number;
  username: string;
  email: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  signupIp: string | null;
  signupUserAgent: string | null;
  signupReferer: string | null;
  signupAcceptLanguage: string | null;
  createdAt: string;
  entries: number;
  saved: number;
  ratings: number;
  archived: number;
  usedBytes: number | string;
  storageFiles: number;
}

type SortKey = "id" | "usedBytes";

const FREE_TIER_BYTES = 1_073_741_824; // 1 GB — matches QUOTA_TIERS.free on the server

function formatBytes(n: number): string {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
  const [sortKey, setSortKey] = useState<SortKey>("usedBytes");
  const [acting, setActing] = useState<number | null>(null);

  const pendingUsers = useMemo(() => users.filter(u => u.status === "pending"), [users]);
  const activeUsers = useMemo(() => users.filter(u => u.status !== "pending"), [users]);

  const sortedUsers = useMemo(() => {
    const copy = [...activeUsers];
    if (sortKey === "usedBytes") {
      copy.sort((a, b) => Number(b.usedBytes || 0) - Number(a.usedBytes || 0));
    } else {
      copy.sort((a, b) => a.id - b.id);
    }
    return copy;
  }, [activeUsers, sortKey]);

  async function setUserStatus(userId: number, status: "approved" | "rejected") {
    setActing(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || err.message || "Failed to update status");
        return;
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
    } finally {
      setActing(null);
    }
  }

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

        {/* Pending approvals */}
        {pendingUsers.length > 0 && (
          <div className="bg-card border-2 border-orange-400/60 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-orange-500/10 flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange-500" />
              <h3 className="text-sm font-semibold">Pending approval ({pendingUsers.length})</h3>
            </div>
            <div className="divide-y divide-border">
              {pendingUsers.map(u => (
                <PendingRow
                  key={u.id}
                  user={u}
                  busy={acting === u.id}
                  onApprove={() => setUserStatus(u.id, "approved")}
                  onReject={() => setUserStatus(u.id, "rejected")}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Users size={14} /> Users ({activeUsers.length})
            </h3>
            <div className="flex gap-1 text-[11px]">
              <button
                onClick={() => setSortKey("usedBytes")}
                className={`px-2 py-0.5 rounded ${sortKey === "usedBytes" ? "bg-pink-500 text-white" : "bg-muted text-muted-foreground"}`}
              >
                Storage
              </button>
              <button
                onClick={() => setSortKey("id")}
                className={`px-2 py-0.5 rounded ${sortKey === "id" ? "bg-pink-500 text-white" : "bg-muted text-muted-foreground"}`}
              >
                Joined
              </button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {sortedUsers.map(u => {
              const bytes = Number(u.usedBytes || 0);
              const pct = Math.min(1, bytes / FREE_TIER_BYTES);
              const pctLabel = `${Math.round(pct * 100)}%`;
              const barColor = pct >= 1 ? "bg-red-500" : pct >= 0.8 ? "bg-orange-500" : "bg-pink-500";
              return (
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
                      {u.status === 'rejected' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600">rejected</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.email || "—"} · joined {formatDate(u.createdAt)}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <HardDrive size={11} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${barColor}`} style={{ width: `${pct * 100}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatBytes(bytes)} · {pctLabel} · {u.storageFiles}f
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground shrink-0 text-right">
                    <span title="Entries uploaded">📁 {u.entries}</span>
                    <span title="Saved entries">🔖 {u.saved}</span>
                    <span title="Ratings given">⭐ {u.ratings}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}

function PendingRow({
  user: u,
  busy,
  onApprove,
  onReject,
  formatDate,
}: {
  user: UserRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  formatDate: (ts: string) => string;
}) {
  const ua = u.signupUserAgent || "";
  const uaShort =
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iOS/i.test(ua) ? "iOS" :
    /Mac OS X/i.test(ua) ? "macOS" :
    /Windows/i.test(ua) ? "Windows" :
    /Linux/i.test(ua) ? "Linux" :
    "Unknown";
  const browser =
    /Firefox/i.test(ua) ? "Firefox" :
    /Edg\//i.test(ua) ? "Edge" :
    /Chrome/i.test(ua) ? "Chrome" :
    /Safari/i.test(ua) ? "Safari" :
    "?";
  const ref = u.signupReferer || "";
  const refHost = (() => {
    try { return ref ? new URL(ref).hostname : ""; } catch { return ""; }
  })();
  const suspicious =
    /\breturn=/i.test(ref) ||
    /bot|crawl|spider/i.test(ua) ||
    (refHost !== "" && !/(^|\.)mariesvault\.com$/.test(refHost));

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {u.username[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm truncate">{u.username}</span>
            {suspicious && (
              <span title="Suspicious signup signals" className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 flex items-center gap-0.5">
                <AlertTriangle size={10} /> suspicious
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{u.email} · joined {formatDate(u.createdAt)}</div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button
            size="sm"
            disabled={busy}
            onClick={onApprove}
            className="h-7 bg-green-600 hover:bg-green-700 text-white gap-1"
          >
            <Check size={12} /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onReject}
            className="h-7 gap-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <X size={12} /> Reject
          </Button>
        </div>
      </div>
      <div className="ml-11 text-[11px] text-muted-foreground space-y-0.5 font-mono">
        <div className="flex gap-1.5"><Globe size={11} className="shrink-0 mt-0.5" /><span className="truncate" title={u.signupIp ?? ""}>IP: {u.signupIp || "—"}</span></div>
        <div className="truncate" title={ua}>UA: {uaShort} · {browser}</div>
        {u.signupAcceptLanguage && (
          <div className="truncate" title={u.signupAcceptLanguage}>Lang: {u.signupAcceptLanguage}</div>
        )}
        {u.signupReferer && (
          <div className="truncate" title={u.signupReferer}>Ref: {u.signupReferer}</div>
        )}
      </div>
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
