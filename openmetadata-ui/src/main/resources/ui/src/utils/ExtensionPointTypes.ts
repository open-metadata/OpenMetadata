/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { ComponentType, ReactNode } from 'react';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { ServiceCategory } from '../enums/service.enum';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';
import { ServicesType } from '../interface/service.interface';

/**
 * Extension Point Type Definitions
 *
 * This file defines generic contribution types that can be used
 * with any extension point in the application.
 */

/**
 * Registry of all available extension point IDs
 *
 * Add new extension points here as they are created.
 */
export const EXTENSION_POINTS = {
  // Service Details Page
  SERVICE_DETAILS_TABS: 'service-details.tabs',
  SERVICE_DETAILS_ACTIONS: 'service-details.actions',

  // Table Details Page
  TABLE_DETAILS_TABS: 'table-details.tabs',
  TABLE_HEADER_ACTIONS: 'table-header.actions',

  // Database Details Page
  DATABASE_DETAILS_TABS: 'database-details.tabs',

  // User Profile Page
  PROFILE_TABS: 'profile.tabs',

  // Global UI
  GLOBAL_FLOATING_BUTTONS: 'global.floating-buttons',
} as const;

/**
 * Type-safe extension point IDs
 */
export type ExtensionPointId =
  typeof EXTENSION_POINTS[keyof typeof EXTENSION_POINTS];

// ============================================================================
// Plugin Context Types
// ============================================================================

/**
 * Context passed to plugin extensions
 * This is the standard context type used across all plugin extension points
 */
export interface PluginEntityDetailsContext {
  serviceCategory?: ServiceCategory;
  serviceDetails?: ServicesType;
  permissions?: OperationPermission;
  entityType?: string;
  entity?: EntityReference;
  userData?: User;
  isLoggedInUser?: boolean;
}

// ============================================================================
// Generic Contribution Types
// ============================================================================

/**
 * Generic tab contribution
 *
 * @example
 * ```typescript
 * // Contribute a tab
 * registry.contribute<TabContribution>({
 *   extensionPointId: 'service-details.tabs',
 *   data: {
 *     key: 'my-tab',
 *     label: 'My Tab',
 *     component: MyTabComponent,
 *     condition: (ctx) => ctx.serviceCategory === ServiceCategory.DATABASE_SERVICES
 *   }
 * });
 * ```
 */
export interface TabContribution {
  /** Unique key for the tab */
  key: string;

  /** Display label for the tab (can be a translation key or string) */
  label: string | ReactNode;

  /** React component to render for tab content */
  component: ComponentType<PluginEntityDetailsContext>;

  /** Optional count badge to display on tab */
  count?: number;

  /** Condition function to determine if tab should be shown */
  condition?: (context: PluginEntityDetailsContext) => boolean;

  /** Whether the tab is hidden (alternative to condition) */
  isHidden?: boolean;
}

/**
 * Generic action button contribution
 *
 * @example
 * ```typescript
 * registry.contribute<ActionContribution>({
 *   extensionPointId: 'my-page.actions',
 *   data: {
 *     key: 'my-action',
 *     label: 'My Action',
 *     onClick: (ctx) => console.log(ctx.entityType),
 *     condition: (ctx) => ctx.permissions?.Edit
 *   }
 * });
 * ```
 */
export interface ActionContribution {
  /** Unique key for the action */
  key: string;

  /** Display label for the action */
  label: string | ReactNode;

  /** Optional icon component */
  icon?: ComponentType;

  /** Click handler */
  onClick: (context: PluginEntityDetailsContext) => void;

  /** Condition function to determine if action should be shown */
  condition?: (context: PluginEntityDetailsContext) => boolean;

  /** Button type (primary, default, link, etc.) */
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';

  /** Button danger flag */
  danger?: boolean;
}
