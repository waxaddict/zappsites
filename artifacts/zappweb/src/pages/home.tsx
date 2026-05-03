import { useListThemes } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Zap, ArrowRight, Globe, Clock, Palette } from "lucide-react";

const THEME_PREVIEWS: Record<string, { gradient: string; accent: string; dark: boolean }> = {
  luminary: { gradient: "from-slate-50 to-white", accent: "#2563eb", dark: false },
  obsidian: { gradient: "from-zinc-900 to-black", accent: "#d97706", dark: true },
  haven: { gradient: "from-amber-50 to-orange-50", accent: "#b45309", dark: false },
};

function ThemePreviewCard({ theme }: { theme: { id: string; name: string; description: string; style: string; isDark: boolean; pages: string[] } }) {
  const [, setLocation] = useLocation();
  const preview = THEME_PREVIEWS[theme.id] || { gradient: "from-zinc-800 to-zinc-900", accent: "#6366f1", dark: true };

  return (
    <div
      className="group relative rounded-xl border border-border overflow-hidden bg-card hover:border-primary/50 transition-all duration-300 cursor-pointer flex flex-col"
      onClick={() => setLocation(`/build/${theme.id}`)}
      data-testid={`theme-card-${theme.id}`}
    >
      {/* Preview mockup */}
      <div className={`relative h-48 bg-gradient-to-br ${preview.gradient} overflow-hidden`}>
        {/* Faux browser chrome */}
        <div className={`flex items-center gap-1.5 px-3 py-2 ${preview.dark ? "bg-black/40" : "bg-white/60"} backdrop-blur-sm`}>
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <div className={`ml-2 flex-1 h-4 rounded ${preview.dark ? "bg-white/10" : "bg-black/10"} text-[10px] flex items-center px-2 ${preview.dark ? "text-white/40" : "text-black/40"}`}>
            mysite.co.uk/business-name
          </div>
        </div>
        {/* Mini site preview */}
        <div className="p-4">
          <div className="w-16 h-2 rounded mb-3" style={{ backgroundColor: preview.accent }} />
          <div className={`w-full h-1.5 rounded mb-1.5 ${preview.dark ? "bg-white/20" : "bg-black/10"}`} />
          <div className={`w-4/5 h-1.5 rounded mb-3 ${preview.dark ? "bg-white/20" : "bg-black/10"}`} />
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex-1 h-12 rounded ${preview.dark ? "bg-white/10" : "bg-black/5"} border`} style={{ borderColor: preview.accent + "30" }} />
            ))}
          </div>
        </div>
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-foreground text-lg tracking-tight">{theme.name}</h3>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${theme.isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"}`}>
              {theme.style.replace(/-/g, " ")}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-200">
            <ArrowRight className="w-4 h-4 text-primary group-hover:text-white" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed flex-1">{theme.description}</p>
        <div className="flex flex-wrap gap-1 mt-3">
          {theme.pages.map(p => (
            <span key={p} className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{p}</span>
          ))}
        </div>
      </div>

      <div className="px-5 pb-5">
        <button
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-150"
          data-testid={`use-theme-${theme.id}`}
        >
          Use {theme.name}
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data, isLoading } = useListThemes();
  const themes = (data as { themes: Array<{ id: string; name: string; description: string; style: string; isDark: boolean; pages: string[] }> } | undefined)?.themes || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 sticky top-0 z-10 backdrop-blur-sm bg-background/80">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground tracking-tight">ZappWeb</span>
          </div>
          <a
            href="/admin"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-admin"
          >
            Master Admin
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 pt-14 pb-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-6">
            <Globe className="w-3 h-3" />
            Site in under 5 minutes
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            Pick a theme.<br />Build a site.
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Walk in, search the business on Google, fill the form, launch. That's it.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4 mb-14 max-w-lg mx-auto">
          {[
            { icon: Globe, label: "Google Places search" },
            { icon: Palette, label: "Pick brand colours" },
            { icon: Clock, label: "Live in minutes" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="text-center">
              <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mx-auto mb-2">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Theme grid */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-6 text-center">
            Choose a Theme to Begin
          </h2>

          {isLoading ? (
            <div className="grid sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-80 rounded-xl bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4">
              {themes.map(theme => (
                <ThemePreviewCard key={theme.id} theme={theme} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
