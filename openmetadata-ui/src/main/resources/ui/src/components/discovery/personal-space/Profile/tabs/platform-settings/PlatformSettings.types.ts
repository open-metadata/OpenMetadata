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

import type { TFunction } from 'i18next';
import type { ComponentType, FC } from 'react';
import type { AuthProvider } from '../../../../../../generated/settings/settings';

export type PlatformSettingsPageId =
  | 'theme'
  | 'email'
  | 'login-configuration'
  | 'health-check'
  | 'profiler-configuration'
  | 'data-quality'
  | 'lineage'
  | 'brand-url'
  | 'data-asset-rules'
  | 'learning-resources'
  | 'search'
  | 'table-schema'
  | 'app-mode'
  | 'glossary'
  | 'time-format';

export type PlatformSettingsView =
  | { type: 'landing' }
  | {
      type: 'page';
      /** A built-in `PlatformSettingsPageId`, or a contributed page's id. */
      page: string;
      isEditing: boolean;
      /** List pages: the item being edited; absent on `edit` means "add". */
      itemId?: string;
    };

export interface PlatformSettingsPage {
  /** A built-in `PlatformSettingsPageId`, or a contributed page's id. */
  id: string;
  icon: FC<{ className?: string }>;
  titleKey: string;
  descriptionKey: string;
  /** Read-only view first, with an Edit action that opens `<page>/edit`. */
  hasEditView?: boolean;
  /** Shows a "Beta" badge on the landing card, as the classic menu did. */
  isBeta?: boolean;
  /** False when the edit form has no per-field docs to offer as hints. */
  hasFieldHints?: boolean;
  isVisible?: (authProvider?: AuthProvider) => boolean;
  /** Read-only sub-pages at `<page>/<itemId>`, e.g. one entity's search settings. */
  hasItemViews?: boolean;
  /** Header title for a read-only sub-page. */
  getItemTitle?: (t: TFunction, itemId: string) => string;
  /** Overrides the default "Edit {title}" header, e.g. "Add Dimension" on a list page. */
  getEditTitle?: (t: TFunction, itemId?: string) => string;
  /** Read-only view of a contributed page; built-in pages are mapped in the panel. */
  component?: ComponentType<PlatformSettingsPageProps>;
}

/**
 * A page a downstream build adds through `PLATFORM_SETTINGS_PAGES`. View-only:
 * edit and item routes resolve through the built-in maps, so they are not part
 * of the contract (ADR:2026-10-12-platform-settings-pages-extension-point).
 */
export type PlatformSettingsPageContribution = Pick<
  PlatformSettingsPage,
  'id' | 'icon' | 'titleKey' | 'descriptionKey' | 'isBeta' | 'isVisible'
> &
  Required<Pick<PlatformSettingsPage, 'component'>>;

/** Shared by every platform-settings page: report back to the panel. */
export interface PlatformSettingsPageProps {
  itemId?: string;
  onNavigate: (view: PlatformSettingsView) => void;
  onSetHeaderActions: (actions: React.ReactNode) => void;
  /**
   * State the page saved before it unmounted (e.g. a list's search and page
   * while one of its items is open), kept by the panel until it closes.
   */
  savedState?: unknown;
  onSaveState?: (state: unknown) => void;
}

export interface PlatformSettingsFormProps
  extends Pick<PlatformSettingsPageProps, 'savedState' | 'onSaveState'> {
  showHint: boolean;
  itemId?: string;
  onNavigate: (view: PlatformSettingsView) => void;
}
