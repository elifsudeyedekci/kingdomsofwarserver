import { SetMetadata } from '@nestjs/common';

export const PLAYER_API_KEY = 'playerApi';

/**
 * Marks a route (or a whole controller) as callable by a signed-in PLAYER (game client token).
 * Everything NOT marked @Public() or @PlayerApi() is admin-only (default deny): the AccessGuard rejects player tokens there.
 * Handlers marked with this decorator must scope their data to `req.user.id` and never accept another player's id for writes.
 */
export const PlayerApi = () => SetMetadata(PLAYER_API_KEY, true);
