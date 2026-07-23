import type { Lang } from "./i18n.ts";

export const REPORT_IDS = [
  "cli",
  "agents",
  "web",
  "trending",
  "hn",
  "ph",
  "arxiv",
  "hf",
  "community",
  "highlights",
] as const;

export type ReportId = (typeof REPORT_IDS)[number];
export type RadarMode = "full" | "lite";

export interface RunOptions {
  mode: RadarMode;
  langs: Lang[];
  reports: ReportId[];
}

const ALL_REPORTS = [...REPORT_IDS];
const LITE_REPORTS: ReportId[] = ["cli", "trending", "hn"];

function parseMode(value: string | undefined): RadarMode {
  if (!value) return "full";
  if (value === "full" || value === "lite") return value;
  throw new Error(`Invalid RADAR_MODE: "${value}". Valid values are: full, lite.`);
}

function parseLangs(value: string | undefined, mode: RadarMode): Lang[] {
  if (!value) return mode === "lite" ? ["zh"] : ["zh", "en"];
  if (value === "both") return ["zh", "en"];

  const langs = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!langs.length || langs.some((lang) => lang !== "zh" && lang !== "en")) {
    throw new Error(`Invalid RADAR_LANGS: "${value}". Valid values are: zh, en, both, zh,en.`);
  }
  return [...new Set(langs)] as Lang[];
}

function parseReports(value: string | undefined, mode: RadarMode): ReportId[] {
  if (!value) return mode === "lite" ? LITE_REPORTS : ALL_REPORTS;
  if (value === "all") return ALL_REPORTS;

  const reports = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const validReports = new Set<string>(REPORT_IDS);
  if (!reports.length || reports.some((report) => !validReports.has(report))) {
    throw new Error(`Invalid RADAR_REPORTS: "${value}". Valid values are: all, ${REPORT_IDS.join(",")}.`);
  }
  return [...new Set(reports)] as ReportId[];
}

export function getRunOptions(env: NodeJS.ProcessEnv = process.env): RunOptions {
  const mode = parseMode(env["RADAR_MODE"]);
  return {
    mode,
    langs: parseLangs(env["RADAR_LANGS"], mode),
    reports: parseReports(env["RADAR_REPORTS"], mode),
  };
}

export function hasReport(options: RunOptions, report: ReportId): boolean {
  return options.reports.includes(report);
}
