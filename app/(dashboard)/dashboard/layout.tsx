import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, BrainCircuit, Database, FileText, LogOut, Settings, Users } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { logoutAction } from "./actions";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/analyse", label: "Analyse Report", icon: BrainCircuit },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/notion-sync", label: "Notion Sync Logs", icon: Database },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-r bg-black/20 p-5">
        <div className="mb-8">
          <div className="text-xl font-semibold">P.H.R.I.S</div>
          <div className="text-xs text-muted-foreground">HR Intelligence System</div>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="mt-8">
          <Button variant="outline" size="sm" className="w-full">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </form>
      </aside>
      <main className="min-w-0 p-5 lg:p-8">{children}</main>
    </div>
  );
}
