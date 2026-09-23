import type { Alert, CreateAlertInput, UpdateAlertInput } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const PATH = '/alerts';

export function useAlerts() {
  const [data, setData] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Alert[] | Alert>(PATH);
      // A singleton endpoint (cart, profile, settings) answers with the record itself rather than a
      // list. Dropping it left every screen bound to this hook permanently empty, so the object is
      // wrapped: screens written against data[0] and against data.map(...) both keep working.
      if (Array.isArray(response)) {
        setData(response);
      } else if (response && typeof response === 'object') {
        setData([response]);
      } else {
        setData([]);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch alerts';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = async (id: number, input: UpdateAlertInput): Promise<Alert> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<Alert>(PATH + '/' + encodeURIComponent(String(id)), input);
      setData((prev) => prev.map((x) => (x.id === id ? updated : x)));
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update alert';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    alerts: data,
    loading,
    error,
    refresh,
    fetchAlerts: refresh,
    update,
    updateAlert: update,
  };
}

export const useAlert = useAlerts;
export default useAlerts;