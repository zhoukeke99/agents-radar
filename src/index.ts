/**
 * agents-radar: daily digest for AI CLI tools and OpenClaw.
 *
 * Env vars:
 *   LLM_PROVIDER        - "anthropic" | "openai" | "github-copilot" | "openrouter" (default: anthropic)
 *   GITHUB_TOKEN        - GitHub token for API access and issue creation
 *   DIGEST_REPO         - owner/repo where digest issues are posted (optional)
 *
 * Provider-specific env vars — see src/providers/ for full list.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  type GitHubItem,
  type RepoFetch,
  fetchRecentItems,
  fetchRecentReleases,
  fetchSkillsData,
  createGitHubIssue,
} from "./github.ts";
import {
  type RepoDigest,
  buildCliPrompt,
  buildPeerPrompt,
  buildComparisonPrompt,
  buildPeersComparisonPrompt,
  buildSkillsPrompt,
} from "./prompts.ts";
import { buildTrendingPrompt, buildHighlightsPrompt, type ReportHighlights } from "./prompts-data.ts";
import { callLlm, parseLlmJson, saveFile, autoGenFooter, LLM_TOKENS_TRENDING } from "./report.ts";
import { buildCliReportContent, buildOpenclawReportContent } from "./report-builders.ts";
import {
  saveWebReport,
  saveTrendingReport,
  saveHnReport,
  savePhReport,
  saveArxivReport,
  saveHfReport,
  saveCommunityReport,
} from "./report-savers.ts";
import { loadWebState, fetchSiteContent, type WebFetchResult, type WebState } from "./web.ts";
import { fetchTrendingData, type TrendingData } from "./trending.ts";
import { fetchHnData, type HnData } from "./hn.ts";
import { fetchPhData, type PhData } from "./ph.ts";
import { fetchArxivData, type ArxivData } from "./arxiv.ts";
import { fetchHfData, type HfData } from "./hf.ts";
import { fetchDevtoData, type DevtoData } from "./devto.ts";
import { fetchLobstersData, type LobstersData } from "./lobsters.ts";
import { loadConfig } from "./config.ts";
import { toCstDateStr, toUtcStr } from "./date.ts";
import { type Lang, MSG, ISSUE_LABELS, CLI_ISSUE_TITLE, OPENCLAW_ISSUE_TITLE } from "./i18n.ts";
import { getRunOptions, hasReport, type RunOptions } from "./run-options.ts";

// ---------------------------------------------------------------------------
// Repo config — loaded from config.yml, falls back to built-in defaults
// ---------------------------------------------------------------------------

const {
  cliRepos: CLI_REPOS,
  skillsRepo: CLAUDE_SKILLS_REPO,
  openclaw: OPENCLAW,
  openclawPeers: OPENCLAW_PEERS,
} = loadConfig();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// ---------------------------------------------------------------------------
// Phase 1: Fetch
// ---------------------------------------------------------------------------

async function fetchAllData(
  since: Date,
  webState: WebState,
): Promise<{
  fetched: RepoFetch[];
  skillsData: { prs: GitHubItem[]; issues: GitHubItem[] };
  webResults: WebFetchResult[];
  trendingData: TrendingData;
  hnData: HnData;
  phData: PhData;
  arxivData: ArxivData;
  hfData: HfData;
  devtoData: DevtoData;
  lobstersData: LobstersData;
}> {
  const allConfigs = [...CLI_REPOS, OPENCLAW, ...OPENCLAW_PEERS];
  console.log(
    `  Tracking: ${allConfigs.map((r) => r.id).join(", ")}, claude-code-skills, web, hn, ph, arxiv, hf, devto, lobsters`,
  );

  const [
    fetched,
    skillsData,
    webResults,
    trendingData,
    hnData,
    phData,
    arxivData,
    hfData,
    devtoData,
    lobstersData,
  ] = await Promise.all([
    Promise.all(
      allConfigs.map(async (cfg) => {
        try {
          const [issuesRaw, prs, releases] = await Promise.all([
            fetchRecentItems(cfg, "issues", since),
            fetchRecentItems(cfg, "pulls", since),
            fetchRecentReleases(cfg.repo, since),
          ]);
          const issues = issuesRaw.filter((i) => !i.pull_request);
          console.log(
            `  [${cfg.id}] issues: ${issues.length}, prs: ${prs.length}, releases: ${releases.length}`,
          );
          return { cfg, issues, prs, releases };
        } catch (err) {
          console.error(`  [${cfg.id}] fetch failed: ${err}`);
          return { cfg, issues: [], prs: [], releases: [] };
        }
      }),
    ),
    fetchSkillsData(CLAUDE_SKILLS_REPO)
      .then((d) => {
        console.log(`  [claude-code-skills] prs: ${d.prs.length}, issues: ${d.issues.length}`);
        return d;
      })
      .catch((err) => {
        console.error(`  [claude-code-skills] fetch failed: ${err}`);
        return { prs: [] as GitHubItem[], issues: [] as GitHubItem[] };
      }),
    Promise.all([
      fetchSiteContent("anthropic", webState).catch((err): WebFetchResult => {
        console.error(`  [web/anthropic] fetch failed: ${err}`);
        return {
          site: "anthropic",
          siteName: "Anthropic (Claude)",
          isFirstRun: false,
          newItems: [],
          totalDiscovered: 0,
        };
      }),
      fetchSiteContent("openai", webState).catch((err): WebFetchResult => {
        console.error(`  [web/openai] fetch failed: ${err}`);
        return { site: "openai", siteName: "OpenAI", isFirstRun: false, newItems: [], totalDiscovered: 0 };
      }),
    ]),
    fetchTrendingData().catch(
      (): TrendingData => ({
        trendingRepos: [],
        searchRepos: [],
        trendingFetchSuccess: false,
      }),
    ),
    fetchHnData().catch((): HnData => ({ stories: [], fetchSuccess: false })),
    fetchPhData().catch((): PhData => ({ products: [], fetchSuccess: false })),
    fetchArxivData().catch((): ArxivData => ({ papers: [], fetchSuccess: false })),
    fetchHfData().catch((): HfData => ({ models: [], fetchSuccess: false })),
    fetchDevtoData().catch((): DevtoData => ({ articles: [], fetchSuccess: false })),
    fetchLobstersData().catch((): LobstersData => ({ stories: [], fetchSuccess: false })),
  ]);

  return {
    fetched,
    skillsData,
    webResults,
    trendingData,
    hnData,
    phData,
    arxivData,
    hfData,
    devtoData,
    lobstersData,
  };
}

// ---------------------------------------------------------------------------
// Phase 2: LLM summaries
// ---------------------------------------------------------------------------

/** Call LLM with logging and error fallback. */
async function summarize(id: string, prompt: string, failMsg: string, maxTokens?: number): Promise<string> {
  console.log(`  [${id}] Calling LLM for summary...`);
  try {
    return await callLlm(prompt, maxTokens);
  } catch (err) {
    console.error(`  [${id}] LLM call failed: ${err}`);
    return failMsg;
  }
}

/** Summarize a repo's activity, returning a RepoDigest. Skips LLM if no data. */
async function summarizeRepo(
  { cfg, issues, prs, releases }: RepoFetch,
  prompt: string,
  noActivityMsg: string,
  failMsg: string,
): Promise<RepoDigest> {
  if (!issues.length && !prs.length && !releases.length) {
    console.log(`  [${cfg.id}] No activity, skipping LLM call`);
    return { config: cfg, issues, prs, releases, summary: noActivityMsg };
  }
  const summary = await summarize(cfg.id, prompt, failMsg);
  return { config: cfg, issues, prs, releases, summary };
}

async function generateSummaries(
  fetchedCli: RepoFetch[],
  fetchedOpenclaw: RepoFetch,
  skillsData: { prs: GitHubItem[]; issues: GitHubItem[] },
  fetchedPeers: RepoFetch[],
  trendingData: TrendingData,
  dateStr: string,
  options: RunOptions,
  lang: Lang = "zh",
): Promise<{
  cliDigests: RepoDigest[];
  openclawSummary: string;
  skillsSummary: string;
  peerDigests: RepoDigest[];
  trendingSummary: string;
}> {
  const noActivity = MSG.noActivity[lang];
  const fail = MSG.summaryFailed[lang];
  const wantsCli = hasReport(options, "cli");
  const wantsAgents = hasReport(options, "agents");
  const wantsTrending = hasReport(options, "trending");

  const [cliDigests, openclawSummary, skillsSummary, peerDigests, trendingSummary] = await Promise.all([
    wantsCli
      ? Promise.all(
          fetchedCli.map((f) =>
            summarizeRepo(
              f,
              buildCliPrompt(f.cfg, f.issues, f.prs, f.releases, dateStr, lang),
              noActivity,
              fail,
            ),
          ),
        )
      : Promise.resolve([]),
    wantsAgents
      ? summarizeRepo(
          fetchedOpenclaw,
          buildPeerPrompt(
            fetchedOpenclaw.cfg,
            fetchedOpenclaw.issues,
            fetchedOpenclaw.prs,
            fetchedOpenclaw.releases,
            dateStr,
            50,
            30,
            lang,
          ),
          noActivity,
          fail,
        ).then((d) => d.summary)
      : Promise.resolve(""),
    wantsCli
      ? summarize(
          "claude-code-skills",
          buildSkillsPrompt(skillsData.prs, skillsData.issues, dateStr, lang),
          MSG.skillsFailed[lang],
        )
      : Promise.resolve(""),
    wantsAgents
      ? Promise.all(
          fetchedPeers.map((f) =>
            summarizeRepo(
              f,
              buildPeerPrompt(f.cfg, f.issues, f.prs, f.releases, dateStr, undefined, undefined, lang),
              noActivity,
              fail,
            ),
          ),
        )
      : Promise.resolve([]),
    wantsTrending
      ? (async () => {
          const hasData = trendingData.trendingRepos.length > 0 || trendingData.searchRepos.length > 0;
          if (!hasData) {
            return MSG.trendingNoData[lang];
          }
          return summarize(
            "trending",
            buildTrendingPrompt(trendingData, dateStr, lang),
            MSG.trendingFailed[lang],
            LLM_TOKENS_TRENDING,
          );
        })()
      : Promise.resolve(""),
  ]);

  return { cliDigests, openclawSummary, skillsSummary, peerDigests, trendingSummary };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  requireEnv("GITHUB_TOKEN");

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateStr = toCstDateStr(now);
  const utcStr = toUtcStr(now);
  const digestRepo = process.env["DIGEST_REPO"] ?? "";
  const options = getRunOptions();

  const providerName = process.env["LLM_PROVIDER"] ?? "anthropic";
  console.log(
    `[${now.toISOString()}] Starting digest | provider: ${providerName} | ` +
      `mode: ${options.mode} | langs: ${options.langs.join(",")} | reports: ${options.reports.join(",")}`,
  );

  // 1. Fetch all data in parallel
  const webState = loadWebState();
  const {
    fetched,
    skillsData,
    webResults,
    trendingData,
    hnData,
    phData,
    arxivData,
    hfData,
    devtoData,
    lobstersData,
  } = await fetchAllData(since, webState);

  const peerIds = new Set(OPENCLAW_PEERS.map((p) => p.id));
  const fetchedCli = fetched.filter((f) => f.cfg.id !== OPENCLAW.id && !peerIds.has(f.cfg.id));
  const fetchedOpenclaw = fetched.find((f) => f.cfg.id === OPENCLAW.id)!;
  const fetchedPeers = fetched.filter((f) => peerIds.has(f.cfg.id));

  // 2. Generate per-repo LLM summaries
  console.log(`  Generating summaries (${options.langs.join(" + ")})...`);
  const summaryEntries = await Promise.all(
    options.langs.map(
      async (lang) =>
        [
          lang,
          await generateSummaries(
            fetchedCli,
            fetchedOpenclaw,
            skillsData,
            fetchedPeers,
            trendingData,
            dateStr,
            options,
            lang,
          ),
        ] as const,
    ),
  );
  const summariesByLang = Object.fromEntries(summaryEntries) as Partial<
    Record<Lang, Awaited<ReturnType<typeof generateSummaries>>>
  >;

  // 3. Generate cross-repo comparisons
  console.log(`  Calling LLM for comparative analyses (${options.langs.join(" + ")})...`);

  const makeOpenclawDigest = (lang: Lang): RepoDigest => ({
    config: OPENCLAW,
    issues: fetchedOpenclaw.issues,
    prs: fetchedOpenclaw.prs,
    releases: fetchedOpenclaw.releases,
    summary: summariesByLang[lang]!.openclawSummary,
  });

  const comparisonByLang: Partial<Record<Lang, string>> = {};
  const peersComparisonByLang: Partial<Record<Lang, string>> = {};
  await Promise.all(
    options.langs.flatMap((lang) => {
      const summary = summariesByLang[lang]!;
      const tasks: Promise<void>[] = [];
      if (hasReport(options, "cli")) {
        tasks.push(
          callLlm(buildComparisonPrompt(summary.cliDigests, dateStr, lang)).then((comparison) => {
            comparisonByLang[lang] = comparison;
          }),
        );
      }
      if (hasReport(options, "agents")) {
        tasks.push(
          callLlm(
            buildPeersComparisonPrompt(makeOpenclawDigest(lang), summary.peerDigests, dateStr, lang),
          ).then((comparison) => {
            peersComparisonByLang[lang] = comparison;
          }),
        );
      }
      return tasks;
    }),
  );

  // 4. Build + save reports
  const cliContent: Partial<Record<Lang, string>> = {};
  const openclawContent: Partial<Record<Lang, string>> = {};

  for (const lang of options.langs) {
    const s = summariesByLang[lang]!;
    const ft = autoGenFooter(lang);
    const suffix = lang === "en" ? "-en" : "";

    if (hasReport(options, "cli")) {
      cliContent[lang] = buildCliReportContent(
        s.cliDigests,
        s.skillsSummary,
        comparisonByLang[lang] ?? "",
        utcStr,
        dateStr,
        ft,
        CLAUDE_SKILLS_REPO,
        lang,
      );
      console.log(`  Saved ${saveFile(cliContent[lang], dateStr, `ai-cli${suffix}.md`)}`);
    }

    if (hasReport(options, "agents")) {
      openclawContent[lang] = buildOpenclawReportContent(
        fetchedOpenclaw,
        s.peerDigests,
        s.openclawSummary,
        peersComparisonByLang[lang] ?? "",
        utcStr,
        dateStr,
        ft,
        OPENCLAW,
        OPENCLAW_PEERS,
        lang,
      );
      console.log(`  Saved ${saveFile(openclawContent[lang], dateStr, `ai-agents${suffix}.md`)}`);
    }
  }

  // Web report: zh saves state, en skips state save
  if (hasReport(options, "web")) {
    for (const lang of options.langs) {
      await saveWebReport(webResults, webState, utcStr, dateStr, digestRepo, autoGenFooter(lang), lang);
    }
  }

  await Promise.all(
    options.langs.flatMap((lang) => {
      const tasks: Promise<void>[] = [];
      if (hasReport(options, "trending")) {
        tasks.push(
          saveTrendingReport(
            trendingData,
            summariesByLang[lang]!.trendingSummary,
            utcStr,
            dateStr,
            digestRepo,
            autoGenFooter(lang),
            lang,
          ),
        );
      }
      if (hasReport(options, "hn"))
        tasks.push(saveHnReport(hnData, utcStr, dateStr, digestRepo, autoGenFooter(lang), lang));
      if (hasReport(options, "ph"))
        tasks.push(savePhReport(phData, utcStr, dateStr, digestRepo, autoGenFooter(lang), lang));
      if (hasReport(options, "arxiv")) {
        tasks.push(saveArxivReport(arxivData, utcStr, dateStr, digestRepo, autoGenFooter(lang), lang));
      }
      if (hasReport(options, "hf"))
        tasks.push(saveHfReport(hfData, utcStr, dateStr, digestRepo, autoGenFooter(lang), lang));
      if (hasReport(options, "community")) {
        tasks.push(
          saveCommunityReport(
            devtoData,
            lobstersData,
            utcStr,
            dateStr,
            digestRepo,
            autoGenFooter(lang),
            lang,
          ),
        );
      }
      return tasks;
    }),
  );

  // 5. Generate highlights for Telegram notification
  if (hasReport(options, "highlights")) {
    const readReport = (name: string): string | undefined => {
      const p = path.join("digests", dateStr, name);
      return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : undefined;
    };

    const reportsByLang: Record<Lang, Record<string, string>> = { zh: {}, en: {} };
    if (cliContent.zh) reportsByLang.zh["ai-cli"] = cliContent.zh;
    if (cliContent.en) reportsByLang.en["ai-cli"] = cliContent.en;
    if (openclawContent.zh) reportsByLang.zh["ai-agents"] = openclawContent.zh;
    if (openclawContent.en) reportsByLang.en["ai-agents"] = openclawContent.en;

    for (const [id, report, zhFile, enFile] of [
      ["ai-trending", "trending", "ai-trending.md", "ai-trending-en.md"],
      ["ai-web", "web", "ai-web.md", "ai-web-en.md"],
      ["ai-hn", "hn", "ai-hn.md", "ai-hn-en.md"],
      ["ai-ph", "ph", "ai-ph.md", "ai-ph-en.md"],
      ["ai-arxiv", "arxiv", "ai-arxiv.md", "ai-arxiv-en.md"],
      ["ai-hf", "hf", "ai-hf.md", "ai-hf-en.md"],
      ["ai-community", "community", "ai-community.md", "ai-community-en.md"],
    ] as const) {
      if (!hasReport(options, report)) continue;
      const zh = readReport(zhFile);
      const en = readReport(enFile);
      if (zh) reportsByLang.zh[id] = zh;
      if (en) reportsByLang.en[id] = en;
    }

    console.log("  Generating highlights for Telegram...");
    const highlights: Record<Lang, ReportHighlights> = { zh: {}, en: {} };
    // Generate + parse one language, retrying once. The LLM occasionally emits
    // slightly malformed JSON that repairJson can't fix (seen 2026-07-13: zh
    // failed with "Expected ',' or ']' after array element"); a fresh generation
    // usually returns valid JSON. Each language runs independently so a failure
    // in one never wipes the other.
    const genHighlights = async (reports: Record<string, string>, lang: Lang): Promise<ReportHighlights> => {
      if (Object.keys(reports).length === 0) return {};
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return parseLlmJson<ReportHighlights>(await callLlm(buildHighlightsPrompt(reports, lang), 2048));
        } catch (err) {
          const tag = attempt < 2 ? "retrying" : "giving up";
          console.error(`  [highlights] ${lang} attempt ${attempt} failed (${tag}): ${err}`);
        }
      }
      return {};
    };
    const highlightEntries = await Promise.all(
      options.langs.map(async (lang) => [lang, await genHighlights(reportsByLang[lang], lang)] as const),
    );
    for (const [lang, result] of highlightEntries) {
      highlights[lang] = result;
    }

    // If one language failed (generation or parse) but the other succeeded,
    // backfill the empty one from the other so notifications never render with
    // zero highlights. Seen 2026-07-13: zh failed intermittently while en was
    // fine, leaving Telegram/Feishu with only section headers and no bullets.
    const zhEmpty = Object.keys(highlights.zh).length === 0;
    const enEmpty = Object.keys(highlights.en).length === 0;
    if (zhEmpty && !enEmpty) {
      console.warn("  [highlights] zh empty — backfilling from en");
      highlights.zh = highlights.en;
    } else if (enEmpty && !zhEmpty) {
      console.warn("  [highlights] en empty — backfilling from zh");
      highlights.en = highlights.zh;
    }

    const highlightsPath = saveFile(JSON.stringify(highlights, null, 2), dateStr, "highlights.json");
    console.log(`  Saved ${highlightsPath}`);
  }

  // 6. Create GitHub issues for CLI + OpenClaw
  if (digestRepo) {
    for (const lang of options.langs) {
      if (hasReport(options, "cli") && cliContent[lang]) {
        const cliUrl = await createGitHubIssue(
          CLI_ISSUE_TITLE(dateStr, lang),
          cliContent[lang],
          ISSUE_LABELS.cli[lang],
        );
        console.log(`  Created CLI issue (${lang}): ${cliUrl}`);
      }

      if (hasReport(options, "agents") && openclawContent[lang]) {
        const ocUrl = await createGitHubIssue(
          OPENCLAW_ISSUE_TITLE(dateStr, lang),
          openclawContent[lang],
          ISSUE_LABELS.openclaw[lang],
        );
        console.log(`  Created OpenClaw issue (${lang}): ${ocUrl}`);
      }
    }
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
