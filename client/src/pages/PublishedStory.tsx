import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface PublishedStoryPayload {
  slug: string;
  app: string;
  user_id: number;
  username: string;
  title: string;
  summary: string | null;
  content: any;
  coverUrl: string | null;
  beforeUrl: string;
  afterUrl: string;
  tags: string[] | null;
  nsfw: boolean;
  views: number;
  created_at: string;
}

export default function PublishedStory() {
  const [, params] = useRoute("/s/:slug");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const slug = params?.slug;
  const [story, setStory] = useState<PublishedStoryPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/stories/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setStory)
      .catch(status => setErr(status === 404 ? "This story was removed or never existed." : "Could not load story."));
  }, [slug]);

  if (err) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground mb-6">{err}</p>
        <Link href="/" className="text-pink-600 underline">Back to Marie's Vault</Link>
      </div>
    );
  }

  if (!story) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const steps: any[] = Array.isArray(story.content?.steps) ? story.content.steps : [];
  const isChoice = story.app === "choice";
  const beforeLabel = isChoice ? "Scene 1" : "Before";
  const afterLabel = isChoice ? "Scene 2" : "After";
  const appLabel = isChoice ? "Marie's Choice" : "The Change Room";
  const appHref = isChoice ? "https://choice.mariesvault.com" : "https://change.mariesvault.com";
  const appCta = isChoice ? "Enter Marie's Choice" : "Enter The Change Room";
  const sectionHeading = isChoice ? "The story" : "The transformation";
  const ctaBlurb = isChoice ? "Want to spin your own choose-your-own-adventure?" : "Want to try your own transformation?";
  const intro = typeof story.content?.intro === "string" ? story.content.intro.trim() : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Home">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">{story.title}</h1>
            <p className="text-xs text-muted-foreground">
              by @{story.username} · {appLabel} · {story.views} views
            </p>
          </div>
          {user?.id === story.user_id && (
            <button
              onClick={async () => {
                if (!confirm("Unpublish this story? The link will 404 and your source images will become deletable again.")) return;
                setUnpublishing(true);
                const res = await fetch(`/api/stories/${story.slug}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                if (res.ok) navigate("/storage");
                else setUnpublishing(false);
              }}
              disabled={unpublishing}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-red-600"
              title="Unpublish"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {intro && (
          <div className="rounded-lg bg-muted/40 border border-border p-4 text-[15px] leading-relaxed whitespace-pre-wrap">
            {intro}
          </div>
        )}
        {story.summary && <p className="text-muted-foreground">{story.summary}</p>}

        <div className="grid grid-cols-2 gap-2">
          <figure>
            <img src={story.beforeUrl} alt={beforeLabel} className="w-full rounded-md border border-border" loading="eager" />
            <figcaption className="text-xs text-center text-muted-foreground mt-1">{beforeLabel}</figcaption>
          </figure>
          <figure>
            <img src={story.afterUrl} alt={afterLabel} className="w-full rounded-md border border-border" loading="eager" />
            <figcaption className="text-xs text-center text-muted-foreground mt-1">{afterLabel}</figcaption>
          </figure>
        </div>

        {story.tags && story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {story.tags.map(t => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
            ))}
          </div>
        )}

        {steps.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-semibold text-lg">{sectionHeading}</h2>
            {steps.map((s, i) => (
              <div key={i} className="space-y-2">
                {s.instruction && <p className="text-sm italic">{s.instruction}</p>}
                {s.story_beat && <p className="text-sm">{s.story_beat}</p>}
                {s.image_url && (
                  <img src={s.image_url} alt="" className="w-full rounded-md border border-border" loading="lazy" />
                )}
              </div>
            ))}
          </section>
        )}

        <div className="pt-6 border-t border-border text-center space-y-3">
          <p className="text-sm text-muted-foreground">{ctaBlurb}</p>
          <a
            href={appHref}
            className="inline-block px-5 py-2 rounded-full bg-pink-600 text-white font-semibold"
          >
            {appCta}
          </a>
        </div>
      </main>
    </div>
  );
}
