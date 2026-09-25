import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("merges class names cleanly", () => {
    expect(cn("px-2 py-1", "bg-emerald-600")).toBe("px-2 py-1 bg-emerald-600");
  });

  it("handles conditional classes and conflicts correctly", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});
