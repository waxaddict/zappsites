import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useSearchPlaces, useGetPlaceDetails, useCreateSite, getSearchPlacesQueryKey, getGetPlaceDetailsQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Zap, Search, MapPin, X, Plus, Trash2, ArrowLeft, Camera } from "lucide-react";

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
}

// ── Camera colour picker ──────────────────────────────────────────────────────
function CameraColourPicker({ onColour }: { onColour: (hex: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgLoaded(false);
    setImgSrc(URL.createObjectURL(file));
    // reset so the same file can be re-picked
    e.target.value = "";
  }

  useEffect(() => {
    if (!imgSrc || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      setImgLoaded(true);
    };
    img.src = imgSrc;
  }, [imgSrc]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !imgLoaded) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    const [r, g, b] = canvas.getContext("2d")!.getImageData(x, y, 1, 1).data;
    const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
    onColour(hex);
    setImgSrc(null);
    setImgLoaded(false);
    toast.success(`Colour sampled: ${hex}`);
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        aria-label="Take or choose a photo to sample a colour"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        title="Use camera or photo to pick a colour"
        className="w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        data-testid="button-camera-colour"
      >
        <Camera className="w-4 h-4" />
      </button>

      {/* Full-screen colour sampler overlay */}
      {imgSrc && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <p className="text-white text-sm font-medium">Tap any colour to sample it</p>
            <button
              type="button"
              onClick={() => { setImgSrc(null); setImgLoaded(false); }}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-2">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className={`max-w-full max-h-full object-contain ${imgLoaded ? "cursor-crosshair" : "opacity-50"}`}
              style={{ touchAction: "none" }}
            />
          </div>
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Main build form ───────────────────────────────────────────────────────────
export default function BuildPage() {
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
  });

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
        email?: string; openingHours?: string[]; socialLinks?: SocialLinks;
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
    if (!form.businessName) {
      toast.error("Business name is required");
      return;
    }

    try {
      const site = await createSite.mutateAsync({
        data: {
          placeId: selectedPlaceId || undefined,
          businessName: form.businessName,
          themeId: "luminary",
          address: form.address,
          postcode: form.postcode,
          phone: form.phone,
          email: form.email,
          blurb: form.blurb,
          openingHours: form.openingHours.filter(Boolean),
          brandColors: form.brandColors.filter(Boolean),
          socialLinks: form.socialLinks,
        },
      });
      const s = site as { slug: string };
      toast.success("Site created — now pick a theme!");
      setLocation(`/s/${s.slug}/themes`);
    } catch {
      toast.error("Failed to create site. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border/50 sticky top-0 z-10 backdrop-blur-sm bg-background/80">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">Business details</span>
          </div>
          <span className="text-xs text-muted-foreground">Step 1 of 2</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Tell us about the business</h1>
          <p className="text-muted-foreground text-sm mt-1">Search Google Places to auto-fill, or type it all in manually.</p>
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
                {loadingDetails && " (loading...)"}
              </p>
            )}
          </div>

          {/* Business Info */}
          <Section title="Business Info">
            <Field label="Business Name *">
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
                  placeholder="Monday: 9am – 5pm"
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

          {/* Business Description */}
          <Section title="Business Description">
            <p className="text-xs text-muted-foreground mb-2">Paste any text — AI will rewrite and place it perfectly on the next step.</p>
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
            <p className="text-xs text-muted-foreground mb-3">
              Add up to 3 brand colours. Use the <Camera className="w-3 h-3 inline" /> button to take a photo and tap any colour in it.
            </p>
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
                    className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent p-0.5"
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
                  <CameraColourPicker
                    onColour={hex => {
                      const cols = [...form.brandColors];
                      cols[i] = hex;
                      setField("brandColors", cols);
                    }}
                  />
                  {i > 0 && (
                    <button type="button" onClick={() => setField("brandColors", form.brandColors.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {form.brandColors.length < 3 && (
                <button
                  type="button"
                  onClick={() => setField("brandColors", [...form.brandColors, ""])}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                  data-testid="button-add-color"
                >
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

          <button
            type="submit"
            disabled={createSite.isPending}
            className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl text-base hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-build-site"
          >
            {createSite.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Next — choose theme
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
