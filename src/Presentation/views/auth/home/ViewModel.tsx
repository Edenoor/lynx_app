import { useContext, useState } from "react";
import { UserContext } from "../../../context/UserContext";
import { LoginAuthUseCase } from "../../../../Domain/useCases/auth/LoginAuth";
import { User } from "../../../../Domain/entities/User";
import {
  ApiDelivery,
  setAuthToken,
} from "../../../../Data/sources/remote/api/ApiDelivery";

type LoginResult = {
  ok: boolean;
  rol?: string;
  message?: string;
};

const buildFullName = (firstName?: string, lastName?: string, fallback?: string) => {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || fallback || "";
};

const HomeViewModel = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const [values, setValues] = useState({
    username: "",
    password: "",
  });

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

  const login = async (): Promise<LoginResult> => {
    if (!isValidForm()) {
      return {
        ok: false,
        message: "Completá usuario y contraseña",
      };
    }

    try {
      const response: any = await LoginAuthUseCase(
        values.username.trim(),
        values.password
      );

      console.log("LOGIN RESPONSE:", JSON.stringify(response));

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

      setAuthToken(token);

      let currentUser: any = null;

      try {
        const currentUserResponse = await ApiDelivery.get(`/v2/users/${authUser.id}`);
        currentUser = currentUserResponse?.data?.user ?? null;

        console.log("CURRENT USER RESPONSE:", JSON.stringify(currentUserResponse.data));
      } catch (error: any) {
        console.log(
          "CURRENT USER ERROR:",
          JSON.stringify(error?.response?.data ?? error?.message)
        );
      }

      const rawUser = currentUser ?? authUser;

      const rol =
        typeof rawUser?.rol === "string"
          ? rawUser.rol.toUpperCase()
          : typeof authUser?.rol === "string"
          ? authUser.rol.toUpperCase()
          : "SELLER";

      const firstName = rawUser?.first_name ?? "";
      const lastName = rawUser?.last_name ?? "";
      const fullName = buildFullName(
        firstName,
        lastName,
        rawUser?.name ?? rawUser?.fullName ?? rawUser?.username ?? values.username.trim()
      );

      const userToSave: User = {
        id: String(rawUser?.id ?? authUser.id ?? ""),
        username: rawUser?.username ?? authUser?.username ?? values.username.trim(),
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        email: rawUser?.email ?? "",
        phone: rawUser?.phone ?? "",
        rol,
        token,
        legacyDriverName: buildFullName(firstName, lastName),
      };

      await saveUserSession(userToSave);

      return {
        ok: true,
        rol,
      };
    } catch (error: any) {
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

  return {
    values,
    ...values,
    user,
    onChange,
    login,
    errorMessage,
    clearError,
    removeUserSession,
  };
};

export default HomeViewModel;