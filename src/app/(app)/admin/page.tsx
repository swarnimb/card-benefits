"use client";

import { AnimatePresence } from "framer-motion";
import { AdminHome } from "@/components/admin/admin-home";
import { AddPicker } from "@/components/admin/add-picker";
import { Scanning } from "@/components/admin/scanning";
import { BenefitReviewGate } from "@/components/admin/benefit-review-gate";
import { Toast } from "@/components/ui/toast";
import { useAdminFlow } from "@/hooks/use-admin-flow";

export default function AdminPage() {
  const {
    cards,
    loading,
    error,
    view,
    setView,
    flowCard,
    scanPending,
    scrapeResult,
    busyId,
    toast,
    handleAdded,
    handleRescrape,
    handleScanDone,
    handleRemove,
    handleSave,
    handleReviewCancel,
    handleScanCancel,
  } = useAdminFlow();

  return (
    <>
      {view === "home" && (
        <AdminHome
          cards={cards}
          busyId={busyId}
          loading={loading}
          error={error}
          onAdd={() => setView("add")}
          onRescrape={handleRescrape}
          onRemove={handleRemove}
        />
      )}

      {view === "add" && (
        <AddPicker onClose={() => setView("home")} onAdded={handleAdded} />
      )}

      {view === "scan" && flowCard && (
        <Scanning
          cardName={flowCard.name}
          color={flowCard.color}
          pending={scanPending}
          errorMessage={scrapeResult?.scrapeError ?? scrapeResult?.parseError ?? null}
          onDone={handleScanDone}
          onCancel={handleScanCancel}
        />
      )}

      {view === "review" && scrapeResult && (
        <BenefitReviewGate
          userCardId={scrapeResult.userCardId}
          initialBenefits={scrapeResult.benefits}
          cardName={flowCard?.name ?? null}
          initialAnnualFee={scrapeResult.annualFee}
          scrapeError={scrapeResult.scrapeError}
          parseError={scrapeResult.parseError}
          onSave={handleSave}
          onCancel={handleReviewCancel}
        />
      )}

      <AnimatePresence>{toast && <Toast key={toast} text={toast} />}</AnimatePresence>
    </>
  );
}
