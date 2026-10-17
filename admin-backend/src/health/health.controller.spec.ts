import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('check() returns status ok', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
  });

  it('check() returns a valid ISO timestamp', () => {
    const result = controller.check();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });

  it('check() returns correct service name', () => {
    const result = controller.check();
    expect(result.service).toBe('kingdoms-of-war-admin-backend');
  });

  it('check() returns a version string', () => {
    const result = controller.check();
    expect(typeof result.version).toBe('string');
    expect(result.version.length).toBeGreaterThan(0);
  });
});
