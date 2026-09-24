import { describe, expect, it } from "vitest";

import { isValidTimeZone } from "@/lib/timezone";

describe("isValidTimeZone", () => {
  it.each(["America/Toronto", "America/Vancouver", "Europe/Paris", "America/Argentina/Buenos_Aires", "UTC"])(
    "accepte l'identifiant IANA %s",
    (value) => {
      expect(isValidTimeZone(value)).toBe(true);
    },
  );

  it.each([
    ["décalage fixe", "UTC-4"],
    ["décalage numérique", "-04:00"],
    ["fuseau inconnu", "Mars/Olympus_Mons"],
    ["chaîne vide", ""],
    ["injection", "America/Toronto'; drop table profiles;--"],
    ["espace", "America/New York"],
    ["trop long", `Europe/${"a".repeat(80)}`],
  ])("refuse %s", (_label, value) => {
    expect(isValidTimeZone(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}])("refuse une valeur non textuelle (%s)", (value) => {
    expect(isValidTimeZone(value)).toBe(false);
  });
});
