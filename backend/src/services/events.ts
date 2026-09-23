import { EventEmitter } from 'events';

/**
 * Domain events emitted AFTER the originating transaction commits. Side effects such as
 * email/SMS notifications subscribe here, so a notification failure can never roll back
 * (or slow down) a financial write.
 */
export interface DomainEvents {
  'invoice.issued': { invoiceId: number; notify: boolean; channels?: ('email' | 'sms')[]; userId: number | null };
  'invoice.voided': { invoiceId: number; userId: number | null };
  'invoice.overdue': { invoiceId: number };
  'payment.recorded': { paymentId: number; invoiceId: number; notify: boolean; userId: number | null };
  'payment.voided': { paymentId: number; invoiceId: number; userId: number | null };
}

class TypedEmitter extends EventEmitter {
  emitEvent<K extends keyof DomainEvents>(name: K, payload: DomainEvents[K]) {
    // Defer so listeners never run inside the caller's request/transaction stack.
    setImmediate(() => {
      try {
        this.emit(name, payload);
      } catch (err) {
        console.error(`[events] listener for ${String(name)} threw:`, err);
      }
    });
  }
  onEvent<K extends keyof DomainEvents>(name: K, listener: (payload: DomainEvents[K]) => void | Promise<void>) {
    this.on(name, (payload: DomainEvents[K]) => {
      Promise.resolve(listener(payload)).catch((err) => console.error(`[events] async listener for ${String(name)} failed:`, err?.message || err));
    });
  }
}

export const events = new TypedEmitter();
