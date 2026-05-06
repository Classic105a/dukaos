// Single source of truth for invite-assignable roles.
// Owners are NEVER assignable through invites — they are only created at business creation time.
export const INVITE_ROLES = ['admin', 'manager', 'attendant', 'cashier'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const INVITE_ROLE_LABELS: Record<InviteRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  attendant: 'Attendant',
  cashier: 'Cashier',
};

/**
 * Normalize and validate an invite role string. Returns the canonical role,
 * or null if the input is unrecognized OR is a forbidden role like "owner".
 */
export function normalizeInviteRole(input: unknown): InviteRole | null {
  if (typeof input !== 'string') return null;
  const v = input.trim().toLowerCase();
  if (!v) return null;
  // Explicitly reject owner — never assignable via invite
  if (v === 'owner') return null;
  return (INVITE_ROLES as readonly string[]).includes(v) ? (v as InviteRole) : null;
}

export const INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];