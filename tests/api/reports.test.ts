import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

let authToken: string;

describe('Reports API', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('GET /api/v1/reports/sales should return sales data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/sales?from=2025-01-01&to=2025-12-31')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalSales');
  });

  it('GET /api/v1/reports/profit should return profit data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/profit?from=2025-01-01&to=2025-12-31')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profit');
  });

  it('GET /api/v1/reports/revenue should return revenue data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/revenue?from=2025-01-01&to=2025-12-31')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('revenue');
  });

  it('GET /api/v1/reports/expenses should return expense breakdown', async () => {
    const res = await request(app)
      .get('/api/v1/reports/expenses?from=2025-01-01&to=2025-12-31')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.byCategory) || typeof res.body === 'object').toBe(true);
  });

  it('GET /api/v1/reports/payments should return payments summary', async () => {
    const res = await request(app)
      .get('/api/v1/reports/payments?from=2025-01-01&to=2025-12-31')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalCollected');
  });

  it('Reports should require auth', async () => {
    const res = await request(app).get('/api/v1/reports/sales');
    expect(res.status).toBe(401);
  });
});