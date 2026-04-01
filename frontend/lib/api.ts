import { API_BASE_URL, DEFAULT_FILTERS, DEFAULT_WEIGHTS } from "@/lib/config";
import type { AnalysisResponse, Filters, Weights } from "@/lib/types";

export async function getLatestResult(): Promise<AnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/analysis/result`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load analysis result");
  }
  return response.json();
}

export async function runAnalysis(
  filters: Filters = DEFAULT_FILTERS,
  weights: Weights = DEFAULT_WEIGHTS
): Promise<AnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/analysis/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studyArea: "Bangkok Metropolitan Area",
      weights,
      filters,
      chosenLayers: ["ndvi", "pm25", "greenSpaces", "pollutionSources", "suitability"]
    })
  });
  if (!response.ok) {
    throw new Error("Failed to run analysis");
  }
  return response.json();
}

