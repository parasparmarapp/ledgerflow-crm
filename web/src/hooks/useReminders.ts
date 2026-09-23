import type { Reminder, CreateReminderInput, UpdateReminderInput } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const PATH = '/reminders';

export function useReminders() {
  const [data, setData] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Reminder[] | Reminder>(PATH);
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
      const msg = err?.message || 'Failed to fetch reminders';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (input: CreateReminderInput): Promise<Reminder> => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.post<Reminder>(PATH, input);
      setData((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create reminder';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };
  const update = async (id: number, input: UpdateReminderInput): Promise<Reminder> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<Reminder>(PATH + '/' + encodeURIComponent(String(id)), input);
      setData((prev) => prev.map((x) => (x.id === id ? updated : x)));
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update reminder';
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
      const msg = err?.message || 'Failed to delete reminder';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    reminders: data,
    loading,
    error,
    refresh,
    fetchReminders: refresh,
    create,
    createReminder: create,
    addReminder: create,
    update,
    updateReminder: update,
    remove,
    deleteReminder: remove,
    removeReminder: remove,
  };
}

export const useReminder = useReminders;
export default useReminders;