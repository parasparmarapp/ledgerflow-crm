import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

let authToken: string;
let reminderId: string;
let alertId: string;

describe('Reminders & Alerts API', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('GET /api/v1/reminders should return list', async () => {
    const res = await request(app)
      .get('/api/v1/reminders')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/reminders should create reminder', async () => {
    const res = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ invoiceId: 'inv-1', remindAt: '2025-02-01', message: 'Pay soon' });
    expect(res.status).toBe(201);
    reminderId = res.body.id;
  });

  it('PATCH /api/v1/reminders/:id should update', async () => {
    const res = await request(app)
      .patch(`/api/v1/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ sent: true });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/v1/reminders/:id should delete', async () => {
    const res = await request(app)
      .delete(`/api/v1/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 204]).toContain(res.status);
  });

  it('GET /api/v1/alerts should return active alerts', async () => {
    const res = await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) alertId = res.body[0].id;
  });

  it('PATCH /api/v1/alerts/:id should dismiss alert', async () => {
    if (!alertId) return;
    const res = await request(app)
      .patch(`/api/v1/alerts/${alertId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ dismissed: true });
    expect(res.status).toBe(200);
  });
});