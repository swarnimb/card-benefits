"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { OverviewData } from "@/types/api";

const COLOR_EXPIRING = "#F59E0B";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntilReset(periodEnd: Date | string): number {
  return Math.ceil((new Date(periodEnd).getTime() - Date.now()) / MS_PER_DAY);
}

type Alert = OverviewData["expiringSoon"][0];

interface ExpiringAlertsProps {
  alerts: Alert[];
}

/** Renders a horizontal scrolling list of benefits expiring within 7 days. */
export function ExpiringAlerts({ alerts }: ExpiringAlertsProps) {
  const shouldReduceMotion = useReducedMotion();

  if (alerts.length === 0) return null;

  return (
    <motion.div
      className="rounded-lg border p-4 mb-4"
      style={{ borderColor: COLOR_EXPIRING }}
      animate={shouldReduceMotion ? {} : { opacity: [1, 0.4, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <p
        className="text-xs font-medium uppercase tracking-wider mb-3"
        style={{ color: COLOR_EXPIRING }}
      >
        Expiring Soon
      </p>
      <ul className="space-y-3">
        {alerts.map((alert) => {
          const days = daysUntilReset(alert.periodEnd);
          return (
            <li key={alert.benefitId} className="flex flex-col gap-0.5">
              <span className="text-sm font-medium" style={{ color: COLOR_EXPIRING }}>
                {alert.benefitName}
              </span>
              <span className="text-xs" style={{ color: COLOR_EXPIRING }}>
                {alert.cardName} · ${Math.round(alert.remainingValue)} remaining · Resets in {days} day
                {days !== 1 ? "s" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
