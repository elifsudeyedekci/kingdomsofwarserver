import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';
import * as bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Shared mock objects — reset in beforeEach via jest.resetAllMocks()
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  ban: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  playerProfile: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  playerSession: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  // register() uses the async-callback form of $transaction
  $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const mockConfig = {
  get: jest.fn(),
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    // Reset all mocks so tests are fully isolated
    jest.resetAllMocks();

    // Re-apply defaults that the happy-path tests rely on
    mockJwt.sign.mockReturnValue('mock-access-token');
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: any) => Promise<any>) => fn(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AdminGateway, useValue: new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : jest.fn()) }) },
        { provide: 'REDIS_CLIENT', useValue: { get: jest.fn(), set: jest.fn(), setex: jest.fn().mockResolvedValue('OK'), del: jest.fn(), incr: jest.fn(), expire: jest.fn(), exists: jest.fn().mockResolvedValue(0) } },
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // =========================================================================
  // register()
  // =========================================================================
  describe('register()', () => {
    const dto = {
      email: 'warrior@example.com',
      username: 'warrior99',
      password: 'Str0ng!Pass',
    };

    beforeEach(() => {
      // Default: no conflicts, transaction succeeds
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.playerProfile.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: dto.email });
      mockPrisma.playerProfile.create.mockResolvedValue({});
      mockPrisma.playerSession.create.mockResolvedValue({});
    });

    it('hashes the password and creates a user + profile inside a transaction', async () => {
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);

      await service.register(dto);

      // Password must be hashed — raw password must NOT appear in the create call
      const userCreateArg = mockPrisma.user.create.mock.calls[0][0];
      expect(userCreateArg.data.passwordHash).toBe('hashed-password');
      expect(userCreateArg.data.passwordHash).not.toBe(dto.password);

      // Profile must be created with the correct userId and username
      expect(mockPrisma.playerProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            username: dto.username,
          }),
        }),
      );
    });

    it('returns an accessToken, refreshToken and expiresAt on success', async () => {
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);

      const result = await service.register(dto);

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresAt');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('stores a hashed (not raw) refresh token in the session', async () => {
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);

      const result = await service.register(dto);

      const sessionCreateArg = mockPrisma.playerSession.create.mock.calls[0][0];
      // The value stored in the DB must differ from the raw token returned to caller
      expect(sessionCreateArg.data.refreshToken).toBeDefined();
      expect(sessionCreateArg.data.refreshToken).not.toBe(result.refreshToken);
    });

    it('signs the JWT with the correct sub and username payload', async () => {
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);

      await service.register(dto);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', username: dto.username }),
        expect.objectContaining({ audience: 'kow-player', issuer: 'kow-backend' }),
      );
    });

    it('throws ConflictException when email is already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      await expect(service.register(dto)).rejects.toThrow('Email already in use');
    });

    it('does NOT create any user when email conflicts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.playerProfile.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when username is already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.playerProfile.findUnique.mockResolvedValue({ id: 'existing-profile' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      await expect(service.register(dto)).rejects.toThrow('Username already taken');
    });

    it('does NOT create any user when username conflicts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.playerProfile.findUnique.mockResolvedValue({ id: 'existing-profile' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // validateCredentials()
  // =========================================================================
  describe('validateCredentials()', () => {
    const email = 'warrior@example.com';
    const password = 'Str0ng!Pass';
    const passwordHash = '$2b$12$fakehash';

    const activeUser = {
      id: 'user-1',
      email,
      passwordHash,
      isActive: true,
      deletedAt: null,
      profile: { username: 'warrior99' },
    };

    it('returns the full user object when credentials are valid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.validateCredentials(email, password);

      expect(result).toEqual(activeUser);
    });

    it('queries prisma with email and includes profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await service.validateCredentials(email, password);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email },
          include: expect.objectContaining({ profile: expect.anything() }),
        }),
      );
    });

    it('returns null when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateCredentials('nobody@example.com', password);

      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const result = await service.validateCredentials(email, 'WrongPassword');

      expect(result).toBeNull();
    });

    it('returns null when user has no passwordHash (guest / OAuth account)', async () => {
      const guestUser = { ...activeUser, passwordHash: null };
      mockPrisma.user.findUnique.mockResolvedValue(guestUser);

      // bcrypt.compare must NOT be called when there is no hash
      const compareSpy = jest.spyOn(bcrypt, 'compare');

      const result = await service.validateCredentials(email, password);

      expect(result).toBeNull();
      expect(compareSpy).not.toHaveBeenCalled();
    });

    it('returns null when user is inactive (isActive = false)', async () => {
      const inactiveUser = { ...activeUser, isActive: false };
      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      const result = await service.validateCredentials(email, password);

      expect(result).toBeNull();
    });

    it('returns null when user is soft-deleted (deletedAt is set)', async () => {
      const deletedUser = { ...activeUser, deletedAt: new Date() };
      mockPrisma.user.findUnique.mockResolvedValue(deletedUser);

      const result = await service.validateCredentials(email, password);

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // login() / issueTokenPair()  — login() is a thin wrapper around issueTokenPair()
  // =========================================================================
  describe('login() / issueTokenPair()', () => {
    beforeEach(() => {
      mockPrisma.playerSession.create.mockResolvedValue({});
    });

    it('creates a session and returns accessToken, refreshToken and expiresAt', async () => {
      const result = await service.login('user-1', 'warrior99');

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresAt');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('persists a session row with userId and a hashed (non-raw) refresh token', async () => {
      const result = await service.login('user-1', 'warrior99');

      expect(mockPrisma.playerSession.create).toHaveBeenCalledTimes(1);
      const createArg = mockPrisma.playerSession.create.mock.calls[0][0];
      expect(createArg.data.userId).toBe('user-1');
      expect(createArg.data.refreshToken).toBeDefined();
      // The stored hash must differ from the raw token given back to the caller
      expect(createArg.data.refreshToken).not.toBe(result.refreshToken);
    });

    it('signs the JWT with the correct sub and username', async () => {
      await service.login('user-1', 'warrior99');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', username: 'warrior99' }),
        expect.objectContaining({ audience: 'kow-player', issuer: 'kow-backend' }),
      );
    });

    it('sets expiresAt approximately 30 days in the future', async () => {
      const before = Date.now();
      const result = await service.login('user-1', 'warrior99');
      const after = Date.now();

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const expiresMs = result.expiresAt.getTime();

      expect(expiresMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
      expect(expiresMs).toBeLessThanOrEqual(after + thirtyDaysMs + 1000);
    });
  });

  // =========================================================================
  // refresh()
  // =========================================================================
  describe('refresh()', () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 min ahead

    beforeEach(() => {
      mockPrisma.playerSession.update.mockResolvedValue({});
      mockPrisma.playerSession.create.mockResolvedValue({});
    });

    it('returns a new token pair for a valid, unexpired session', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        isValid: true,
        expiresAt: futureDate,
        user: { profile: { username: 'warrior99' } },
      };
      mockPrisma.playerSession.findUnique.mockResolvedValue(session);

      const result = await service.refresh('valid-raw-token');

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresAt');
    });

    it('revokes the old session before issuing a new pair (token rotation)', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        isValid: true,
        expiresAt: futureDate,
        user: { profile: { username: 'warrior99' } },
      };
      mockPrisma.playerSession.findUnique.mockResolvedValue(session);

      await service.refresh('valid-raw-token');

      expect(mockPrisma.playerSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({ isValid: false }),
        }),
      );
      // A new session must also have been created
      expect(mockPrisma.playerSession.create).toHaveBeenCalledTimes(1);
    });

    it('falls back to empty string username when user has no profile', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        isValid: true,
        expiresAt: futureDate,
        user: { profile: null }, // profile can be null
      };
      mockPrisma.playerSession.findUnique.mockResolvedValue(session);

      await service.refresh('valid-raw-token');

      // Should still sign a JWT — just with an empty username
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', username: '' }),
        expect.objectContaining({ audience: 'kow-player', issuer: 'kow-backend' }),
      );
    });

    it('throws UnauthorizedException when session does not exist', async () => {
      mockPrisma.playerSession.findUnique.mockResolvedValue(null);

      await expect(service.refresh('nonexistent-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException with a descriptive message when not found', async () => {
      mockPrisma.playerSession.findUnique.mockResolvedValue(null);

      await expect(service.refresh('nonexistent-token')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('throws UnauthorizedException when session is revoked (isValid = false)', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        isValid: false,
        expiresAt: futureDate,
        user: { profile: { username: 'warrior99' } },
      };
      mockPrisma.playerSession.findUnique.mockResolvedValue(session);

      await expect(service.refresh('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when session is expired (expiresAt in the past)', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const session = {
        id: 'session-1',
        userId: 'user-1',
        isValid: true,
        expiresAt: pastDate,
        user: { profile: { username: 'warrior99' } },
      };
      mockPrisma.playerSession.findUnique.mockResolvedValue(session);

      await expect(service.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does NOT create a new session when the old one is invalid', async () => {
      mockPrisma.playerSession.findUnique.mockResolvedValue(null);

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.playerSession.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // logout()
  // =========================================================================
  describe('logout()', () => {
    it('calls updateMany to invalidate the matching session', async () => {
      mockPrisma.playerSession.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('some-raw-refresh-token');

      expect(mockPrisma.playerSession.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.playerSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isValid: false }),
        }),
      );
    });

    it('filters by isValid: true so only active sessions are touched', async () => {
      mockPrisma.playerSession.updateMany.mockResolvedValue({ count: 0 });

      await service.logout('some-raw-refresh-token');

      const updateArg = mockPrisma.playerSession.updateMany.mock.calls[0][0];
      expect(updateArg.where).toMatchObject({ isValid: true });
    });

    it('completes without error when no matching session exists (already logged out)', async () => {
      mockPrisma.playerSession.updateMany.mockResolvedValue({ count: 0 });

      // Should resolve cleanly — not throw
      await expect(service.logout('already-invalidated-token')).resolves.toBeUndefined();
    });

    it('stores the hashed token in the where clause, not the raw token', async () => {
      mockPrisma.playerSession.updateMany.mockResolvedValue({ count: 1 });
      const rawToken = 'raw-token-value';

      await service.logout(rawToken);

      const whereArg = mockPrisma.playerSession.updateMany.mock.calls[0][0].where;
      expect(whereArg.refreshToken).toBeDefined();
      expect(whereArg.refreshToken).not.toBe(rawToken);
      // SHA-256 hex output is always 64 characters
      expect(whereArg.refreshToken).toHaveLength(64);
    });
  });

  // =========================================================================
  // getUserById()
  // =========================================================================
  describe('getUserById()', () => {
    it('returns the user with their profile when found and not deleted', async () => {
      const user = {
        id: 'user-1',
        email: 'warrior@example.com',
        deletedAt: null,
        profile: { username: 'warrior99' },
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getUserById('user-1');

      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          include: expect.objectContaining({ profile: true }),
        }),
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getUserById('nonexistent-id')).rejects.toThrow(
        'User not found',
      );
    });

    it('throws NotFoundException when user is soft-deleted (deletedAt is set)', async () => {
      const deletedUser = {
        id: 'user-1',
        email: 'warrior@example.com',
        deletedAt: new Date(),
        profile: null,
      };
      mockPrisma.user.findUnique.mockResolvedValue(deletedUser);

      await expect(service.getUserById('user-1')).rejects.toThrow(NotFoundException);
      await expect(service.getUserById('user-1')).rejects.toThrow('User not found');
    });
  });
});
