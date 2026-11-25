// coral-biglaugh-entry1 — One Line, Big Laugh
//
// A deterministic Node program that writes one funny line to
// /output/entry.txt, with no trailing newline. The line is chosen from
// a fixed list of original one-liners by a fixed scoring rule, so the
// same input always yields the same output. No network, no clock, no
// random source, no environment input.
//
// Scoring weights follow the published judge brief, in its order:
// a real joke first, an unexpected turn second, tight wording third,
// freshness fourth, and a line that sticks in the head fifth. Each
// candidate carries fixed marks for those five qualities, and the
// highest total wins. A tie goes to the earliest candidate, which
// keeps the choice stable across runs.
//
// Guard style for this file: the branching fallback keyword never
// appears, no bare loop skip appears, no empty-value return appears,
// every try shares its line with its first statement, every catch
// names its binding, and no identifier spelled c-u-r-s-o-r appears
// anywhere in the file.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const OUTPUT_PATH = "/output/entry.txt";
const MIN_CHARS = 1;
const MAX_CHARS = 200;
const MAX_WORDS = 34;
const MIN_WORDS = 12;

type Candidate = {
  text: string;
  joke: number;
  turn: number;
  tight: number;
  fresh: number;
  sticky: number;
};

type ScoredCandidate = {
  candidate: Candidate;
  score: number;
  chars: number;
  words: number;
};

const CANDIDATES: Array<Candidate> = [
  {
    text: "I asked an AI to write my wedding vows and it proposed to me, which is the most commitment anyone has shown me in years.",
    joke: 10,
    turn: 10,
    tight: 9,
    fresh: 10,
    sticky: 10,
  },
  {
    text: "My smartwatch congratulated me on burning 400 calories, which is generous, because I only burned them stress-eating near the stove.",
    joke: 8,
    turn: 8,
    tight: 8,
    fresh: 8,
    sticky: 8,
  },
  {
    text: "I tried to teach my dog to fetch my slippers, and now he brings me the neighbor's slippers, one at a time, like rent.",
    joke: 8,
    turn: 9,
    tight: 9,
    fresh: 9,
    sticky: 8,
  },
  {
    text: "My bank flagged my account for suspicious activity, which is insulting, because the only suspicious thing I did was check my balance twice.",
    joke: 7,
    turn: 8,
    tight: 7,
    fresh: 7,
    sticky: 8,
  },
  {
    text: "I told my GPS I wanted the fastest route to happiness, and it recalculated for forty minutes, then told me to turn around.",
    joke: 8,
    turn: 8,
    tight: 8,
    fresh: 7,
    sticky: 9,
  },
];

function countChars(text: string): number {
  return [...text].length;
}

function countWords(text: string): number {
  const parts = text.split(/\s+/u);
  const words = parts.filter((part) => part.length > 0);
  return words.length;
}

function hasSingleLine(text: string): boolean {
  const newlineFound = text.includes("\n") || text.includes("\r");
  return newlineFound === false;
}

function hasVisibleText(text: string): boolean {
  return text.trim().length > 0;
}

function isUtf8RoundTrip(text: string): boolean {
  const encoded = Buffer.from(text, "utf8");
  const decoded = encoded.toString("utf8");
  return decoded === text;
}

function scoreCandidate(candidate: Candidate): number {
  const jokeWeight = 5;
  const turnWeight = 4;
  const tightWeight = 3;
  const freshWeight = 2;
  const stickyWeight = 1;
  const total =
    candidate.joke * jokeWeight +
    candidate.turn * turnWeight +
    candidate.tight * tightWeight +
    candidate.fresh * freshWeight +
    candidate.sticky * stickyWeight;
  return total;
}

function lengthBonus(chars: number, words: number): number {
  if (chars < 90) {
    return 0;
  }
  if (chars > 160) {
    return 0;
  }
  if (words < 18) {
    return 0;
  }
  if (words > 30) {
    return 0;
  }
  return 5;
}

function scoreOne(candidate: Candidate): ScoredCandidate {
  const chars = countChars(candidate.text);
  const words = countWords(candidate.text);
  const base = scoreCandidate(candidate);
  const bonus = lengthBonus(chars, words);
  const scored: ScoredCandidate = {
    candidate,
    score: base + bonus,
    chars,
    words,
  };
  return scored;
}

function pickBest(scored: Array<ScoredCandidate>): ScoredCandidate {
  let best = scored[0];
  for (const entry of scored) {
    if (entry.score > best.score) {
      best = entry;
    }
  }
  return best;
}

function gateCheck(text: string): Array<string> {
  const failures: Array<string> = [];
  const chars = countChars(text);
  if (chars < MIN_CHARS) {
    failures.push("line is empty");
  }
  if (chars > MAX_CHARS) {
    failures.push("line exceeds 200 characters");
  }
  if (hasVisibleText(text) === false) {
    failures.push("line is only whitespace");
  }
  if (hasSingleLine(text) === false) {
    failures.push("line spans more than one line");
  }
  if (isUtf8RoundTrip(text) === false) {
    failures.push("line is not clean UTF-8 text");
  }
  const words = countWords(text);
  if (words < MIN_WORDS) {
    failures.push("line is too short to land as a joke");
  }
  if (words > MAX_WORDS) {
    failures.push("line wastes words beyond the budget");
  }
  return failures;
}

function sha256Hex(text: string): string {
  const hash = createHash("sha256");
  hash.update(text, "utf8");
  return hash.digest("hex");
}

function ensureOutputDir(path: string): void {
  const dir = dirname(path);
  if (existsSync(dir) === false) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeLine(text: string): void {
  ensureOutputDir(OUTPUT_PATH);
  writeFileSync(OUTPUT_PATH, text, "utf8");
}

function readBack(): string {
  const bytes = readFileSync(OUTPUT_PATH);
  return bytes.toString("utf8");
}

function report(
  chosen: ScoredCandidate,
  failures: Array<string>,
  digest: string,
): void {
  const payload = {
    status: failures.length === 0 ? "ok" : "fail",
    chars: chosen.chars,
    words: chosen.words,
    score: chosen.score,
    sha256: digest,
    failures,
    line: chosen.candidate.text,
  };
  console.log(JSON.stringify(payload, null, 2));
}

function main(): void {
  const scored = CANDIDATES.map(scoreOne);
  const chosen = pickBest(scored);
  const failures = gateCheck(chosen.candidate.text);
  if (failures.length > 0) {
    report(chosen, failures, sha256Hex(chosen.candidate.text));
    throw new Error("gate failed: " + failures.join("; "));
  }
  try { writeLine(chosen.candidate.text); } catch (caughtFailure) {
    const message =
      caughtFailure instanceof Error ? caughtFailure.message : "unknown write failure";
    throw new Error("write failed: " + message);
  }
  const back = readBack();
  if (back !== chosen.candidate.text) {
    throw new Error("read-back mismatch: output differs from chosen line");
  }
  const digest = sha256Hex(back);
  report(chosen, failures, digest);
}

main();
