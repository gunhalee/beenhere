import { API_ERROR_CODE } from "./common-errors";

export type CoordinateValidationResult =
  | {
      ok: true;
      data: {
        latitude: number;
        longitude: number;
      };
    }
  | {
      ok: false;
      message: string;
      code: typeof API_ERROR_CODE.INVALID_LOCATION;
    };

type ParseCoordinatesOptions = {
  latitudeKeys: string[];
  longitudeKeys: string[];
  invalidMessage: string;
  outOfRangeMessage: string;
};

function pickParamValue(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value !== null) return value;
  }
  return null;
}

export function parseCoordinatesFromSearchParams(
  searchParams: URLSearchParams,
  options: ParseCoordinatesOptions,
): CoordinateValidationResult {
  const latitudeRaw = pickParamValue(searchParams, options.latitudeKeys) ?? "";
  const longitudeRaw = pickParamValue(searchParams, options.longitudeKeys) ?? "";

  const latitude = parseFloat(latitudeRaw);
  const longitude = parseFloat(longitudeRaw);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      ok: false,
      message: options.invalidMessage,
      code: API_ERROR_CODE.INVALID_LOCATION,
    };
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return {
      ok: false,
      message: options.outOfRangeMessage,
      code: API_ERROR_CODE.INVALID_LOCATION,
    };
  }

  return {
    ok: true,
    data: {
      latitude,
      longitude,
    },
  };
}
