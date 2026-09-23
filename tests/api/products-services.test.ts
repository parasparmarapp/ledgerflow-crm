import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

let authToken: string;
let psId: string;

describe('Products & Services API', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('GET /api/v1/products-services should return list', async () => {
    const res = await request(app)
      .get('/api/v1/products-services')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/products-services should create item', async () => {
    const res = await request(app)
      .post('/api/v1/products-services')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Consulting', type: 'service', unitPrice: 150 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Consulting');
    psId = res.body.id;
  });

  it('GET /api/v1/products-services/:id should return details', async () => {
    const res = await request(app)
      .get(`/api/v1/products-services/${psId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(psId);
  });

  it('PATCH /api/v1/products-services/:id should update', async () => {
    const res = await request(app)
      .patch(`/api/v1/products-services/${psId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ unitPrice: 175 });
    expect(res.status).toBe(200);
    expect(res.body.unitPrice).toBe(175);
  });

  it('DELETE /api/v1/products-services/:id should delete', async () => {
    const res = await request(app)
      .delete(`/api/v1/products-services/${psId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 204]).toContain(res.status);
  });
});