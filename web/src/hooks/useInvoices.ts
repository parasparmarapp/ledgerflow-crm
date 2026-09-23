import type { Invoice, CreateInvoiceInput, UpdateInvoiceInput } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const PATH = '/invoices';

export function useInvoices() {
  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (params?: { from?: string; to?: string; search?: string; status?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Invoice[] | Invoice>(PATH, { params });
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
      const msg = err?.message || 'Failed to fetch invoices';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (input: CreateInvoiceInput): Promise<Invoice> => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.post<Invoice>(PATH, input);
      setData((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create invoice';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };
  const update = async (id: number, input: UpdateInvoiceInput): Promise<Invoice> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<Invoice>(PATH + '/' + encodeURIComponent(String(id)), input);
      setData((prev) => prev.map((x) => (x.id === id ? updated : x)));
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update invoice';
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
      const msg = err?.message || 'Failed to delete invoice';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const getInvoice = async (id: number): Promise<Invoice> => {
    return await api.get<Invoice>(PATH + '/' + encodeURIComponent(String(id)));
  };

  const sendInvoice = async (id: number): Promise<Invoice> => {
    const updated = await api.post<Invoice>(PATH + '/' + encodeURIComponent(String(id)) + '/send', {});
    setData((prev) => prev.map((x) => (x.id === id ? updated : x)));
    return updated;
  };

  return {
    data,
    invoices: data,
    loading,
    error,
    refresh,
    fetchInvoices: refresh,
    create,
    createInvoice: create,
    addInvoice: create,
    update,
    updateInvoice: update,
    remove,
    deleteInvoice: remove,
    removeInvoice: remove,
    getInvoice,
    sendInvoice,
  };
}

export const useInvoice = useInvoices;
export default useInvoices;