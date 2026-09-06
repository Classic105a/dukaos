// ---------------------------------------------------------------------------
// Frontend permission resolver — UI VISIBILITY ONLY.
//
// Mirrors the per-business role model enforced by the database
// (public.business_users + has_business_role / is_business_owner). It answers
// "should this control be shown?", never "is this operation authorized?" —
// RLS policies and SECURITY DEFINER RPCs remain the sole authority.
//
// Role tiers, exactly as the database policies group them:
//   owner  ............ is_business_owner() OR role = 'owner'
//   admin  ............ has_business_role(..., ['owner','admin'])
//   manager ........... has_business_role(..., ['owner','admin','manager'])
//   cashier/attendant/staff ... basic member (sales, own shifts, own data)
// ---------------------------------------------------------------------------

export const BUSINESS_ROLES = ['owner', 'admin', 'manager', 'attendant', 'cashier', 'staff'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

/** Row shape of public.business_users that the resolver depends on. */
export interface BusinessMembership {
  business_id: string;
  user_id: string;
  role: string | null;
  is_owner: boolean | null;
  status: string | null;
}

export interface Permissions {
  canViewProfit: boolean;
  canEditProducts: boolean;
  canProcessRefunds: boolean;
  canApproveRefunds: boolean;
  canManageInventory: boolean;
  canManageUsers: boolean;
  canChangeMemberRoles: boolean;
  canViewReports: boolean;
  canManageBranches: boolean;
  canManageModules: boolean;
  canManageBilling: boolean;
  canVoidSales: boolean;
  canApplyCreditSales: boolean;
  canManageCustomerCredit: boolean;
  canViewAuditLogs: boolean;
  canCloseShifts: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  /** True only when the user has an ACTIVE membership in the selected business. */
  isMember: boolean;
}

export const NO_PERMISSIONS: Permissions = Object.freeze({
  canViewProfit: false,
  canEditProducts: false,
  canProcessRefunds: false,
  canApproveRefunds: false,
  canManageInventory: false,
  canManageUsers: false,
  canChangeMemberRoles: false,
  canViewReports: false,
  canManageBranches: false,
  canManageModules: false,
  canManageBilling: false,
  canVoidSales: false,
  canApplyCreditSales: false,
  canManageCustomerCredit: false,
  canViewAuditLogs: false,
  canCloseShifts: false,
  isManager: false,
  isAdmin: false,
  isOwner: false,
  isMember: false,
}) as Permissions;

export const normalizeBusinessRole = (input: unknown): BusinessRole | null => {
  if (typeof input !== 'string') return null;
  const v = input.trim().toLowerCase();
  return (BUSINESS_ROLES as readonly string[]).includes(v) ? (v as BusinessRole) : null;
};

/**
 * Effective role for the selected business. `is_owner = true` always wins
 * (matches is_business_owner()), otherwise the stored role. Pending or
 * missing memberships resolve to null — the DB grants nothing either.
 */
export const resolveEffectiveRole = (
  membership: BusinessMembership | null | undefined,
): BusinessRole | null => {
  if (!membership) return null;
  if ((membership.status ?? 'active') !== 'active') return null;
  if (membership.is_owner) return 'owner';
  return normalizeBusinessRole(membership.role);
};

export const resolvePermissions = (
  membership: BusinessMembership | null | undefined,
): Permissions => {
  const role = resolveEffectiveRole(membership);
  if (!role) return NO_PERMISSIONS;

  const isOwner = role === 'owner';
  const isAdmin = isOwner || role === 'admin';
  const isManager = isAdmin || role === 'manager';

  return {
    // Manager tier — RLS: has_business_role(owner, admin, manager)
    canViewProfit: isManager,
    canEditProducts: isManager,
    canProcessRefunds: isManager, // process_return() requires manager+
    canApproveRefunds: isManager, // approval_requests update policy
    canManageInventory: isManager, // stock_movements / branch_inventory / transfers
    canViewReports: isManager, // sales SELECT policy for other cashiers' sales
    canManageBranches: isManager, // branches ALL policy
    canVoidSales: isManager, // sales UPDATE policy
    canApplyCreditSales: isManager,
    canManageCustomerCredit: isManager, // credit_transactions policy
    canViewAuditLogs: isManager, // audit_logs SELECT policy
    // Admin tier — RLS: has_business_role(owner, admin)
    canManageUsers: isAdmin, // custom_permissions, branch_users, invites, profiles
    canManageModules: isAdmin, // business_modules
    canManageBilling: isAdmin, // business_subscriptions / subscription_invoices
    // Owner tier — RLS: is_business_owner() on business_users
    canChangeMemberRoles: isOwner,
    // Every active member can close their own shift.
    canCloseShifts: true,
    isManager,
    isAdmin,
    isOwner,
    isMember: true,
  };
};
