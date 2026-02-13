// src/Data/sources/remote/api/ApiDelivery.tsx
import axios from "axios";
import { ENV } from "../../../../Config/env";
import { attachInterceptors } from "./ApiInterceptors";

export const ApiDelivery = axios.create({
  baseURL: ENV.API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

attachInterceptors(ApiDelivery);
