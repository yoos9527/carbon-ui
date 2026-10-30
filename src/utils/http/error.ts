/** 后端统一错误结构中的字段错误 */
export interface HttpFieldError {
  field?: string;
  line?: number;
  message: string;
}

/** 后端统一错误结构 */
export interface HttpErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
    details?: HttpFieldError[] | Record<string, unknown>;
  };
  traceId?: string;
}

/** 供页面和 API 层统一消费的请求错误 */
export class ApiRequestError extends Error {
  /** 稳定业务错误码，如 `PARSER_IN_USE` */
  readonly code: string;

  /** 字段级错误或补充信息 */
  readonly details?: HttpFieldError[] | Record<string, unknown>;

  /** 服务端链路 ID */
  readonly traceId?: string;

  /** HTTP 状态码；网络错误时为 0 */
  readonly status: number;

  /** 原始异常，便于上报和调试 */
  readonly cause?: unknown;

  constructor(
    code: string,
    message: string,
    options: {
      details?: HttpFieldError[] | Record<string, unknown>;
      traceId?: string;
      status?: number;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.details = options.details;
    this.traceId = options.traceId;
    this.status = options.status ?? 0;
    this.cause = options.cause;
  }
}

/** 判断响应体是否为后端统一错误结构 */
export function isHttpErrorPayload(value: unknown): value is HttpErrorPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<HttpErrorPayload>;
  return (
    payload.success === false &&
    !!payload.error &&
    typeof payload.error.code === "string" &&
    typeof payload.error.message === "string"
  );
}

/** 判断响应体是否为后端统一成功结构 */
export function isHttpSuccessPayload(
  value: unknown
): value is { success: true; data: unknown } {
  if (!value || typeof value !== "object") return false;
  return (value as { success?: unknown }).success === true;
}
