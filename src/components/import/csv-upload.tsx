"use client";

import { useState, useRef, useCallback } from "react";
import { FileUp, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface CsvUploadProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export function CsvUpload({ file, onFileSelect, disabled }: CsvUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (f: File) => {
      if (!f.name.endsWith(".csv")) {
        setFileError("Only CSV files are supported");
        return;
      }
      setFileError(null);
      onFileSelect(f);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;

      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [disabled, handleFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) handleFile(selected);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [handleFile]
  );

  // File is selected — show file info
  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onFileSelect(null)}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  // No file — show dropzone
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      disabled={disabled}
      className={cn(
        "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10",
        "transition-all duration-200",
        "disabled:pointer-events-none disabled:opacity-50",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
          dragging ? "bg-primary/10" : "bg-muted"
        )}
      >
        <FileUp
          className={cn(
            "h-5 w-5 transition-colors",
            dragging ? "text-primary" : "text-muted-foreground"
          )}
          strokeWidth={1.5}
        />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium">
          {dragging ? "Drop your CSV here" : "Upload bank statement"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drag & drop or tap to browse &middot; CSV only
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleInputChange}
        className="hidden"
      />

      {fileError && (
        <p className="mt-2 text-center text-xs font-medium text-destructive">
          {fileError}
        </p>
      )}
    </button>
  );
}
