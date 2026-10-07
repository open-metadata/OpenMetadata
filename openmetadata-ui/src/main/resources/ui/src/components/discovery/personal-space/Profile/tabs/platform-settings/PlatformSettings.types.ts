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
import type { FC } from 'react';
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
  | 'app-mode';

export type PlatformSettingsView =
  | { type: 'landing' }
  | {
      type: 'page';
      page: PlatformSettingsPageId;
      isEditing: boolean;
      /** List pages: the item being edited; absent on `edit` means "add". */
      itemId?: string;
    };

export interface PlatformSettingsPage {
  id: PlatformSettingsPageId;
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
  /** Overrides the default "Edit {title}" header, e.g. "Add Dimension" on a list page. */
  getEditTitle?: (t: TFunction, itemId?: string) => string;
}

/** Shared by every platform-settings page: report back to the panel. */
export interface PlatformSettingsPageProps {
  onNavigate: (view: PlatformSettingsView) => void;
  onSetHeaderActions: (actions: React.ReactNode) => void;
}

export interface PlatformSettingsFormProps {
  showHint: boolean;
  itemId?: string;
  onNavigate: (view: PlatformSettingsView) => void;
}
