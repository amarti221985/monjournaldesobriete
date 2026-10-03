import { describe, expect, it } from "vitest";

import { forCheckinDay } from "@/features/checkin/components/step-content";
import { canBackfillCheckin, getJourneyStartDate } from "@/features/checkin/logic";

describe("check-in d'une journée passée (ADR-098)", () => {
  it("début du parcours = date de début la plus ancienne", () => {
    expect(getJourneyStartDate([{ startedOn: "2026-09-10" }, { startedOn: "2026-08-01" }])).toBe("2026-08-01");
    expect(getJourneyStartDate([])).toBeNull();
  });

  it("possible du début du parcours à hier, jamais aujourd'hui, le futur ni avant le parcours", () => {
    const today = "2026-10-03";
    const start = "2026-09-20";
    expect(canBackfillCheckin("2026-10-02", today, start)).toBe(true);
    expect(canBackfillCheckin("2026-09-20", today, start)).toBe(true);
    expect(canBackfillCheckin("2026-09-19", today, start)).toBe(false);
    expect(canBackfillCheckin(today, today, start)).toBe(false);
    expect(canBackfillCheckin("2026-10-04", today, start)).toBe(false);
    expect(canBackfillCheckin("2026-10-02", today, null)).toBe(false);
  });

  it("formulations : « ce jour-là » et « le lendemain » pour une journée passée", () => {
    expect(forCheckinDay("Qu'as-tu ressenti aujourd'hui?", true)).toBe("Qu'as-tu ressenti ce jour-là?");
    expect(forCheckinDay("Quelle est ton intention pour demain?", true)).toBe("Quelle est ton intention pour le lendemain?");
    expect(forCheckinDay("Qu'as-tu ressenti aujourd'hui?", false)).toBe("Qu'as-tu ressenti aujourd'hui?");
  });
});
