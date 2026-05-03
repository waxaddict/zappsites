import { useGetAdminStats, useListTenants, useSetTenantTier } from "@workspace/api-client-react";
import { getGetAdminStatsQueryKey, getListTenantsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { useLocation } from "wouter";
import { Zap, Globe, TrendingUp, AlertTriangle, Users, ExternalLink } from "lucide-react";

type TenantRecord = {
  id: number; slug: string; businessName: string; themeId: string;
  tier: "demo" | "live" | "pro"; address?: string; email?: string;
  logoUrl?: string; demoExpiresAt?: string; createdAt: string;
};

const TIER_STYLES: Record<string, string> = {
  demo: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  live: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  pro: "bg-purple-500/15 text-purple-400 border-purple-500/25",
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: statsData, isLoading: statsLoading } = useGetAdminStats();
  const { data: tenantsData, isLoading: tenantsLoading } = useListTenants();
  const setTier = useSetTenantTier();

  const stats = statsData as {
    totalSites: number; demoSites: number; liveSites: number; proSites: number;
    expiringThisWeek: number;
  } | undefined;

  const tenants = ((tenantsData as { tenants: TenantRecord[] } | undefined)?.tenants || [])
    .filter(t => !search || t.businessName.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase()));

  async function handleTierChange(slug: string, tier: "demo" | "live" | "pro") {
    try {
      await setTier.mutateAsync({ slug, data: { tier } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListTenantsQueryKey() }),
      ]);
      toast.success(`Tier updated to ${tier}`);
    } catch {
      toast.error("Failed to update tier");
    }
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b border-border/50 sticky top-0 z-10 backdrop-blur-sm bg-background/80">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight">ZappWeb</span>
            <span className="text-xs text-muted-foreground ml-1">Master Admin</span>
          </div>
          <button onClick={() => setLocation("/")} className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-builder">
            Builder
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">All tenants and site activity</p>
        </div>

        {/* Stats */}
        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Sites" value={stats?.totalSites ?? 0} />
            <StatCard icon={Globe} label="Demo" value={stats?.demoSites ?? 0} color="text-yellow-400" />
            <StatCard icon={TrendingUp} label="Live + Pro" value={(stats?.liveSites ?? 0) + (stats?.proSites ?? 0)} color="text-emerald-400" />
            <StatCard icon={AlertTriangle} label="Expiring" value={stats?.expiringThisWeek ?? 0} color="text-orange-400" />
          </div>
        )}

        {/* Tenants */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">All Tenants</h2>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-40"
              data-testid="input-search"
            />
          </div>

          {tenantsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)}
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{search ? "No matching tenants" : "No sites yet"}</p>
              {!search && <p className="text-xs mt-1">Build your first site from the builder</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {tenants.map(tenant => (
                <TenantRow key={tenant.id} tenant={tenant} onTierChange={handleTierChange} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color = "text-foreground" }: {
  icon: React.ElementType; label: string; value: number; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TenantRow({ tenant, onTierChange }: {
  tenant: TenantRecord;
  onTierChange: (slug: string, tier: "demo" | "live" | "pro") => void;
}) {
  const daysLeft = tenant.demoExpiresAt
    ? Math.ceil((new Date(tenant.demoExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4" data-testid={`tenant-row-${tenant.slug}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-medium text-sm truncate">{tenant.businessName}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${TIER_STYLES[tenant.tier]}`}>
            {tenant.tier.toUpperCase()}
          </span>
          {tenant.tier === "demo" && daysLeft !== null && daysLeft <= 7 && (
            <span className="text-[10px] text-orange-400">exp. {daysLeft}d</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono">{tenant.slug}</span>
          {tenant.email && <span className="hidden sm:block truncate max-w-[200px]">{tenant.email}</span>}
          <span>{new Date(tenant.createdAt).toLocaleDateString("en-GB")}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={tenant.tier}
          onChange={e => onTierChange(tenant.slug, e.target.value as "demo" | "live" | "pro")}
          className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid={`select-tier-${tenant.slug}`}
        >
          <option value="demo">Demo</option>
          <option value="live">Live</option>
          <option value="pro">Pro</option>
        </select>
        <a
          href={`/s/${tenant.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          data-testid={`link-visit-${tenant.slug}`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
