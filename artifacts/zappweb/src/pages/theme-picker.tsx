import { useParams, useLocation } from "wouter";
import { useGetSite, useUpdateSite, useListThemes } from "@workspace/api-client-react";
import { getGetSiteQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Check, ArrowRight, Zap } from "lucide-react";

const THEME_PREVIEWS: Record<string, { bg: string; accent: string; textDark: boolean }> = {
  luminary: { bg: "#f8fafc", accent: "#2563eb", textDark: true },
  obsidian: { bg: "#09090b", accent: "#d97706", textDark: false },
  haven:    { bg: "#faf5ed", accent: "#b45309", textDark: true },
};

type Theme = { id: string; name: string; description: string; style: string; isDark: boolean };

export default function ThemePickerPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data: siteData } = useGetSite(slug, {
    query: { queryKey: getGetSiteQueryKey(slug) },
  });
  const site = siteData as { themeId: string; businessName: string } | undefined;

  const { data: themesData } = useListThemes();
  const themes = ((themesData as { themes: Theme[] } | undefined)?.themes) || [];

  const [selected, setSelected] = useState<string>(site?.themeId || "luminary");
  const [applying, setApplying] = useState(false);
  const updateSite = useUpdateSite();

  async function handleSelect(themeId: string) {
    setSelected(themeId);
  }

  async function handleConfirm() {
    setApplying(true);
    try {
      await updateSite.mutateAsync({ slug, data: { themeId: selected } });
      await qc.invalidateQueries({ queryKey: getGetSiteQueryKey(slug) });
      toast.success("Theme applied!");
      setLocation(`/s/${slug}/preview`);
    } catch {
      toast.error("Failed to apply theme");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="border-b border-border/50 sticky top-0 z-10 backdrop-blur-sm bg-background/80">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">Choose a theme</span>
          </div>
          <span className="text-xs text-muted-foreground">You can change this any time</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Pick your theme</h1>
          {site?.businessName && (
            <p className="text-muted-foreground text-sm mt-1">
              Previewing how <span className="text-foreground font-medium">{site.businessName}</span> will look
            </p>
          )}
        </div>

        <div className="space-y-4">
          {themes.map(theme => {
            const preview = THEME_PREVIEWS[theme.id] || THEME_PREVIEWS.luminary;
            const isSelected = selected === theme.id;

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelect(theme.id)}
                className={`w-full text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
                  isSelected ? "border-primary shadow-lg shadow-primary/10" : "border-border hover:border-border/80"
                }`}
                data-testid={`theme-option-${theme.id}`}
              >
                <div className="flex items-stretch">
                  {/* Mini site preview */}
                  <div className="w-48 sm:w-64 shrink-0 relative overflow-hidden" style={{ backgroundColor: preview.bg, minHeight: "140px" }}>
                    {/* Fake nav */}
                    <div
                      className="flex items-center justify-between px-3 py-2 border-b text-[9px] font-semibold"
                      style={{
                        backgroundColor: preview.bg,
                        borderColor: preview.textDark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)",
                        color: preview.textDark ? "#1a1a1a" : "#fff",
                      }}
                    >
                      <span>{site?.businessName || "Business Name"}</span>
                      <div className="flex gap-1.5">
                        {["About","Services","Contact"].map(n => (
                          <span key={n} className="opacity-50">{n}</span>
                        ))}
                      </div>
                    </div>
                    {/* Fake hero */}
                    <div className="px-3 py-3">
                      <div className="w-2/3 h-2 rounded mb-1.5" style={{ backgroundColor: preview.accent }} />
                      <div className="w-full h-1.5 rounded mb-1 opacity-20" style={{ backgroundColor: preview.textDark ? "#000" : "#fff" }} />
                      <div className="w-5/6 h-1.5 rounded mb-1 opacity-20" style={{ backgroundColor: preview.textDark ? "#000" : "#fff" }} />
                      <div className="w-3/4 h-1.5 rounded mb-3 opacity-20" style={{ backgroundColor: preview.textDark ? "#000" : "#fff" }} />
                      <div
                        className="inline-flex px-2.5 py-1 rounded-full text-[9px] font-semibold text-white"
                        style={{ backgroundColor: preview.accent }}
                      >
                        Get in touch
                      </div>
                    </div>
                    {/* Fake service cards */}
                    <div className="flex gap-1.5 px-3 pb-3">
                      {[1,2,3].map(i => (
                        <div
                          key={i}
                          className="flex-1 h-8 rounded"
                          style={{
                            backgroundColor: preview.textDark ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
                            border: `1px solid ${preview.accent}30`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 p-5 flex flex-col justify-between bg-card">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{theme.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">
                          {theme.style.replace(/-/g, " ")}
                        </span>
                        {theme.isDark && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">Dark</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{theme.description}</p>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{
                          borderColor: isSelected ? "hsl(var(--primary))" : "hsl(var(--border))",
                          backgroundColor: isSelected ? "hsl(var(--primary))" : "transparent",
                        }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <a
                        href={`/s/${slug}`}
                        onClick={async e => {
                          e.preventDefault();
                          // Apply theme first, then open preview
                          if (selected !== site?.themeId) {
                            await updateSite.mutateAsync({ slug, data: { themeId: theme.id } });
                          }
                          window.open(`/s/${slug}`, "_blank");
                        }}
                        className="text-xs text-primary hover:underline"
                        data-testid={`preview-${theme.id}`}
                      >
                        Preview site →
                      </a>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky confirm bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground capitalize">
              {themes.find(t => t.id === selected)?.name || selected}
            </p>
            <p className="text-xs text-muted-foreground">Selected theme</p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={applying}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            data-testid="button-confirm-theme"
          >
            {applying
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <>Confirm theme <ArrowRight className="w-4 h-4" /></>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
