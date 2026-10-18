import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const html = readFileSync(path.join(root, "index.html"), "utf8");
const viteConfig = readFileSync(path.join(root, "vite.config.ts"), "utf8");

function collectQuotedValues(source: string): string[] {
  return [...source.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function collectConfiguredIconPaths(): string[] {
  const htmlIcons = [...html.matchAll(/<link\b[^>]*\brel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/gi)]
    .map((match) => match[0])
    .flatMap((tag) => [...tag.matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => match[1]));
  const includeAssets = viteConfig.match(/includeAssets\s*:\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  const precachePaths = collectQuotedValues(includeAssets).map((value) =>
    value.startsWith("/") ? value : `/${value}`,
  );
  const manifestIcons = viteConfig.match(/icons\s*:\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  const manifestPaths = [...manifestIcons.matchAll(/\bsrc\s*:\s*["']([^"']+)["']/g)].map((match) => match[1]);

  return [...new Set([...htmlIcons, ...precachePaths, ...manifestPaths])]
    .filter((value) => value.startsWith("/") && !value.startsWith("//"));
}

function sourcePath(urlPath: string): string {
  return path.join(root, "public", decodeURIComponent(urlPath.slice(1)));
}

function pngDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 24 || !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return null;
  }

  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe("PWA icon asset contract", () => {
  const configuredPaths = collectConfiguredIconPaths();

  it("has a source file for every icon referenced by HTML and Vite PWA config", () => {
    expect(configuredPaths.length).toBeGreaterThan(0);
    const missingPaths = configuredPaths.filter((urlPath) => !existsSync(sourcePath(urlPath)));
    expect(missingPaths).toEqual([]);
  });

  it("contains valid SVG favicon and mask icon sources", () => {
    const svgPaths = configuredPaths.filter((urlPath) => urlPath.endsWith(".svg"));
    expect(svgPaths.length).toBeGreaterThan(0);

    for (const urlPath of svgPaths) {
      const filePath = sourcePath(urlPath);
      if (!existsSync(filePath)) continue;
      const svg = readFileSync(filePath, "utf8");
      expect(svg).toMatch(/<svg\b[^>]*\bviewBox=["'][^"']+["']/i);
      expect(svg).toMatch(/<\/svg>\s*$/i);
      expect(svg).not.toMatch(/<script\b/i);
    }
  });

  it("contains valid PNGs with their declared or platform dimensions", () => {
    const declaredSizes = new Map<string, number>();
    for (const match of viteConfig.matchAll(/src\s*:\s*["']([^"']+\.png)["'][\s\S]*?sizes\s*:\s*["'](\d+)x\2["']/g)) {
      declaredSizes.set(match[1], Number(match[2]));
    }

    for (const urlPath of configuredPaths.filter((candidate) => candidate.endsWith(".png"))) {
      const filePath = sourcePath(urlPath);
      if (!existsSync(filePath)) continue;
      const data = readFileSync(filePath);
      const expectedSize = declaredSizes.get(urlPath) ?? (urlPath === "/apple-touch-icon.png" ? 180 : undefined);
      expect(expectedSize, `${urlPath} must declare or define its expected square size`).toBeDefined();
      expect(pngDimensions(data), `${urlPath} must be a valid PNG`).toEqual({
        width: expectedSize,
        height: expectedSize,
      });
    }
  });

  it("contains a valid ICO favicon when one is configured", () => {
    for (const urlPath of configuredPaths.filter((candidate) => candidate.endsWith(".ico"))) {
      const filePath = sourcePath(urlPath);
      if (!existsSync(filePath)) continue;
      const data = readFileSync(filePath);
      expect(data.length).toBeGreaterThan(22);
      expect(data.readUInt16LE(0)).toBe(0);
      expect(data.readUInt16LE(2)).toBe(1);
      expect(data.readUInt16LE(4)).toBeGreaterThan(0);
      expect(data.readUInt8(6) || 256).toBe(32);
      expect(data.readUInt8(7) || 256).toBe(32);
      const payloadLength = data.readUInt32LE(14);
      const payloadOffset = data.readUInt32LE(18);
      expect(payloadLength).toBeGreaterThan(0);
      expect(payloadOffset + payloadLength).toBeLessThanOrEqual(data.length);
      expect(pngDimensions(data.subarray(payloadOffset, payloadOffset + payloadLength))).toEqual({
        width: 32,
        height: 32,
      });
    }
  });
});
