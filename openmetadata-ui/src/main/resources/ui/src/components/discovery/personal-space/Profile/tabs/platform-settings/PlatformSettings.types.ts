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

import type { FC } from 'react';
import type { AuthProvider } from '../../../../../../generated/settings/settings';

export type PlatformSettingsPageId =
  | 'email'
  | 'login-configuration'
  | 'health-check'
  | 'lineage'
  | 'brand-url'
  | 'app-mode';

export type PlatformSettingsView =
  | { type: 'landing' }
  | { type: 'page'; page: PlatformSettingsPageId; isEditing: boolean };

export interface PlatformSettingsPage {
  id: PlatformSettingsPageId;
  icon: FC<{ className?: string }>;
  titleKey: string;
  descriptionKey: string;
  /** Read-only view first, with an Edit action that opens `<page>/edit`. */
  hasEditView?: boolean;
  /** False when the edit form has no per-field docs to offer as hints. */
  hasFieldHints?: boolean;
  isVisible?: (authProvider?: AuthProvider) => boolean;
}

/** Shared by every platform-settings page: report back to the panel. */
export interface PlatformSettingsPageProps {
  onNavigate: (view: PlatformSettingsView) => void;
  onSetHeaderActions: (actions: React.ReactNode) => void;
}

export interface PlatformSettingsFormProps {
  showHint: boolean;
  onNavigate: (view: PlatformSettingsView) => void;
}
