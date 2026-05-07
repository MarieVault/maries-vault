import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  HardDrive,
  Download,
  Trash2,
  Heart,
  X,
  Loader2,
  AlertTriangle,
  Lock,
} from "lucide-react";

type App = "choice" | "change" | "studio";
type AppFilter = "all" | App;

interface QuotaByApp {
  app: App;
  count: number;
  bytes: number;
}

interface QuotaPayload {
  userId: number;
  tier: "free" | "plus" | "pro";
  usedBytes: number;
  quotaBytes: number;
  percent: number;
  byApp: QuotaByApp[];
}

interface LedgerRow {
  id: number;
  app: App;
  kind: string;
  path: string;
  sizeBytes: number;
  mime: string | null;
  hearted: boolean;
  createdAt: string;
  sessionRef: string | null;
  isPublished?: boolean;
  publishedSlug?: string | null;
}

const APP_META: Record<App, { label: string; color: string }> = {
  choice: { label: "Choice", color: "bg-pink-500" },
  change: { label: "Change Room", color: "bg-amber-500" },
  studio: { label: "Studio", color: "bg-purple-500" },
};

function formatBytes(n: number): string {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function basename(p: string) {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

function formatDate(ts: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

export default function Storage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [quota, setQuota] = useState<QuotaPayload | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [appFilter, setAppFilter] = useState<AppFilter>("all");
  const [heartedOnly, setHeartedOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<number | null>(null);

  const fetchAll = async () => {
    const q = new URLSearchParams();
    if (appFilter !== "all") q.set("app", appFilter);
    if (heartedOnly) q.set("hearted", "1");
    q.set("limit", "500");
    const [qp, list] = await Promise.all([
      fetch("/api/quota", { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/ledger/list?${q}`, { credentials: "include" }).then((r) => r.json()),
    ]);
    setQuota(qp);
    setRows(Array.isArray(list) ? list : []);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    fetchAll().catch(() => setLoading(false));

  }, [isAuthenticated, appFilter, heartedOnly]);

  const pct = useMemo(() => {
    if (!quota || !quota.quotaBytes) return 0;
    return Math.min(1, quota.usedBytes / quota.quotaBytes);
  }, [quota]);

  const barColor = pct >= 1 ? "bg-red-500" : pct >= 0.8 ? "bg-orange-500" : "bg-pink-500";

  async function toggleHeart(row: LedgerRow) {
    setRowBusy(row.id);
    try {
      const res = await fetch(`/api/ledger/${row.id}/heart`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hearted: !row.hearted }),
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, hearted: !row.hearted } : r))
        );
      }
    } finally {
      setRowBusy(null);
    }
  }

  async function deleteOne(row: LedgerRow) {
    if (row.isPublished) {
      alert("This image backs a published story. Unpublish it from /s/" + row.publishedSlug + " first.");
      return;
    }
    if (!confirm(`Delete this ${row.app} file? The underlying image will also be removed.`)) return;
    setRowBusy(row.id);
    try {
      const res = await fetch(`/api/ledger/${row.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "locked") {
        alert(data.message || "Image is locked by a published story.");
      } else if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        fetchAll();
      }
    } finally {
      setRowBusy(null);
    }
  }

  function downloadUrl() {
    const q = new URLSearchParams();
    if (appFilter !== "all") q.set("app", appFilter);
    if (heartedOnly) q.set("hearted", "1");
    return `/api/ledger/download?${q}`;
  }

  async function bulkDelete(kind: "unhearted" | "all") {
    const scope =
      appFilter === "all" ? "across every app" : `in ${APP_META[appFilter as App].label}`;
    const verb = kind === "unhearted" ? "unhearted images" : "ALL images (hearted included)";
    const message =
      kind === "all"
        ? `This will permanently delete ${verb} ${scope}. Type DELETE to confirm:`
        : `Delete all ${verb} ${scope}? Hearted items will be kept.`;

    if (kind === "all") {
      const input = prompt(message);
      if (input !== "DELETE") return;
    } else {
      if (!confirm(message)) return;
    }

    setBusy(kind);
    try {
      const body: Record<string, unknown> = { confirm: "yes" };
      if (appFilter !== "all") body.app = appFilter;
      if (kind === "unhearted") body.unheartedOnly = true;
      const res = await fetch("/api/ledger/bulk-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || data.message || "Delete failed");
        return;
      }
      const lockedMsg = data.locked ? ` ${data.locked} kept (locked by published stories — unpublish first).` : "";
      alert(`Deleted ${data.deleted ?? "?"} entries.${lockedMsg}`);
      await fetchAll();
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <HardDrive size={48} className="text-muted-foreground" />
        <h1 className="text-xl font-bold">Storage</h1>
        <p className="text-muted-foreground text-sm">Sign in to manage your vault storage.</p>
        <Link href="/login">
          <Button className="bg-pink-600 hover:bg-pink-700 text-white">Sign in</Button>
        </Link>
      </div>
    );
  }

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
            <HardDrive size={14} /> Storage
          </span>
          {quota && (
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {formatBytes(quota.usedBytes)} / {formatBytes(quota.quotaBytes)}
            </span>
          )}
        </div>
      </header>

      <main className="pt-16 pb-10 px-4 max-w-2xl mx-auto space-y-5">
        {/* Quota bar */}
        {quota && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-2xl font-bold tabular-nums">
                  {formatBytes(quota.usedBytes)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}of {formatBytes(quota.quotaBytes)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(pct * 100)}% of your{" "}
                  <span className="uppercase font-semibold">{quota.tier}</span> tier
                </div>
              </div>
              {pct >= 0.8 && (
                <span className="text-[11px] font-semibold px-2 py-1 rounded bg-orange-500/15 text-orange-600 flex items-center gap-1">
                  <AlertTriangle size={12} /> near limit
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${barColor}`} style={{ width: `${pct * 100}%` }} />
            </div>
            {quota.byApp.length > 0 && (
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground pt-1">
                {quota.byApp.map((b) => (
                  <span key={b.app} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${APP_META[b.app]?.color ?? "bg-gray-400"}`} />
                    {APP_META[b.app]?.label ?? b.app}: {formatBytes(b.bytes)} ({b.count})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "choice", "change", "studio"] as AppFilter[]).map((k) => (
            <button
              key={k}
              onClick={() => setAppFilter(k)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                appFilter === k
                  ? "bg-pink-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {k === "all" ? "All" : APP_META[k as App].label}
            </button>
          ))}
          <button
            onClick={() => setHeartedOnly((v) => !v)}
            className={`ml-auto text-xs px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors ${
              heartedOnly
                ? "bg-pink-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            <Heart size={11} fill={heartedOnly ? "currentColor" : "none"} />
            Hearted only
          </button>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <a href={downloadUrl()} className="no-underline">
            <Button
              variant="outline"
              className="w-full h-11 gap-1.5 text-xs"
              disabled={rows.length === 0}
            >
              <Download size={14} /> Download ZIP
            </Button>
          </a>
          <Button
            variant="outline"
            onClick={() => bulkDelete("unhearted")}
            disabled={busy !== null || rows.filter((r) => !r.hearted).length === 0}
            className="h-11 gap-1.5 text-xs text-orange-700 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
          >
            {busy === "unhearted" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete unhearted
          </Button>
          <Button
            variant="outline"
            onClick={() => bulkDelete("all")}
            disabled={busy !== null || rows.length === 0}
            className="h-11 gap-1.5 text-xs text-red-700 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
          >
            {busy === "all" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete all
          </Button>
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {rows.length} {rows.length === 1 ? "file" : "files"}
            </h3>
            {rows.length === 500 && (
              <span className="text-[11px] text-muted-foreground">showing first 500</span>
            )}
          </div>
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No files match your filter.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase text-white shrink-0 ${
                      APP_META[r.app]?.color ?? "bg-gray-500"
                    }`}
                  >
                    {APP_META[r.app]?.label ?? r.app}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono truncate" title={r.path}>
                      {basename(r.path)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatBytes(r.sizeBytes)} · {formatDate(r.createdAt)}
                    </div>
                  </div>
                  {r.isPublished && r.publishedSlug && (
                    <a
                      href={`/s/${r.publishedSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-amber-600"
                      title="Published — click to view. Unpublish to unlock deletion."
                    >
                      <Lock size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => toggleHeart(r)}
                    disabled={rowBusy === r.id}
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                    title={r.hearted ? "Unheart" : "Heart"}
                  >
                    <Heart
                      size={14}
                      className={r.hearted ? "text-pink-500 fill-pink-500" : "text-muted-foreground"}
                    />
                  </button>
                  <button
                    onClick={() => deleteOne(r)}
                    disabled={rowBusy === r.id || r.isPublished}
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-muted-foreground hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={r.isPublished ? "Locked by published story" : "Delete"}
                  >
                    {rowBusy === r.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
