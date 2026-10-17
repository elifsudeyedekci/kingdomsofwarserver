/**
 * Integration test bootstrap.
 *
 * Starts a real NestJS application instance backed by the database pointed to
 * by DATABASE_URL in the environment (typically loaded from .env.test).
 *
 * Usage:
 *   import { setupApp, teardownApp, getApp } from './setup';
 *
 *   beforeAll(() => setupApp());
 *   afterAll(() => teardownApp());
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../app.module';

/** Singleton app instance shared across all integration test suites. */
let app: INestApplication;

/**
 * Creates and initialises the NestJS application with the same global pipes
 * and guards used in production so that integration tests are as realistic
 * as possible.
 *
 * Call once in a global `beforeAll` or `jest.globalSetup` hook.
 */
export async function setupApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}

/**
 * Gracefully shuts down the application and releases all connections.
 *
 * Call in `afterAll`.
 */
export async function teardownApp(): Promise<void> {
  await app?.close();
}

/**
 * Returns the running NestJS application instance.
 *
 * Throws if called before `setupApp` has resolved.
 */
export function getApp(): INestApplication {
  if (!app) {
    throw new Error(
      'Integration test app is not initialised. Did you forget to call setupApp()?',
    );
  }
  return app;
}
