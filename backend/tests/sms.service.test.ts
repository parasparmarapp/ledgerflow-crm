import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizePhone, arkeselSend } from '../src/services/sms.service';
import { renderTemplate, formatGhs } from '../src/services/template.service';

describe('normalizePhone', () => {
  it.each([
    ['0244123456', '233244123456'],
    ['024 412 3456', '233244123456'],
    ['+233 24 412 3456', '233244123456'],
    ['233244123456', '233244123456'],
    ['00233244123456', '233244123456'],
    ['244123456', '233244123456'],
    ['(024) 412-3456', '233244123456'],
    ['+234 803 123 4567', '2348031234567'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizePhone(raw, '233')).toBe(expected);
  });

  it.each([null, undefined, '', 'abc', '+1-555-0144', '12345'])('rejects %s', (raw) => {
    expect(normalizePhone(raw as any, '233')).toBeNull();
  });
});

describe('arkeselSend', () => {
  const config = { apiKey: 'test-key', baseUrl: 'https://sms.arkesel.com/api/v2' };
  const payload = { sender: 'LedgerFlow', message: 'Hello', recipients: ['233244123456'] };

  afterEach(() => vi.unstubAllGlobals());

  const mockFetch = (status: number, body: any) => {
    const fn = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'status',
      json: async () => body,
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  it('posts to /sms/send with the api-key header and returns the message id', async () => {
    const fetchMock = mockFetch(200, { status: 'success', data: [{ recipient: '233244123456', id: 'abc-123' }] });
    const res = await arkeselSend(config, payload);

    expect(res.messageId).toBe('abc-123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sms.arkesel.com/api/v2/sms/send');
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it('throws with provider message on 401', async () => {
    mockFetch(401, { status: 'error', message: 'Invalid API key' });
    await expect(arkeselSend(config, payload)).rejects.toThrow('Arkesel 401: Invalid API key');
  });

  it('throws with provider message on 422', async () => {
    mockFetch(422, { message: 'The recipients field is invalid.' });
    await expect(arkeselSend(config, payload)).rejects.toThrow('Arkesel 422');
  });
});

describe('renderTemplate / formatGhs', () => {
  it('formatGhs avoids the cedi symbol (GSM-7 safe) and formats to 2dp', () => {
    expect(formatGhs(1000)).toBe('GHS 1,000.00');
    expect(formatGhs(1000)).not.toContain('₵');
  });

  it('substitutes {{dot.path}} placeholders and blanks unknown keys', () => {
    const msg = renderTemplate('Dear {{client.firstName}}, invoice {{invoice.number}} is due {{invoice.missing}}.', {
      client: { firstName: 'Kwame' },
      invoice: { number: 'INV-2026-0004' },
    });
    expect(msg).toBe('Dear Kwame, invoice INV-2026-0004 is due .');
  });

  it('fits an SMS reminder in one GSM-7 segment (≤160 chars)', () => {
    const msg = renderTemplate('Reminder: invoice {{invoice.number}} of {{invoice.balance}} is due {{invoice.dueDate}}. Please arrange payment. Thank you.', {
      invoice: { number: 'INV-2026-0004', balance: formatGhs(1000), dueDate: '30 Oct 2026' },
    });
    expect(msg.length).toBeLessThanOrEqual(160);
    expect(msg).not.toContain('₵');
  });
});
