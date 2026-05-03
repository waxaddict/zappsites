import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useSearchPlaces, useGetPlaceDetails, useCreateSite,
  getSearchPlacesQueryKey, getGetPlaceDetailsQueryKey,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { Zap, Search, MapPin, X, Plus, Trash2, ArrowLeft, Camera, Link, Sparkles, RotateCcw } from "lucide-react";

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

// ── AI Logo Extractor ─────────────────────────────────────────────────────────
type LogoState = "idle" | "uploading" | "processing" | "review" | "error";

function LogoExtractor({
  businessName, logoUrl, onLogoUrl,
}: { businessName: string; logoUrl: string; onLogoUrl: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<LogoState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [extractedUrl, setExtractedUrl] = useState<string>("");
  const pendingFile = useRef<File | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopPolling() {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
  }

  async function pollJob(jobId: string) {
    try {
      const res = await fetch(`/api/media/extract-logo/status/${jobId}`);
      if (!res.ok) throw new Error("Job not found");
      const data = await res.json() as { status: string; logoUrl?: string; error?: string };

      if (data.status === "done" && data.logoUrl) {
        stopPolling();
        setExtractedUrl(data.logoUrl);
        setState("review");
        return;
      }
      if (data.status === "error") {
        stopPolling();
        setErrorMsg(data.error ?? "Extraction failed");
        setState("error");
        return;
      }
      // Still pending — poll again in 2 seconds
      pollTimer.current = setTimeout(() => pollJob(jobId), 2000);
    } catch {
      stopPolling();
      setErrorMsg("Lost connection while waiting — please retry.");
      setState("error");
    }
  }

  // Compress photo to ≤1024px JPEG (~100–150KB) before uploading.
  // Phone cameras produce 4–12MB images which time out on the proxy.
  function compressPhoto(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1024;
        const ratio = Math.min(MAX / img.naturalWidth, MAX / img.naturalHeight, 1);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.naturalWidth  * ratio);
        canvas.height = Math.round(img.naturalHeight * ratio);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error("Compression failed")),
          "image/jpeg", 0.85,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read photo")); };
      img.src = url;
    });
  }

  // Read compressed blob as base64 string
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // result is "data:image/jpeg;base64,<data>" — strip the prefix
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function startExtraction(file: File) {
    stopPolling();
    setState("uploading");
    setErrorMsg("");

    try {
      // Compress to ≤1024px JPEG (~100–150KB) then encode as base64.
      // Sending JSON avoids multipart/form-data streaming which the proxy drops.
      const compressed = await compressPhoto(file);
      const photo = await blobToBase64(compressed);

      const res = await fetch("/api/media/extract-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo, businessName: businessName || "business" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Upload failed");
      }
      const { jobId } = await res.json() as { jobId: string };
      setState("processing");
      pollTimer.current = setTimeout(() => pollJob(jobId), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setState("error");
    }
  }

  // Clean up poll on unmount
  useEffect(() => () => stopPolling(), []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingFile.current = file;
    e.target.value = "";
    await startExtraction(file);
  }

  function handleSave() {
    onLogoUrl(extractedUrl);
    setExtractedUrl("");
    setState("idle");
  }

  function handleRetake() {
    stopPolling();
    setExtractedUrl("");
    setState("idle");
    fileRef.current?.click();
  }

  function handleRetry() {
    if (pendingFile.current) startExtraction(pendingFile.current);
  }

  return (
    <div className="space-y-3">
      {/* URL paste field — hidden while reviewing an extraction */}
      {state !== "review" && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="url"
              value={logoUrl}
              onChange={e => { onLogoUrl(e.target.value); setState("idle"); }}
              placeholder="https://example.com/logo.png  (or use camera below)"
              className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="input-logo-url"
            />
          </div>
        </div>
      )}

      {/* Hidden camera input */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        onChange={handleFile} className="hidden" aria-label="Take photo to extract logo" />

      {/* ── Review screen: show extracted logo, Save / Retake ── */}
      {state === "review" && extractedUrl && (
        <div className="rounded-2xl border-2 border-primary/30 bg-card overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Logo extracted</span>
            <span className="text-xs text-muted-foreground ml-auto">Review before saving</span>
          </div>

          {/* Light + dark preview */}
          <div className="grid grid-cols-2 mx-4 mb-3 rounded-xl overflow-hidden border border-border">
            <div className="bg-white flex items-center justify-center p-6 min-h-[100px]">
              <img src={extractedUrl} alt="Logo on light background"
                className="max-h-16 max-w-full object-contain" />
            </div>
            <div className="bg-zinc-900 flex items-center justify-center p-6 min-h-[100px]">
              <img src={extractedUrl} alt="Logo on dark background"
                className="max-h-16 max-w-full object-contain"
                style={{ filter: "invert(1) brightness(2)" }} />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mb-3">
            Light theme · Dark theme (auto-inverted)
          </p>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={handleRetake}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-background text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retake
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
              data-testid="button-save-logo"
            >
              <Sparkles className="w-3.5 h-3.5" /> Use this logo
            </button>
          </div>
        </div>
      )}

      {/* ── Uploading / Processing spinner ── */}
      {(state === "uploading" || state === "processing") && (
        <div className="rounded-xl border border-border bg-card flex flex-col items-center gap-3 py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {state === "uploading" ? "Uploading photo…" : "AI is copying your logo…"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {state === "uploading" ? "Just a moment" : "Usually 15–20 seconds"}
            </p>
          </div>
        </div>
      )}

      {/* ── Camera trigger button (idle / error states) ── */}
      {(state === "idle" || state === "error") && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground text-sm font-medium transition-all cursor-pointer"
          data-testid="button-extract-logo"
        >
          <Camera className="w-4 h-4" />
          <Sparkles className="w-4 h-4" />
          {state === "error" ? "Retry — photo a flyer, letterhead or shop sign" : "Photo a flyer, letterhead or shop sign — AI strips the logo"}
        </button>
      )}

      {/* ── Error with retry ── */}
      {state === "error" && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-destructive">Extraction failed — network may have dropped when camera closed.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-xs font-semibold text-destructive hover:underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Saved logo preview (idle with a URL already set) ── */}
      {state === "idle" && logoUrl && (
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
            <p className="text-xs text-muted-foreground">Saved · Light / Dark preview</p>
            <button type="button"
              onClick={() => { onLogoUrl(""); setState("idle"); }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors">
              Remove
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        AI copies the logo directly from your photo as a clean flat graphic. Background removed automatically.
      </p>
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
            <LogoExtractor
              businessName={form.businessName}
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
