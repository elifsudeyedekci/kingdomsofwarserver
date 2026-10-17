import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AdminSessionService } from '../modules/admin-auth/admin-session.service';

const ROOM = 'admins';

/**
 * Live feed for the panel (namespace /admin). EVERY connection must present a valid, non-limited admin access token (`auth: { token }` in the socket.io handshake) - checked against the
 * live session table before the socket is even accepted, so nothing is ever broadcast to an anonymous client. Events go to the authenticated `admins` room only.
 */
@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'], credentials: true },
  namespace: '/admin',
})
export class AdminGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AdminGateway.name);
  private connectedClients = 0;

  constructor(private readonly sessions: AdminSessionService) {}

  afterInit(server: Server) {
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      try {
        const raw = (socket.handshake.auth as { token?: string } | undefined)?.token ?? (socket.handshake.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
        if (!raw) return next(new Error('unauthorized'));
        const admin = await this.sessions.authenticate(raw);
        if (admin.limited) return next(new Error('unauthorized'));
        socket.data.admin = { id: admin.id, role: admin.role, sid: admin.sid };
        next();
      } catch { next(new Error('unauthorized')); }
    });
  }

  handleConnection(client: Socket) {
    this.connectedClients++;
    client.join(ROOM);
    client.emit('connected', { clientId: client.id, role: client.data.admin?.role, timestamp: new Date().toISOString() });
  }
  handleDisconnect() { this.connectedClients = Math.max(0, this.connectedClients - 1); }

  get onlineAdmins() { return this.connectedClients; }

  /** Pushes an event to every signed-in panel. Never throws (a feed problem must not break a request). */
  emitToAdmins(event: string, payload: Record<string, unknown>) {
    try { this.server?.to(ROOM).emit(event, { ...payload, timestamp: new Date().toISOString() }); } catch { /* feed is best effort */ }
  }

  emitMatchStarted(d: { matchId: string; playerCount: number; gameMode: string }) { this.emitToAdmins('match:started', d); }
  emitMatchEnded(d: { matchId: string; winnerId?: string; duration: number }) { this.emitToAdmins('match:ended', d); }
  emitFraudAlert(d: { playerId: string; reason: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }) { this.emitToAdmins('fraud:alert', d); }
  emitPlayerRegistered(d: { playerId: string; username: string }) { this.emitToAdmins('player:registered', d); }
  emitStatsUpdate(s: { activePlayers: number; activeMatches: number; onlineAdmins: number }) { this.emitToAdmins('stats:update', { ...s, connectedAdmins: this.connectedClients }); }
  emitSecurityAlert(d: { type: string; severity: string; ip?: string; detail?: unknown }) { this.emitToAdmins('security:alert', d as Record<string, unknown>); }
  /** Anti-cheat finding the moment it is recorded (the panel shows it live and can act on it). */
  emitCheatAlert(d: Record<string, unknown>) { this.emitToAdmins('cheat:alert', d); }
  emitPlayerPresence(d: { userId: string; username?: string; online: boolean }) { this.emitToAdmins('player:presence', d); }
  emitModeration(d: { action: string; userId: string; by?: string; reason?: string }) { this.emitToAdmins('moderation:action', d); }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: unknown) { return { event: 'pong', data }; }
}
