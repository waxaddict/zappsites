import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useListThemes, useSearchPlaces, useGetPlaceDetails, useCreateSite, getSearchPlacesQueryKey, getGetPlaceDetailsQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Zap, Search, MapPin, X, Plus, Trash2, ArrowLeft } from "lucide-react";

type SocialLinks = { instagram?: string; facebook?: string; tiktok?: string };

interface FormData {
  businessName: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  openingHours: string[];
  blurb: string;
  logoUrl: string;
  brandColors: string[];
  socialLinks: SocialLinks;
  password: string;
  confirmPassword: string;
}

export default function BuildPage() {
  const { themeId } = useParams<{ themeId: string }>();
  const [, setLocation] = useLocation();

  const [placeSearch, setPlaceSearch] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormData>({
    businessName: "",
    address: "",
    postcode: "",
    phone: "",
    email: "",
    openingHours: [],
    blurb: "",
    logoUrl: "",
    brandColors: [""],
    socialLinks: {},
    password: "",
    confirmPassword: "",
  });

  const { data: themesData } = useListThemes();
  const themes = (themesData as { themes: Array<{ id: string; name: string; style: string }> } | undefined)?.themes || [];
  const currentTheme = themes.find(t => t.id === themeId);

  const { data: searchResults, isLoading: searching } = useSearchPlaces(
    { q: placeSearch },
    { query: { queryKey: getSearchPlacesQueryKey({ q: placeSearch }), enabled: placeSearch.length > 2 } }
  );
  const results = (searchResults as { results: Array<{ placeId: string; name: string; address: string }> } | undefined)?.results || [];

  const { data: placeDetails, isLoading: loadingDetails } = useGetPlaceDetails(
    selectedPlaceId || "",
    { query: { queryKey: getGetPlaceDetailsQueryKey(selectedPlaceId || ""), enabled: !!selectedPlaceId } }
  );

  const createSite = useCreateSite();

  useEffect(() => {
    if (placeDetails) {
      const d = placeDetails as {
        name?: string; address?: string; postcode?: string; phone?: string;
        website?: string; email?: string; openingHours?: string[];
        socialLinks?: SocialLinks;
      };
      setForm(f => ({
        ...f,
        businessName: d.name || f.businessName,
        address: d.address || f.address,
        postcode: d.postcode || f.postcode,
        phone: d.phone || f.phone,
        email: d.email || f.email,
        openingHours: d.openingHours || f.openingHours,
        socialLinks: d.socialLinks || f.socialLinks,
      }));
    }
  }, [placeDetails]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!form.businessName || !form.password) {
      toast.error("Business name and password are required");
      return;
    }

    try {
      const site = await createSite.mutateAsync({
        data: {
          placeId: selectedPlaceId || undefined,
          businessName: form.businessName,
          themeId: themeId || "luminary",
          address: form.address,
          postcode: form.postcode,
          phone: form.phone,
          email: form.email,
          website: "",
          blurb: form.blurb,
          openingHours: form.openingHours.filter(Boolean),
          brandColors: form.brandColors.filter(Boolean),
          socialLinks: form.socialLinks,
          password: form.password,
        },
      });

      const s = site as { slug: string };
      toast.success("Site created!");
      setLocation(`/s/${s.slug}/preview`);
    } catch {
      toast.error("Failed to create site. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border/50 sticky top-0 z-10 backdrop-blur-sm bg-background/80">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">
              {currentTheme ? `${currentTheme.name} Theme` : "Building"}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Build a site</h1>
          <p className="text-muted-foreground text-sm mt-1">Search the business to auto-fill, then review and submit.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Google Places Search */}
          <div ref={searchRef} className="relative">
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Search Business (Google Places)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={placeSearch}
                onChange={e => { setPlaceSearch(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                placeholder="e.g. Costa Coffee Bristol"
                className="w-full pl-9 pr-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="input-place-search"
              />
              {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
            </div>

            {showResults && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-20 max-h-60 overflow-auto">
                {results.map(r => (
                  <button
                    key={r.placeId}
                    type="button"
                    onClick={() => {
                      setSelectedPlaceId(r.placeId);
                      setPlaceSearch(r.name);
                      setShowResults(false);
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent text-left transition-colors"
                    data-testid={`place-result-${r.placeId}`}
                  >
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.address}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedPlaceId && (
              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Place selected — fields auto-filled below
                {loadingDetails && " (loading details...)"}
              </p>
            )}
          </div>

          {/* Business Info */}
          <Section title="Business Info">
            <Field label="Business Name *" required>
              <input
                type="text"
                value={form.businessName}
                onChange={e => setField("businessName", e.target.value)}
                className="input-field"
                required
                data-testid="input-business-name"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input type="tel" value={form.phone} onChange={e => setField("phone", e.target.value)} className="input-field" data-testid="input-phone" />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={e => setField("email", e.target.value)} className="input-field" data-testid="input-email" />
              </Field>
            </div>
            <Field label="Address">
              <input type="text" value={form.address} onChange={e => setField("address", e.target.value)} className="input-field" data-testid="input-address" />
            </Field>
            <Field label="Postcode">
              <input type="text" value={form.postcode} onChange={e => setField("postcode", e.target.value)} className="input-field" data-testid="input-postcode" />
            </Field>
          </Section>

          {/* Opening Hours */}
          <Section title="Opening Hours">
            {form.openingHours.map((h, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={h}
                  onChange={e => {
                    const hrs = [...form.openingHours];
                    hrs[i] = e.target.value;
                    setField("openingHours", hrs);
                  }}
                  className="input-field flex-1"
                  placeholder="Monday: 9am - 5pm"
                  data-testid={`input-hours-${i}`}
                />
                <button type="button" onClick={() => setField("openingHours", form.openingHours.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setField("openingHours", [...form.openingHours, ""])}
              className="text-xs text-primary flex items-center gap-1 hover:underline"
              data-testid="button-add-hours"
            >
              <Plus className="w-3 h-3" /> Add line
            </button>
          </Section>

          {/* Blurb */}
          <Section title="Business Description">
            <p className="text-xs text-muted-foreground mb-2">Paste any text — AI will rewrite and place it perfectly.</p>
            <textarea
              value={form.blurb}
              onChange={e => setField("blurb", e.target.value)}
              rows={4}
              className="input-field resize-none"
              placeholder="Tell us about this business..."
              data-testid="input-blurb"
            />
          </Section>

          {/* Brand Colours */}
          <Section title="Brand Colours">
            <p className="text-xs text-muted-foreground mb-2">Up to 3 colours. Use your phone camera to match brand colours from print.</p>
            <div className="space-y-2">
              {form.brandColors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c || "#000000"}
                    onChange={e => {
                      const cols = [...form.brandColors];
                      cols[i] = e.target.value;
                      setField("brandColors", cols);
                    }}
                    className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent p-0"
                    data-testid={`input-color-${i}`}
                  />
                  <input
                    type="text"
                    value={c}
                    onChange={e => {
                      const cols = [...form.brandColors];
                      cols[i] = e.target.value;
                      setField("brandColors", cols);
                    }}
                    placeholder="#000000"
                    className="input-field flex-1 font-mono text-sm"
                  />
                  {i > 0 && (
                    <button type="button" onClick={() => setField("brandColors", form.brandColors.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {form.brandColors.length < 3 && (
                <button type="button" onClick={() => setField("brandColors", [...form.brandColors, ""])} className="text-xs text-primary flex items-center gap-1 hover:underline" data-testid="button-add-color">
                  <Plus className="w-3 h-3" /> Add colour
                </button>
              )}
            </div>
          </Section>

          {/* Socials */}
          <Section title="Social Links">
            {(["instagram", "facebook", "tiktok"] as const).map(platform => (
              <Field key={platform} label={platform.charAt(0).toUpperCase() + platform.slice(1)}>
                <input
                  type="url"
                  value={form.socialLinks[platform] || ""}
                  onChange={e => setField("socialLinks", { ...form.socialLinks, [platform]: e.target.value })}
                  placeholder={`https://${platform}.com/yourbusiness`}
                  className="input-field"
                  data-testid={`input-${platform}`}
                />
              </Field>
            ))}
          </Section>

          {/* Password */}
          <Section title="Tenant Admin Password">
            <p className="text-xs text-muted-foreground mb-2">The business owner uses this to access their CMS dashboard.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Password *" required>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setField("password", e.target.value)}
                  required
                  className="input-field"
                  data-testid="input-password"
                />
              </Field>
              <Field label="Confirm Password *" required>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => setField("confirmPassword", e.target.value)}
                  required
                  className="input-field"
                  data-testid="input-confirm-password"
                />
              </Field>
            </div>
          </Section>

          <button
            type="submit"
            disabled={createSite.isPending}
            className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl text-base hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-build-site"
          >
            {createSite.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Building...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Build Site
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
