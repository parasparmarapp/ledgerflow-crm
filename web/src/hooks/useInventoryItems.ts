import type { InventoryItem, CreateInventoryItemInput, UpdateInventoryItemInput } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const PATH = '/inventory';

export function useInventoryItems() {
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<InventoryItem[] | InventoryItem>(PATH);
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
      const msg = err?.message || 'Failed to fetch inventoryitems';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (input: CreateInventoryItemInput): Promise<InventoryItem> => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.post<InventoryItem>(PATH, input);
      setData((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create inventoryitem';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };
  const update = async (id: number, input: UpdateInventoryItemInput): Promise<InventoryItem> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<InventoryItem>(PATH + '/' + encodeURIComponent(String(id)), input);
      setData((prev) => prev.map((x) => (x.id === id ? updated : x)));
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update inventoryitem';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const getItem = async (id: number): Promise<InventoryItem> => {
    return await api.get<InventoryItem>(PATH + '/' + encodeURIComponent(String(id)));
  };

  const adjustStock = async (id: number, input: { quantityChange: number; reason: string; notes?: string }): Promise<any> => {
    return await api.post(PATH + '/' + encodeURIComponent(String(id)) + '/adjust', input);
  };

  return {
    data,
    inventoryitems: data,
    loading,
    error,
    refresh,
    fetchInventoryItems: refresh,
    create,
    createInventoryItem: create,
    addInventoryItem: create,
    update,
    updateInventoryItem: update,
    getItem,
    adjustStock,
  };
}

export const useInventoryItem = useInventoryItems;
export default useInventoryItems;