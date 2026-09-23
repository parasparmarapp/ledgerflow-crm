import type { StockMovement, CreateStockMovementInput, UpdateStockMovementInput } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const PATH = '/stock-movements';

export function useStockMovements() {
  const [data, setData] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (params?: { from?: string; to?: string; search?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<StockMovement[] | StockMovement>(PATH, { params });
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
      const msg = err?.message || 'Failed to fetch stockmovements';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);


  return {
    data,
    stockmovements: data,
    loading,
    error,
    refresh,
    fetchStockMovements: refresh,
  };
}

export const useStockMovement = useStockMovements;
export default useStockMovements;