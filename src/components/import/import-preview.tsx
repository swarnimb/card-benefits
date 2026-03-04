"use client";

import { Calendar, FileText, AlertTriangle } from "lucide-react";
import type { ImportPreview } from "@/types/transaction";

interface ImportPreviewProps {
  preview: ImportPreview;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ImportPreviewCard({ preview }: ImportPreviewProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Preview
      </h3>

      {/* Detected bank */}
      {preview.detectedBank && (
        <p className="text-xs text-muted-foreground">
          Detected format:{" "}
          <span className="font-medium text-foreground">
            {preview.detectedBank}
          </span>
        </p>
      )}

      {/* Stats */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-semibold">{preview.totalCount}</span>{" "}
            <span className="text-muted-foreground">transactions</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {formatDate(preview.dateRange.start)} &ndash;{" "}
            {formatDate(preview.dateRange.end)}
          </span>
        </div>
      </div>

      {/* Duplicate warning */}
      {preview.duplicateCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {preview.duplicateCount} duplicate
            {preview.duplicateCount === 1 ? "" : "s"} detected and excluded.
          </p>
        </div>
      )}
    </div>
  );
}
