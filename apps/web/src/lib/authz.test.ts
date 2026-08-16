import { describe, expect, it } from "vitest";
import { canAccessManagerArea, canAccessTechnicianArea } from "./authz";

describe("role isolation", () => {
  it("only the owner can access the Service Manager area", () => {
    expect(canAccessManagerArea("owner")).toBe(true);
    expect(canAccessManagerArea("technician")).toBe(false);
    expect(canAccessManagerArea(null)).toBe(false);
    expect(canAccessManagerArea(undefined)).toBe(false);
    expect(canAccessManagerArea("customer")).toBe(false);
  });

  it("technicians and the owner can access the technician area", () => {
    expect(canAccessTechnicianArea("owner")).toBe(true);
    expect(canAccessTechnicianArea("technician")).toBe(true);
    expect(canAccessTechnicianArea(null)).toBe(false);
    expect(canAccessTechnicianArea("anything-else")).toBe(false);
  });
});
