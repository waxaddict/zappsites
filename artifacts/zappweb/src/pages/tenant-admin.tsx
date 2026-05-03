import { useParams, useLocation } from "wouter";
import { useGetSite, useGetTenantSession, useTenantLogout, useUpdateSite, useGenerateSiteContent, useCreateCheckoutSession } from "@workspace/api-client-react";
import { getGetSiteQueryKey, getGetTenantSessionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  Zap, LogOut, ExternalLink, Sparkles, CreditCard, Globe, Image, Palette,
  Clock, Phone, Mail, Instagram, Facebook, Edit3, Save, X, Shield
} from "lucide-react";

const TIER_INFO: Record<string, { label: string; color: string; next?: string }> = {
  demo: { label: "Demo", color: "text-yellow-400", next: "live" },
  live: { label: "Live", color: "text-emerald-400", next: "pro" },
  pro: { label: "Pro", color: "text-purple-400" },
};

type Site = {
  slug: string; businessName: string; themeId: string; tier: string;
  address?: string; phone?: string; email?: string; blurb?: string;
  aiBlurb?: string; openingHours?: string[]; photos?: string[];
  brandColors?: string[]; socialLinks?: { instagram?: string; facebook?: string; tiktok?: string };
  logoUrl?: string; headCode?: string; demoExpiresAt?: string; createdAt: string;
};

export default function TenantAdminPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data: session } = useGetTenantSession();
  const sess = session as { authenticated: boolean; slug?: string } | undefined;

  useEffect(() => {
    if (sess && !sess.authenticated) {
      setLocation(`/s/${slug}/login`);
    }
  }, [sess, slug, setLocation]);

  const { data, isLoading } = useGetSite(slug, {
    query: { queryKey: getGetSiteQueryKey(slug) },
  });
  const site = data as Site | undefined;

  const logout = useTenantLogout();
  const updateSite = useUpdateSite();
  const generate = useGenerateSiteContent();
  const checkout = useCreateCheckoutSession();

  const [activeTab, setActiveTab] = useState<"overview" | "content" | "photos" | "billing">("overview");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Site>>({});

  useEffect(() => {
    if (site) setEditForm(site);
  }, [site]);

  async function handleLogout() {
    await logout.mutateAsync();
    await qc.invalidateQueries({ queryKey: getGetTenantSessionQueryKey() });
    setLocation(`/s/${slug}/login`);
  }

  async function handleSave() {
    try {
      await updateSite.mutateAsync({
        slug,
        data: {
          businessName: editForm.businessName,
          address: editForm.address,
          phone: editForm.phone,
          email: editForm.email,
          blurb: editForm.blurb,
          openingHours: editForm.openingHours,
          brandColors: editForm.brandColors,
          socialLinks: editForm.socialLinks,
          headCode: editForm.headCode,
        },
      });
      await qc.invalidateQueries({ queryKey: getGetSiteQueryKey(slug) });
      setEditing(false);
      toast.success("Changes saved");
    } catch {
      toast.error("Failed to save");
    }
  }

  async function handleGenerate() {
    try {
      await generate.mutateAsync({ slug });
      await qc.invalidateQueries({ queryKey: getGetSiteQueryKey(slug) });
      toast.success("AI content generated");
    } catch {
      toast.error("Failed — check OpenAI API key");
    }
  }

  async function handleUpgrade(plan: "live" | "pro") {
    try {
      const result = await checkout.mutateAsync({
        slug,
        data: {
          plan,
          successUrl: `${window.location.origin}/s/${slug}/admin?upgraded=true`,
          cancelUrl: `${window.location.origin}/s/${slug}/admin`,
        },
      });
      const r = result as { checkoutUrl: string };
      window.location.href = r.checkoutUrl;
    } catch {
      toast.error("Failed to start checkout — check Stripe configuration");
    }
  }

  if (isLoading || !site) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tierInfo = TIER_INFO[site.tier] || TIER_INFO.demo;
  const demoExpiry = site.demoExpiresAt ? new Date(site.demoExpiresAt) : null;
  const daysLeft = demoExpiry ? Math.ceil((demoExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border/50 sticky top-0 z-20 backdrop-blur-sm bg-background/90">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm truncate">{site.businessName}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-card border border-border ${tierInfo.color}`}>
              {tierInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={`/s/${slug}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-muted-foreground" data-testid="link-view-site">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-muted-foreground" data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Demo warning */}
        {site.tier === "demo" && daysLeft !== null && daysLeft <= 7 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-400">{daysLeft} days left on demo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade to keep your site live.</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
          {(["overview", "content", "photos", "billing"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <InfoCard title="Site Status">
              <Row label="Status" value={<span className="text-emerald-400 text-xs font-medium">Active</span>} />
              <Row label="Plan" value={<span className={`${tierInfo.color} font-medium text-xs`}>{tierInfo.label}</span>} />
              {daysLeft !== null && <Row label="Expires" value={`${daysLeft} days`} />}
              <Row label="Theme" value={<span className="capitalize">{site.themeId}</span>} />
              <Row label="Created" value={new Date(site.createdAt).toLocaleDateString("en-GB")} />
            </InfoCard>

            <InfoCard title="Contact Info">
              {site.phone && <Row label={<Phone className="w-3.5 h-3.5" />} value={site.phone} />}
              {site.email && <Row label={<Mail className="w-3.5 h-3.5" />} value={site.email} />}
              {site.address && <Row label="Address" value={site.address} />}
            </InfoCard>

            <div className="grid grid-cols-2 gap-3">
              <a href={`/s/${slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-xl text-sm font-medium hover:bg-accent transition-colors">
                <Globe className="w-4 h-4" />
                View Site
              </a>
              <button onClick={() => setActiveTab("content")} className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                <Edit3 className="w-4 h-4" />
                Edit Content
              </button>
            </div>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === "content" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Edit Content</h2>
              {editing ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground flex items-center gap-1">
                    <X className="w-3 h-3" /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={updateSite.isPending} className="text-xs text-primary flex items-center gap-1 font-medium" data-testid="button-save">
                    <Save className="w-3 h-3" />
                    {updateSite.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="text-xs text-primary flex items-center gap-1" data-testid="button-edit">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <EditCard title="Business Info">
                  <EditField label="Business Name">
                    <input type="text" value={editForm.businessName || ""} onChange={e => setEditForm(f => ({ ...f, businessName: e.target.value }))} className="input-field" />
                  </EditField>
                  <EditField label="Phone">
                    <input type="tel" value={editForm.phone || ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="input-field" />
                  </EditField>
                  <EditField label="Email">
                    <input type="email" value={editForm.email || ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="input-field" />
                  </EditField>
                  <EditField label="Address">
                    <input type="text" value={editForm.address || ""} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="input-field" />
                  </EditField>
                </EditCard>

                <EditCard title="Description">
                  <textarea
                    value={editForm.blurb || ""}
                    onChange={e => setEditForm(f => ({ ...f, blurb: e.target.value }))}
                    rows={4}
                    className="input-field resize-none"
                    placeholder="Business description..."
                  />
                </EditCard>

                <EditCard title="Opening Hours">
                  {(editForm.openingHours || []).map((h, i) => (
                    <input
                      key={i}
                      type="text"
                      value={h}
                      onChange={e => {
                        const hrs = [...(editForm.openingHours || [])];
                        hrs[i] = e.target.value;
                        setEditForm(f => ({ ...f, openingHours: hrs }));
                      }}
                      className="input-field"
                    />
                  ))}
                </EditCard>

                <EditCard title="Socials">
                  {(["instagram", "facebook", "tiktok"] as const).map(p => (
                    <EditField key={p} label={p.charAt(0).toUpperCase() + p.slice(1)}>
                      <input
                        type="url"
                        value={(editForm.socialLinks as Record<string, string>)?.[p] || ""}
                        onChange={e => setEditForm(f => ({ ...f, socialLinks: { ...(f.socialLinks || {}), [p]: e.target.value } }))}
                        className="input-field"
                        placeholder={`https://${p}.com/yourbusiness`}
                      />
                    </EditField>
                  ))}
                </EditCard>

                <EditCard title="Head Code">
                  <p className="text-xs text-muted-foreground mb-2">Paste scripts, analytics, or custom code for the &lt;head&gt; of your site.</p>
                  <textarea
                    value={editForm.headCode || ""}
                    onChange={e => setEditForm(f => ({ ...f, headCode: e.target.value }))}
                    rows={4}
                    className="input-field resize-none font-mono text-xs"
                    placeholder="<!-- Google Analytics, custom scripts, etc. -->"
                  />
                </EditCard>
              </div>
            ) : (
              <div className="space-y-4">
                {/* AI Generate */}
                <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">AI Content Generation</p>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                      {site.aiBlurb ? "AI content applied. Regenerate anytime." : "Generate polished content from your description."}
                    </p>
                    <button
                      onClick={handleGenerate}
                      disabled={generate.isPending || !site.blurb}
                      className="text-xs px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      data-testid="button-ai-generate"
                    >
                      {generate.isPending ? <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {site.aiBlurb ? "Regenerate" : "Generate"}
                    </button>
                  </div>
                </div>

                <InfoCard title="Current Content">
                  <Row label="Business Name" value={site.businessName} />
                  <Row label="Phone" value={site.phone || "—"} />
                  <Row label="Email" value={site.email || "—"} />
                  <Row label="Address" value={site.address || "—"} />
                  {site.blurb && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm leading-relaxed">{site.aiBlurb || site.blurb}</p>
                    </div>
                  )}
                </InfoCard>
              </div>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === "photos" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <Image className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Site Photos</p>
                  <p className="text-xs text-muted-foreground">{(site.photos || []).length} photos uploaded</p>
                </div>
              </div>
              {(site.photos || []).length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {(site.photos || []).map((url, i) => (
                    <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No photos yet</p>
                  <p className="text-xs mt-1">Photos from Google Places are shown on your site</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && (
          <div className="space-y-4">
            <InfoCard title="Current Plan">
              <div className="flex items-center justify-between py-1">
                <span className={`text-lg font-bold ${tierInfo.color}`}>{tierInfo.label}</span>
                {daysLeft !== null && (
                  <span className="text-xs text-muted-foreground">{daysLeft} days remaining</span>
                )}
              </div>
              {site.tier === "demo" && (
                <p className="text-xs text-muted-foreground">Free demo plan. Upgrade to publish your site publicly.</p>
              )}
            </InfoCard>

            {tierInfo.next && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upgrade Plan</p>

                {site.tier === "demo" && (
                  <PlanCard
                    name="Live"
                    price="£19/mo"
                    features={["Custom domain", "Live site", "Priority support"]}
                    onClick={() => handleUpgrade("live")}
                    loading={checkout.isPending}
                  />
                )}
                <PlanCard
                  name="Pro"
                  price="£39/mo"
                  features={["Everything in Live", "Analytics", "Multiple themes", "SEO tools"]}
                  onClick={() => handleUpgrade("pro")}
                  loading={checkout.isPending}
                  highlighted
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground flex items-center gap-1">{label}</span>
      <span className="text-foreground font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function EditCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function PlanCard({ name, price, features, onClick, loading, highlighted }: {
  name: string; price: string; features: string[]; onClick: () => void; loading: boolean; highlighted?: boolean;
}) {
  return (
    <div className={`rounded-xl p-5 border ${highlighted ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-foreground">{name}</p>
          <p className="text-2xl font-bold text-primary mt-1">{price}</p>
        </div>
        <button
          onClick={onClick}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          data-testid={`button-upgrade-${name.toLowerCase()}`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Upgrade
        </button>
      </div>
      <ul className="space-y-1">
        {features.map(f => (
          <li key={f} className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-primary" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
