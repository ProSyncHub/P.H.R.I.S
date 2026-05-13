"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EmployeeOption = { id: string; fullName: string; employeeId: string; department: string };

export function AnalyseForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState({ detailed: "", login: "" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setStatus("Uploading reports and analysing with P.H.R.I.S intelligence engine. This can take 30-60 seconds.");
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/analyse", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? "Analysis failed.");
        setStatus("");
        return;
      }
      setStatus("Analysis complete. Opening report...");
      router.push(`/dashboard/reports/${json.analysisId}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Analysis failed.");
      setStatus("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Analysis Input</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              Employee
              <select name="employeeId" required className="h-10 rounded-md border bg-background/60 px-3 text-sm">
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.fullName} - {employee.department}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              Date
              <Input name="reportDate" type="date" required />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              Detailed Activity Report
              <Input name="detailedActivityReport" type="file" accept=".csv,.xls,.xlsx" required onChange={(event) => setFiles((f) => ({ ...f, detailed: event.target.files?.[0]?.name ?? "" }))} />
              <span className="text-xs text-muted-foreground">{files.detailed || "CSV/XLSX up to 8 MB"}</span>
            </label>
            <label className="grid gap-2 text-sm">
              Login/Logout Report
              <Input name="loginLogoutReport" type="file" accept=".csv,.xls,.xlsx" required onChange={(event) => setFiles((f) => ({ ...f, login: event.target.files?.[0]?.name ?? "" }))} />
              <span className="text-xs text-muted-foreground">{files.login || "CSV/XLSX up to 8 MB"}</span>
            </label>
          </div>

          <label className="grid gap-2 text-sm">
            Manual End Day Report
            <Textarea name="eodText" placeholder="Paste the employee EOD report here..." required />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              {isSubmitting ? "Analysing" : "Analyse"}
            </Button>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <UploadCloud className="h-4 w-4" />
              {status || "Uploads are parsed server-side. Secrets never reach the browser."}
            </span>
          </div>
          {error ? <div className="rounded-md border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">{error}</div> : null}
        </form>
      </CardContent>
    </Card>
  );
}
