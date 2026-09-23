import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../backend/src/server';

describe('Auth API', () => {
  beforeAll(async () => {
    // Setup test DB if needed
  });

  it('POST /api/v1/auth/login should return 200 and JWT token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  it('POST /api/v1/auth/login should return 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@ledgerflow.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/login should return 400 when fields missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });
});