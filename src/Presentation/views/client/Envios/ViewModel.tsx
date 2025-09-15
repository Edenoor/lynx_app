import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../../context/UserContext';
import { postJson } from '../../../config/Api';

const useEnviosViewModel = () => {
  const { user } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [totales, setTotales] = useState<any | null>(null);
  const [discount, setDiscount] = useState<any | null>(null);
  const [error, setError] = useState<string>("");

  // el backend matchea por 'username' (guardado en sesión en el login)
  const username =
    (user as any)?.username ||
    user?.email ||
    user?.name ||
    "";

  const load = async () => {
    setError("");
    if (!username) {
      setError("No hay username en sesión");
      setList([]); setTotales(null); setDiscount(null);
      return;
    }

    setLoading(true);
    try {
      const r = await postJson("/client/me", { username });
      const ok = r?.ok === true || r?.success === true || r?.status === "ok";
      if (!ok) throw new Error(r?.message || "No se pudo obtener envíos");

      setList(r?.result ?? r?.data ?? []);
      setTotales(r?.totales ?? null);
      setDiscount(r?.discount ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando envíos");
      setList([]); setTotales(null); setDiscount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [username]);

  return { loading, list, totales, discount, error, reload: load, username };
};

export default useEnviosViewModel;
