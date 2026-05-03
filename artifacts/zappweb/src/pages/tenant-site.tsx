import { useParams } from "wouter";
import { useGetPublicSite, useSubmitContactForm } from "@workspace/api-client-react";
import { getGetPublicSiteQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { toast } from "sonner";
import { Phone, Mail, MapPin, Clock, Instagram, Facebook, ExternalLink, Zap } from "lucide-react";

type PublicSite = {
  slug: string; businessName: string; themeId: string; tier: string;
  address?: string; postcode?: string; phone?: string; email?: string;
  blurb?: string; aiBlurb?: string; openingHours?: string[];
  logoUrl?: string; photos?: string[]; brandColors?: string[];
  socialLinks?: { instagram?: string; facebook?: string; tiktok?: string };
  headCode?: string; lat?: number; lng?: number; isActive: boolean;
};

export default function TenantSitePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useGetPublicSite(slug, {
    query: { queryKey: getGetPublicSiteQueryKey(slug) },
  });
  const site = data as PublicSite | undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!site || !site.isActive) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white/60 text-center px-4">
        <div>
          <p className="text-xl font-light mb-2">Site not available</p>
          <p className="text-sm">This site may have expired or been taken offline.</p>
        </div>
      </div>
    );
  }

  if (site.themeId === "obsidian") return <ObsidianTheme site={site} />;
  if (site.themeId === "haven") return <HavenTheme site={site} />;
  return <LuminaryTheme site={site} />;
}

// ─── Shared Components ────────────────────────────────────────────────────────

function ContactForm({ slug, accentColor = "#2563eb", dark = false }: { slug: string; accentColor?: string; dark?: boolean }) {
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

  const inputClass = `w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 ${
    dark
      ? "bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:ring-white/20"
      : "bg-black/5 border border-black/10 text-zinc-800 placeholder:text-zinc-400 focus:ring-black/20"
  }`;

  if (sent) {
    return (
      <div className={`rounded-2xl p-8 text-center border ${dark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"}`}>
        <p className="text-2xl font-bold mb-2">Message sent</p>
        <p className={dark ? "text-white/60" : "text-zinc-500"}>We'll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <input type="text" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inputClass} data-testid="input-contact-name" />
        <input type="email" placeholder="Email address" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className={inputClass} data-testid="input-contact-email" />
      </div>
      <input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} data-testid="input-contact-phone" />
      <textarea placeholder="Your message" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required rows={4} className={`${inputClass} resize-none`} data-testid="input-contact-message" />
      <button
        type="submit"
        disabled={submit.isPending}
        style={{ backgroundColor: accentColor }}
        className="w-full py-4 rounded-xl text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
        data-testid="button-contact-submit"
      >
        {submit.isPending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}

function SiteFooter({ site, dark = false }: { site: PublicSite; dark?: boolean }) {
  return (
    <footer className={`py-8 px-6 border-t ${dark ? "border-white/10 text-white/40" : "border-black/10 text-zinc-400"}`}>
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <p>{site.businessName} &copy; {new Date().getFullYear()}</p>
        <div className="flex items-center gap-4">
          {site.socialLinks?.instagram && (
            <a href={site.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
              <Instagram className="w-4 h-4" />
            </a>
          )}
          {site.socialLinks?.facebook && (
            <a href={site.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
              <Facebook className="w-4 h-4" />
            </a>
          )}
          {site.socialLinks?.tiktok && (
            <a href={site.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity text-xs font-bold">
              TikTok
            </a>
          )}
          <a href={`/s/${site.slug}/login`} className="hover:opacity-70 transition-opacity flex items-center gap-1">
            <Zap className="w-3 h-3" /> Admin
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── Luminary Theme (light, minimal, crisp) ──────────────────────────────────
function LuminaryTheme({ site }: { site: PublicSite }) {
  const accent = site.brandColors?.[0] || "#2563eb";
  const navItems = ["About", "Services", "Gallery", "Contact"];

  return (
    <div className="bg-white text-zinc-900 min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">{site.businessName}</span>
          <div className="hidden sm:flex items-center gap-6 text-sm text-zinc-500">
            {navItems.map(n => (
              <a key={n} href={`#${n.toLowerCase()}`} className="hover:text-zinc-900 transition-colors scroll-smooth">{n}</a>
            ))}
          </div>
          <a href={`#contact`} style={{ backgroundColor: accent }} className="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-white text-sm font-medium hover:opacity-90 transition-opacity">
            Get in touch
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          {site.logoUrl && <img src={site.logoUrl} alt={site.businessName} className="h-16 mb-8 object-contain" />}
          <div className="max-w-2xl">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-none mb-6">{site.businessName}</h1>
            <p className="text-xl text-zinc-500 leading-relaxed mb-8">
              {site.aiBlurb ? site.aiBlurb.split("\n")[0] : site.blurb?.slice(0, 120) || "Welcome to our business."}
            </p>
            <div className="flex gap-3">
              <a href="#contact" style={{ backgroundColor: accent }} className="px-6 py-3 rounded-full text-white font-medium hover:opacity-90 transition-opacity text-sm">
                Contact us
              </a>
              <a href="#about" className="px-6 py-3 rounded-full border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors text-sm">
                Learn more
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Photos strip */}
      {(site.photos || []).length > 0 && (
        <div className="overflow-x-auto px-6 pb-16">
          <div className="flex gap-4 max-w-5xl mx-auto">
            {(site.photos || []).slice(0, 4).map((url, i) => (
              <img key={i} src={url} alt="" className="w-64 h-48 object-cover rounded-2xl shrink-0 first:ml-0" />
            ))}
          </div>
        </div>
      )}

      {/* About */}
      <section id="about" className="py-20 px-6 bg-zinc-50">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>About Us</p>
            <h2 className="text-3xl font-bold mb-4">Who we are</h2>
            <p className="text-zinc-500 leading-relaxed">{site.aiBlurb || site.blurb || "We're passionate about what we do and committed to excellent service."}</p>
          </div>
          <div className="space-y-4">
            {site.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color: accent }} />
                <div><p className="font-medium text-sm">Address</p><p className="text-sm text-zinc-500">{site.address}</p></div>
              </div>
            )}
            {site.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 mt-0.5 shrink-0" style={{ color: accent }} />
                <div><p className="font-medium text-sm">Phone</p><a href={`tel:${site.phone}`} className="text-sm text-zinc-500 hover:underline">{site.phone}</a></div>
              </div>
            )}
            {site.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 mt-0.5 shrink-0" style={{ color: accent }} />
                <div><p className="font-medium text-sm">Email</p><a href={`mailto:${site.email}`} className="text-sm text-zinc-500 hover:underline">{site.email}</a></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: accent }}>Services</p>
          <h2 className="text-3xl font-bold mb-10 text-center">What we offer</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {["Quality Service", "Expert Team", "Great Results"].map((s, i) => (
              <div key={i} className="p-6 border border-zinc-100 rounded-2xl hover:border-zinc-200 transition-colors">
                <div className="w-10 h-10 rounded-full mb-4" style={{ backgroundColor: accent + "20" }}>
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold" style={{ color: accent }}>{i + 1}</div>
                </div>
                <h3 className="font-semibold mb-2">{s}</h3>
                <p className="text-sm text-zinc-400">Delivering excellence in every aspect of our work.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Opening Hours */}
      {(site.openingHours || []).length > 0 && (
        <section className="py-12 px-6 bg-zinc-50">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5" style={{ color: accent }} />
              <h2 className="text-xl font-bold">Opening Hours</h2>
            </div>
            <div className="space-y-2">
              {(site.openingHours || []).map((h, i) => (
                <div key={i} className="flex justify-between text-sm py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">{h.split(":")[0]}</span>
                  <span className="font-medium">{h.split(":").slice(1).join(":").trim()}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Gallery */}
      {(site.photos || []).length > 0 && (
        <section id="gallery" className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: accent }}>Gallery</p>
            <h2 className="text-3xl font-bold mb-10 text-center">Our work</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(site.photos || []).map((url, i) => (
                <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-2xl" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Map */}
      {site.postcode && (
        <div className="px-6 py-4">
          <div className="max-w-5xl mx-auto">
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(site.postcode)}&output=embed`}
              className="w-full h-64 rounded-2xl border-0"
              loading="lazy"
              title="Location map"
            />
          </div>
        </div>
      )}

      {/* Contact */}
      <section id="contact" className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: accent }}>Contact</p>
          <h2 className="text-3xl font-bold mb-3 text-center">Get in touch</h2>
          <p className="text-zinc-400 text-center mb-8">We'd love to hear from you.</p>
          <ContactForm slug={site.slug} accentColor={accent} dark={false} />
        </div>
      </section>

      <SiteFooter site={site} dark={false} />
    </div>
  );
}

// ─── Obsidian Theme (dark, cinematic, premium) ───────────────────────────────
function ObsidianTheme({ site }: { site: PublicSite }) {
  const accent = site.brandColors?.[0] || "#d97706";
  const navItems = ["About", "Services", "Gallery", "Contact"];

  return (
    <div className="bg-zinc-950 text-white min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <span className="font-bold text-lg tracking-tight">{site.businessName}</span>
            <div className="hidden sm:flex items-center gap-6 text-sm text-white/40">
              {navItems.map(n => (
                <a key={n} href={`#${n.toLowerCase()}`} className="hover:text-white transition-colors">{n}</a>
              ))}
            </div>
          </div>
        </nav>

        {(site.photos || []).length > 0 && (
          <div className="absolute inset-0">
            <img src={(site.photos || [])[0]} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/50 to-zinc-950" />
          </div>
        )}

        <div className="relative flex-1 flex items-center pt-16">
          <div className="max-w-5xl mx-auto px-6 py-20">
            {site.logoUrl && <img src={site.logoUrl} alt={site.businessName} className="h-14 mb-8 object-contain brightness-0 invert" />}
            <div className="w-12 h-0.5 mb-6" style={{ backgroundColor: accent }} />
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-none mb-6 max-w-xl">{site.businessName}</h1>
            <p className="text-white/60 text-xl max-w-lg leading-relaxed mb-10">
              {site.aiBlurb?.split("\n")[0] || site.blurb?.slice(0, 120) || "Premium service, exceptional results."}
            </p>
            <a href="#contact" style={{ borderColor: accent, color: accent }} className="inline-flex items-center px-6 py-3 border rounded font-medium text-sm hover:bg-white/5 transition-colors">
              Make an enquiry
            </a>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: accent }}>About</p>
            <h2 className="text-3xl font-bold mb-6">{site.businessName}</h2>
            <p className="text-white/50 leading-relaxed">{site.aiBlurb || site.blurb || "We are dedicated to delivering outstanding service."}</p>
          </div>
          <div className="space-y-6">
            {site.address && <ContactItem icon={<MapPin className="w-4 h-4" />} label={site.address} accent={accent} />}
            {site.phone && <ContactItem icon={<Phone className="w-4 h-4" />} label={site.phone} href={`tel:${site.phone}`} accent={accent} />}
            {site.email && <ContactItem icon={<Mail className="w-4 h-4" />} label={site.email} href={`mailto:${site.email}`} accent={accent} />}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest mb-12" style={{ color: accent }}>What we do</p>
          <div className="grid sm:grid-cols-3 gap-8">
            {["Excellence", "Precision", "Dedication"].map((s, i) => (
              <div key={i} className="border border-white/10 p-8 hover:border-white/20 transition-colors">
                <p className="text-5xl font-bold mb-6 opacity-20">0{i + 1}</p>
                <h3 className="font-semibold text-lg mb-3">{s}</h3>
                <p className="text-white/40 text-sm leading-relaxed">Bringing the highest standards to every project and client interaction.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      {(site.photos || []).length > 1 && (
        <section id="gallery" className="py-24 px-6 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest mb-12" style={{ color: accent }}>Gallery</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(site.photos || []).slice(1).map((url, i) => (
                <img key={i} src={url} alt="" className="w-full aspect-square object-cover" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Hours */}
      {(site.openingHours || []).length > 0 && (
        <div className="py-12 px-6 border-t border-white/5">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-4 h-4" style={{ color: accent }} />
              <h3 className="font-semibold tracking-wide text-sm uppercase">Hours</h3>
            </div>
            {(site.openingHours || []).map((h, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-white/5 text-sm">
                <span className="text-white/40">{h.split(":")[0]}</span>
                <span>{h.split(":").slice(1).join(":").trim()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <section id="contact" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: accent }}>Contact</p>
          <h2 className="text-3xl font-bold mb-2">Get in touch</h2>
          <p className="text-white/40 mb-10">We'll get back to you as soon as possible.</p>
          <ContactForm slug={site.slug} accentColor={accent} dark={true} />
        </div>
      </section>

      <SiteFooter site={site} dark={true} />
    </div>
  );
}

function ContactItem({ icon, label, href, accent }: { icon: React.ReactNode; label: string; href?: string; accent: string }) {
  const content = (
    <div className="flex items-center gap-4 group">
      <div className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-colors" style={{ color: accent }}>
        {icon}
      </div>
      <span className="text-white/60 text-sm group-hover:text-white/80 transition-colors">{label}</span>
    </div>
  );
  if (href) return <a href={href}>{content}</a>;
  return <div>{content}</div>;
}

// ─── Haven Theme (warm, organic, neighbourhood) ───────────────────────────────
function HavenTheme({ site }: { site: PublicSite }) {
  const accent = site.brandColors?.[0] || "#b45309";
  const navItems = ["About", "Services", "Gallery", "Contact"];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf5ed", color: "#1c1611", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ backgroundColor: "#faf5ed", borderColor: "#e8d9c4" }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-lg" style={{ color: accent }}>{site.businessName}</span>
          <div className="hidden sm:flex items-center gap-6 text-sm" style={{ color: "#6b5c48" }}>
            {navItems.map(n => (
              <a key={n} href={`#${n.toLowerCase()}`} className="hover:opacity-70 transition-opacity">{n}</a>
            ))}
          </div>
          <a href="#contact" className="px-5 py-2 rounded-full text-sm font-medium text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: accent }}>
            Contact
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 text-center" style={{ backgroundColor: "#f5ead6" }}>
        <div className="max-w-3xl mx-auto">
          {site.logoUrl && <img src={site.logoUrl} alt={site.businessName} className="h-16 mx-auto mb-8 object-contain" />}
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight" style={{ color: "#1c1611" }}>{site.businessName}</h1>
          <p className="text-lg mb-8 leading-relaxed" style={{ color: "#6b5c48" }}>
            {site.aiBlurb?.split("\n")[0] || site.blurb?.slice(0, 120) || "A local favourite, serving the community with heart."}
          </p>
          <div className="flex gap-3 justify-center">
            <a href="#contact" className="px-6 py-3 rounded-full text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: accent }}>
              Get in touch
            </a>
            <a href="#about" className="px-6 py-3 rounded-full border font-medium hover:opacity-70 transition-opacity" style={{ borderColor: accent, color: accent }}>
              Learn more
            </a>
          </div>
        </div>
      </section>

      {/* Photo strip */}
      {(site.photos || []).length > 0 && (
        <div className="py-8 px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-3 gap-3">
            {(site.photos || []).slice(0, 3).map((url, i) => (
              <img key={i} src={url} alt="" className="w-full h-48 object-cover rounded-3xl" />
            ))}
          </div>
        </div>
      )}

      {/* About */}
      <section id="about" className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>Our story</p>
            <h2 className="text-3xl font-bold mb-4">About us</h2>
            <p className="leading-relaxed" style={{ color: "#6b5c48" }}>{site.aiBlurb || site.blurb || "We're proud to serve our local community."}</p>
          </div>
          <div className="rounded-3xl p-6 space-y-4" style={{ backgroundColor: "#f5ead6" }}>
            {site.address && <InfoRow icon={<MapPin className="w-4 h-4" />} text={site.address} accent={accent} />}
            {site.phone && <InfoRow icon={<Phone className="w-4 h-4" />} text={site.phone} href={`tel:${site.phone}`} accent={accent} />}
            {site.email && <InfoRow icon={<Mail className="w-4 h-4" />} text={site.email} href={`mailto:${site.email}`} accent={accent} />}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 px-6" style={{ backgroundColor: "#f5ead6" }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: accent }}>Services</p>
          <h2 className="text-3xl font-bold mb-10 text-center">What we do</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {["Personal Service", "Quality First", "Local & Proud"].map((s, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white/70 border" style={{ borderColor: "#e8d9c4" }}>
                <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: accent }}>
                  {i + 1}
                </div>
                <h3 className="font-bold text-lg mb-2">{s}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6b5c48" }}>Committed to delivering the best for every customer who walks through our door.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hours */}
      {(site.openingHours || []).length > 0 && (
        <div className="py-12 px-6">
          <div className="max-w-2xl mx-auto rounded-3xl p-6" style={{ backgroundColor: "#f5ead6" }}>
            <div className="flex items-center gap-3 mb-5">
              <Clock className="w-5 h-5" style={{ color: accent }} />
              <h3 className="font-bold text-lg">Opening Hours</h3>
            </div>
            {(site.openingHours || []).map((h, i) => (
              <div key={i} className="flex justify-between py-2.5 border-b text-sm" style={{ borderColor: "#e8d9c4" }}>
                <span style={{ color: "#6b5c48" }}>{h.split(":")[0]}</span>
                <span className="font-medium">{h.split(":").slice(1).join(":").trim()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gallery */}
      {(site.photos || []).length > 0 && (
        <section id="gallery" className="py-20 px-6" style={{ backgroundColor: "#f5ead6" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: accent }}>Gallery</p>
            <h2 className="text-3xl font-bold mb-10 text-center">Our space</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(site.photos || []).map((url, i) => (
                <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-3xl" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Map */}
      {site.postcode && (
        <div className="px-6 py-4">
          <div className="max-w-5xl mx-auto">
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(site.postcode)}&output=embed`}
              className="w-full h-64 rounded-3xl border-0"
              loading="lazy"
              title="Location map"
            />
          </div>
        </div>
      )}

      {/* Contact */}
      <section id="contact" className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: accent }}>Say hello</p>
          <h2 className="text-3xl font-bold mb-2 text-center">Get in touch</h2>
          <p className="text-center mb-8" style={{ color: "#6b5c48" }}>We'd love to hear from you.</p>
          <ContactForm slug={site.slug} accentColor={accent} dark={false} />
        </div>
      </section>

      <footer className="py-8 px-6 border-t" style={{ borderColor: "#e8d9c4" }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: "#9c8060" }}>
          <p>{site.businessName} &copy; {new Date().getFullYear()}</p>
          <div className="flex items-center gap-4">
            {site.socialLinks?.instagram && <a href={site.socialLinks.instagram} target="_blank" rel="noopener noreferrer"><Instagram className="w-4 h-4" /></a>}
            {site.socialLinks?.facebook && <a href={site.socialLinks.facebook} target="_blank" rel="noopener noreferrer"><Facebook className="w-4 h-4" /></a>}
            <a href={`/s/${site.slug}/login`} className="flex items-center gap-1"><Zap className="w-3 h-3" /> Admin</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InfoRow({ icon, text, href, accent }: { icon: React.ReactNode; text: string; href?: string; accent: string }) {
  const inner = (
    <div className="flex items-center gap-3 text-sm">
      <span style={{ color: accent }}>{icon}</span>
      <span style={{ color: "#6b5c48" }}>{text}</span>
    </div>
  );
  if (href) return <a href={href} className="hover:opacity-70 transition-opacity">{inner}</a>;
  return inner;
}
