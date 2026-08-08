export interface MenuAccessPermission {
  menuKey: string;
  menuName: string;
  view: boolean;
  edit: boolean;
}

export interface MenuItemDefinition {
  key: string;
  name: string;
  path: string;
}

export const APP_MENUS: MenuItemDefinition[] = [
  { key: 'dashboard', name: 'Dashboard', path: '/' },
  { key: 'pos', name: 'Billing & POS', path: '/pos' },
  { key: 'orders', name: 'Orders & Billing', path: '/orders' },
  { key: 'wholesaler_orders', name: 'Wholesaler Orders', path: '/wholesaler-orders' },
  { key: 'walk_in_sales', name: 'Walk-In Sales', path: '/walk-in-sales' },
  { key: 'customers', name: 'Customers', path: '/customers' },
  { key: 'wholesalers', name: 'Wholesalers', path: '/wholesalers' },
  { key: 'items', name: 'Item Master & Pricing', path: '/items' },
  { key: 'price_list', name: 'Price List', path: '/price-list' },
  { key: 'inventory', name: 'Inventory & Stock', path: '/inventory' },
  { key: 'manufacturing_portal', name: 'Manufacturing Portal', path: '/manufacturing-portal' },
  { key: 'manufacturing', name: 'Manufacturing Setup', path: '/manufacturing' },
  { key: 'packing_portal', name: 'Packing Portal', path: '/packing-portal' },
  { key: 'packing', name: 'Packing Setup', path: '/packing' },
  { key: 'store', name: 'Store', path: '/store' },
  { key: 'payroll', name: 'Payroll & Attendance', path: '/payroll' },
  { key: 'employee_portal', name: 'Employee Portal', path: '/employee-portal' },
  { key: 'support', name: 'Support & Tickets', path: '/support' },
  { key: 'settings', name: 'Settings', path: '/settings' }
];

/**
 * Dynamically merges an employee's existing saved permissions with the central APP_MENUS list.
 * Any new menu added to APP_MENUS automatically gets included!
 */
export function getMergedEmployeePermissions(
  existingPermissions?: MenuAccessPermission[]
): Record<string, MenuAccessPermission> {
  const permMap: Record<string, MenuAccessPermission> = {};

  APP_MENUS.forEach((menu) => {
    const existing = existingPermissions?.find((p) => p.menuKey === menu.key);
    permMap[menu.key] = {
      menuKey: menu.key,
      menuName: menu.name,
      view: existing ? existing.view : menu.key === 'employee_portal',
      edit: existing ? existing.edit : false
    };
  });

  return permMap;
}
