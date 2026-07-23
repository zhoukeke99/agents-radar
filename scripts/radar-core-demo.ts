import fs from "node:fs";
import path from "node:path";
import { fetchArxivData } from "../src/arxiv.ts";
import { toCstDateStr, toUtcStr } from "../src/date.ts";
import { fetchDevtoData } from "../src/devto.ts";
import { fetchHnData } from "../src/hn.ts";
import { fetchLobstersData } from "../src/lobsters.ts";
import { fetchTrendingData } from "../src/trending.ts";

type RadarSource = "GitHub Trending" | "GitHub Search" | "Hacker News" | "Dev.to" | "Lobste.rs" | "ArXiv";

interface Candidate {
  source: RadarSource;
  title: string;
  url: string;
  summary: string;
  score: number;
  reason: string;
}

const TARGET_LINKS = 30;
const TARGET_RECOMMENDATIONS = 5;
const AI_KEYWORDS = [
  /\bai\b/i,
  /\bllm(s)?\b/i,
  /machine learning/i,
  /deep learning/i,
  /neural/i,
  /transformer/i,
  /language model/i,
  /\brag\b/i,
  /agent/i,
  /openai/i,
  /anthropic/i,
  /claude/i,
  /chatgpt/i,
  /gemini/i,
  /copilot/i,
  /inference/i,
  /diffusion/i,
];

function canonicalUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^ref$|^source$/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return rawUrl.trim();
  }
}

function compact(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}...`;
}

function isAiRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`;
  return AI_KEYWORDS.some((pattern) => pattern.test(text));
}

function logScore(value: number, scale: number): number {
  return Math.log10(Math.max(value, 1)) * scale;
}

function dedupe(candidates: Candidate[]): Candidate[] {
  const bestByUrl = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = canonicalUrl(candidate.url);
    const current = bestByUrl.get(key);
    if (!current || candidate.score > current.score) bestByUrl.set(key, candidate);
  }
  return [...bestByUrl.values()].sort((a, b) => b.score - a.score);
}

function saveDemoFile(content: string, ...segments: string[]): string {
  const filepath = path.join("digests", ...segments);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, content, "utf-8");
  return filepath;
}

async function collectCandidates(): Promise<Candidate[]> {
  const [trending, hn, devto, lobsters, arxiv] = await Promise.all([
    fetchTrendingData(),
    fetchHnData(),
    fetchDevtoData(),
    fetchLobstersData(),
    fetchArxivData(),
  ]);

  const candidates: Candidate[] = [];

  for (const repo of trending.trendingRepos) {
    if (!isAiRelated(repo.fullName, repo.description)) continue;
    const score = 70 + repo.todayStars * 0.8 + logScore(repo.totalStars, 8) + logScore(repo.forks, 3);
    candidates.push({
      source: "GitHub Trending",
      title: repo.fullName,
      url: repo.url,
      summary: compact(repo.description || "GitHub daily trending repository."),
      score,
      reason: `${repo.todayStars} stars today, ${repo.totalStars.toLocaleString()} total stars`,
    });
  }

  for (const repo of trending.searchRepos) {
    const score = 55 + logScore(repo.stargazersCount, 10);
    candidates.push({
      source: "GitHub Search",
      title: repo.fullName,
      url: repo.url,
      summary: compact(repo.description || `Recently active ${repo.searchQuery} repository.`),
      score,
      reason: `topic:${repo.searchQuery}, ${repo.stargazersCount.toLocaleString()} stars`,
    });
  }

  for (const story of hn.stories) {
    const rankBoost = Math.max(0, 35 - (story.hnRank ?? 35));
    const score = 45 + story.points * 0.7 + story.comments * 1.2 + rankBoost;
    candidates.push({
      source: "Hacker News",
      title: story.title,
      url: story.url,
      summary: `HN discussion by ${story.author}.`,
      score,
      reason: `${story.points} points, ${story.comments} comments, HN rank ${story.hnRank ?? "n/a"}`,
    });
  }

  for (const article of devto.articles) {
    const score = 35 + article.positiveReactionsCount * 1.4 + article.commentsCount * 2.5;
    candidates.push({
      source: "Dev.to",
      title: article.title,
      url: article.url,
      summary: compact(article.description || `Article by ${article.user}.`),
      score,
      reason: `${article.positiveReactionsCount} reactions, ${article.commentsCount} comments`,
    });
  }

  for (const story of lobsters.stories) {
    const score = 35 + story.score * 5 + story.commentCount * 3;
    const author = story.author || "unknown";
    candidates.push({
      source: "Lobste.rs",
      title: story.title,
      url: story.url,
      summary: `Tagged ${story.tags.join(", ")} by ${author}.`,
      score,
      reason: `${story.score} score, ${story.commentCount} comments`,
    });
  }

  for (const paper of arxiv.papers) {
    const ageHours = Math.max(1, (Date.now() - new Date(paper.published).getTime()) / 3_600_000);
    const score = 32 + Math.max(0, 48 - ageHours) * 0.7 + Math.min(paper.authors.length, 8);
    candidates.push({
      source: "ArXiv",
      title: paper.title,
      url: paper.url,
      summary: compact(paper.summary),
      score,
      reason: `${paper.categories.join(", ")}, ${paper.authors.length} authors, published ${paper.published.slice(0, 10)}`,
    });
  }

  return candidates;
}

function renderMarkdown(dateStr: string, utcStr: string, pool: Candidate[], recommendations: Candidate[]): string {
  const rows = recommendations
    .map(
      (item, index) =>
        `| ${index + 1} | ${item.source} | [${item.title}](${item.url}) | ${item.score.toFixed(1)} | ${item.reason} |`,
    )
    .join("\n");

  const poolRows = pool
    .map(
      (item, index) =>
        `| ${index + 1} | ${item.source} | [${item.title}](${item.url}) | ${item.score.toFixed(1)} | ${item.summary.replaceAll("|", "\\|")} |`,
    )
    .join("\n");

  return `# 信息雷达核心降级 Demo ${dateStr}

> 抓取 ${pool.length} 条候选链接，按规范化 URL 去重后打分，生成 ${recommendations.length} 条推荐。生成时间: ${utcStr} UTC

## 今日 5 条推荐

| # | 来源 | 链接 | 分数 | 推荐理由 |
| ---: | --- | --- | ---: | --- |
${rows}

## 30 条候选池

| # | 来源 | 链接 | 分数 | 摘要 |
| ---: | --- | --- | ---: | --- |
${poolRows}

## 评分说明

- GitHub Trending: 今日新增 star、总 star、fork 加权。
- GitHub Search: topic 命中和总 star 加权。
- Hacker News: points、comments、HN 排名加权。
- Dev.to / Lobste.rs: 互动数加权。
- ArXiv: 新鲜度、分类和作者数轻量加权。
`;
}

async function main(): Promise<void> {
  const now = new Date();
  const dateStr = toCstDateStr(now);
  const utcStr = toUtcStr(now);

  const candidates = await collectCandidates();
  const pool = dedupe(candidates).slice(0, TARGET_LINKS);
  const recommendations = pool.slice(0, TARGET_RECOMMENDATIONS);

  if (pool.length < TARGET_RECOMMENDATIONS) {
    throw new Error(`Only collected ${pool.length} links; need at least ${TARGET_RECOMMENDATIONS}.`);
  }

  const markdownPath = saveDemoFile(renderMarkdown(dateStr, utcStr, pool, recommendations), dateStr, "core-demo.md");
  const jsonPath = saveDemoFile(
    JSON.stringify({ generatedAt: now.toISOString(), pool, recommendations }, null, 2),
    dateStr,
    "core-demo.json",
  );

  console.log(`Collected ${candidates.length} raw candidates`);
  console.log(`Wrote ${pool.length} deduped links to ${markdownPath}`);
  console.log(`Wrote recommendation data to ${jsonPath}`);
  console.log("Top recommendations:");
  for (const [index, item] of recommendations.entries()) {
    console.log(`${index + 1}. [${item.source}] ${item.title} (${item.score.toFixed(1)})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
