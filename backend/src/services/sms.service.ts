/**
 * Low-level Arkesel transport. Orchestration (templates, NotificationLog, retry, Alerts)
 * lives in notification.service.ts — this module only knows how to reach Arkesel.
 */
const REQUEST_TIMEOUT_MS = 10_000;

export interface SmsSendResult {
  success: boolean;
  status: 'sent' | 'simulated' | 'failed' | 'skipped';
  messageId: string | null;
  simulated: boolean;
  recipient: string;
  error?: string;
}

export interface ArkeselSendPayload {
  sender: string;
  message: string;
  recipients: string[];
  sandbox?: boolean;
  callback_url?: string;
  use_case?: string;
}

/** Reads SMS configuration from environment variables on every call so .env changes apply without a restart. */
export const getSmsConfig = () => ({
  apiKey: process.env.LEGERCRM_ARKESEL_API_KEY || '',
  senderId: process.env.LEGERCRM_ARKESEL_SENDER_ID || 'LedgerFlow',
  baseUrl: (process.env.LEGERCRM_ARKESEL_BASE_URL || 'https://sms.arkesel.com/api/v2').replace(/\/+$/, ''),
  enabled: process.env.LEGERCRM_SMS_ENABLED !== 'false',
  sandbox: process.env.LEGERCRM_SMS_SANDBOX === 'true',
  defaultCountryCode: (process.env.LEGERCRM_SMS_DEFAULT_COUNTRY_CODE || '233').replace(/\D/g, ''),
  callbackUrl: process.env.LEGERCRM_SMS_CALLBACK_URL || '',
});

/**
 * Normalizes a free-text phone number to the international digits-only format Arkesel expects.
 * Handles all common input formats (using Ghana/233 as example):
 *   "+233244123456"     → 233244123456  (E.164 with leading plus)
 *   "00233244123456"    → 233244123456  (00-prefixed international)
 *   "233244123456"      → 233244123456  (already full international — pass-through)
 *   "0244123456"        → 233244123456  (local 10-digit with leading 0)
 *   "244123456"         → 233244123456  (local 9-digit, no leading 0)
 *   "24412345"          → 23324412345   (local 8-digit — prepend country code)
 */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = getSmsConfig().defaultCountryCode): string | null {
  if (!raw) return null;
  let digits = String(raw).trim().replace(/[^\d+]/g, '');
  const hadPlus = digits.startsWith('+');
  digits = digits.replace(/\+/g, '');

  // Strip 00-international prefix
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  // Strip local leading zero and prepend country code (e.g. "0244123456" → "233244123456")
  else if (!hadPlus && digits.startsWith('0')) {
    digits = defaultCountryCode + digits.slice(1);
  }
  // If the number does NOT already start with the country code, prepend it.
  // This covers bare 8- and 9-digit local numbers (e.g. "244123456" or "24412345").
  else if (!hadPlus && !digits.startsWith(defaultCountryCode)) {
    digits = defaultCountryCode + digits;
  }
  // Otherwise the number already carries the full country code — use as-is.

  // Final sanity: must be 11–15 digits after normalization
  return /^\d{11,15}$/.test(digits) ? digits : null;
}

/** Low-level Arkesel v2 send call. Throws on HTTP/transport errors with the provider's message. */
export async function arkeselSend(
  config: { apiKey: string; baseUrl: string },
  payload: ArkeselSendPayload,
): Promise<{ messageId: string | null; raw: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.baseUrl}/sms/send`, {
      method: 'POST',
      headers: { 'api-key': config.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body: any = await res.json().catch(() => ({}));

    if (!res.ok || (body?.status && body.status !== 'success')) {
      const reason = body?.message || body?.error || res.statusText || 'Unknown Arkesel error';
      throw new Error(`Arkesel ${res.status}: ${reason}`);
    }

    const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
    return { messageId: data?.id ? String(data.id) : null, raw: body };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error(`Arkesel request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

class SmsService {
  /** True when a live Arkesel API key is configured (not a placeholder). */
  public isConfigured(): boolean {
    const { apiKey } = getSmsConfig();
    return Boolean(apiKey && !apiKey.includes('replace_with_'));
  }

  /**
   * Sends one SMS via Arkesel, or simulates delivery if unconfigured / running tests.
   * Pure transport: never throws, never writes to the database.
   */
  public async sendRaw(to: string | null | undefined, message: string): Promise<SmsSendResult> {
    const config = getSmsConfig();
    const recipient = normalizePhone(to, config.defaultCountryCode);

    if (!config.enabled) return { success: false, status: 'skipped', messageId: null, simulated: false, recipient: recipient || String(to || ''), error: 'SMS disabled (SMS_ENABLED=false)' };
    if (!recipient) return { success: false, status: 'skipped', messageId: null, simulated: false, recipient: String(to || ''), error: 'Missing or invalid phone number' };

    if (this.isConfigured() && process.env.LEGERCRM_NODE_ENV !== 'test') {
      try {
        const { messageId } = await arkeselSend(config, {
          sender: config.senderId,
          message,
          recipients: [recipient],
          ...(config.sandbox ? { sandbox: true } : {}),
          ...(config.callbackUrl ? { callback_url: config.callbackUrl } : {}),
          ...(recipient.startsWith('234') ? { use_case: 'transactional' } : {}),
        });
        console.log(`[SmsService] SMS dispatched to ${recipient} (id: ${messageId}${config.sandbox ? ', sandbox' : ''})`);
        return { success: true, status: 'sent', messageId, simulated: false, recipient };
      } catch (err: any) {
        console.error(`[SmsService] Arkesel delivery to ${recipient} failed:`, err?.message);
        return { success: false, status: 'failed', messageId: null, simulated: false, recipient, error: err?.message || 'Unknown error' };
      }
    }

    const simulatedId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[SmsService:Simulated] To: ${recipient} | "${message}" | ID: ${simulatedId}`);
    return { success: true, status: 'simulated', messageId: simulatedId, simulated: true, recipient };
  }

  /** Fetches the Arkesel account balance, or null if unconfigured. */
  public async getBalance(): Promise<any> {
    const config = getSmsConfig();
    if (!this.isConfigured()) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${config.baseUrl}/clients/balance-details`, {
        headers: { 'api-key': config.apiKey, Accept: 'application/json' },
        signal: controller.signal,
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Arkesel ${res.status}: ${body?.message || res.statusText}`);
      return body?.data ?? body;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const smsService = new SmsService();
export default smsService;
