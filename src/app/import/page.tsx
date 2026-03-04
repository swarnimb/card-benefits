"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CsvUpload } from "@/components/import/csv-upload";
import { CardSelector } from "@/components/import/card-selector";
import { ImportPreviewCard } from "@/components/import/import-preview";
import { cn } from "@/lib/utils";
import type { UserCardWithCard } from "@/types/card";
import type { ImportPreview, ImportConfirmResponse } from "@/types/transaction";

type ImportStep = "select" | "preview" | "importing" | "success";

export default function ImportPage() {
  const router = useRouter();
  const [userCards, setUserCards] = useState<UserCardWithCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<ImportStep>("select");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportConfirmResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch user cards on mount
  useEffect(() => {
    fetch("/api/cards/user")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load cards: ${res.status}`);
        return res.json();
      })
      .then((data: UserCardWithCard[]) => {
        setUserCards(data);
        // Auto-select first card if only one
        if (data.length === 1) setSelectedCardId(data[0].id);
        setCardsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setCardsLoading(false);
      });
  }, []);

  // Upload CSV for preview
  const handleUpload = useCallback(async () => {
    if (!file || !selectedCardId) return;

    setError(null);
    setStep("preview");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userCardId", selectedCardId);

    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Upload failed: ${res.status}`);

      setPreview(data as ImportPreview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("select");
    }
  }, [file, selectedCardId]);

  // Confirm import
  const handleConfirm = useCallback(async () => {
    if (!preview || !selectedCardId || !file) return;

    setStep("importing");
    setError(null);

    try {
      const res = await fetch("/api/transactions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userCardId: selectedCardId,
          transactions: preview.transactions,
          fileName: file.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Import failed: ${res.status}`);

      setResult(data as ImportConfirmResponse);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  }, [preview, selectedCardId, file]);

  // Reset to start over
  const handleReset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep("select");
  }, []);

  const isProcessing = step === "preview" && !preview;
  const canUpload = file && selectedCardId && step === "select";

  if (cardsLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Success state
  if (step === "success" && result) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">Import Complete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.transactionCount} transaction
            {result.transactionCount === 1 ? "" : "s"} imported
            {result.categorized > 0 &&
              ` · ${result.categorized} categorized`}
          </p>
        </div>
        <div className="mt-2 flex gap-3">
          <Button variant="outline" onClick={handleReset}>
            Import more
          </Button>
          <Button onClick={() => router.push("/dashboard")}>
            View dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Import</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a bank statement CSV to track benefit utilization.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="flex flex-col gap-5">
          {/* Card selector */}
          <CardSelector
            userCards={userCards}
            selectedId={selectedCardId}
            onSelect={setSelectedCardId}
            disabled={step !== "select"}
          />

          {/* CSV upload */}
          <CsvUpload
            file={file}
            onFileSelect={setFile}
            disabled={step !== "select"}
          />

          {/* Preview */}
          {preview && step !== "select" && (
            <ImportPreviewCard preview={preview} />
          )}

          {/* Error */}
          {error && (
            <p className="text-center text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Bottom action */}
      <div className="sticky bottom-0 border-t border-border bg-background/80 px-6 py-4 backdrop-blur-lg">
        {step === "select" && (
          <Button
            onClick={handleUpload}
            disabled={!canUpload}
            size="lg"
            className={cn(
              "w-full text-base font-semibold",
              "transition-all duration-200 active:scale-95"
            )}
          >
            {isProcessing && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {!selectedCardId
              ? "Select a card"
              : !file
                ? "Upload a CSV"
                : "Preview import"}
          </Button>
        )}

        {step === "preview" && !preview && (
          <Button disabled size="lg" className="w-full text-base font-semibold">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </Button>
        )}

        {step === "preview" && preview && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              size="lg"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={preview.totalCount === 0}
              size="lg"
              className={cn(
                "flex-1 text-base font-semibold",
                "transition-all duration-200 active:scale-95"
              )}
            >
              Import {preview.totalCount} transaction
              {preview.totalCount === 1 ? "" : "s"}
            </Button>
          </div>
        )}

        {step === "importing" && (
          <Button disabled size="lg" className="w-full text-base font-semibold">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Importing...
          </Button>
        )}
      </div>
    </div>
  );
}
