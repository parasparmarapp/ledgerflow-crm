import type { Client, CreateClientInput, UpdateClientInput } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const PATH = '/clients';

export function useClients() {
  const [data, setData] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (params?: { search?: string; active?: string; tag?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Client[] | Client>(PATH, { params });
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
      const msg = err?.message || 'Failed to fetch clients';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (input: CreateClientInput): Promise<Client> => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.post<Client>(PATH, input);
      setData((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create client';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };
  const update = async (id: number, input: UpdateClientInput): Promise<Client> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<Client>(PATH + '/' + encodeURIComponent(String(id)), input);
      setData((prev) => prev.map((x) => (x.id === id ? updated : x)));
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update client';
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
      const msg = err?.message || 'Failed to delete client';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    clients: data,
    loading,
    error,
    refresh,
    fetchClients: refresh,
    create,
    createClient: create,
    addClient: create,
    update,
    updateClient: update,
    remove,
    deleteClient: remove,
    removeClient: remove,
  };
}

export const useClient = useClients;
export default useClients;