import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

let authToken: string;
let itemId: string;

describe('Inventory API', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('GET /api/v1/inventory should return items', async () => {
    const res = await request(app)
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/inventory should create a new item', async () => {
    const res = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sku: 'SKU-001',
        name: 'Test Widget',
        quantity: 100,
        unitCost: 5.5,
        reorderLevel: 10
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.sku).toBe('SKU-001');
    itemId = res.body.id;
  });

  it('POST /api/v1/inventory should reject duplicate SKU', async () => {
    const res = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ sku: 'SKU-001', name: 'Dup', quantity: 1 });
    expect([400, 409]).toContain(res.status);
  });

  it('GET /api/v1/inventory/:id should return item', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/${itemId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(itemId);
  });

  it('PATCH /api/v1/inventory/:id should update item', async () => {
    const res = await request(app)
      .patch(`/api/v1/inventory/${itemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ unitCost: 6.0 });
    expect(res.status).toBe(200);
    expect(res.body.unitCost).toBe(6.0);
  });

  it('POST /api/v1/inventory/:id/adjust should adjust stock up', async () => {
    const res = await request(app)
      .post(`/api/v1/inventory/${itemId}/adjust`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ delta: 50, reason: 'restock' });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(150);
  });

  it('POST /api/v1/inventory/:id/adjust should not allow negative stock', async () => {
    const res = await request(app)
      .post(`/api/v1/inventory/${itemId}/adjust`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ delta: -9999, reason: 'test' });
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/stock-movements should return movements', async () => {
    const res = await request(app)
      .get('/api/v1/stock-movements')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});