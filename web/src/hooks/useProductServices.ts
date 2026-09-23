import type { ProductService, CreateProductServiceInput, UpdateProductServiceInput } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const PATH = '/products-services';

export function useProductServices() {
  const [data, setData] = useState<ProductService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ProductService[] | ProductService>(PATH);
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
      const msg = err?.message || 'Failed to fetch productservices';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (input: CreateProductServiceInput): Promise<ProductService> => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.post<ProductService>(PATH, input);
      setData((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create productservice';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };
  const update = async (id: number, input: UpdateProductServiceInput): Promise<ProductService> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<ProductService>(PATH + '/' + encodeURIComponent(String(id)), input);
      setData((prev) => prev.map((x) => (x.id === id ? updated : x)));
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update productservice';
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
      const msg = err?.message || 'Failed to delete productservice';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    productservices: data,
    loading,
    error,
    refresh,
    fetchProductServices: refresh,
    create,
    createProductService: create,
    addProductService: create,
    update,
    updateProductService: update,
    remove,
    deleteProductService: remove,
    removeProductService: remove,
  };
}

export const useProductService = useProductServices;
export default useProductServices;