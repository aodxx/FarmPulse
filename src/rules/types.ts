export type RecommendationStatus =
  | "GOOD"
  | "CAUTION"
  | "NOT_RECOMMENDED"
  | "UNKNOWN";

export type ActivityType =
  | "rubber_tapping"
  | "fertilizing"
  | "spraying"
  | "grass_cutting"
  | "harvesting"
  | "equipment_inspection";

export interface WeatherContext {
  temperatureC?: number;
  humidityPercent?: number;
  precipitationMm?: number;
  precipitationProbabilityPercent?: number;
  windSpeedKmh?: number;
}

export interface RuleEvaluation {
  status: RecommendationStatus;
  reasonCodes: string[];
  humanReason: string;
  metrics: Record<string, number | string | null>;
  ruleVersion: string;
}
