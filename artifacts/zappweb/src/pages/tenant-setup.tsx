import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useSetupTenant } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetTenantSessionQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Lock, Zap, Eye, EyeOff } from "lucide-react";

export default function TenantSetupPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const setup = useSetupTenant();
  const qc = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await setup.mutateAsync({ data: { slug, password } });
      await qc.invalidateQueries({ queryKey: getGetTenantSessionQueryKey() });
      toast.success("Admin access created — welcome!");
      setLocation(`/s/${slug}/admin`);
    } catch {
      toast.error("Setup failed — please try again");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Create admin access</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Set a password to manage <span className="text-foreground font-medium">{slug}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                placeholder="Min 6 characters"
                className="w-full px-3 py-2.5 pr-10 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              placeholder="Repeat password"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="input-confirm"
            />
          </div>
          <button
            type="submit"
            disabled={setup.isPending}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-setup"
          >
            {setup.isPending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : "Create admin access"}
          </button>
        </form>

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
