// Single source of truth for which permission flag unlocks each route.
// Consumed by the sidebar, the More page and the route guard so navigation
// and route access can never disagree. UI only — RLS remains the authority.
import type { Permissions } from './permissions';

export type PermissionKey = keyof Permissions;

const ROUTE_ACCESS: Record<string, PermissionKey> = {
  '/command-center': 'canViewReports',
  '/dashboard': 'isMember',
  '/analytics': 'canViewReports',
  '/promotions': 'canEditProducts',
  '/inventory': 'canEditProducts',
  '/smart-inventory': 'canManageInventory',
  '/warehouse': 'canManageInventory',
  '/reports': 'isMember', // Sales History; RLS limits cashiers to own sales
  '/customers': 'isMember',
  '/parties': 'canManageInventory',
  '/debts': 'canManageCustomerCredit',
  '/branches': 'canManageBranches',
  '/subscription': 'canManageBilling',
  '/audit-log': 'canViewAuditLogs',
  '/observability': 'isAdmin',
  '/more': 'isMember',
  '/onboarding': 'isMember',
};

// Settings tabs (query-string based).
const SETTINGS_TAB_ACCESS: Record<string, PermissionKey> = {
  profile: 'isMember',
  security: 'isMember',
  preferences: 'isMember',
  team: 'canManageUsers',
  approvals: 'canManageUsers',
  receipts: 'canManageBranches',
  printers: 'canManageBranches',
  tax: 'canManageUsers',
};

export const requiredPermission = (path: string): PermissionKey => {
  const [pathname, query = ''] = path.split('?');
  if (pathname === '/settings') {
    const tab = new URLSearchParams(query).get('tab');
    if (!tab) return 'canManageUsers';
    return SETTINGS_TAB_ACCESS[tab] ?? 'canManageUsers';
  }
  if (pathname.startsWith('/customers/')) return 'isMember';
  return ROUTE_ACCESS[pathname] ?? 'isMember';
};

export const canAccess = (perms: Permissions, path: string) => !!perms[requiredPermission(path)];

/** Where a user lands when a route is not available to them. */
export const homeFor = (perms: Permissions) => (perms.canViewReports ? '/command-center' : '/dashboard');
