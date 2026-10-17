---
name: project-clan-service-patterns
description: Key implementation constraints and test patterns for ClanService — transaction mock, member cap, disband behavior, leader transfer
metadata:
  type: project
---

ClanService uses callback-style Prisma transactions throughout. Test setup requires a `tx = makeTxMock()` rebuilt in `beforeEach` after `jest.resetAllMocks()`, with `mockPrisma.$transaction.mockImplementation(cb => cb(tx))`.

**Why:** `jest.resetAllMocks()` wipes mock fns; tx must be reconstructed each cycle or stale references cause false positives.

**How to apply:** Any new test block that exercises a transactional method must ensure `tx` is freshly rebuilt in its `beforeEach` — do not rely on module-level `tx` staying intact between test files.

Key constraints encoded in clan.service.ts:
- `CLAN_MAX_MEMBERS = 50` — `addMember` throws `BadRequestException` when `count >= 50`
- `disbandClan` is a **hard delete** (`tx.clan.delete`), not a soft-delete/status update — no `status` field exists on the Clan model
- Leader transfer (`promoteMember` with `role: 'leader'`) runs inside a transaction that: (1) demotes old leader to officer via `clanMember.updateMany`, (2) promotes new leader via `clanMember.update`, (3) updates `Clan.leaderId` via `clan.update`
- Non-leader promotions bypass the transaction entirely and call `prisma.clanMember.update` directly

Pre-existing TypeScript errors exist in `admin.service.ts`, `friendship.service.spec.ts`, `legal.service.ts`, `tournament.service.ts` — these are not clan-related and were present before this work.
