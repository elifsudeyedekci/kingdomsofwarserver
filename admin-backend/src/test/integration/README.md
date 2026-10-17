# Integration Tests

Integration tests spin up a **real NestJS application** connected to a live PostgreSQL database. They test the full request-response cycle including database writes, validation pipes, auth guards, and middleware.

## Setup

1. Copy the example env and set a test database URL:
   ```
   cp .env.example .env.test
   # Edit DATABASE_URL to point at your test database (NOT production)
   ```

2. Run migrations against the test database:
   ```
   DATABASE_URL=<test-url> npm run db:migrate
   ```

3. Run the integration suite:
   ```
   npm run test:integration
   ```

## Rules

- Integration tests **never run against the production database**. Use a dedicated test schema or a local Docker Postgres instance.
- Each test file must be self-cleaning: if it creates records, it should delete them (or use a transaction rollback strategy) so runs are idempotent.
- Use unique suffixes (e.g. `Date.now()`) in usernames and emails to prevent collision between parallel runs.

## CI Policy

Integration tests are **not run automatically on pull requests**. Unit tests (`npm test`) cover PR checks because integration tests require a live database and are too slow for sub-minute PR feedback.

Integration tests **are** run in the pre-release pipeline as a smoke test before every production deployment.

## Adding New Suites

Create `src/test/integration/<module>.integration.spec.ts`. Follow the pattern in `auth.integration.spec.ts`:

- Import `setupApp` / `teardownApp` / `getApp` from `./setup`.
- Wrap the suite in `describe.skip` when `DATABASE_URL` is not set, so the file can be imported without failing in unit-test mode.
- Use `supertest` to make HTTP requests against `app.getHttpServer()`.
