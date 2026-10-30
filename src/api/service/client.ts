import { http } from "@/utils/http";
import type { AxiosRequestConfig } from "axios";
import {
  ApiRequestError,
  isHttpErrorPayload,
  isHttpSuccessPayload
} from "@/utils/http/error";
import type { DownloadedFile } from "./types";

export const API_PREFIX = "/api/v1";

function useMockBackend(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_API_MOCK === "true";
}

type RequestMethod = "get" | "post" | "put" | "patch" | "delete";

export interface ApiRequestOptions {
  params?: object;
  data?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

function toAxiosConfig(options: ApiRequestOptions): AxiosRequestConfig {
  const config: AxiosRequestConfig = {};
  if (options.params) config.params = options.params;
  if (options.data !== undefined) config.data = options.data;
  if (options.headers) config.headers = options.headers;
  if (options.timeout !== undefined) config.timeout = options.timeout;
  return config;
}

/**
 * 拆掉 `{ success, data }` 外壳。
 *
 * HTTP 层已经会把业务错误转成 `ApiRequestError`，这里再兜底一次，
 * 便于直接把 API 函数返回类型声明成资源类型。
 */
function unwrap<T>(body: unknown): T {
  if (isHttpErrorPayload(body)) {
    throw new ApiRequestError(body.error.code, body.error.message, {
      details: body.error.details,
      traceId: body.traceId
    });
  }
  if (isHttpSuccessPayload(body)) {
    return body.data as T;
  }
  return body as T;
}

/** 调用业务接口，返回 `data` 本体 */
export async function apiRequest<T>(
  method: RequestMethod,
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  if (useMockBackend()) {
    const { mockApiRequest } = await import("./mock");
    return mockApiRequest<T>(method, url, options);
  }
  const body = await http.request<unknown>(
    method,
    API_PREFIX + url,
    toAxiosConfig(options)
  );
  return unwrap<T>(body);
}

function parseFilename(
  contentDisposition: string | undefined
): string | undefined {
  if (!contentDisposition) return undefined;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      return encoded[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return plain?.[1]?.trim();
}

/** 下载文件；文件名优先取 `Content-Disposition` */
export async function apiDownload(
  url: string,
  params?: object
): Promise<DownloadedFile> {
  if (useMockBackend()) {
    const { mockApiDownload } = await import("./mock");
    return mockApiDownload(url, (params ?? {}) as Record<string, unknown>);
  }
  let filename: string | undefined;
  const blob = await http.request<Blob>(
    "get",
    API_PREFIX + url,
    { params, responseType: "blob" },
    {
      beforeResponseCallback(response) {
        const header = response.headers?.["content-disposition"];
        filename = parseFilename(
          typeof header === "string" ? header : undefined
        );
      }
    }
  );
  return { blob, filename };
}

/** 上传 CSV 等单文件表单 */
export async function apiUpload<T>(
  url: string,
  file: File | Blob,
  fields: Record<string, string> = {}
): Promise<T> {
  if (useMockBackend()) {
    const { mockApiUpload } = await import("./mock");
    return mockApiUpload<T>(url, file);
  }
  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  const body = await http.request<unknown>("post", API_PREFIX + url, {
    data: form
  });
  return unwrap<T>(body);
}

/** 删除请求必须带 `If-Match: "<revision>"` */
export function ifMatch(revision: number): Record<string, string> {
  return { "If-Match": `"${revision}"` };
}
