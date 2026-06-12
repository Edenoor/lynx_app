import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.wynflex.com.ar";

type UnauthorizedHandler = () => void | Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let isHandlingUnauthorized = false;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

const handleUnauthorized = async () => {
  if (isHandlingUnauthorized) return;

  isHandlingUnauthorized = true;

  try {
    await unauthorizedHandler?.();
  } finally {
    setTimeout(() => {
      isHandlingUnauthorized = false;
    }, 1000);
  }
};

export const ApiDelivery = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const setAuthToken = (token?: string | null) => {
  if (token) {
    ApiDelivery.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete ApiDelivery.defaults.headers.common.Authorization;
  }
};

ApiDelivery.interceptors.request.use(
  (config) => {
    console.log(
      "API REQUEST:",
      `${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
    );

    return config;
  },
  (error) => Promise.reject(error),
);

ApiDelivery.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url;

    console.log("API ERROR:", {
      url,
      status,
      data: error?.response?.data,
    });

    if (status === 401) {
      console.log("[Lynx Auth] Token expirado detectado en ApiDelivery");
      await handleUnauthorized();
    }

    return Promise.reject(error);
  },
);