import type { Payment, CreatePaymentInput, UpdatePaymentInput } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const PATH = '/payments';

export function usePayments() {
  const [data, setData] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (params?: { from?: string; to?: string; search?: string; status?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Payment[] | Payment>(PATH, { params });
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
      const msg = err?.message || 'Failed to fetch payments';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (input: CreatePaymentInput): Promise<Payment> => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.post<Payment>(PATH, input);
      setData((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create payment';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };
  const update = async (id: number, input: UpdatePaymentInput): Promise<Payment> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<Payment>(PATH + '/' + encodeURIComponent(String(id)), input);
      setData((prev) => prev.map((x) => (x.id === id ? updated : x)));
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update payment';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };
  const remove = async (id: number): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.del(PATH + '/' + encodeURIComponent(String(id)));
      setData((prev) => prev.filter((x) => x.id !== id));
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete payment';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const reconcile = async (paymentIds: number[]): Promise<any> => {
    return await api.post(PATH + '/reconcile', { paymentIds });
  };

  return {
    data,
    payments: data,
    loading,
    error,
    refresh,
    fetchPayments: refresh,
    create,
    createPayment: create,
    addPayment: create,
    update,
    updatePayment: update,
    remove,
    deletePayment: remove,
    removePayment: remove,
    reconcile,
  };
}

export const usePayment = usePayments;
export default usePayments;