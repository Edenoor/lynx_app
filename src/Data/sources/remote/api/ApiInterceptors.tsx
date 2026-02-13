// src/Data/sources/remote/api/ApiInterceptors.tsx
import type { AxiosInstance, AxiosError } from "axios";

// Redacta campos sensibles en logs
function safeJson(obj: unknown) {
  try {
    const text = JSON.stringify(obj);
    return text
      .replace(/"password"\s*:\s*".*?"/gi, `"password":"***"`)
      .replace(/"token"\s*:\s*".*?"/gi, `"token":"***"`);
  } catch {
    return String(obj);
  }
}

export function attachInterceptors(api: AxiosInstance) {
  api.interceptors.request.use(
    (config) => {
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      // ✅ Runtime-safe: Axios v1 a veces trae headers como objeto, a veces como AxiosHeaders con .set()
      const headersAny = (config.headers ?? {}) as any;

      if (typeof headersAny.set === "function") {
        headersAny.set("X-Request-Id", requestId);
        headersAny.set("X-Client", "lynx_app");
        config.headers = headersAny;
      } else {
        config.headers = {
          ...(headersAny ?? {}),
          "X-Request-Id": requestId,
          "X-Client": "lynx_app",
        } as any;
      }

      if (__DEV__) {
        console.log(
          "[API][REQ]",
          config.method?.toUpperCase(),
          config.baseURL ? `${config.baseURL}${config.url}` : config.url,
          "headers:",
          safeJson((config.headers as any) ?? {}),
          "data:",
          safeJson(config.data)
        );
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  api.interceptors.response.use(
    (response) => {
      if (__DEV__) {
        console.log(
          "[API][RES]",
          response.status,
          response.config?.url,
          "data:",
          safeJson(response.data)
        );
      }
      return response;
    },
    (error: AxiosError<any>) => {
      const status = error.response?.status;
      const data = error.response?.data;

      const message =
        (data && (data.message || data.error)) ||
        error.message ||
        "Error de red";

      if (__DEV__) {
        console.log(
          "[API][ERR]",
          "status:",
          status,
          "url:",
          error.config?.url,
          "message:",
          message,
          "data:",
          safeJson(data)
        );
      }

      return Promise.reject(error);
    }
  );
}
