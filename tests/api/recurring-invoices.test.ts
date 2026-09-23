import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

let authToken: string;
let recurringId: string;

describe('Recurring Invoices API', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('GET /api/v1/recurring-invoices should return list', async () => {
    const res = await request(app)
      .get('/api/v1/recurring-invoices')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/recurring-invoices should create a recurring invoice', async () => {
    const res = await request(app)
      .post('/api/v1/recurring-invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clientId: 'client-1',
        frequency: 'monthly',
        startDate: '2025-01-01',
        lineItems: [{ productServiceId: 'ps-1', quantity: 1, unitPrice: 50 }]
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.frequency).toBe('monthly');
    recurringId = res.body.id;
  });

  it('PATCH /api/v1/recurring-invoices/:id should update', async () => {
    const res = await request(app)
      .patch(`/api/v1/recurring-invoices/${recurringId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ frequency: 'weekly' });
    expect(res.status).toBe(200);
    expect(res.body.frequency).toBe('weekly');
  });

  it('DELETE /api/v1/recurring-invoices/:id should delete', async () => {
    const res = await request(app)
      .delete(`/api/v1/recurring-invoices/${recurringId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 204]).toContain(res.status);
  });
});