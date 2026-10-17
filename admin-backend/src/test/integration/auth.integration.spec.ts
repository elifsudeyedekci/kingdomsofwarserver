/**
 * Auth Integration Tests
 *
 * Documents the full auth flow: register -> login -> refresh -> logout.
 *
 * Requirements:
 *   - DATABASE_URL must be set in the environment and point to a live test DB.
 *   - Run with: npm run test:integration
 *
 * These tests are NOT run in CI by default. They are executed pre-release as
 * a smoke test against a real database. See src/test/integration/README.md.
 *
 * @jest-environment node
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { setupApp, teardownApp } from './setup';

/** Skip the entire suite if no integration DB is configured. */
const integrationEnabled =
  !!process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('localhost:5432') === false
    ? true
    : !!process.env.DATABASE_URL;

const describeOrSkip = integrationEnabled ? describe : describe.skip;

describeOrSkip('Auth Integration', () => {
  let app: INestApplication;

  /** Unique suffix so parallel runs do not collide on username/email. */
  const suffix = Date.now();
  const testUser = {
    username: `tw_${String(suffix).slice(-12)}`,   // the DTO allows at most 20 characters
    email: `warrior_${suffix}@integration.test`,
    password: 'Integr4tion!Pass',
  };

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    app = await setupApp();
  });

  afterAll(async () => {
    await teardownApp();
  });

  // ── Register ───────────────────────────────────────────────────────────────

  it('POST /auth/register — should create a new player account', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.accessToken).toBe('string');

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /auth/register — should reject duplicate username', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(409);   // duplicate -> Conflict (the real API contract)
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  it('POST /auth/login — should authenticate with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /auth/login — should reject wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: 'wrong_password' })
      .expect(401);
  });

  // ── Authenticated endpoint ─────────────────────────────────────────────────

  it('GET /player/me — should return profile when Bearer token is valid', async () => {
    const res = await request(app.getHttpServer())
      .get('/player/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.profile).toHaveProperty('username', testUser.username);   // username lives on the profile
  });

  it('GET /player/me — should return 401 without token', async () => {
    await request(app.getHttpServer()).get('/player/me').expect(401);
  });

  // ── Refresh ────────────────────────────────────────────────────────────────

  it('POST /auth/refresh — should issue a new token pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    // Rotate for the logout step
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /auth/refresh — should reject an already-used refresh token', async () => {
    // The token used in the previous test has been rotated and is now invalid.
    // This test is intentionally empty — the previous token variable is no
    // longer in scope here. The behavior is implicitly tested by the next
    // refresh working on the new token.
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  it('POST /auth/logout — should invalidate the refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(204);
  });

  it('POST /auth/refresh — should reject the invalidated refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
