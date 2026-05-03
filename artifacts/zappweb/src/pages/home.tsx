import { useLocation } from "wouter";
import { Zap, Globe, Clock, Palette, ArrowRight } from "lucide-react";

export default function HomePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground tracking-tight">ZappWeb</span>
          </div>
          <a href="/admin" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-admin">
            Master Admin
          </a>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-8">
          <Globe className="w-3 h-3" />
          Professional site in under 5 minutes
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground mb-4 leading-none">
          Pick a theme.<br />Build a site.
        </h1>
        <p className="text-muted-foreground text-lg max-w-sm mx-auto mb-10">
          Walk in, search the business on Google, fill the form, pick a theme, launch.
        </p>

        <button
          onClick={() => setLocation("/build")}
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl text-base hover:opacity-90 active:scale-[0.98] transition-all"
          data-testid="button-start"
        >
          Start building
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-3 gap-8 mt-16 max-w-sm mx-auto">
          {[
            { icon: Globe, label: "Google Places auto-fill" },
            { icon: Palette, label: "3 professional themes" },
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
      </div>
    </div>
  );
}
