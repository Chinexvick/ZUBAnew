import type { Metadata } from "next";
import { adminConfigured, emailLoginEnabled, isAdmin, passwordLoginEnabled } from "@/lib/auth";
import { storageMode } from "@/lib/store";
import AdminLogin from "./AdminLogin";
import Dashboard from "./Dashboard";

export const metadata: Metadata = { title: "Workbench", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  if (!adminConfigured()) {
    return (
      <div className="admin-shell center">
        <div className="admin-card stack">
          <h1 className="t-title md">Workbench Locked</h1>
          <p className="t-muted">
            Set <code>ADMIN_EMAIL</code>, <code>ADMIN_SECRET</code> and the <code>SMTP_*</code> settings (or <code>ADMIN_PASSWORD</code>) in
            Vercel → Project → Settings → Environment Variables, then redeploy.
          </p>
        </div>
      </div>
    );
  }
  if (!(await isAdmin())) {
    const { link } = await searchParams;
    return <AdminLogin email={emailLoginEnabled()} password={passwordLoginEnabled()} expired={link === "expired"} />;
  }
  return <Dashboard mode={storageMode()} />;
}
