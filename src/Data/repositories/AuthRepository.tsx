import { AxiosError } from "axios";
import { AdminCapabilities, AuthRepository } from "../../Domain/repositories/AuthRepository";
import { ResponseApiDelivery } from "../sources/remote/models/ResponseApiDelivery";
import { ApiDelivery } from "../sources/remote/api/ApiDelivery";
import { User } from "../../Domain/entities/User";

const CAPABILITIES_TIMEOUT_MS = 8_000;

export class AuthRepositoryImpl implements AuthRepository {
  async login(username: string, password: string): Promise<ResponseApiDelivery> {
    try {
      const response = await ApiDelivery.post<ResponseApiDelivery>("/v2/auth/login", {
        username,
        password,
      });

      return response.data;
    } catch (error) {
      const e = error as AxiosError<ResponseApiDelivery>;

      if (__DEV__) console.log("ERROR LOGIN:", JSON.stringify(e.response?.data));

      return (
        e.response?.data ?? {
          ok: false,
          error: "No se pudo iniciar sesión",
        }
      );
    }
  }

  async register(user: User): Promise<ResponseApiDelivery> {
    try {
      const response = await ApiDelivery.post<ResponseApiDelivery>("/users/register", user);
      return response.data;
    } catch (error) {
      const e = error as AxiosError<ResponseApiDelivery>;

      if (__DEV__) console.log("ERROR REGISTER:", JSON.stringify(e.response?.data));

      return (
        e.response?.data ?? {
          ok: false,
          error: "No se pudo registrar el usuario",
        }
      );
    }
  }

  async recovery(username: string): Promise<ResponseApiDelivery> {
    try {
      const response = await ApiDelivery.post<ResponseApiDelivery>("/users/recovery", {
        username,
      });

      return response.data;
    } catch (error) {
      const e = error as AxiosError<ResponseApiDelivery>;

      if (__DEV__) console.log("ERROR RECOVERY:", JSON.stringify(e.response?.data));

      return (
        e.response?.data ?? {
          ok: false,
          error: "No se pudo recuperar la cuenta",
        }
      );
    }
  }

  // Solo para ADMIN. Tira error si no hay respuesta: quien llama decide qué
  // hacer sin el perfil (el login no sigue; una sesión guardada usa el último).
  async capabilities(): Promise<AdminCapabilities> {
    const response = await ApiDelivery.get("/v2/auth/capabilities", {
      timeout: CAPABILITIES_TIMEOUT_MS,
    });
    return response.data?.capabilities ?? {};
  }
}