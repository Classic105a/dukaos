import { describe, it, expect } from 'vitest';
import {
  resolvePermissions,
  resolveEffectiveRole,
  NO_PERMISSIONS,
  type BusinessMembership,
} from '@/lib/permissions';

const BIZ_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BIZ_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const member = (
  business_id: string,
  role: string | null,
  extra: Partial<BusinessMembership> = {},
): BusinessMembership => ({
  business_id,
  user_id: USER,
  role,
  is_owner: false,
  status: 'active',
  ...extra,
});

/** Simulates the hook: pick the membership for the selected business only. */
const forBusiness = (memberships: BusinessMembership[], businessId: string) =>
  resolvePermissions(memberships.find(m => m.business_id === businessId) ?? null);

describe('resolveEffectiveRole', () => {
  it('treats is_owner as owner regardless of stored role', () => {
    expect(resolveEffectiveRole(member(BIZ_A, 'staff', { is_owner: true }))).toBe('owner');
  });
  it('ignores pending memberships', () => {
    expect(resolveEffectiveRole(member(BIZ_A, 'admin', { status: 'pending' }))).toBeNull();
  });
  it('ignores unknown roles and missing memberships', () => {
    expect(resolveEffectiveRole(member(BIZ_A, 'superuser'))).toBeNull();
    expect(resolveEffectiveRole(null)).toBeNull();
  });
});

describe('role tiers mirror the database policies', () => {
  it('owner gets every flag including role management', () => {
    const p = resolvePermissions(member(BIZ_A, 'owner', { is_owner: true }));
    expect(p.isOwner && p.isAdmin && p.isManager).toBe(true);
    expect(p.canChangeMemberRoles).toBe(true);
    expect(p.canManageBilling).toBe(true);
    expect(p.canProcessRefunds).toBe(true);
  });

  it('manager can refund/void/manage stock but not staff, modules or billing', () => {
    const p = resolvePermissions(member(BIZ_A, 'manager'));
    expect(p.isManager).toBe(true);
    expect(p.isAdmin).toBe(false);
    expect(p.canProcessRefunds).toBe(true);
    expect(p.canVoidSales).toBe(true);
    expect(p.canManageInventory).toBe(true);
    expect(p.canViewAuditLogs).toBe(true);
    expect(p.canManageUsers).toBe(false);
    expect(p.canManageModules).toBe(false);
    expect(p.canManageBilling).toBe(false);
    expect(p.canChangeMemberRoles).toBe(false);
  });

  it('admin manages staff/modules/billing but cannot change roles (owner-only)', () => {
    const p = resolvePermissions(member(BIZ_A, 'admin'));
    expect(p.canManageUsers).toBe(true);
    expect(p.canManageModules).toBe(true);
    expect(p.canManageBilling).toBe(true);
    expect(p.canChangeMemberRoles).toBe(false);
    expect(p.isOwner).toBe(false);
  });

  it('cashier and staff only get their own shift close; no restricted actions', () => {
    for (const role of ['cashier', 'attendant', 'staff']) {
      const p = resolvePermissions(member(BIZ_A, role));
      expect(p.isMember).toBe(true);
      expect(p.canCloseShifts).toBe(true);
      expect(p.canProcessRefunds).toBe(false);
      expect(p.canVoidSales).toBe(false);
      expect(p.canViewProfit).toBe(false);
      expect(p.canEditProducts).toBe(false);
      expect(p.canManageInventory).toBe(false);
      expect(p.canViewAuditLogs).toBe(false);
      expect(p.canManageUsers).toBe(false);
    }
  });

  it('a user with no membership gets nothing at all', () => {
    expect(resolvePermissions(null)).toEqual(NO_PERMISSIONS);
    expect(resolvePermissions(null).isMember).toBe(false);
  });
});

describe('multi-business isolation', () => {
  const memberships = [
    member(BIZ_A, 'owner', { is_owner: true }),
    member(BIZ_B, 'cashier'),
  ];

  it('same user, different roles per business — no leakage on switch', () => {
    const a = forBusiness(memberships, BIZ_A);
    const b = forBusiness(memberships, BIZ_B);
    expect(a.isOwner).toBe(true);
    expect(b.isOwner).toBe(false);
    expect(b.canProcessRefunds).toBe(false);
    expect(b.canManageUsers).toBe(false);
    // switching back must restore, not accumulate
    expect(forBusiness(memberships, BIZ_A).canChangeMemberRoles).toBe(true);
  });

  it('no membership in the second business means zero permissions', () => {
    const onlyA = [member(BIZ_A, 'admin')];
    expect(forBusiness(onlyA, BIZ_B)).toEqual(NO_PERMISSIONS);
    expect(forBusiness(onlyA, BIZ_A).canManageUsers).toBe(true);
  });

  it('a pending invite in another business grants nothing', () => {
    const list = [member(BIZ_A, 'manager'), member(BIZ_B, 'admin', { status: 'pending' })];
    expect(forBusiness(list, BIZ_B).isMember).toBe(false);
    expect(forBusiness(list, BIZ_A).canProcessRefunds).toBe(true);
  });
});
