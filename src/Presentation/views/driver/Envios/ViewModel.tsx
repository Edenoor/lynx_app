import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../../context/UserContext';
import { postJson } from '../../../config/Api';

const useEnviosViewModel = () => {
  const { user } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [totales, setTotales] = useState<any | null>(null);
  const [discount, setDiscount] = useState<any | null>(null); // compat
  const [error, setError] = useState<string>('');

  // Igual que en Client: el backend matchea por 'username'
  // En tu app, para Client usás name; mantenemos el mismo criterio
  const username =
    (user as any)?.username ||
    user?.email ||
    user?.name ||
    '';

  const load = async () => {
    setError('');
    if (!username) {
      setError('No hay username en sesión');
      setList([]); setTotales(null); setDiscount(null);
      return;
    }

    setLoading(true);
    try {
      // 🔁 Driver pega a /driver/me
      const r = await postJson('/driver/me', { username });
      const ok = r?.ok === true || r?.success === true || r?.status === 'ok';
      if (!ok) throw new Error(r?.message || 'No se pudo obtener envíos');

      // la lista puede venir en result o data (como en Client)
      setList(r?.result ?? r?.data ?? []);
      setTotales(r?.totales ?? null);
      setDiscount(r?.discount ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando envíos');
      setList([]); setTotales(null); setDiscount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [username]);

  return { loading, list, totales, discount, error, reload: load, username };
};

export default useEnviosViewModel;
