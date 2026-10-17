/**
 * Prisma seed script for Kingdoms of War admin backend.
 *
 * Run via:
 *   cd admin-backend && npx ts-node prisma/seed.ts
 *
 * All operations are idempotent (upsert). Safe to run multiple times.
 * Reads SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD from environment variables.
 *
 * Schema is located at: ../database/schema.prisma
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------
const FEATURE_FLAGS: Array<{ key: string; value: boolean; description: string }> = [
  {
    key: 'matchmaking_enabled',
    value: true,
    description: 'Enables the matchmaking queue. Disable during maintenance windows.',
  },
  {
    key: 'store_enabled',
    value: true,
    description: 'Enables in-app purchases and the store UI.',
  },
  {
    key: 'tournaments_enabled',
    value: false,
    description: 'Enables tournament mode. Disabled until tournament system is fully tested.',
  },
];

// ---------------------------------------------------------------------------
// Remote config
// ---------------------------------------------------------------------------
const REMOTE_CONFIGS: Array<{ key: string; value: unknown; description: string }> = [
  {
    key: 'max_players_per_match',
    value: 8,
    description: 'Maximum number of players allowed in a single match session.',
  },
  {
    key: 'tick_rate',
    value: 20,
    description: 'Server simulation tick rate in Hz.',
  },
];

// ---------------------------------------------------------------------------
// Localization keys — English and Turkish
// ---------------------------------------------------------------------------
interface LocalizationEntry {
  key: string;
  language: string;
  value: string;
  namespace: string;
}

const LOCALIZATION_KEYS: LocalizationEntry[] = [
  // ui.play
  { key: 'ui.play',     language: 'en', value: 'Play',     namespace: 'ui' },
  { key: 'ui.play',     language: 'tr', value: 'Oyna',     namespace: 'ui' },
  // ui.quit
  { key: 'ui.quit',     language: 'en', value: 'Quit',     namespace: 'ui' },
  { key: 'ui.quit',     language: 'tr', value: 'Cik',      namespace: 'ui' },
  // ui.settings
  { key: 'ui.settings', language: 'en', value: 'Settings', namespace: 'ui' },
  { key: 'ui.settings', language: 'tr', value: 'Ayarlar',  namespace: 'ui' },
  // game.win
  { key: 'game.win',    language: 'en', value: 'Victory!', namespace: 'game' },
  { key: 'game.win',    language: 'tr', value: 'Zafer!',   namespace: 'game' },
  // game.lose
  { key: 'game.lose',   language: 'en', value: 'Defeat',   namespace: 'game' },
  { key: 'game.lose',   language: 'tr', value: 'Yenilgi',  namespace: 'game' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('Seeding database...');

  // 1. Feature flags
  console.log('  Upserting feature flags...');
  for (const flag of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { value: flag.value, description: flag.description },
      create: { key: flag.key, value: flag.value, description: flag.description },
    });
  }
  console.log(`  Done: ${FEATURE_FLAGS.length} feature flag(s)`);

  // 2. Remote config
  console.log('  Upserting remote config...');
  for (const config of REMOTE_CONFIGS) {
    await prisma.remoteConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: {
        key: config.key,
        value: config.value,
        description: config.description,
        environment: 'production',
      },
    });
  }
  console.log(`  Done: ${REMOTE_CONFIGS.length} remote config(s)`);

  // 3. Localization keys
  console.log('  Upserting localization keys...');
  for (const entry of LOCALIZATION_KEYS) {
    await prisma.localizationKey.upsert({
      where: { key_language: { key: entry.key, language: entry.language } },
      update: { value: entry.value, namespace: entry.namespace },
      create: {
        key: entry.key,
        language: entry.language,
        value: entry.value,
        namespace: entry.namespace,
      },
    });
  }
  console.log(`  Done: ${LOCALIZATION_KEYS.length} localization key(s)`);

  // 4. Admin user from environment
  console.log('  Upserting admin user...');
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn(
      '  WARNING: SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not set — skipping admin user seed.',
    );
  } else {
    const BCRYPT_ROUNDS = 12;
    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash,
        isActive: true,
      },
      create: {
        email: adminEmail,
        passwordHash,
        name: 'Seed Admin',
        role: 'super_admin',
        isActive: true,
      },
    });
    console.log(`  Done: admin user seeded for ${adminEmail}`);
  }

  console.log('Seeding complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
