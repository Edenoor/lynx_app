import { useContext, useState } from "react";
import { UserContext } from "../../../context/UserContext";
import { LoginAuthUseCase } from "../../../../Domain/useCases/auth/LoginAuth";

const HomeViewModel = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const [values, setValues] = useState({ username: "", password: "" });

  const { user, saveUserSession, removeUserSession } = useContext(UserContext);
  console.log("USUARIO DE SESION: " + JSON.stringify(user));

  const onChange = (property: string, value: any) => {
    setValues((v) => ({ ...v, [property]: value }));
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

  const login = async (): Promise<{ ok: boolean; rol?: string; message?: string }> => {
    if (!isValidForm()) return { ok: false, message: errorMessage };

    try {
      const resp = await LoginAuthUseCase(values.username, values.password);

      let r: any = resp;
      if (r && typeof r.json === "function") {
        try { r = await r.json(); } catch {}
      }

      console.log("RESPONSE NORMALIZADA:", JSON.stringify(r));

      const httpOk =
        typeof r?.status === "number" ? r.status >= 200 && r.status < 300 : false;
      const reportedOk = r?.ok === true || r?.success === true || r?.status === "ok";
      const success = httpOk || reportedOk;

      if (!success) {
        const msg = r?.message || r?.error || "Error de autenticación";
        setErrorMessage(msg);
        return { ok: false, message: msg };
      }

      const payload = r?.data ?? r?.result ?? r;
      const rawUser = payload?.user ?? payload?.usuario ?? payload?.data ?? payload;

      const rawRole = rawUser?.rol ?? rawUser?.role ?? payload?.rol ?? payload?.role;
      const rol = typeof rawRole === "string" ? rawRole.toUpperCase() : "SELLER";

      const userToSave: any = {
        id: String(rawUser?.id ?? rawUser?._id ?? ""),
        name: rawUser?.name ?? rawUser?.fullName ?? rawUser?.username ?? "",
        email: rawUser?.email ?? rawUser?.mail ?? "",
        password: "",
        confirmPassword: "",
        rol,
        username: values.username, // 👈 lo guardamos para /client/me
      };

      await saveUserSession(userToSave as any);
      return { ok: true, rol: userToSave.rol };
    } catch (e: any) {
      const msg = e?.message ?? "Error de autenticación";
      setErrorMessage(msg);
      return { ok: false, message: msg };
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
