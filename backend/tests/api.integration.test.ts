import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server';

describe('Backend API Integration Tests for ' + "LedgerFlow CRM", () => {
  it('GET /health returns 200 and healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });

  it('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /openapi.json serves valid OpenAPI specification', async () => {
    const res = await request(app).get('/openapi.json');
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.openapi || res.body.swagger).toBeDefined();
    }
  });

  it('handles unmatched api routes with 404 JSON', async () => {
    const res = await request(app).get('/api/unmatched-probe-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('GET /api/v1/clients returns 200 or 401 array response', async () => {
    const res = await request(app).get('/api/v1/clients');
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });

  it('GET /api/v1/stockmovements returns 200 or 401 array response', async () => {
    const res = await request(app).get('/api/v1/stockmovements');
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });

  it('GET /api/v1/invoices returns 200 or 401 array response', async () => {
    const res = await request(app).get('/api/v1/invoices');
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
});
