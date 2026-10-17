import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@client/components/ThemeProvider";
import { ThemeSelector } from "@client/components/ThemeSelector";

describe("ThemeSelector", () => {
  it("exposes an accessible native selector with the exact theme choices", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ThemeSelector />
      </ThemeProvider>
    );

    expect(markup).toContain('label for="theme-preference"');
    expect(markup).toContain(">Tema visual</label>");
    expect(markup).toContain('<select id="theme-preference" name="theme-preference"');
    expect(markup).toContain('<option value="system" selected="">Sistema</option>');
    expect(markup).toContain('<option value="light">Claro</option>');
    expect(markup).toContain('<option value="dark">Oscuro</option>');
  });
});
