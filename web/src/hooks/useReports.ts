import type { Invoice, Expense, Payment } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

export type ProfitReportRow = {
  id?: number;
  period?: string;
  date?: string;
  label?: string;
  revenue?: number;
  expenses?: number;
  profit?: number;
  margin?: number;
  grossProfit?: number;
  costOfGoods?: number;
  netProfit?: number;
};

export type ProfitReportResponse = {
  revenue?: number;
  totalRevenue?: number;
  costOfGoods?: number;
  grossProfit?: number;
  expenses?: number;
  totalExpenses?: number;
  netProfit?: number;
  margin?: number;
  profitMargin?: number;
  rows?: ProfitReportRow[];
  data?: ProfitReportRow[];
  periods?: ProfitReportRow[];
};

export function useSalesReport() {
  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Invoice[]>('/reports/sales');
      setData(Array.isArray(response) ? response : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sales report');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useProfitReport() {
  const [report, setReport] = useState<ProfitReportResponse | null>(null);
  const [rows, setRows] = useState<ProfitReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ProfitReportResponse | ProfitReportRow[]>('/reports/profit');
      if (Array.isArray(response)) {
        setRows(response);
        setReport({
          totalRevenue: response.reduce((sum, item) => sum + (Number(item?.revenue) || 0), 0),
          totalExpenses: response.reduce((sum, item) => sum + (Number(item?.expenses) || 0), 0),
          netProfit: response.reduce((sum, item) => sum + (Number(item?.profit) || 0), 0),
          profitMargin: 0,
          rows: response,
        });
      } else if (response && typeof response === 'object') {
        const rowList = response.rows || response.data || response.periods || [];
        setReport(response);
        setRows(rowList);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load profit report');
      setReport(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { report, rows, loading, error, refresh };
}

export function useRevenueReport() {
  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Invoice[]>('/reports/revenue');
      setData(Array.isArray(response) ? response : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load revenue report');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useExpenseReport() {
  const [data, setData] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Expense[]>('/reports/expenses');
      setData(Array.isArray(response) ? response : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load expense report');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function usePaymentsReport() {
  const [data, setData] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Payment[]>('/reports/payments');
      setData(Array.isArray(response) ? response : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments report');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
