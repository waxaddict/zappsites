import { useParams } from "wouter";
import { useGetPublicSite, useSubmitContactForm } from "@workspace/api-client-react";
import { getGetPublicSiteQueryKey } from "@workspace/api-client-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Phone, Mail, MapPin, Clock, Instagram, Facebook,
  Zap, ArrowRight, Menu, X,
} from "lucide-react";

type PublicSite = {
  slug: string; businessName: string; themeId: string; tier: string;
  address?: string; postcode?: string; phone?: string; email?: string;
  blurb?: string; aiBlurb?: string; openingHours?: string[];
  logoUrl?: string; photos?: string[]; brandColors?: string[];
  socialLinks?: { instagram?: string; facebook?: string; tiktok?: string };
  headCode?: string; lat?: number; lng?: number; isActive: boolean;
};

type ThemeMode = "light" | "dark" | "warm";

interface Palette {
  mode: ThemeMode;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
  cardBg: string;
  headingFont: string;
  bodyFont: string;
}

function buildPalette(mode: ThemeMode): Palette {
  if (mode === "dark") return {
    mode, bg: "#09090b", surface: "#18181b", border: "rgba(255,255,255,0.08)",
    text: "#fafafa", muted: "rgba(255,255,255,0.5)", subtle: "rgba(255,255,255,0.08)",
    cardBg: "rgba(255,255,255,0.04)",
    headingFont: "'Fraunces', Georgia, serif", bodyFont: "'DM Sans', system-ui, sans-serif",
  };
  if (mode === "warm") return {
    mode, bg: "#faf7f2", surface: "#f3ece0", border: "#e8d9c4",
    text: "#1c150e", muted: "#7c6a54", subtle: "#ede4d5",
    cardBg: "#f5eedd",
    headingFont: "'Fraunces', Georgia, serif", bodyFont: "'DM Sans', system-ui, sans-serif",
  };
  return {
    mode, bg: "#ffffff", surface: "#f8fafc", border: "#e5e7eb",
    text: "#0a0a0a", muted: "#6b7280", subtle: "#f3f4f6",
    cardBg: "#f9fafb",
    headingFont: "'Fraunces', Georgia, serif", bodyFont: "'DM Sans', system-ui, sans-serif",
  };
}

function FontLoader() {
  useEffect(() => {
    const id = "zw-google-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap";
      document.head.appendChild(link);
    }
  }, []);
  return null;
}

const DEFAULT_FEATURES = [
  { icon: "✦", title: "Quality You Can Trust", desc: "We're committed to delivering the highest standards in everything we do, every single time." },
  { icon: "◈", title: "Locally Rooted", desc: "Proudly serving our community with the care and personal attention that only a local business can offer." },
  { icon: "❋", title: "Your Satisfaction, Guaranteed", desc: "Every client matters to us. We go above and beyond to make sure you leave happy." },
];

function extractFeatures(aiBlurb?: string) {
  if (!aiBlurb) return DEFAULT_FEATURES;
  const bullets = aiBlurb.split("\n").filter(l => /^[•\-\*]\s/.test(l.trim()));
  if (bullets.length >= 3) {
    return bullets.slice(0, 3).map((b, i) => ({
      icon: DEFAULT_FEATURES[i].icon,
      title: DEFAULT_FEATURES[i].title,
      desc: b.replace(/^[•\-\*]\s/, ""),
    }));
  }
  const sentences = aiBlurb.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 30);
  if (sentences.length >= 3) {
    return sentences.slice(0, 3).map((s, i) => ({
      icon: DEFAULT_FEATURES[i].icon,
      title: DEFAULT_FEATURES[i].title,
      desc: s.trim(),
    }));
  }
  return DEFAULT_FEATURES;
}

function getTodayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

// ─── Shared: Contact Form ─────────────────────────────────────────────────────
function ContactForm({ slug, palette, accent }: { slug: string; palette: Palette; accent: string }) {
  const submit = useSubmitContactForm();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await submit.mutateAsync({ slug, data: form });
      setSent(true);
      toast.success("Message sent!");
    } catch {
      toast.error("Failed to send — please try again");
    }
  }

  const isDark = palette.mode === "dark";

  const inputClass = [
    "w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all",
    "border focus:ring-2",
    isDark
      ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-white/20 focus:border-white/30"
      : "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:ring-zinc-300 focus:border-zinc-300",
  ].join(" ");

  if (sent) return (
    <div className="rounded-2xl p-10 text-center" style={{ background: palette.cardBg, border: `1px solid ${palette.border}` }}>
      <div className="text-4xl mb-4">✓</div>
      <p className="text-xl font-semibold mb-2" style={{ fontFamily: palette.headingFont, color: palette.text }}>Message sent!</p>
      <p style={{ color: palette.muted, fontFamily: palette.bodyFont }}>We'll be in touch very soon.</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <input type="text" placeholder="Your name" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inputClass}
          style={{ fontFamily: palette.bodyFont }} data-testid="input-contact-name" />
        <input type="email" placeholder="Email address" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className={inputClass}
          style={{ fontFamily: palette.bodyFont }} data-testid="input-contact-email" />
      </div>
      <input type="tel" placeholder="Phone (optional)" value={form.phone}
        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass}
        style={{ fontFamily: palette.bodyFont }} data-testid="input-contact-phone" />
      <textarea placeholder="Tell us what you need…" value={form.message}
        onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required rows={4}
        className={`${inputClass} resize-none`} style={{ fontFamily: palette.bodyFont }}
        data-testid="input-contact-message" />
      <button
        type="submit" disabled={submit.isPending}
        style={{ backgroundColor: accent, fontFamily: palette.bodyFont }}
        className="w-full py-4 rounded-xl text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        data-testid="button-contact-submit"
      >
        {submit.isPending ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
        ) : (
          <>"Send message" <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
    </form>
  );
}

// ─── Shared: Nav ─────────────────────────────────────────────────────────────
function SiteNav({ site, palette, accent }: { site: PublicSite; palette: Palette; accent: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navItems = ["About", "Services", "Gallery", "Contact"];
  const hasPhotos = (site.photos || []).length > 0;
  const heroTransparent = hasPhotos && palette.mode !== "light";

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navBg = heroTransparent && !scrolled && !open
    ? "transparent"
    : palette.mode === "dark"
    ? "rgba(9,9,11,0.92)"
    : palette.mode === "warm"
    ? `${palette.bg}ee`
    : "rgba(255,255,255,0.92)";

  const navText = (heroTransparent && !scrolled) ? "rgba(255,255,255,0.85)" : palette.text;
  const navMuted = (heroTransparent && !scrolled) ? "rgba(255,255,255,0.55)" : palette.muted;
  const borderBottom = scrolled || !heroTransparent ? `1px solid ${palette.border}` : "1px solid transparent";

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{ background: navBg, borderBottom, backdropFilter: scrolled || !heroTransparent ? "blur(16px)" : "none" }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {site.logoUrl
              ? <img src={site.logoUrl} alt={site.businessName} className="h-8 object-contain"
                  style={{ filter: heroTransparent && !scrolled ? "brightness(0) invert(1)" : "none" }} />
              : <span className="text-lg font-bold tracking-tight" style={{ fontFamily: palette.headingFont, color: navText }}>{site.businessName}</span>
            }
          </div>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map(n => (
              <a key={n} href={`#${n.toLowerCase()}`}
                className="text-sm font-medium hover:opacity-70 transition-opacity"
                style={{ fontFamily: palette.bodyFont, color: navMuted }}>
                {n}
              </a>
            ))}
            <a href="#contact"
              className="px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: accent, fontFamily: palette.bodyFont }}>
              Get in touch
            </a>
          </div>

          <button className="md:hidden p-2 rounded-lg" onClick={() => setOpen(o => !o)}
            style={{ color: navText }}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden px-6 pb-6 space-y-4 border-t" style={{ borderColor: palette.border, background: palette.bg }}>
            {navItems.map(n => (
              <a key={n} href={`#${n.toLowerCase()}`} onClick={() => setOpen(false)}
                className="block text-base font-medium py-2"
                style={{ fontFamily: palette.bodyFont, color: palette.text }}>{n}</a>
            ))}
            <a href="#contact" onClick={() => setOpen(false)}
              className="flex items-center justify-center py-3 rounded-xl text-white font-semibold"
              style={{ backgroundColor: accent, fontFamily: palette.bodyFont }}>
              Get in touch
            </a>
          </div>
        )}
      </nav>
    </>
  );
}

// ─── Shared: Footer ───────────────────────────────────────────────────────────
function SiteFooter({ site, palette, accent }: { site: PublicSite; palette: Palette; accent: string }) {
  const footerBg = palette.mode === "dark" ? "#000000" : palette.mode === "warm" ? "#1c150e" : "#0a0a0a";
  return (
    <footer style={{ background: footerBg }}>
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="font-bold text-white text-base mb-1" style={{ fontFamily: palette.headingFont }}>{site.businessName}</p>
          <p className="text-white/40 text-xs" style={{ fontFamily: palette.bodyFont }}>
            © {new Date().getFullYear()} {site.businessName}. All rights reserved.
          </p>
        </div>
        <div className="flex items-center gap-5">
          {site.socialLinks?.instagram && (
            <a href={site.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
          )}
          {site.socialLinks?.facebook && (
            <a href={site.socialLinks.facebook} target="_blank" rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors">
              <Facebook className="w-4 h-4" />
            </a>
          )}
          {site.socialLinks?.tiktok && (
            <a href={site.socialLinks.tiktok} target="_blank" rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors text-xs font-bold">
              TikTok
            </a>
          )}
          <a href={`/s/${site.slug}/login`}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors text-xs"
            style={{ fontFamily: palette.bodyFont }}>
            <Zap className="w-3 h-3" style={{ color: accent }} /> Admin
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── The One Theme ───────────────────────────────────────────────────────────
function UnifiedTheme({ site, mode }: { site: PublicSite; mode: ThemeMode }) {
  const palette = buildPalette(mode);
  const photos = site.photos || [];
  const hasHeroPhoto = photos.length > 0;

  const defaultAccents: Record<ThemeMode, string> = {
    light: "#2563eb",
    dark: "#f59e0b",
    warm: "#b45309",
  };
  const accent = site.brandColors?.[0] || defaultAccents[mode];
  const features = extractFeatures(site.aiBlurb);
  const todayIndex = getTodayIndex();
  const hours = site.openingHours || [];

  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ background: palette.bg, color: palette.text, fontFamily: palette.bodyFont, scrollBehavior: "smooth" }}>
      <FontLoader />
      <SiteNav site={site} palette={palette} accent={accent} />

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section
        className="relative flex items-end min-h-screen overflow-hidden"
        ref={sectionRef}
      >
        {hasHeroPhoto ? (
          <>
            <img src={photos[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.15) 100%)" }} />
          </>
        ) : (
          <div className="absolute inset-0"
            style={{
              background: palette.mode === "dark"
                ? `radial-gradient(ellipse at 70% 50%, ${accent}28 0%, transparent 60%), #09090b`
                : palette.mode === "warm"
                ? `radial-gradient(ellipse at 30% 60%, ${accent}20 0%, transparent 55%), ${palette.bg}`
                : `radial-gradient(ellipse at 80% 40%, ${accent}18 0%, transparent 60%), #ffffff`,
            }}
          >
            {/* Subtle dot grid */}
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle, ${palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} 1px, transparent 1px)`,
              backgroundSize: "28px 28px",
            }} />
          </div>
        )}

        <div className="relative max-w-6xl mx-auto px-6 pb-20 pt-32 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-8"
              style={{
                background: hasHeroPhoto ? "rgba(255,255,255,0.12)" : `${accent}18`,
                border: `1px solid ${hasHeroPhoto ? "rgba(255,255,255,0.2)" : accent + "40"}`,
                color: hasHeroPhoto ? "rgba(255,255,255,0.9)" : accent,
                backdropFilter: hasHeroPhoto ? "blur(8px)" : "none",
              }}>
              {site.address?.split(",").pop()?.trim() || "Local Business"}
            </div>

            {site.logoUrl && (
              <img src={site.logoUrl} alt={site.businessName} className="h-14 mb-6 object-contain"
                style={{ filter: hasHeroPhoto ? "brightness(0) invert(1)" : "none" }} />
            )}

            <h1
              className="font-black leading-[0.95] mb-6"
              style={{
                fontFamily: palette.headingFont,
                fontSize: "clamp(3rem, 8vw, 6rem)",
                color: hasHeroPhoto ? "#ffffff" : palette.text,
                letterSpacing: "-0.02em",
              }}
            >
              {site.businessName}
            </h1>

            <p className="text-lg leading-relaxed mb-10 max-w-xl"
              style={{ color: hasHeroPhoto ? "rgba(255,255,255,0.72)" : palette.muted, fontWeight: 300 }}>
              {(() => {
                const raw = site.aiBlurb?.split("\n")[0] || site.blurb || "Welcome — we'd love to work with you.";
                if (raw.length <= 180) return raw;
                const cut = raw.slice(0, 180);
                return cut.slice(0, cut.lastIndexOf(" ")) + "…";
              })()}
            </p>

            <div className="flex flex-wrap gap-3">
              <a href="#contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
                style={{ backgroundColor: accent }}>
                Get in touch <ArrowRight className="w-4 h-4" />
              </a>
              {site.phone && (
                <a href={`tel:${site.phone}`}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm hover:opacity-80 active:scale-[0.98] transition-all"
                  style={{
                    border: `2px solid ${hasHeroPhoto ? "rgba(255,255,255,0.4)" : palette.border}`,
                    color: hasHeroPhoto ? "white" : palette.text,
                  }}>
                  <Phone className="w-4 h-4" /> Call us
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-40">
          <div className="w-px h-10 animate-pulse" style={{ background: hasHeroPhoto ? "white" : palette.muted }} />
        </div>
      </section>

      {/* ── PHOTO STRIP (if multiple photos) ────────────────────────────────── */}
      {photos.length > 1 && (
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div
            className="grid gap-2 rounded-3xl overflow-hidden"
            style={{
              gridTemplateColumns: photos.length >= 3 ? "2fr 1fr 1fr" : photos.length === 2 ? "1fr 1fr" : "1fr",
              gridTemplateRows: photos.length >= 3 ? "240px 240px" : "360px",
            }}
          >
            {photos.slice(1).slice(0, 5).map((url, i) => (
              <div key={i} className="overflow-hidden" style={{ gridRow: i === 0 && photos.length >= 3 ? "1 / 3" : undefined }}>
                <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABOUT ───────────────────────────────────────────────────────────── */}
      <section id="about" className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: accent, fontFamily: palette.bodyFont }}>
              About Us
            </p>
            <h2 className="font-black mb-6 leading-tight"
              style={{ fontFamily: palette.headingFont, fontSize: "clamp(2rem, 4vw, 3rem)", color: palette.text, letterSpacing: "-0.02em" }}>
              Who we are
            </h2>
            <p className="leading-relaxed text-base mb-6" style={{ color: palette.muted, fontWeight: 300 }}>
              {site.aiBlurb || site.blurb || "We are dedicated to delivering outstanding service and results you can count on."}
            </p>
            {site.phone && (
              <a href={`tel:${site.phone}`}
                className="inline-flex items-center gap-2 font-semibold text-sm hover:opacity-70 transition-opacity"
                style={{ color: accent, fontFamily: palette.bodyFont }}>
                <Phone className="w-4 h-4" /> {site.phone}
              </a>
            )}
          </div>

          <div className="space-y-4">
            {[
              site.address && { icon: <MapPin className="w-4 h-4" />, label: "Address", value: site.address },
              site.phone && { icon: <Phone className="w-4 h-4" />, label: "Phone", value: site.phone, href: `tel:${site.phone}` },
              site.email && { icon: <Mail className="w-4 h-4" />, label: "Email", value: site.email, href: `mailto:${site.email}` },
            ].filter(Boolean).map((item, i) => {
              if (!item) return null;
              const inner = (
                <div key={i} className="flex items-start gap-4 p-5 rounded-2xl transition-all hover:scale-[1.01]"
                  style={{ background: palette.cardBg, border: `1px solid ${palette.border}` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${accent}18`, color: accent }}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: palette.muted, fontFamily: palette.bodyFont }}>{item.label}</p>
                    <p className="text-sm font-medium" style={{ color: palette.text, fontFamily: palette.bodyFont }}>{item.value}</p>
                  </div>
                </div>
              );
              return item.href ? <a key={i} href={item.href}>{inner}</a> : inner;
            })}

            {site.postcode && (
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${palette.border}` }}>
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(site.postcode)}&output=embed`}
                  className="w-full h-44 border-0" loading="lazy" title="Location" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SERVICES / WHY US ───────────────────────────────────────────────── */}
      <section id="services" style={{ background: palette.mode === "dark" ? palette.surface : palette.subtle }}>
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: accent, fontFamily: palette.bodyFont }}>
              Why choose us
            </p>
            <h2 className="font-black leading-tight"
              style={{ fontFamily: palette.headingFont, fontSize: "clamp(2rem, 4vw, 3rem)", color: palette.text, letterSpacing: "-0.02em" }}>
              What we stand for
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
                style={{ background: palette.bg, border: `1px solid ${palette.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div className="text-3xl mb-6" style={{ color: accent }}>{f.icon}</div>
                <h3 className="font-bold text-lg mb-3" style={{ fontFamily: palette.headingFont, color: palette.text }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: palette.muted, fontFamily: palette.bodyFont, fontWeight: 300 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ─────────────────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <section id="gallery" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: accent, fontFamily: palette.bodyFont }}>Gallery</p>
                <h2 className="font-black leading-tight"
                  style={{ fontFamily: palette.headingFont, fontSize: "clamp(2rem, 4vw, 3rem)", color: palette.text, letterSpacing: "-0.02em" }}>
                  Our work
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 auto-rows-[220px]">
              {photos.map((url, i) => (
                <div key={i}
                  className={`rounded-2xl overflow-hidden ${i === 0 ? "md:col-span-2 md:row-span-2" : ""}`}
                  style={{ gridRow: i === 0 ? "span 2" : undefined }}>
                  <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── OPENING HOURS ───────────────────────────────────────────────────── */}
      {hours.length > 0 && (
        <div style={{ background: palette.mode === "dark" ? palette.surface : palette.subtle }}>
          <div className="max-w-2xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xl" style={{ fontFamily: palette.headingFont, color: palette.text }}>Opening Hours</h3>
            </div>
            <div className="space-y-1">
              {hours.map((h, i) => {
                const day = h.split(":")[0];
                const time = h.split(":").slice(1).join(":").trim();
                const isToday = i === todayIndex;
                return (
                  <div key={i} className="flex justify-between items-center px-4 py-3 rounded-xl transition-colors"
                    style={{
                      background: isToday ? `${accent}12` : "transparent",
                      border: isToday ? `1px solid ${accent}30` : "1px solid transparent",
                    }}>
                    <span className="text-sm font-medium" style={{ color: isToday ? accent : palette.muted, fontFamily: palette.bodyFont }}>{day}</span>
                    <span className="text-sm font-semibold" style={{ color: isToday ? accent : palette.text, fontFamily: palette.bodyFont }}>{time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACT CTA ─────────────────────────────────────────────────────── */}
      <section id="contact" style={{ background: accent }}>
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="text-white">
              <p className="text-xs font-bold uppercase tracking-widest mb-4 text-white/60" style={{ fontFamily: palette.bodyFont }}>
                Contact
              </p>
              <h2 className="font-black leading-tight mb-6"
                style={{ fontFamily: palette.headingFont, fontSize: "clamp(2.5rem, 5vw, 4rem)", letterSpacing: "-0.02em" }}>
                Let's talk.
              </h2>
              <p className="text-white/70 text-base leading-relaxed mb-10" style={{ fontFamily: palette.bodyFont, fontWeight: 300 }}>
                We'd love to hear from you. Fill in the form and we'll get back to you as soon as possible.
              </p>
              <div className="space-y-5">
                {site.phone && (
                  <a href={`tel:${site.phone}`} className="flex items-center gap-4 text-white group">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-lg" style={{ fontFamily: palette.bodyFont }}>{site.phone}</span>
                  </a>
                )}
                {site.email && (
                  <a href={`mailto:${site.email}`} className="flex items-center gap-4 text-white group">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="font-medium" style={{ fontFamily: palette.bodyFont }}>{site.email}</span>
                  </a>
                )}
                {site.address && (
                  <div className="flex items-center gap-4 text-white">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="font-medium" style={{ fontFamily: palette.bodyFont }}>{site.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Form card */}
            <div className="rounded-3xl p-8 shadow-2xl" style={{ background: palette.bg }}>
              <ContactForm slug={site.slug} palette={palette} accent={accent} />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter site={site} palette={palette} accent={accent} />
    </div>
  );
}

// ─── Theme Entry Points (add new themes here) ─────────────────────────────────
function LuminaryTheme({ site }: { site: PublicSite }) {
  return <UnifiedTheme site={site} mode="light" />;
}

function ObsidianTheme({ site }: { site: PublicSite }) {
  return <UnifiedTheme site={site} mode="dark" />;
}

function HavenTheme({ site }: { site: PublicSite }) {
  return <UnifiedTheme site={site} mode="warm" />;
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function TenantSitePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useGetPublicSite(slug, {
    query: { queryKey: getGetPublicSiteQueryKey(slug) },
  });
  const site = data as PublicSite | undefined;

  if (isLoading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (!site || !site.isActive) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white/60 text-center px-4">
      <div>
        <p className="text-xl font-light mb-2">Site not available</p>
        <p className="text-sm">This site may have expired or been taken offline.</p>
      </div>
    </div>
  );

  if (site.themeId === "obsidian") return <ObsidianTheme site={site} />;
  if (site.themeId === "haven") return <HavenTheme site={site} />;
  return <LuminaryTheme site={site} />;
}
