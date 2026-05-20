"use client";

import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

/** Shape of a card row in the management list. */
export interface ManagedCard {
  id: string;
  card: { issuer: string; name: string };
  lastVerifiedAt: string | null;
  benefitCount: number;
}

/** Props for CardManagementList. */
export interface CardManagementListProps {
  cards: ManagedCard[];
  onRescrape: (cardId: string) => void;
  onRemove: (cardId: string) => void;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/** Admin list of user's cards with rescrape and remove actions. */
export function CardManagementList({ cards, onRescrape, onRemove }: CardManagementListProps) {
  const [removeTarget, setRemoveTarget] = useState<ManagedCard | null>(null);

  return (
    <>
      <div className="space-y-2">
        {cards.map((card) => (
          <div
            key={card.id}
            className="flex items-center justify-between rounded-md border p-3"
            data-testid="card-row"
          >
            <div>
              <p className="text-sm font-medium">
                {card.card.issuer} {card.card.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Last verified: {card.lastVerifiedAt ? relativeDate(card.lastVerifiedAt) : "Never"}
                {" · "}
                {card.benefitCount} benefit{card.benefitCount !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="xs"
                onClick={() => onRescrape(card.id)}
                aria-label={`Refresh benefits for ${card.card.name}`}
              >
                <RefreshCw className="size-3" />
                Refresh Benefits
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setRemoveTarget(card)}
                aria-label={`Remove ${card.card.name}`}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        // NEW-3 fix: include issuer so the title reads e.g. "Remove Amex Blue Cash
        // Everyday?" or "Remove Discover it Cash Back?" — name alone is awkward
        // for cards where the brand line is inseparable from the issuer.
        title={
          removeTarget
            ? `Remove ${removeTarget.card.issuer} ${removeTarget.card.name}?`
            : "Remove card?"
        }
        description="All benefits and usage history will be deleted."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (removeTarget) onRemove(removeTarget.id);
          setRemoveTarget(null);
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </>
  );
}
