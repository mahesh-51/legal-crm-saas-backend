import { ModulePermissionSelection } from '../../common/types/module-permission.type';

export interface ModuleActionCatalogItem {
  module: string;
  actions: string[];
}

export const MODULE_ACTIONS_CATALOG: ModuleActionCatalogItem[] = [
  { module: 'dashboard', actions: ['view'] },
  { module: 'clients', actions: ['view', 'create', 'update', 'delete'] },
  { module: 'matters', actions: ['view', 'create', 'update', 'delete'] },
  { module: 'daily-listings', actions: ['view', 'create', 'update', 'delete'] },
  { module: 'documents', actions: ['view', 'create', 'update', 'delete'] },
  { module: 'invoices', actions: ['view', 'create', 'update', 'delete'] },
  { module: 'tasks', actions: ['view', 'create', 'update', 'delete'] },
  { module: 'meetings', actions: ['view', 'create', 'update', 'delete'] },
  { module: 'notifications', actions: ['view', 'update'] },
  { module: 'courts', actions: ['view', 'create', 'update', 'delete'] },
];

export function getDefaultFirmAdminPermissions(): ModulePermissionSelection[] {
  return MODULE_ACTIONS_CATALOG.map(
    (item: ModuleActionCatalogItem): ModulePermissionSelection => ({
      module: item.module,
      actions: [...item.actions],
    }),
  );
}
