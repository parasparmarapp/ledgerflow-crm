import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

let authToken: string;
let clientId: string;

describe('Clients API', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('GET /api/v1/clients should return clients list', async () => {
    const res = await request(app)
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/clients should create a client', async () => {
    const res = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Acme Corp',
        email: 'billing@acme.com',
        phone: '555-0100',
        address: '123 Main St'
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Acme Corp');
    clientId = res.body.id;
  });

  it('POST /api/v1/clients should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Bad', email: 'not-an-email' });
    expect([400, 422]).toContain(res.status);
  });

  it('GET /api/v1/clients/:id should return client details', async () => {
    const res = await request(app)
      .get(`/api/v1/clients/${clientId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(clientId);
  });

  it('PATCH /api/v1/clients/:id should update client', async () => {
    const res = await request(app)
      .patch(`/api/v1/clients/${clientId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ phone: '555-9999' });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('555-9999');
  });

  it('DELETE /api/v1/clients/:id should delete client', async () => {
    const res = await request(app)
      .delete(`/api/v1/clients/${clientId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 204]).toContain(res.status);
  });
});