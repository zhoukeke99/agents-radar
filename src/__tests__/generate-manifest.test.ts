import { describe, it, expect } from "vitest";
import { toRfc822, escapeXml, getReportFiles, getSiteUrl } from "../generate-manifest.ts";

// ---------------------------------------------------------------------------
// toRfc822
// ---------------------------------------------------------------------------

describe("toRfc822", () => {
  it("formats a known date correctly", () => {
    // 2026-03-09 is a Monday
    const date = new Date(Date.UTC(2026, 2, 9, 14, 30, 0));
    const result = toRfc822(date);
    expect(result).toBe("Mon, 09 Mar 2026 14:30:00 +0000");
  });

  it("pads single-digit day and hours", () => {
    const date = new Date(Date.UTC(2026, 0, 5, 3, 7, 9));
    const result = toRfc822(date);
    expect(result).toBe("Mon, 05 Jan 2026 03:07:09 +0000");
  });

  it("handles midnight correctly", () => {
    const date = new Date(Date.UTC(2026, 5, 15, 0, 0, 0));
    const result = toRfc822(date);
    expect(result).toContain("00:00:00 +0000");
  });

  it("handles end of year", () => {
    const date = new Date(Date.UTC(2026, 11, 31, 23, 59, 59));
    const result = toRfc822(date);
    expect(result).toContain("Dec 2026");
    expect(result).toContain("23:59:59");
  });
});

// ---------------------------------------------------------------------------
// escapeXml
// ---------------------------------------------------------------------------

describe("escapeXml", () => {
  it("escapes ampersand", () => {
    expect(escapeXml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeXml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("handles multiple escapes in one string", () => {
    expect(escapeXml('A & B < C > D "E"')).toBe("A &amp; B &lt; C &gt; D &quot;E&quot;");
  });

  it("returns unchanged string if no special chars", () => {
    expect(escapeXml("plain text")).toBe("plain text");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// getSiteUrl
// ---------------------------------------------------------------------------

describe("getSiteUrl", () => {
  it("uses configured Pages URL and trims trailing slash", () => {
    expect(getSiteUrl({ PAGES_URL: "https://example.com/repo/" })).toBe("https://example.com/repo");
  });

  it("falls back when Pages URL is empty", () => {
    expect(getSiteUrl({ PAGES_URL: "" })).toBe("https://duanyytop.github.io/agents-radar");
  });
});

// ---------------------------------------------------------------------------
// getReportFiles
// ---------------------------------------------------------------------------

describe("getReportFiles", () => {
  it("filters to Chinese reports and selected daily report types", () => {
    const files = getReportFiles({
      RADAR_MODE: "lite",
      RADAR_LANGS: "zh",
      RADAR_REPORTS: "cli,trending,hn,arxiv,hf,community",
    });

    expect(files).toEqual([
      "ai-cli",
      "ai-trending",
      "ai-hn",
      "ai-arxiv",
      "ai-hf",
      "ai-community",
      "ai-weekly",
      "ai-monthly",
    ]);
  });

  it("keeps bilingual output by default", () => {
    const files = getReportFiles({});

    expect(files).toContain("ai-cli");
    expect(files).toContain("ai-cli-en");
  });
});
