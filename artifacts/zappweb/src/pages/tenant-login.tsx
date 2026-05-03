import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useTenantLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetTenantSessionQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Lock, Zap } from "lucide-react";

export default function TenantLoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const login = useTenantLogin();
  const qc = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ data: { slug, password } });
      await qc.invalidateQueries({ queryKey: getGetTenantSessionQueryKey() });
      toast.success("Logged in");
      setLocation(`/s/${slug}/admin`);
    } catch {
      toast.error("Invalid password");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Admin Access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono text-primary">{slug}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="input-tenant-password"
            />
          </div>
          <button
            type="submit"
            disabled={login.isPending}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-tenant-login"
          >
            {login.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href={`/s/${slug}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Back to site
          </a>
        </div>

        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground/50">
            <Zap className="w-3 h-3" />
            Powered by ZappWeb
          </div>
        </div>
      </div>
    </div>
  );
}
