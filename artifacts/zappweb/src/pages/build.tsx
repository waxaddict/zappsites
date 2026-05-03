import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useSearchPlaces, useGetPlaceDetails, useCreateSite,
  getSearchPlacesQueryKey, getGetPlaceDetailsQueryKey,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { Zap, Search, MapPin, X, Plus, Trash2, ArrowLeft, Upload, Link, Camera, Sparkles, Wand2, Globe } from "lucide-react";

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
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
    const [r, g, b] = canvas.getContext("2d")!.getImageData(x, y, 1, 1).data;
    const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
    onColour(hex);
    setImgSrc(null);
    setImgLoaded(false);
    toast.success(`Colour sampled: ${hex}`);
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        onChange={handleFile} className="hidden" aria-label="Take photo to sample colour" />
      <button type="button" onClick={() => fileRef.current?.click()}
        title="Use camera or photo to pick a colour"
        className="w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        data-testid="button-camera-colour">
        <Camera className="w-4 h-4" />
      </button>
      {imgSrc && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <p className="text-white text-sm font-medium">Tap any colour to sample it</p>
            <button type="button" onClick={() => { setImgSrc(null); setImgLoaded(false); }}
              className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-2">
            <canvas ref={canvasRef} onClick={handleCanvasClick}
              className={`max-w-full max-h-full object-contain ${imgLoaded ? "cursor-crosshair" : "opacity-50"}`}
              style={{ touchAction: "none" }} />
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

// ── Logo uploader ─────────────────────────────────────────────────────────────
function LogoUploader({
  logoUrl, onLogoUrl,
}: { logoUrl: string; onLogoUrl: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setFileName(file.name);
    setUploading(true);
    try {
      const photo = await fileToBase64(file);
      const res = await fetch("/api/media/upload-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Upload failed");
      }
      const { logoUrl: url } = await res.json() as { logoUrl: string };
      onLogoUrl(url);
      toast.success("Logo uploaded successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setFileName("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* URL paste */}
      <div className="relative">
        <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="url"
          value={logoUrl}
          onChange={e => onLogoUrl(e.target.value)}
          placeholder="Paste a logo URL, or browse below"
          className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid="input-logo-url"
        />
      </div>

      {/* Browse button */}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={handleFile} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all
          ${uploading
            ? "border-primary/30 text-primary/60 bg-primary/5 cursor-wait"
            : "border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground cursor-pointer"
          }`}
        data-testid="button-browse-logo"
      >
        {uploading ? (
          <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading {fileName}…</>
        ) : (
          <><Upload className="w-4 h-4" /> Browse files — PNG, JPG, SVG</>
        )}
      </button>

      {/* Preview */}
      {logoUrl && !uploading && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-2">
            <div className="bg-white flex items-center justify-center p-4 min-h-[72px]">
              <img src={logoUrl} alt="Logo light" className="max-h-12 max-w-full object-contain"
                onError={e => (e.currentTarget.style.display = "none")} />
            </div>
            <div className="bg-zinc-900 flex items-center justify-center p-4 min-h-[72px]">
              <img src={logoUrl} alt="Logo dark" className="max-h-12 max-w-full object-contain"
                style={{ filter: "invert(1) brightness(2)" }}
                onError={e => (e.currentTarget.style.display = "none")} />
            </div>
          </div>
          <div className="px-3 py-2 bg-card border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Light / Dark preview</p>
            <button type="button" onClick={() => { onLogoUrl(""); setFileName(""); }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors">
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Brand Analyser ─────────────────────────────────────────────────────────
type BrandResult = {
  businessName?: string | null;
  tagline?: string | null;
  blurb?: string | null;
  brandColors?: string[];
  tone?: string | null;
  fontStyle?: string | null;
};
type AnalyserState = "idle" | "reading" | "done" | "error";

function BrandAnalyser({
  onApplyBlurb,
  onApplyColors,
  onApplyName,
}: {
  onApplyBlurb: (blurb: string) => void;
  onApplyColors: (colors: string[]) => void;
  onApplyName: (name: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [state, setState] = useState<AnalyserState>("idle");
  const [result, setResult] = useState<BrandResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 4 - images.length);
    e.target.value = "";
    const newImages = await Promise.all(
      files.map(async (f) => ({ url: await readFileAsDataUrl(f), name: f.name }))
    );
    setImages((prev) => [...prev, ...newImages].slice(0, 4));
  }

  async function analyse() {
    if (images.length === 0) return;
    setState("reading");
    setResult(null);
    setErrorMsg("");
    try {
      const res = await fetch("/api/media/analyse-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: images.map((i) => i.url) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Analysis failed");
      }
      const data = await res.json() as BrandResult;
      setResult(data);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Analysis failed");
      setState("error");
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    if (state === "done" || state === "error") { setState("idle"); setResult(null); }
  }

  function reset() {
    setImages([]);
    setState("idle");
    setResult(null);
    setErrorMsg("");
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-background to-background">
      <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-purple-500/10">
        <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
          <Wand2 className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">AI Brand Reader</p>
          <p className="text-xs text-muted-foreground">Photo a flyer, business card or menu — AI reads the colours, copy and style</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400">AI</span>
      </div>

      <div className="p-4 space-y-4">
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img.url} alt={img.name} className="w-20 h-20 object-cover rounded-xl border border-border" />
                <button type="button" onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {images.length < 4 && state !== "reading" && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-purple-400/50 flex items-center justify-center text-muted-foreground hover:text-purple-400 transition-colors">
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />

        {state !== "done" && (
          <div className="flex gap-2">
            {images.length === 0 && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-purple-400/50 hover:bg-purple-500/5 text-sm text-muted-foreground hover:text-purple-400 font-medium transition-all"
                data-testid="button-attach-materials">
                <Upload className="w-4 h-4" />
                Attach materials (flyers, business cards, menus)
              </button>
            )}
            {images.length > 0 && state !== "reading" && (
              <button type="button" onClick={analyse}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
                data-testid="button-analyse-brand">
                <Sparkles className="w-4 h-4" />
                Read brand
              </button>
            )}
            {state === "reading" && (
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm text-purple-400">
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                AI is reading your brand materials…
              </div>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-destructive">{errorMsg}</p>
            <button type="button" onClick={() => setState("idle")} className="text-xs font-semibold text-destructive hover:underline shrink-0">Retry</button>
          </div>
        )}

        {state === "done" && result && (
          <div className="space-y-3">
            <div className="h-px bg-purple-500/10" />

            {result.brandColors && result.brandColors.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {result.brandColors.map((c, i) => (
                    <div key={i} className="w-8 h-8 rounded-lg shadow-sm border border-white/10 ring-1 ring-black/10" style={{ background: c }} title={c} />
                  ))}
                </div>
                <p className="text-xs font-mono text-muted-foreground flex-1">{result.brandColors.join("  ")}</p>
                <button type="button"
                  onClick={() => { onApplyColors(result.brandColors!.filter(Boolean)); toast.success("Brand colours applied"); }}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                  data-testid="button-apply-colors">
                  Apply colours
                </button>
              </div>
            )}

            {result.businessName && (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-purple-500/5 border border-purple-500/10">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Business name</p>
                  <p className="text-sm font-semibold">{result.businessName}</p>
                </div>
                <button type="button"
                  onClick={() => { onApplyName(result.businessName!); toast.success("Business name applied"); }}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-colors shrink-0">
                  Apply
                </button>
              </div>
            )}

            {result.tagline && (
              <div className="px-3 py-2 rounded-xl bg-purple-500/5 border border-purple-500/10">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Tagline found</p>
                <p className="text-sm italic">"{result.tagline}"</p>
              </div>
            )}

            {result.blurb && (
              <div className="space-y-2">
                <div className="px-3 py-2 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">AI-written description</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{result.blurb}</p>
                </div>
                <button type="button"
                  onClick={() => { onApplyBlurb(result.blurb!); toast.success("Description applied to form"); }}
                  className="w-full text-xs font-semibold text-purple-400 hover:text-purple-300 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                  data-testid="button-apply-blurb">
                  Apply description
                </button>
              </div>
            )}

            {(result.tone || result.fontStyle) && (
              <div className="flex gap-2 flex-wrap">
                {result.tone && <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-purple-500/10 text-purple-400">{result.tone}</span>}
                {result.fontStyle && <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-zinc-500/10 text-muted-foreground">{result.fontStyle}</span>}
              </div>
            )}

            <button type="button" onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear and start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── URL / Social scraper ──────────────────────────────────────────────────────
type ScrapeResult = { businessName?: string; blurb?: string; services?: string[] };

function ScrapeUrlPanel({ onApplyBlurb }: { onApplyBlurb: (blurb: string) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState("");

  async function scrape() {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/media/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to scrape");
      }
      setResult(await res.json() as ScrapeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach that URL");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://theirbusiness.co.uk or Instagram URL"
            className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), scrape())}
            data-testid="input-scrape-url" />
        </div>
        <button type="button" onClick={scrape} disabled={loading || !url.trim()}
          className="px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          data-testid="button-scrape-url">
          {loading
            ? <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />}
          Pull
        </button>
      </div>
      {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
      {result?.blurb && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{result.blurb}</p>
          {result.services && result.services.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.services.map((s, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{s}</span>
              ))}
            </div>
          )}
          <button type="button"
            onClick={() => { onApplyBlurb(result.blurb!); toast.success("Description applied"); setResult(null); setUrl(""); }}
            className="text-xs font-semibold text-primary hover:underline"
            data-testid="button-apply-scraped-blurb">
            Apply description →
          </button>
        </div>
      )}
    </div>
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
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.businessName) { toast.error("Business name is required"); return; }

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
          logoUrl: form.logoUrl || undefined,
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
                  <button key={r.placeId} type="button"
                    onClick={() => { setSelectedPlaceId(r.placeId); setPlaceSearch(r.name); setShowResults(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent text-left transition-colors"
                    data-testid={`place-result-${r.placeId}`}>
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

          {/* AI Brand Reader */}
          <BrandAnalyser
            onApplyBlurb={blurb => setField("blurb", blurb)}
            onApplyColors={colors => setField("brandColors", colors.length ? colors : [""])}
            onApplyName={name => setField("businessName", name)}
          />

          {/* Business Info */}
          <Section title="Business Info">
            <Field label="Business Name *">
              <input type="text" value={form.businessName} onChange={e => setField("businessName", e.target.value)}
                className="input-field" required data-testid="input-business-name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input type="tel" value={form.phone} onChange={e => setField("phone", e.target.value)}
                  className="input-field" data-testid="input-phone" />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={e => setField("email", e.target.value)}
                  className="input-field" data-testid="input-email" />
              </Field>
            </div>
            <Field label="Address">
              <input type="text" value={form.address} onChange={e => setField("address", e.target.value)}
                className="input-field" data-testid="input-address" />
            </Field>
            <Field label="Postcode">
              <input type="text" value={form.postcode} onChange={e => setField("postcode", e.target.value)}
                className="input-field" data-testid="input-postcode" />
            </Field>
          </Section>

          {/* Logo */}
          <Section title="Logo">
            <LogoUploader
              logoUrl={form.logoUrl}
              onLogoUrl={url => setField("logoUrl", url)}
            />
          </Section>

          {/* Opening Hours */}
          <Section title="Opening Hours">
            {form.openingHours.map((h, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={h}
                  onChange={e => { const hrs = [...form.openingHours]; hrs[i] = e.target.value; setField("openingHours", hrs); }}
                  className="input-field flex-1" placeholder="Monday: 9am – 5pm"
                  data-testid={`input-hours-${i}`} />
                <button type="button" onClick={() => setField("openingHours", form.openingHours.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setField("openingHours", [...form.openingHours, ""])}
              className="text-xs text-primary flex items-center gap-1 hover:underline" data-testid="button-add-hours">
              <Plus className="w-3 h-3" /> Add line
            </button>
          </Section>

          {/* Business Description */}
          <Section title="Business Description">
            <p className="text-xs text-muted-foreground mb-2">Paste any text — AI will rewrite and place it perfectly on the next step.</p>
            <textarea value={form.blurb} onChange={e => setField("blurb", e.target.value)}
              rows={4} className="input-field resize-none"
              placeholder="Tell us about this business…" data-testid="input-blurb" />
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Globe className="w-3 h-3" />
                Or pull from their website / social profile
              </p>
              <ScrapeUrlPanel onApplyBlurb={blurb => setField("blurb", blurb)} />
            </div>
          </Section>

          {/* Brand Colours */}
          <Section title="Brand Colours">
            <p className="text-xs text-muted-foreground mb-3">
              Add up to 3 brand colours. Use the <Camera className="w-3 h-3 inline" /> button to take a photo and tap any colour in it.
            </p>
            <div className="space-y-2">
              {form.brandColors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="color" value={c || "#000000"}
                    onChange={e => { const cols = [...form.brandColors]; cols[i] = e.target.value; setField("brandColors", cols); }}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent p-0.5"
                    data-testid={`input-color-${i}`} />
                  <input type="text" value={c}
                    onChange={e => { const cols = [...form.brandColors]; cols[i] = e.target.value; setField("brandColors", cols); }}
                    placeholder="#000000" className="input-field flex-1 font-mono text-sm" />
                  <CameraColourPicker
                    onColour={hex => { const cols = [...form.brandColors]; cols[i] = hex; setField("brandColors", cols); }} />
                  {i > 0 && (
                    <button type="button" onClick={() => setField("brandColors", form.brandColors.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              {form.brandColors.length < 3 && (
                <button type="button" onClick={() => setField("brandColors", [...form.brandColors, ""])}
                  className="text-xs text-primary flex items-center gap-1 hover:underline" data-testid="button-add-color">
                  <Plus className="w-3 h-3" /> Add colour
                </button>
              )}
            </div>
          </Section>

          {/* Socials */}
          <Section title="Social Links">
            {(["instagram", "facebook", "tiktok"] as const).map(platform => (
              <Field key={platform} label={platform.charAt(0).toUpperCase() + platform.slice(1)}>
                <input type="url" value={form.socialLinks[platform] || ""}
                  onChange={e => setField("socialLinks", { ...form.socialLinks, [platform]: e.target.value })}
                  placeholder={`https://${platform}.com/yourbusiness`}
                  className="input-field" data-testid={`input-${platform}`} />
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
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating…</>
            ) : (
              <><Zap className="w-4 h-4" />Next — choose theme</>
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
