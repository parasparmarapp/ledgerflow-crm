import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

let authToken: string;
let paymentId: string;

describe('Payments API', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('GET /api/v1/payments should return list', async () => {
    const res = await request(app)
      .get('/api/v1/payments')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/payments should record a payment', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ invoiceId: 'inv-1', amount: 200, method: 'card', date: '2025-01-22' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(200);
    paymentId = res.body.id;
  });

  it('GET /api/v1/payments/:id should return details', async () => {
    const res = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(paymentId);
  });

  it('PATCH /api/v1/payments/:id should update', async () => {
    const res = await request(app)
      .patch(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ method: 'bank_transfer' });
    expect(res.status).toBe(200);
    expect(res.body.method).toBe('bank_transfer');
  });

  it('POST /api/v1/payments/reconcile should reconcile', async () => {
    const res = await request(app)
      .post('/api/v1/payments/reconcile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ paymentIds: [paymentId], statementRef: 'STMT-001' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reconciledCount');
  });

  it('DELETE /api/v1/payments/:id should delete', async () => {
    const res = await request(app)
      .delete(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 204]).toContain(res.status);
  });
});