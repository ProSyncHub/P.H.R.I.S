"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteReportAction } from "@/app/(dashboard)/dashboard/reports/actions";

export function DeleteReportButton({ reportId, redirectTo }: { reportId: string; redirectTo?: string }) {
  return (
    <form
      action={deleteReportAction}
      onSubmit={(event) => {
        if (!window.confirm("Delete this report permanently?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="reportId" value={reportId} />
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <Button size="sm" variant="destructive" type="submit">
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </form>
  );
}
