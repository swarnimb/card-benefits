"use client";

import { COLORS, RADII } from "@/lib/ui/tokens";
import { fieldInputStyle } from "./edit-fields";
import { PlusIcon } from "./icons";

/** Props for CustomCardForm. */
export interface CustomCardFormProps {
  open: boolean;
  issuer: string;
  name: string;
  adding: boolean;
  disabled: boolean;
  onOpen: () => void;
  onIssuerChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onSubmit: () => void;
}

/**
 * Custom-card affordance for the add picker (extracted to keep `add-picker` <
 * 200 lines). Collapsed: a dashed "+ Add a custom card" button. Open: issuer +
 * name inputs and the submit button. Preserves the existing custom add path.
 */
export function CustomCardForm({
  open,
  issuer,
  name,
  adding,
  disabled,
  onOpen,
  onIssuerChange,
  onNameChange,
  onSubmit,
}: CustomCardFormProps) {
  const incomplete = !issuer.trim() || !name.trim();

  return (
    <div style={{ padding: "0 16px 28px" }}>
      {!open ? (
        <button
          onClick={onOpen}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: RADII.button,
            cursor: "pointer",
            background: "transparent",
            border: `1px dashed ${COLORS.hairline2}`,
            color: COLORS.text2,
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {PlusIcon} Add a custom card
        </button>
      ) : (
        <div
          style={{
            padding: "14px",
            borderRadius: RADII.button,
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Custom card</div>
          <input
            placeholder="Issuer (e.g. US Bank)"
            aria-label="Custom issuer"
            value={issuer}
            onChange={(e) => onIssuerChange(e.target.value)}
            style={fieldInputStyle}
          />
          <input
            placeholder="Card name"
            aria-label="Custom card name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            style={fieldInputStyle}
          />
          <button
            onClick={onSubmit}
            disabled={incomplete || disabled}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: RADII.button,
              cursor: incomplete || disabled ? "not-allowed" : "pointer",
              background: incomplete ? "rgba(255,255,255,0.06)" : COLORS.amber,
              border: "none",
              color: incomplete ? COLORS.text4 : COLORS.onAmber,
              fontSize: 13.5,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {adding ? "Adding…" : "Add custom card"}
          </button>
        </div>
      )}
    </div>
  );
}
