// src/Presentation/views/driver/Envios/ViewModel.tsx

import { useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "../../../context/UserContext";
import { ApiDelivery } from "../../../../Data/sources/remote/api/ApiDelivery";

const buildLegacyDriverName = (sessionUser: any) => {
  const legacyDriverName = sessionUser?.legacyDriverName?.trim();

  if (legacyDriverName) {
    return legacyDriverName;
  }

  const fullName = [sessionUser?.first_name, sessionUser?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) {
    return fullName;
  }

  return sessionUser?.name?.trim() || "";
};

const normalizeLegacyDriverName = (value: string) => {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
};

const useEnviosViewModel = () => {
  const { user, getUserSession } = useContext(UserContext);

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [totales, setTotales] = useState<any>(null);
  const [discount, setDiscount] = useState<any>(null);
  const [error, setError] = useState("");

  const legacyDriverName = useMemo(() => {
    return buildLegacyDriverName(user);
  }, [user]);

  const load = async () => {
    setError("");

    let sessionUser = user;

    if (!sessionUser?.token || !buildLegacyDriverName(sessionUser)) {
      sessionUser = await getUserSession();
    }

    const driverName = buildLegacyDriverName(sessionUser);

    if (!driverName) {
      setError("No hay nombre de chofer en sesión");
      setList([]);
      setTotales(null);
      setDiscount(null);
      return;
    }

    if (!sessionUser?.token) {
      setError("Token no disponible en sesión");
      setList([]);
      setTotales(null);
      setDiscount(null);
      return;
    }

    const normalizedDriverName = normalizeLegacyDriverName(driverName);

    setLoading(true);

    try {


      const response = await ApiDelivery.post("/v1/data/driver/me", {
        // Legacy espera este campo, aunque realmente filtra por cadete.
        username: normalizedDriverName,
      });


      const r = response.data;

      const ok =
        r?.ok === true ||
        r?.success === true ||
        r?.status === "ok" ||
        r?.statusCode === 200;

      if (!ok) {
        throw new Error(
          r?.message || r?.error || "No se pudo obtener envíos"
        );
      }

      setList(r?.result ?? r?.data ?? []);
      setTotales(r?.totales ?? null);
      setDiscount(r?.discount ?? null);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Error cargando envíos";

      setError(message);
      setList([]);
      setTotales(null);
      setDiscount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyDriverName]);

  return {
    loading,
    list,
    totales,
    discount,
    error,
    reload: load,

    // Conservamos username para no romper componentes existentes,
    // pero ahora representa el nombre legacy del chofer.
    username: legacyDriverName,
    legacyDriverName,
  };
};

export default useEnviosViewModel;