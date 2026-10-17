import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokenFile = resolve(process.cwd(), "src/client/styles/design-tokens.css");
const requiredTokens = [
  "--color-canvas",
  "--color-surface",
  "--color-surface-raised",
  "--color-surface-sunken",
  "--color-text",
  "--color-text-secondary",
  "--color-text-muted",
  "--color-border",
  "--color-border-strong",
  "--color-accent",
  "--color-accent-strong",
  "--color-on-accent",
  "--color-focus",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--color-info",
  "--color-success-surface",
  "--color-warning-surface",
  "--color-danger-surface",
  "--color-info-surface",
];

function parseThemeTokens(source: string, selector: string): Record<string, string> {
  const start = source.indexOf(selector);
  if (start < 0) return {};

  const openBrace = source.indexOf("{", start);
  const closeBrace = source.indexOf("}", openBrace);
  if (openBrace < 0 || closeBrace < 0) return {};

  return Object.fromEntries(
    [...source.slice(openBrace + 1, closeBrace).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
      .map(([, token, value]) => [token, value.trim()])
  );
}

function luminance(color: string): number {
  const channels = color.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Expected an opaque hex color, received ${color}`);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function expectTokensToMeetContrast(tokens: Record<string, string>) {
  const textPairs: Array<[string, string]> = [
    ["--color-text", "--color-canvas"],
    ["--color-text", "--color-surface"],
    ["--color-text-secondary", "--color-surface"],
    ["--color-text-muted", "--color-canvas"],
    ["--color-accent", "--color-surface"],
    ["--color-on-accent", "--color-accent-strong"],
    ["--color-on-accent", "--color-danger-strong"],
    ["--color-success", "--color-success-surface"],
    ["--color-warning", "--color-warning-surface"],
    ["--color-danger", "--color-danger-surface"],
    ["--color-info", "--color-info-surface"],
  ];

  for (const [foreground, background] of textPairs) {
    expect(
      contrastRatio(tokens[foreground], tokens[background]),
      `${foreground} on ${background}`
    ).toBeGreaterThanOrEqual(4.5);
  }

  expect(contrastRatio(tokens["--color-border"], tokens["--color-surface-sunken"])).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(tokens["--color-border-strong"], tokens["--color-surface"])).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(tokens["--color-focus"], tokens["--color-canvas"])).toBeGreaterThanOrEqual(3);
}

describe("semantic design tokens", () => {
  it("defines the full semantic color set for dark and light themes", () => {
    expect(existsSync(tokenFile)).toBe(true);
    const source = readFileSync(tokenFile, "utf8");
    const themes = [
      parseThemeTokens(source, ":root"),
      parseThemeTokens(source, ':root[data-theme="light"]'),
    ];

    for (const theme of themes) {
      for (const token of requiredTokens) expect(theme[token], token).toMatch(/^#[\da-f]{6}$/i);
    }
  });

  it("keeps text and important interface boundaries above the contrast targets in both themes", () => {
    expect(existsSync(tokenFile)).toBe(true);
    const source = readFileSync(tokenFile, "utf8");
    const themes = [
      parseThemeTokens(source, ":root"),
      parseThemeTokens(source, ':root[data-theme="light"]'),
    ];

    for (const theme of themes) expectTokensToMeetContrast(theme);
  });
});
