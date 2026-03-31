import { describe, it, expect } from "vitest";
import { THINKING_LEVELS } from "./models";

describe("thinking levels", () => {
  it("includes xhigh for teammate configuration", () => {
    expect(THINKING_LEVELS).toContain("xhigh");
  });
});
