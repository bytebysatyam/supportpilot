import type { ReactNode } from "react";
import { AppShell } from "../../components/app-shell/app-shell";
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <AppShell audience="customer">{children}</AppShell>;
}
