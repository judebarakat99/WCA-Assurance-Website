// Kept for the callers that load "sample data": the demonstration records are now the compliance
// register itself (data/register/compliance.csv), so every page starts from the same numbers.
import { seedAssessments } from "@/lib/domain/assessment.mjs";

/** The compliance register's records. */
export function sampleAssessments() {
  return seedAssessments();
}
