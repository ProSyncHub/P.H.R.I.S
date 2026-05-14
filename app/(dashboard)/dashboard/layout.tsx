import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, BrainCircuit, CalendarRange, Database, FileText, LogOut, Settings, Users } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { brand, usageDisclaimer } from "@/lib/branding";
import { logoutAction } from "./actions";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/analyse", label: "Analyse Report", icon: BrainCircuit },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/weekly", label: "Weekly Reports", icon: CalendarRange },
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
          <div className="mb-3 flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-background/70">
              <Image src={brand.logoPath} alt={`${brand.companyName} logo`} fill className="object-contain p-1" sizes="40px" priority />
            </div>
            <div>
              <div className="text-lg font-semibold">{brand.appName}</div>
              <div className="text-xs text-muted-foreground">{brand.companyName}</div>
            </div>
          </div>
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
        <div className="mt-6 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          {usageDisclaimer[0]}
        </div>
      </aside>
      <main className="min-w-0 p-5 lg:p-8">
        {children}
        <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
          <p>{usageDisclaimer[1]}</p>
          <p className="mt-1">{usageDisclaimer[2]}</p>
        </footer>
      </main>
    </div>
  );
}
