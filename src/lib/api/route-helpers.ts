import { API_ERROR_CODE } from "./common-errors";
import { readJsonBody } from "./request";
import { fail, ok } from "./response";
import type { ApiErrorDetails } from "@/types/api";
import { runWritePreflight } from "@/lib/auth/write-preflight";
import type {
  WritePreflightFailure,
  WritePreflightSuccess,
} from "@/lib/auth/write-preflight";

export function failFromPreflight(result: WritePreflightFailure) {
  return fail(result.message, result.status, result.code, result.details);
}

export function failValidation(
  message: string,
  code: string = API_ERROR_CODE.VALIDATION_ERROR,
) {
  return fail(message, 400, code);
}

export function failInternal(message: string) {
  return fail(message, 500, API_ERROR_CODE.INTERNAL_ERROR);
}

export function failWithStatus(input: {
  message: string;
  status?: number;
  code?: string;
  details?: ApiErrorDetails;
}) {
  return fail(input.message, input.status ?? 400, input.code, input.details);
}

export function parseOptionalInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type RouteFactorySuccess<T> = {
  ok: true;
  data: T;
  status?: number;
};

type RouteFactoryFailure = {
  ok: false;
  message: string;
  status?: number;
  code?: string;
  details?: ApiErrorDetails;
};

type RouteFactoryResult<T> = RouteFactorySuccess<T> | RouteFactoryFailure;

type BodyHandlerArgs<TBody, TContext> = {
  request: Request;
  context: TContext;
  body: TBody;
  preflight?: WritePreflightSuccess;
};

type ActionHandlerArgs<TContext> = {
  request: Request;
  context: TContext;
  preflight?: WritePreflightSuccess;
};

type ReadHandlerArgs<TParsed, TContext> = {
  request: Request;
  context: TContext;
  parsed: TParsed;
};

type ParseResult<TParsed> =
  | { ok: true; parsed: TParsed }
  | { ok: false; response: ReturnType<typeof fail> };

export function createBodyRouteHandler<TBody, TResponse, TContext = { params: Promise<Record<string, string>> }>(input: {
  validate?: (args: BodyHandlerArgs<TBody, TContext>) => ReturnType<typeof fail> | null;
  getPreflightOptions?: (args: BodyHandlerArgs<TBody, TContext>) => Parameters<
    typeof runWritePreflight
  >[0] | null;
  action: (args: BodyHandlerArgs<TBody, TContext>) => Promise<RouteFactoryResult<TResponse>>;
  onError: {
    logLabel: string;
    message: string;
  };
}) {
  return async (request: Request, context: TContext) => {
    const bodyResult = await readJsonBody<TBody>(request);
    if (!bodyResult.ok) return bodyResult.response;

    let preflight: WritePreflightSuccess | undefined;
    const args: BodyHandlerArgs<TBody, TContext> = {
      request,
      context,
      body: bodyResult.body,
    };

    const validationError = input.validate?.(args);
    if (validationError) return validationError;

    const preflightOptions = input.getPreflightOptions?.(args);
    if (preflightOptions) {
      const result = await runWritePreflight(preflightOptions);
      if (!result.ok) {
        return failFromPreflight(result);
      }
      preflight = result;
    }

    try {
      const result = await input.action({
        ...args,
        preflight,
      });
      if (!result.ok) {
        return failWithStatus({
          message: result.message,
          status: result.status,
          code: result.code,
          details: result.details,
        });
      }
      return ok(result.data, result.status ?? 200);
    } catch (error) {
      console.error(input.onError.logLabel, error);
      return failInternal(input.onError.message);
    }
  };
}

export function createActionRouteHandler<TResponse, TContext = { params: Promise<Record<string, string>> }>(input: {
  getPreflightOptions?: (args: ActionHandlerArgs<TContext>) => Parameters<
    typeof runWritePreflight
  >[0] | null;
  action: (args: ActionHandlerArgs<TContext>) => Promise<RouteFactoryResult<TResponse>>;
  onError: {
    logLabel: string;
    message: string;
  };
}) {
  return async (request: Request, context: TContext) => {
    let preflight: WritePreflightSuccess | undefined;
    const args: ActionHandlerArgs<TContext> = { request, context };

    const preflightOptions = input.getPreflightOptions?.(args);
    if (preflightOptions) {
      const result = await runWritePreflight(preflightOptions);
      if (!result.ok) {
        return failFromPreflight(result);
      }
      preflight = result;
    }

    try {
      const result = await input.action({
        ...args,
        preflight,
      });
      if (!result.ok) {
        return failWithStatus({
          message: result.message,
          status: result.status,
          code: result.code,
          details: result.details,
        });
      }
      return ok(result.data, result.status ?? 200);
    } catch (error) {
      console.error(input.onError.logLabel, error);
      return failInternal(input.onError.message);
    }
  };
}

export function createReadRouteHandler<
  TParsed,
  TResponse,
  TContext = { params: Promise<Record<string, string>> },
>(input: {
  parse: (request: Request, context: TContext) => Promise<ParseResult<TParsed>> | ParseResult<TParsed>;
  action: (args: ReadHandlerArgs<TParsed, TContext>) => Promise<RouteFactoryResult<TResponse>>;
  onError: {
    logLabel: string;
    message: string;
  };
}) {
  return async (request: Request, context: TContext) => {
    const parseResult = await input.parse(request, context);
    if (!parseResult.ok) {
      return parseResult.response;
    }

    try {
      const result = await input.action({
        request,
        context,
        parsed: parseResult.parsed,
      });
      if (!result.ok) {
        return failWithStatus({
          message: result.message,
          status: result.status,
          code: result.code,
          details: result.details,
        });
      }
      return ok(result.data, result.status ?? 200);
    } catch (error) {
      console.error(input.onError.logLabel, error);
      return failInternal(input.onError.message);
    }
  };
}
