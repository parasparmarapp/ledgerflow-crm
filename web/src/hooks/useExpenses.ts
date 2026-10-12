import type { Expense, CreateExpenseInput, UpdateExpenseInput, ExpenseCategory, ExpenseCategoryItem } from '../types';
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

  const fetchCategories = useCallback(async (): Promise<ExpenseCategory[]> => {
    try {
      const res = await api.get<ExpenseCategory[]>(`${PATH}/categories`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }, []);

  const fetchItems = useCallback(async (category?: string, categoryId?: number): Promise<ExpenseCategoryItem[]> => {
    try {
      const params: Record<string, any> = {};
      if (categoryId) params.categoryId = categoryId;
      else if (category) params.category = category;
      const res = await api.get<ExpenseCategoryItem[]>(`${PATH}/items`, { params });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }, []);

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
    fetchCategories,
    fetchItems,
  };
}

export function useExpenseCategories() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ExpenseCategory[]>(`${PATH}/categories`);
      const cats = Array.isArray(data) ? data : [];
      setCategories(cats);
      return cats;
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch expense categories';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchItems = useCallback(async (category?: string, categoryId?: number) => {
    try {
      const params: Record<string, any> = {};
      if (categoryId) params.categoryId = categoryId;
      else if (category && category !== 'All' && category !== 'All categories') params.category = category;
      const data = await api.get<ExpenseCategoryItem[]>(`${PATH}/items`, { params });
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, error, refresh: fetchCategories, fetchCategories, fetchItems };
}

export const useExpense = useExpenses;
export default useExpenses;