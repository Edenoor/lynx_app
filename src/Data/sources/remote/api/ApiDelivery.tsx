import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.wynflex.com.ar";

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
      `${config.method?.toUpperCase()} ${config.baseURL}${config.url}`
    );

    return config;
  },
  (error) => Promise.reject(error)
);

ApiDelivery.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("API ERROR:", {
      url: error?.config?.url,
      status: error?.response?.status,
      data: error?.response?.data,
    });

    return Promise.reject(error);
  }
);