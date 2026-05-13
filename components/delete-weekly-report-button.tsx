"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWeeklyReportAction } from "@/app/(dashboard)/dashboard/weekly/actions";

export function DeleteWeeklyReportButton({ weeklyReportId, redirectTo }: { weeklyReportId: string; redirectTo?: string }) {
  return (
    <form
      action={deleteWeeklyReportAction}
      onSubmit={(event) => {
        if (!window.confirm("Delete this weekly report permanently?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="weeklyReportId" value={weeklyReportId} />
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <Button size="sm" variant="destructive" type="submit">
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </form>
  );
}
