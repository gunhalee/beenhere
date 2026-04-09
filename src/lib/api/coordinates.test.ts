import { describe, expect, it } from "vitest";
import { API_ERROR_CODE } from "./common-errors";
import { parseCoordinatesFromSearchParams } from "./coordinates";

const BASE_OPTIONS = {
  latitudeKeys: ["latitude"],
  longitudeKeys: ["longitude"],
  invalidMessage: "invalid",
  outOfRangeMessage: "out-of-range",
};

describe("coordinates parser", () => {
  it("parses required coordinates when both values are valid", () => {
    const searchParams = new URLSearchParams({
      latitude: "37.55",
      longitude: "127.02",
    });

    const result = parseCoordinatesFromSearchParams(searchParams, BASE_OPTIONS);
    expect(result).toEqual({
      ok: true,
      data: { latitude: 37.55, longitude: 127.02 },
    });
  });

  it("returns null for optional parser when no coordinates are provided", () => {
    const result = parseCoordinatesFromSearchParams(
      new URLSearchParams(),
      { ...BASE_OPTIONS, required: false },
    );

    expect(result).toEqual({
      ok: true,
      data: null,
    });
  });

  it("returns invalid-location error for optional parser when only one coordinate exists", () => {
    const result = parseCoordinatesFromSearchParams(
      new URLSearchParams({ latitude: "37.55" }),
      { ...BASE_OPTIONS, required: false },
    );

    expect(result).toEqual({
      ok: false,
      message: "invalid",
      code: API_ERROR_CODE.INVALID_LOCATION,
    });
  });

  it("returns parsed coordinates for optional parser when both values are valid", () => {
    const result = parseCoordinatesFromSearchParams(
      new URLSearchParams({ latitude: "37.55", longitude: "127.02" }),
      { ...BASE_OPTIONS, required: false },
    );

    expect(result).toEqual({
      ok: true,
      data: { latitude: 37.55, longitude: 127.02 },
    });
  });

  it("returns out-of-range error when latitude or longitude exceeds limits", () => {
    const result = parseCoordinatesFromSearchParams(
      new URLSearchParams({ latitude: "91", longitude: "127.02" }),
      { ...BASE_OPTIONS, required: false },
    );

    expect(result).toEqual({
      ok: false,
      message: "out-of-range",
      code: API_ERROR_CODE.INVALID_LOCATION,
    });
  });
});
