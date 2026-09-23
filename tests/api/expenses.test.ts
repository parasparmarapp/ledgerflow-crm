import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

let authToken: string;
let expenseId: string;

describe('Expenses API', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('GET /api/v1/expenses should return list', async () => {
    const res = await request(app)
      .get('/api/v1/expenses')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/expenses should create expense', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ category: 'office', amount: 250.50, date: '2025-01-20', description: 'Supplies' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(250.50);
    expenseId = res.body.id;
  });

  it('POST /api/v1/expenses should reject negative amount', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ category: 'office', amount: -10, date: '2025-01-20' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/v1/expenses/:id should update', async () => {
    const res = await request(app)
      .patch(`/api/v1/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 300 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(300);
  });

  it('DELETE /api/v1/expenses/:id should delete', async () => {
    const res = await request(app)
      .delete(`/api/v1/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 204]).toContain(res.status);
  });
});