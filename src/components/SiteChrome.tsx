"use client";

import { usePathname } from "next/navigation";

/* Hides public-site chrome (footer) inside the admin workbench. */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  return usePathname().startsWith("/admin") ? null : <>{children}</>;
}
