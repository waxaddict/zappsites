import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import BuildPage from "@/pages/build";
import SitePreviewPage from "@/pages/site-preview";
import TenantSitePage from "@/pages/tenant-site";
import TenantLoginPage from "@/pages/tenant-login";
import TenantAdminPage from "@/pages/tenant-admin";
import AdminDashboard from "@/pages/admin-dashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/build/:themeId" component={BuildPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/s/:slug/preview" component={SitePreviewPage} />
      <Route path="/s/:slug/login" component={TenantLoginPage} />
      <Route path="/s/:slug/admin" component={TenantAdminPage} />
      <Route path="/s/:slug" component={TenantSitePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
