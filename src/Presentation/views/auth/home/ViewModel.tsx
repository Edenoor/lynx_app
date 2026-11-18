import { useContext, useState } from "react";
import { UserContext } from "../../../context/UserContext";
import { LoginAuthUseCase } from "../../../../Domain/useCases/auth/LoginAuth";
import { GetAdminCapabilitiesUseCase } from "../../../../Domain/useCases/auth/GetAdminCapabilities";
import { User } from "../../../../Domain/entities/User";
import {
  ApiDelivery,
  setAuthToken,
} from "../../../../Data/sources/remote/api/ApiDelivery";

import { passwordProblem } from "../../../utils/passwordPolicy";

type LoginResult = {
  ok: boolean;
  rol?: string;
  message?: string;
};

// Entró con la clave temporal de un reseteo: el servidor no le deja hacer
// nada más que definir la propia, así que la sesión todavía no se guarda.
type PendingPasswordChange = {
  userId: string;
  token: string;
  temporary: string;
};

const buildFullName = (
  firstName?: string,
  lastName?: string,
  fallback?: string,
) => {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || fallback || "";
};

const normalizeRole = (value?: string | null) => {
  if (!value) return "SELLER";
  return value.toUpperCase();
};

const HomeViewModel = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const [values, setValues] = useState({
    username: "",
    password: "",
  });

  const [pendingChange, setPendingChange] = useState<PendingPasswordChange | null>(null);

  const { user, saveUserSession, removeUserSession } = useContext(UserContext);

  const onChange = (property: string, value: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [property]: value,
    }));

    if (errorMessage) {
      setErrorMessage("");
    }
  };

  const isValidForm = (): boolean => {
    if (!values.username.trim()) {
      setErrorMessage("Ingresa el usuario");
      return false;
    }

    if (!values.password.trim()) {
      setErrorMessage("Ingresa la contraseña");
      return false;
    }

    return true;
  };

  const clearError = () => setErrorMessage("");

  // `passwordOverride`: recién definida la contraseña propia se entra con
  // ella sin esperar a que el estado del formulario se actualice.
  const login = async (passwordOverride?: string): Promise<LoginResult> => {
    const password = passwordOverride ?? values.password;

    if (passwordOverride === undefined && !isValidForm()) {
      return {
        ok: false,
        message: "Completá usuario y contraseña",
      };
    }

    try {
      const response: any = await LoginAuthUseCase(
        values.username.trim(),
        password,
      );

      // Sin loguear la respuesta: trae el token, y los logs quedan en logcat
      // también en release.
      const success = response?.ok === true;
      const token = response?.token;
      const authUser = response?.user;

      if (!success || !token || !authUser?.id) {
        const msg =
          response?.message ||
          response?.error ||
          "Usuario o contraseña incorrectos";

        setErrorMessage(msg);

        return {
          ok: false,
          message: msg,
        };
      }

      if (authUser.password_temporary === true) {
        setPendingChange({ userId: String(authUser.id), token, temporary: password });
        return { ok: false };
      }

      setAuthToken(token);

      let currentUser: any = null;

      try {
        const currentUserResponse = await ApiDelivery.get(
          `/v2/users/${authUser.id}`,
        );

        currentUser = currentUserResponse?.data?.user ?? null;
      } catch (error: any) {
        console.log(
          "CURRENT USER ERROR:",
          error?.response?.status ?? error?.message,
        );
      }

      const rawUser = currentUser ?? authUser;

      const rol = normalizeRole(rawUser?.rol ?? authUser?.rol);

      // El perfil y los permisos de un ADMIN no vienen en el token y deciden
      // a qué parte de la app entra: sin confirmarlos no se inicia sesión.
      let profile: string | null = null;
      let permissions: string[] | null = null;
      if (rol === "ADMIN") {
        try {
          const access = await GetAdminCapabilitiesUseCase();
          profile = access.profile ?? null;
          permissions = access.permissions ?? null;
        } catch {
          throw new Error("No se pudo verificar tu perfil. Revisá la conexión y volvé a intentar.");
        }
      }

      const firstName = rawUser?.first_name ?? "";
      const lastName = rawUser?.last_name ?? "";
      const fallbackName =
        rawUser?.name ??
        rawUser?.fullName ??
        rawUser?.username ??
        values.username.trim();

      const fullName = buildFullName(firstName, lastName, fallbackName);

      const userToSave: User = {
        id: String(rawUser?.id ?? authUser.id ?? ""),
        username: rawUser?.username ?? authUser?.username ?? values.username.trim(),
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        email: rawUser?.email ?? "",
        phone: rawUser?.phone ?? "",
        rol,
        profile,
        permissions,
        token,
        legacyDriverName: buildFullName(firstName, lastName),
      };

      await saveUserSession(userToSave);

      return {
        ok: true,
        rol,
      };
    } catch (error: any) {
      // El token se aplicó a axios antes de guardar la sesión: si el login no
      // terminó (por ejemplo, no se pudo guardar), no queda activo en memoria.
      setAuthToken(null);
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Error de autenticación";

      setErrorMessage(msg);

      return {
        ok: false,
        message: msg,
      };
    }
  };

  const cancelPasswordChange = () => setPendingChange(null);

  // Define la contraseña propia con la sesión de la clave temporal y entra.
  const changeTemporaryPassword = async (
    newPassword: string,
    confirmPassword: string,
  ): Promise<LoginResult> => {
    if (!pendingChange) return { ok: false };

    const fail = (message: string): LoginResult => {
      setErrorMessage(message);
      return { ok: false, message };
    };

    const problem = passwordProblem(newPassword);
    if (problem) return fail(problem);
    if (newPassword !== confirmPassword) return fail("Las contraseñas no coinciden");
    if (newPassword === pendingChange.temporary) {
      return fail("La contraseña nueva no puede ser la clave temporal");
    }

    try {
      await ApiDelivery.put(
        `/v2/users/${pendingChange.userId}/change-password`,
        { password: newPassword },
        { headers: { Authorization: `Bearer ${pendingChange.token}` } },
      );
    } catch (error: any) {
      return fail(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "No se pudo guardar la contraseña. Revisá la conexión y volvé a intentar.",
      );
    }

    // Cambiar la contraseña cierra la sesión de la clave temporal: se entra
    // de nuevo, ya con la propia.
    setPendingChange(null);
    setValues((current) => ({ ...current, password: newPassword }));
    return login(newPassword);
  };

  return {
    values,
    ...values,
    user,
    onChange,
    login,
    mustChangePassword: pendingChange !== null,
    changeTemporaryPassword,
    cancelPasswordChange,
    errorMessage,
    clearError,
    removeUserSession,
  };
};

export default HomeViewModel;