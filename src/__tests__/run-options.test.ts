import { describe, expect, it } from "vitest";
import { getRunOptions } from "../run-options.ts";

describe("getRunOptions", () => {
  it("defaults to full bilingual reports", () => {
    const options = getRunOptions({});
    expect(options.mode).toBe("full");
    expect(options.langs).toEqual(["zh", "en"]);
    expect(options.reports).toContain("cli");
    expect(options.reports).toContain("agents");
    expect(options.reports).toContain("highlights");
  });

  it("uses lite mode to reduce LLM work", () => {
    const options = getRunOptions({ RADAR_MODE: "lite" });
    expect(options.mode).toBe("lite");
    expect(options.langs).toEqual(["zh"]);
    expect(options.reports).toEqual(["cli", "trending", "hn"]);
  });

  it("allows explicit language and report overrides", () => {
    const options = getRunOptions({ RADAR_MODE: "lite", RADAR_LANGS: "en", RADAR_REPORTS: "trending,arxiv" });
    expect(options.langs).toEqual(["en"]);
    expect(options.reports).toEqual(["trending", "arxiv"]);
  });

  it("throws on invalid options", () => {
    expect(() => getRunOptions({ RADAR_LANGS: "fr" })).toThrow("Invalid RADAR_LANGS");
    expect(() => getRunOptions({ RADAR_REPORTS: "unknown" })).toThrow("Invalid RADAR_REPORTS");
  });
});
