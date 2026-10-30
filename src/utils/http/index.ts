import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CustomParamsSerializer,
  type InternalAxiosRequestConfig
} from "axios";
import type {
  PureHttpError,
  RequestMethods,
  PureHttpResponse,
  PureHttpRequestConfig
} from "./types.d";
import { stringify } from "qs";
import { getToken, formatToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";
import { ApiRequestError, isHttpErrorPayload } from "./error";

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1
const defaultConfig: AxiosRequestConfig = {
  // 请求超时时间
  timeout: 10000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  // 数组格式参数序列化（https://github.com/axios/axios/issues/5142）
  paramsSerializer: {
    serialize: stringify as unknown as CustomParamsSerializer
  }
};

/** 登录、刷新等无需携带 Token 的接口，避免刷新时死循环 */
const AUTH_FREE_URLS = [
  "/login",
  "/auth/login",
  "/refresh-token",
  "/auth/refresh"
];

type RetryRequestConfig = InternalAxiosRequestConfig & {
  /** 防止 401 重试无限循环 */
  _retry?: boolean;
};

function isAuthFreeUrl(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_FREE_URLS.some(path => url.endsWith(path));
}

function setAuthorization(config: PureHttpRequestConfig, token: string): void {
  config.headers = config.headers ?? {};
  config.headers["Authorization"] = formatToken(token);
}

function clearContentTypeForFormData(config: PureHttpRequestConfig): void {
  if (typeof FormData === "undefined" || !(config.data instanceof FormData)) {
    return;
  }
  const headers = config.headers as
    | (Record<string, unknown> & { setContentType?: (value: null) => void })
    | undefined;
  if (typeof headers?.setContentType === "function") {
    headers.setContentType(null);
  } else if (headers) {
    delete headers["Content-Type"];
    delete headers["content-type"];
  }
}

function toApiError(error: PureHttpError): ApiRequestError {
  const response = error.response;
  const status = response?.status ?? 0;
  const payload = response?.data;

  if (isHttpErrorPayload(payload)) {
    return new ApiRequestError(payload.error.code, payload.error.message, {
      details: payload.error.details,
      traceId: payload.traceId,
      status,
      cause: error
    });
  }

  let message = error.message || "请求失败";
  if (typeof payload === "string" && payload.trim()) {
    message = payload.trim();
  } else if (payload && typeof payload === "object") {
    const body = payload as { message?: unknown; error?: unknown };
    if (typeof body.message === "string") message = body.message;
  }
  if (status === 401) message = "登录状态已失效，请重新登录";
  if (status === 403) message = "没有权限执行该操作";
  if (status === 0) message = error.message || "网络异常，请稍后重试";

  return new ApiRequestError(
    status ? `HTTP_${status}` : "NETWORK_ERROR",
    message,
    {
      status,
      cause: error
    }
  );
}

class PureHttp {
  /** 防止重复刷新 `token`；并发请求共享同一个 Promise */
  private static refreshPromise: Promise<string> | null = null;

  /** 初始化配置对象 */
  private static initConfig: PureHttpRequestConfig = {};

  /** 保存当前`Axios`实例对象 */
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  /** 刷新 Token 并返回新的 accessToken */
  private static refreshAccessToken(): Promise<string> {
    if (PureHttp.refreshPromise) return PureHttp.refreshPromise;

    const data = getToken();
    if (!data?.refreshToken) {
      useUserStoreHook().logOut();
      return Promise.reject(
        new ApiRequestError("NO_REFRESH_TOKEN", "登录状态已失效，请重新登录", {
          status: 401
        })
      );
    }

    PureHttp.refreshPromise = useUserStoreHook()
      .handRefreshToken({ refreshToken: data.refreshToken })
      .then(res => {
        const token = res?.data?.accessToken;
        if (!token) {
          throw new ApiRequestError(
            "REFRESH_TOKEN_FAILED",
            "登录状态已失效，请重新登录",
            { status: 401 }
          );
        }
        return token;
      })
      .catch(error => {
        useUserStoreHook().logOut();
        throw error;
      })
      .finally(() => {
        PureHttp.refreshPromise = null;
      });

    return PureHttp.refreshPromise;
  }

  /** 请求拦截 */
  private httpInterceptorsRequest(): void {
    PureHttp.axiosInstance.interceptors.request.use(
      async (config: PureHttpRequestConfig): Promise<any> => {
        clearContentTypeForFormData(config);

        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
          return config;
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(config);
          return config;
        }

        if (isAuthFreeUrl(config.url)) return config;

        const data = getToken();
        if (!data) return config;

        // 按本地过期时间提前刷新，避免必然失败的请求
        const now = new Date().getTime();
        const expiresAt = Number(data.expires);
        const expired = !Number.isFinite(expiresAt) || expiresAt - now <= 0;
        if (expired) {
          const token = await PureHttp.refreshAccessToken();
          setAuthorization(config, token);
          return config;
        }

        setAuthorization(config, data.accessToken);
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  private httpInterceptorsResponse(): void {
    const instance = PureHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: PureHttpResponse) => {
        const $config = response.config;

        // 业务错误即使 HTTP 200 也要按失败处理
        if (isHttpErrorPayload(response.data)) {
          return Promise.reject(
            new ApiRequestError(
              response.data.error.code,
              response.data.error.message,
              {
                details: response.data.error.details,
                traceId: response.data.traceId,
                status: response.status
              }
            )
          );
        }

        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof $config.beforeResponseCallback === "function") {
          $config.beforeResponseCallback(response);
          return response.data;
        }
        if (PureHttp.initConfig.beforeResponseCallback) {
          PureHttp.initConfig.beforeResponseCallback(response);
          return response.data;
        }
        return response.data;
      },
      async (error: PureHttpError) => {
        const $error = error;
        $error.isCancelRequest = Axios.isCancel($error);

        // 取消请求原样抛出，页面可据此忽略
        if ($error.isCancelRequest) return Promise.reject($error);

        const config = $error.config as RetryRequestConfig | undefined;
        const status = $error.response?.status;

        // 本地过期时间不准或服务端撤销 Token 时，刷新后重放一次
        if (
          status === 401 &&
          config &&
          !config._retry &&
          !isAuthFreeUrl(config.url)
        ) {
          config._retry = true;
          try {
            const token = await PureHttp.refreshAccessToken();
            setAuthorization(config, token);
            return PureHttp.axiosInstance.request(config);
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(toApiError($error));
      }
    );
  }

  /** 通用请求工具函数 */
  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: PureHttpRequestConfig
  ): Promise<T> {
    const config = {
      method,
      url,
      ...param,
      ...axiosConfig
    } as PureHttpRequestConfig;

    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      PureHttp.axiosInstance
        .request(config)
        .then((response: undefined) => {
          resolve(response);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /** 单独抽离的`post`工具函数 */
  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  /** 单独抽离的`get`工具函数 */
  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }
}

export const http = new PureHttp();
