import { useCsv } from "./useCsv.js";
export function useAlertHistory() {
  return useCsv("/alert_history.csv");
}
