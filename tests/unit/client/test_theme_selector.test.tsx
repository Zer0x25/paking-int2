import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@client/components/ThemeProvider";
import { ThemeSelector } from "@client/components/ThemeSelector";

describe("ThemeSelector", () => {
  it("exposes one accessible button for switching between light and dark themes", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ThemeSelector />
      </ThemeProvider>
    );

    expect(markup.match(/<button\b/g)).toHaveLength(1);
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-label="Tema actual claro. Cambiar a tema oscuro"');
    expect(markup).not.toContain("<select");
  });
});
