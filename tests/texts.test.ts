import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t } from "@/lib/texts.sk";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

describe("wording of confidentiality [NFR-04]", () => {
  it("no file under src/ contains the forbidden word", () => {
    const forbidden = /anonym/i;
    const offenders = sourceFiles("src").filter((path) => forbidden.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the intro text of a survey has the exact wording from mvp.md", () => {
    expect(t.fill.confidentiality).toBe(
      "Tvoje odpovede sú dôverné. Manažér ani tím neuvidia, kto čo napísal, výsledky vidia iba za skupinu aspoň 5 ľudí.",
    );
  });
});
