import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../../context/UserContext';
import { ApiDelivery } from '../../../../Data/sources/remote/api/ApiDelivery';

export const useDriverData = () => {
  const { user } = useContext(UserContext);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!user?.email) return;
      setLoading(true);
      try {
        const r = await ApiDelivery.post('/driver/me', { username: user.email });
        setData(r.data);                 // { status, result, totales, discount }
      } catch (e:any) {
        setErr(e?.response?.data?.error || 'Error');
      } finally { setLoading(false); }
    })();
  }, [user?.email]);

  return { data, loading, err };
};
