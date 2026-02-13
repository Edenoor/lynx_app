// src/Presentation/views/client/Envios/ViewModel.tsx
import { useContext, useEffect, useState } from "react";
import { UserContext } from "../../../context/UserContext";
import { postJson } from "../../../config/Api";

const useEnviosViewModel = () => {
  const { user } = useContext(UserContext);

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [totales, setTotales] = useState<any>(null);
  const [discount, setDiscount] = useState<any>(null);
  const [error, setError] = useState("");

  // backend matchea por username
  const username = (user as any)?.username || user?.email || user?.name || "";

  const load = async () => {
    setError("");

    if (!username) {
      setError("No hay username en sesión");
      setList([]);
      setTotales(null);
      setDiscount(null);
      return;
    }

    setLoading(true);
    try {
      // ✅ FIX: tu server lo sirve bajo /v1/data
      const r = await postJson("/v1/data/client/me", { username });

      const ok =
        r?.ok === true || r?.success === true || r?.status === "ok" || r?.statusCode === 200;

      if (!ok) throw new Error(r?.message || r?.error || "No se pudo obtener envíos");

      setList(r?.result ?? r?.data ?? []);
      setTotales(r?.totales ?? null);
      setDiscount(r?.discount ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando envíos");
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
  }, [username]);

  return { loading, list, totales, discount, error, reload: load, username };
};

export default useEnviosViewModel;
