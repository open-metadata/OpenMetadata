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

import { ComponentType, ReactElement, ReactNode } from 'react';
import { PluginRouteProps } from '../components/Settings/Applications/plugins/AppPlugin';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { ServiceCategory } from '../enums/service.enum';
import { Task } from '../generated/entity/tasks/task';
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

  // Team Details Page
  TEAM_DETAILS_TABS: 'team-details.tabs',

  // Global UI
  GLOBAL_FLOATING_BUTTONS: 'global.floating-buttons',

  // App Mode Shell (platform / ai-shell)
  // A plugin contributes AI-exclusive chrome through these points so OSS
  // core never imports plugin code. Read via the typed helpers in
  // `components/platform/ai-shell/appModeExtensions.ts`. Modules (nav +
  // owned routes) are NOT contributed here — AI is an app layout, so
  // its modules come from `LeftSidebarClassBase.getAppModeModules()` (a
  // downstream build overrides that), read via `sharedAppModules.ts`.
  APP_MODE_ROUTES_FALLBACK: 'app-mode.routes.fallback',
  APP_MODE_LAYOUT_BANNERS: 'app-mode.layout.banners',
  APP_MODE_LAYOUT_OVERLAYS: 'app-mode.layout.overlays',
  // Sidebar region slots — proprietary chrome (chat list, profile, inbox,
  // user menu) a plugin injects into the neutral shell sidebar.
  APP_MODE_SIDEBAR_HEADER: 'app-mode.sidebar.header',
  APP_MODE_SIDEBAR_MAIN_FOOTER: 'app-mode.sidebar.mainFooter',
  APP_MODE_SIDEBAR_RAIL_FOOTER: 'app-mode.sidebar.railFooter',
  // Recent-activity region between the nav and the footer — e.g. a plugin's
  // recent-chats list (expanded panel) and its collapsed-rail popover.
  APP_MODE_SIDEBAR_RECENT: 'app-mode.sidebar.recent',
  APP_MODE_SIDEBAR_RECENT_RAIL: 'app-mode.sidebar.recentRail',

  // Inbox task overview — a plugin contributes a task-type-specific detail
  // panel (e.g. a Data Access Request panel) that replaces the generic task
  // overview when its `condition(task)` matches. The core inbox renders the
  // generic overview standalone when nothing is contributed.
  INBOX_TASK_PANELS: 'inbox.task-panels',

  // Connections (integration domain) — page-level slots a plugin fills with
  // proprietary AI surfaces so OSS core never imports plugin code.
  CONNECTIONS_PAGE_FOOTER: 'connections.page.footer',
  SERVICE_DETAILS_FOOTER: 'service-details.footer',
  CONNECTIONS_LIST_ONBOARDING: 'connections.list.onboarding',
  CONNECTIONS_ROUTES: 'connections.routes',
} as const;

/**
 * Type-safe extension point IDs
 */
export type ExtensionPointId =
  (typeof EXTENSION_POINTS)[keyof typeof EXTENSION_POINTS];

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
  teamId?: string;
  /**
   * True when the consumer is the app-mode (AI) surface rather than a classic
   * page. Lets a plugin contribute a mode-specific variant of the same tab
   * (e.g. a compact vs. table layout) via `condition`.
   */
  isAiMode?: boolean;
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

  /**
   * Optional icon for consumers that render tabs as a nav with icons (e.g. the
   * app-mode profile side-nav). Classic tab bars that show label-only ignore it.
   */
  icon?: ComponentType<{ className?: string }>;

  /**
   * Optional description/subtitle (translation key or string) for consumers
   * that render a content header per tab. Ignored by label-only tab bars.
   */
  description?: string;

  /** Optional count badge to display on tab */
  count?: number;

  /** Optional sort order (ascending) among contributed tabs; unset sorts last/insertion order. */
  order?: number;

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

/**
 * Generic single-component slot. The consumer renders `component` in a fixed
 * region and passes it the page context. Used for page footers, onboarding
 * regions, and other single-widget injection points.
 */
export interface SlotContribution {
  key: string;
  component: ComponentType<PluginEntityDetailsContext>;
}

/**
 * A route a plugin splices into a module's route table. `order` (ascending)
 * controls placement relative to sibling contributions; the consuming module
 * still relies on react-router specificity for final matching.
 */
export interface RouteContribution {
  key: string;
  order?: number;
  route: PluginRouteProps;
}

// ============================================================================
// App Mode Shell Contribution Types
// ============================================================================

/**
 * Contribution to `app-mode.routes.fallback`. The `element` becomes the
 * catch-all (`path="*"`) route mounted last in the app-mode route table —
 * i.e. what renders for any URL no module route matched. Last contribution
 * wins.
 */
export interface AppModeRoutesFallbackContribution {
  element: ReactElement;
}

/**
 * Generic layout / sidebar region slot. A plugin renders proprietary chrome
 * (banners, overlays, chat list, profile, inbox) into a named region of the
 * neutral shell without OSS importing plugin code. Contributions stack in
 * registration order.
 */
export interface AppModeSlotContribution {
  /** Stable React key, unique within the slot. */
  key: string;
  /** Rendered with no props at the slot location. */
  component: ComponentType;
}

/**
 * Task-type-specific overview panel for the inbox (`inbox.task-panels`). When
 * `condition(task)` matches, the inbox renders `component` in place of the
 * generic task overview. The first matching contribution wins.
 */
export interface InboxTaskPanelContribution {
  /** Stable key, unique within the slot. */
  key: string;
  /** True when this panel should render for the given task. */
  condition: (task: Task) => boolean;
  /** Replaces the generic task overview body for a matching task. */
  component: ComponentType<{ id: string; task: Task }>;
}
