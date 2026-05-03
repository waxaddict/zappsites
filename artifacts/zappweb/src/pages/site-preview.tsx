import { useParams, useLocation } from "wouter";
import { useGetSite } from "@workspace/api-client-react";
import { getGetSiteQueryKey } from "@workspace/api-client-react";
import { useGenerateSiteContent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, ExternalLink, Settings, Sparkles, Copy, Check } from "lucide-react";
import { useState } from "react";

const TIER_COLORS: Record<string, string> = {
  demo: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  live: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pro: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export default function SitePreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useGetSite(slug, {
    query: { queryKey: getGetSiteQueryKey(slug) },
  });

  const generate = useGenerateSiteContent();
  const site = data as {
    slug: string; businessName: string; themeId: string; tier: string;
    address?: string; email?: string; blurb?: string; aiBlurb?: string;
    demoExpiresAt?: string; createdAt: string;
  } | undefined;

  const siteUrl = `/s/${slug}`;
  const adminUrl = `/s/${slug}/admin`;
  const fullUrl = `${window.location.origin}${siteUrl}`;

  async function handleGenerate() {
    try {
      await generate.mutateAsync({ slug });
      await qc.invalidateQueries({ queryKey: getGetSiteQueryKey(slug) });
      toast.success("AI content generated!");
    } catch {
      toast.error("Failed to generate content — check OpenAI API key");
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Site not found</p>
      </div>
    );
  }

  const demoExpiry = site.demoExpiresAt ? new Date(site.demoExpiresAt) : null;
  const daysLeft = demoExpiry ? Math.ceil((demoExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">ZappWeb</span>
          </div>
          <button onClick={() => setLocation("/")} className="text-xs text-muted-foreground hover:text-foreground">
            Build another
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Success banner */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold tracking-tight text-foreground mb-1">{site.businessName}</div>
          <p className="text-muted-foreground text-sm mb-4">Site created successfully</p>
          <span className={`inline-block text-xs font-medium px-3 py-1 rounded-full border ${TIER_COLORS[site.tier] || TIER_COLORS.demo}`}>
            {site.tier.toUpperCase()} PLAN
            {daysLeft !== null && ` · ${daysLeft} days left`}
          </span>
        </div>

        {/* URL */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Site URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-background border border-border px-3 py-2 rounded-lg text-primary font-mono truncate">
              {fullUrl}
            </code>
            <button
              onClick={copyUrl}
              className="w-10 h-10 flex items-center justify-center bg-secondary rounded-lg hover:bg-accent transition-colors"
              data-testid="button-copy-url"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* AI Generate */}
        {site.blurb && !site.aiBlurb && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">AI content ready to generate</p>
                <p className="text-xs text-muted-foreground mb-3">AI will rewrite the business description and place it perfectly in the site.</p>
                <button
                  onClick={handleGenerate}
                  disabled={generate.isPending}
                  className="text-sm px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
                  data-testid="button-generate-ai"
                >
                  {generate.isPending ? (
                    <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Generate AI Content
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
            data-testid="link-open-site"
          >
            <ExternalLink className="w-4 h-4" />
            Open Site
          </a>
          <button
            onClick={() => setLocation(adminUrl)}
            className="flex items-center justify-center gap-2 py-3.5 bg-card border border-border rounded-xl font-medium text-sm hover:bg-accent transition-colors"
            data-testid="button-go-admin"
          >
            <Settings className="w-4 h-4" />
            Manage Site
          </button>
        </div>

        {/* Site details */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Site Details</p>
          {[
            ["Theme", site.themeId],
            ["Email", site.email || "—"],
            ["Created", new Date(site.createdAt).toLocaleDateString()],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-foreground font-medium capitalize">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
