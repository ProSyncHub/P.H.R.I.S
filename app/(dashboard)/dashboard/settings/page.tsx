import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const env = [
    ["DATABASE_URL", Boolean(process.env.DATABASE_URL)],
    ["NEXTAUTH_SECRET", Boolean(process.env.NEXTAUTH_SECRET)],
    ["OPENAI_API_KEY", Boolean(process.env.OPENAI_API_KEY)],
    ["NOTION_API_KEY", Boolean(process.env.NOTION_API_KEY)],
    ["NOTION_DAILY_REPORTS_DATABASE_ID", Boolean(process.env.NOTION_DAILY_REPORTS_DATABASE_ID)],
    ["NOTION_EMPLOYEE_MASTER_DATABASE_ID", Boolean(process.env.NOTION_EMPLOYEE_MASTER_DATABASE_ID)]
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Deployment readiness and secure integration configuration.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Environment Status</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {env.map(([name, configured]) => (
            <div key={String(name)} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{name}</span>
              <span className={configured ? "text-emerald-300" : "text-amber-300"}>{configured ? "Configured" : "Missing"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
