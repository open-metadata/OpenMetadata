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

import { ComponentType, FC, ReactElement, ReactNode } from 'react';
import {
  TaskDetailDescriptor,
  TaskStatTilesProps,
} from '../components/discovery/personal-space/InboxPage/taskDetail.types';
import type { ProfileHeaderOverride } from '../components/discovery/personal-space/Profile/profileNavConfig';
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
import { EXTENSION_POINTS } from './extensionPoints';

export { EXTENSION_POINTS };

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
  /**
   * Allows a contributed tab to override the ProfilePage header (breadcrumbs,
   * title, actions) without needing a separate route. Only provided by
   * ProfilePage when it maps contributed tabs; other consumers leave it absent.
   * Pass `null` to clear the override and restore the default header.
   */
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
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

  /**
   * Optional self-rendered live badge, shown next to the tab label. The consuming
   * page renders it (with the page context) inside every contributed tab's
   * trigger — not just the active one — so the badge can reflect data the
   * contribution fetches itself and stay in sync while another tab is active
   * (e.g. a live agents count driven by a stream). Takes precedence over the
   * static `count`. Provide it as a lazily-loaded component so its data layer is
   * not pulled onto the plugin's boot path.
   */
  badgeComponent?: ComponentType<PluginEntityDetailsContext>;

  /** Optional sort order (ascending) among contributed tabs; unset sorts last/insertion order. */
  order?: number;

  /** Condition function to determine if tab should be shown */
  condition?: (context: PluginEntityDetailsContext) => boolean;

  /** Whether the tab is hidden (alternative to condition) */
  isHidden?: boolean;

  /**
   * Sidebar group this tab belongs to. Consumers that render tabs in a grouped
   * side-nav (e.g. ProfilePage) use this to place the item under the right
   * section header. Defaults to 'credentials' when omitted.
   */
  group?: string;

  /**
   * When true, the host page skips its standard content scroll wrapper and lets
   * the tab manage its own layout (e.g. a page that needs a sticky footer).
   */
  selfContainedLayout?: boolean;
}

/**
 * Props passed to a contributed `NotificationSectionContribution.component`.
 *
 * A section is expected to clear what it pushed via `onSetHeaderActions` /
 * `onSetSubTitle` on unmount (e.g. an effect cleanup), the same way the native
 * alert detail panel does — the panel does not reset this for you.
 */
export interface NotificationSectionProps {
  /**
   * Inject (or clear, with `null`) the action buttons shown on the right of the
   * profile content header for this section — e.g. a "Create" button. Mirrors
   * how the native alert detail panel populates the header.
   */
  onSetHeaderActions?: (actions: ReactNode | null) => void;

  /** Navigate back to the Notification landing (e.g. after cancel). */
  onClose?: () => void;

  /**
   * Hash path below the section root (`#notification/section/<key>/<subPath>`),
   * e.g. `add` or `edit/<fqn>`. Empty at the section root.
   */
  subPath?: string;

  /**
   * Navigate within the section; omit `subPath` to return to its root.
   * `params` become the hash query (e.g. a list's paging), so a section can
   * carry its state through a sub-page and back; omitted, the query is cleared.
   */
  onNavigate?: (
    subPath?: string,
    params?: Record<string, string | undefined>
  ) => void;

  /**
   * Name the current sub-page (e.g. "Add Template"). The header then shows it
   * as the title and as a trailing breadcrumb after the section's own crumb,
   * which becomes clickable back to the section root. `null` clears it.
   */
  onSetSubTitle?: (title: string | null) => void;
}

/**
 * Notification landing section contribution
 *
 * A downstream build contributes a self-contained section component that the
 * profile Notification panel renders as its own view. The card for it comes
 * from the global-settings Notifications menu (matched by `key`), so the key
 * MUST equal that menu option's suffix (e.g. `weekly-emails`).
 *
 * @example
 * ```typescript
 * registry.contribute<NotificationSectionContribution>({
 *   extensionPointId: EXTENSION_POINTS.NOTIFICATION_LANDING_SECTIONS,
 *   data: { key: 'weekly-emails', component: WeeklyEmailSettingsPage },
 * });
 * ```
 */
export interface NotificationSectionContribution {
  /** Settings option suffix this section renders for (e.g. `weekly-emails`). */
  key: string;

  /** Self-contained component rendered in the Notification panel body. */
  component: ComponentType<NotificationSectionProps>;

  /** Landing card icon; falls back to the settings menu item's icon. */
  icon?: ComponentType<{ className?: string }>;
}

/**
 * Members landing section contribution
 *
 * A downstream build contributes a self-contained section that the profile
 * Members panel renders as its own view (`#members/section/<key>`), with a card
 * appended to the Members landing grid. Unlike the Notification sections, the
 * card's label/description come from the contribution itself — there is no
 * global-settings menu entry to borrow them from.
 *
 * @example
 * ```typescript
 * registry.contribute<MembersSectionContribution>({
 *   extensionPointId: EXTENSION_POINTS.MEMBERS_LANDING_SECTIONS,
 *   data: {
 *     key: 'provisioning',
 *     component: UserAndTeamProvisioning,
 *     titleKey: 'label.provisioning',
 *     descriptionKey: 'message.user-and-team-provisioning-desc',
 *   },
 * });
 * ```
 */
export interface MembersSectionContribution {
  /** Hash segment this section renders for (e.g. `provisioning`). */
  key: string;

  /** Self-contained component rendered in the Members panel body. */
  component: ComponentType<NotificationSectionProps>;

  /**
   * Landing card icon. Typed `FC` (not `ComponentType`) to match the icon maps
   * in `Members.utils`, which the panel feeds this straight into.
   */
  icon?: FC<{ className?: string }>;

  /** i18n key for the landing card title and the section's header/breadcrumb. */
  titleKey: string;

  /** i18n key for the landing card description and the section's header. */
  descriptionKey?: string;
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

  /** Click handler. Ignored when `component` is set. */
  onClick?: (context: PluginEntityDetailsContext) => void;

  /**
   * Optional self-rendered action. When set, the consumer renders this
   * component in the action region (passing it the page context) instead of the
   * default `label` + `onClick` button, so the component can own its own
   * disabled/loading/tooltip state — e.g. a trigger whose disabled state tracks
   * a live status the static `label`/`onClick` shape cannot express. `label`,
   * `icon`, `onClick`, `type`, and `danger` are ignored when `component` is set.
   */
  component?: ComponentType<PluginEntityDetailsContext>;

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
 * Props the connections list page passes to a `CONNECTIONS_LIST_ONBOARDING`
 * contribution. The page owns the estate query and the browse chrome; the
 * contribution owns the first-run decision (who is a first-run admin, what the
 * checklist is), which OSS core has no notion of.
 *
 * The contribution is mounted on every load — not only on an empty estate — so
 * it can read `estateTotal` (avoiding a second `/services/overview`) and drive
 * its own gate, then report through `onActiveChange` whether it is showing its
 * onboarding UI. The page hides the browse chrome and the list behind it while
 * it is active, and shows them (with the generic empty-state placeholder for an
 * empty estate) while it is not.
 */
export interface ConnectionsOnboardingSlotProps {
  /** Unfiltered estate size from the page's own overview query (for the "has a service" gate). */
  estateTotal: number;
  /**
   * The page's own "settled, empty, unnarrowed estate" signal (no rows, not loading, not errored,
   * no search/filter). The contribution combines it with its own first-run/admin decision — the
   * page cannot make that call — and reports the result via `onActiveChange`.
   */
  isEmptyUnnarrowedEstate: boolean;
  /** Report whether the onboarding UI is showing, so the page can hide/show the browse view. */
  onActiveChange: (active: boolean) => void;
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
 * Task-type-specific detail for the inbox (`inbox.task-panels`). When
 * `condition(task)` matches, the contribution refines how the task's detail pane
 * renders. The first matching contribution wins.
 *
 * OSS describes its own task types; a plugin contributes only the types it owns
 * (a Data Access Request's access terms, say) and overrides just the slices it
 * knows better, leaving the layout to the inbox.
 */
export interface InboxTaskPanelContribution {
  /** Stable key, unique within the slot. */
  key: string;
  /** True when this panel should render for the given task. */
  condition: (task: Task) => boolean;
  /**
   * Overrides merged over the descriptor the inbox derives for this task —
   * summary rows, callout, type chip or action labels.
   */
  describe?: (
    task: Task,
    t: (key: string, options?: Record<string, unknown>) => string
  ) => Partial<TaskDetailDescriptor>;
  /** Replaces the asset card's default stat tiles. */
  stats?: ComponentType<TaskStatTilesProps>;
  /**
   * Replaces the generic summary rows with a bespoke body.
   *
   * @deprecated Prefer `describe` (and `stats`), which keep the pane's layout,
   * spacing and callout consistent across task types.
   */
  component?: ComponentType<{ id: string; task: Task }>;
}
