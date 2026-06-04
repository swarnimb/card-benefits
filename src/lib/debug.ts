/**
 * Gated debug logger — EH-01 (not silent) / EH-02 (context). Output is visible
 * only when DEBUG=true. Single source for the prefixed-debug pattern that was
 * previously triplicated across the scraper and parser (OBS-3 follow-up).
 *
 * Usage: `const debugLog = createDebugLog("scraper");` then `debugLog("...")`.
 */
export function createDebugLog(label: string): (message: string) => void {
  return (message: string) => {
    if (process.env.DEBUG === "true") {
      console.log(`[${label}] ${message}`);
    }
  };
}
