import type { Expense, CreateExpenseInput, UpdateExpenseInput } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const PATH = '/expenses';

export function useExpenses() {
  const [data, setData] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (params?: { from?: string; to?: string; search?: string; category?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Expense[] | Expense>(PATH, { params });
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
      const msg = err?.message || 'Failed to fetch expenses';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (input: CreateExpenseInput): Promise<Expense> => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.post<Expense>(PATH, input);
      setData((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create expense';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };
  const update = async (id: number, input: UpdateExpenseInput): Promise<Expense> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<Expense>(PATH + '/' + encodeURIComponent(String(id)), input);
      setData((prev) => prev.map((x) => (x.id === id ? updated : x)));
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update expense';
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
      const msg = err?.message || 'Failed to delete expense';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    expenses: data,
    loading,
    error,
    refresh,
    fetchExpenses: refresh,
    create,
    createExpense: create,
    addExpense: create,
    update,
    updateExpense: update,
    remove,
    deleteExpense: remove,
    removeExpense: remove,
  };
}

export const useExpense = useExpenses;
export default useExpenses;