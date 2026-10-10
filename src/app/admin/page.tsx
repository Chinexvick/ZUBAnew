import type { Metadata } from "next";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { storageMode } from "@/lib/store";
import AdminLogin from "./AdminLogin";
import Dashboard from "./Dashboard";

export const metadata: Metadata = { title: "Workbench", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <div className="admin-shell center">
        <div className="admin-card stack">
          <h1 className="t-title md">Workbench Locked</h1>
          <p className="t-muted">
            Set <code>ADMIN_PASSWORD</code> in the environment (Vercel → Project → Settings → Environment Variables) and redeploy to
            open the admin dashboard.
          </p>
        </div>
      </div>
    );
  }
  if (!(await isAdmin())) return <AdminLogin />;
  return <Dashboard mode={storageMode()} />;
}
