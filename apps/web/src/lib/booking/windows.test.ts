import { describe, expect, it } from "vitest";
import { offeredWindows } from "./windows";

describe("offeredWindows", () => {
  // 2026-08-22 is a Saturday; 18:00 UTC = 13:00 America/Chicago (CDT).
  const saturdayAfternoon = new Date("2026-08-22T18:00:00Z");

  it("Test G — never offers Sunday windows", () => {
    const windows = offeredWindows(saturdayAfternoon, 14);
    const sundays = windows.filter((w) => {
      const [y, m, d] = w.date.split("-").map(Number);
      return new Date(Date.UTC(y!, m! - 1, d!, 12)).getUTCDay() === 0;
    });
    expect(sundays).toHaveLength(0);
    expect(windows.length).toBeGreaterThan(0);
  });

  it("stops offering same-day windows after the cutoff", () => {
    // 21:00 UTC = 16:00 CDT — past the 15:00 same-day cutoff.
    const lateAfternoon = new Date("2026-08-19T21:00:00Z");
    const windows = offeredWindows(lateAfternoon, 3);
    expect(windows.some((w) => w.date === "2026-08-19")).toBe(false);
  });

  it("offers only future windows on the current day before cutoff", () => {
    // 14:00 UTC = 09:00 CDT on Wednesday — 10 AM, 1 PM windows remain; 7 AM gone.
    const morning = new Date("2026-08-19T14:00:00Z");
    const todays = offeredWindows(morning, 3).filter((w) => w.date === "2026-08-19");
    expect(todays.map((w) => w.start)).toEqual(["10:00", "13:00", "16:00"]);
  });

  it("labels windows in customer-friendly form", () => {
    const windows = offeredWindows(saturdayAfternoon, 7);
    expect(windows[0]!.label).toMatch(/^(Mon|Tues|Wednes|Thurs|Fri|Satur)day \d{1,2}\/\d{1,2}, \d{1,2} (AM|PM)–\d{1,2} (AM|PM)$/);
  });
});
