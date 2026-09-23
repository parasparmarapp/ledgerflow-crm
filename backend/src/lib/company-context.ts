import { AsyncLocalStorage } from 'async_hooks';

const companyStorage = new AsyncLocalStorage<number>();

export function runWithCompany<T>(companyId: number, fn: () => T): Promise<Awaited<T>> {
  return companyStorage.run(companyId, async () => await fn()) as Promise<Awaited<T>>;
}

export function currentCompanyId(): number | undefined {
  return companyStorage.getStore();
}
