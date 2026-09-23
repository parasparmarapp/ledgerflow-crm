import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

let authToken: string;
let createdInvoiceId: string;

describe('Invoices API', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('GET /api/v1/invoices should return list of invoices with auth', async () => {
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/invoices should return 401 without auth', async () => {
    const res = await request(app).get('/api/v1/invoices');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/invoices should create a new invoice', async () => {
    const payload = {
      clientId: 'client-1',
      issueDate: '2025-01-15',
      dueDate: '2025-02-15',
      lineItems: [{ productServiceId: 'ps-1', quantity: 2, unitPrice: 100 }]
    };
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('total');
    createdInvoiceId = res.body.id;
  });

  it('POST /api/v1/invoices should return 400 for missing clientId', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ lineItems: [] });
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/invoices/:id should return invoice details', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${createdInvoiceId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdInvoiceId);
  });

  it('GET /api/v1/invoices/:id should return 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/v1/invoices/non-existent-id')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });

  it('PATCH /api/v1/invoices/:id should update an invoice', async () => {
    const res = await request(app)
      .patch(`/api/v1/invoices/${createdInvoiceId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'sent' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('sent');
  });

  it('POST /api/v1/invoices/:id/send should send the invoice', async () => {
    const res = await request(app)
      .post(`/api/v1/invoices/${createdInvoiceId}/send`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/v1/invoices/:id should delete an invoice', async () => {
    const res = await request(app)
      .delete(`/api/v1/invoices/${createdInvoiceId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 204]).toContain(res.status);
  });
});