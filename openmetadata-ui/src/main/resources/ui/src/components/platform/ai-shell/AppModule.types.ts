/*
 *  Copyright 2026 Collate.
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

import { BadgeColors } from '@openmetadata/ui-core-components';
import { ComponentType, SVGProps } from 'react';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import { PluginRouteProps } from '../../Settings/Applications/plugins/AppPlugin';

/**
 * Shape of an SVG icon used in any nav surface (main sidebar, sub-nav,
 * rail). Centralised here so app modules and the sidebar derivation
 * agree on a single icon contract.
 */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Cross-component CTA intents. Definers (module sub-nav configs) and
 * listeners (route layouts via `useIntent`) both reference these
 * constants so a typo on either side is a compile error.
 */
export const Intent = {
  AddTestCase: 'add-test-case',
  AddBundleSuite: 'add-bundle-suite',
  UploadFile: 'upload-file',
  CreateArticle: 'create-article',
  AddQuickLink: 'add-quick-link',
} as const;
export type IntentName = (typeof Intent)[keyof typeof Intent];

export interface SubNavItem {
  key: string;
  icon?: IconComponent;
  activeIcon?: IconComponent;
  labelKey: string;
  /** Override icon shown in SubRail (collapsed) mode only */
  railIcon?: IconComponent;
  /** Override active icon shown in SubRail (collapsed) mode only */
  railActiveIcon?: IconComponent;
  /** Override tooltip label shown in SubRail (collapsed) mode only */
  railLabelKey?: string;
  /** A route the item navigates to. Omit for `intent`-only CTAs. */
  path?: string;
  /**
   * Extra route prefixes (besides `path`) that should also mark this item
   * active, for routes that logically belong to this section but live
   * outside `path`'s own subtree (e.g. an entity detail page reached from
   * a listing page at a sibling path). Each entry is matched the same way
   * as `path`: exact match or `pathname` starting with `${prefix}/`.
   */
  activePaths?: string[];
  /** Static fallback. Live counts come from a `badges` prop on `SubPanel`. */
  badgeCount?: number;
  /** Badge pill color; defaults to 'gray' (neutral count) when omitted. */
  badgeColor?: BadgeColors;
  /** CTA-styled item: semibold weight, secondary text color. */
  emphasized?: boolean;
  /**
   * Fires `emitIntent(intent)` on click instead of navigating. The
   * currently-mounted route layout listens via `useIntent`. Constrained
   * to known `IntentName`s so a typo on either side is a compile error.
   */
  intent?: IntentName;

  /**
   * Hide this item unless the current user holds `operation` on
   * `resource`. Omit for items everyone may see.
   *
   * Only for actions the UI can decide up front. Do **not** add this to
   * items whose permission depends on a selection made inside the flow.
   */
  requiredPermission?: {
    resource: ResourceEntity;
    operation: Operation;
  };
}

export interface SubNavSection {
  /** Optional section header i18n key; omit for an unheaded first block */
  headerKey?: string;
  /** Optional icon rendered to the left of the header label */
  headerIcon?: IconComponent;
  /** Optional i18n key for a badge pill rendered to the right of the header */
  headerBadgeKey?: string;
  /** Render a horizontal divider above this section */
  showDivider?: boolean;
  items: SubNavItem[];
}

export interface SubNavConfig {
  key: string;
  /** i18n key for the panel title (e.g. 'label.observability') */
  titleKey: string;
  /** Root route — a route whose pathname starts with this activates the sub-nav */
  rootPath: string;
  sections: SubNavSection[];
}

/**
 * Stable identifier for an app-mode module.
 *
 * Deliberately an OPEN `string` type (not a closed enum): OSS shared
 * modules and plugin (e.g. Collate) contributions interleave in a single
 * ordered list, so no single file can enumerate every id ahead of time.
 * Uniqueness across contributors is the contributor's responsibility.
 */
export type AppModuleId = string;

/**
 * Declarative configuration for a single app-mode module. A module owns a
 * contiguous URL namespace (`prefix`), every route inside that namespace,
 * the sidebar entry that links to it, and (optionally) its sub-nav.
 *
 * The app-mode sidebar derives its top-level items from the module list
 * (`useAllAppModules`), and the route table is the flat union of every
 * module's `routes` plus a contributed fallback — so adding a module is one
 * new entry in `LeftSidebarClassBase.getAppModeModules()` (which a downstream
 * build overrides to append its own).
 */
export interface AppModule {
  /** Stable identifier. Must be unique across all contributed modules. */
  id: AppModuleId;

  /**
   * Sort key controlling both route-flattening order and sidebar order.
   * Shared OSS modules and plugin contributions interleave by this value
   * (ascending). Ties keep insertion order.
   */
  navOrder: number;

  /** i18n key for the sidebar label (e.g. 'label.observability'). */
  labelKey: string;

  /**
   * Sidebar icon. Optional because some modules own routes but are not
   * surfaced in the main sidebar — the sidebar derivation skips modules
   * with no icon.
   */
  icon?: IconComponent;

  /** Icon shown when this sidebar item is active. */
  activeIcon?: IconComponent;

  /**
   * When true this item cannot be hidden per-persona: its visibility toggle
   * in the app-mode sidebar customize editor is disabled. Use for anchor
   * entries (e.g. New Chat) that must always render on the live sidebar.
   */
  disablePersonaHide?: boolean;

  /**
   * Primary URL namespace owned by this module (e.g. '/observability').
   * The sidebar item highlights when the current pathname starts with
   * this prefix; nothing outside the prefix belongs to the module.
   */
  prefix: string;

  /**
   * Additional path prefixes that also activate this module.
   * Needed when a module's sub-nav items span disjoint URL namespaces.
   */
  additionalPrefixes?: string[];

  /**
   * Path the sidebar click navigates to. Either equal to `prefix` (relying
   * on a route-level redirect to the real landing page) or to a deeper
   * path under it. Must start with `prefix`.
   */
  defaultPath: string;

  /** Routes owned by this module. Flattened into the app-mode route tree. */
  routes: PluginRouteProps[];

  /** Optional sub-navigation panel. */
  subNav?: SubNavConfig;
}
