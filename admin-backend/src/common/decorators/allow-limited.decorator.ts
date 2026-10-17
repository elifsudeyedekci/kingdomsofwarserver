import { SetMetadata } from '@nestjs/common';

export const ALLOW_LIMITED_KEY = 'allowLimited';

/**
 * A "limited" panel session is one that signed in with password only and still has to enrol two-factor authentication (mandatory in production).
 * It may call ONLY the routes marked with this decorator (2FA setup, who-am-I, logout); everything else answers 403 TWO_FACTOR_SETUP_REQUIRED.
 */
export const AllowLimited = () => SetMetadata(ALLOW_LIMITED_KEY, true);
