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
import type { AuthProvider } from '../../../../../../generated/settings/settings';
import { PLATFORM_SETTINGS_PAGES } from './PlatformSettings.constants';
import type {
  PlatformSettingsPage,
  PlatformSettingsView,
} from './PlatformSettings.types';

const EDIT_SEGMENT = 'edit';
const LANDING_VIEW: PlatformSettingsView = { type: 'landing' };

export const getVisiblePlatformSettingsPages = (
  authProvider?: AuthProvider
): PlatformSettingsPage[] =>
  PLATFORM_SETTINGS_PAGES.filter(
    (page) => !page.isVisible || page.isVisible(authProvider)
  );

/**
 * Unknown, hidden or malformed sub-paths fall back to the landing page so a
 * stale deep link never renders an empty panel.
 */
export const hashSubPathToView = (
  subPath: string,
  pages: PlatformSettingsPage[]
): PlatformSettingsView => {
  const [pageId, mode] = subPath.split('/');
  const page = pages.find((item) => item.id === pageId);

  if (!page) {
    return LANDING_VIEW;
  }

  return {
    type: 'page',
    page: page.id,
    isEditing: Boolean(page.hasEditView) && mode === EDIT_SEGMENT,
  };
};

export const viewToSubPath = (
  view: PlatformSettingsView
): string | undefined => {
  if (view.type === 'landing') {
    return undefined;
  }

  return view.isEditing ? `${view.page}/${EDIT_SEGMENT}` : view.page;
};

/** Number inputs hold strings; an empty input means "unset", not zero. */
export const toOptionalNumber = (value: string): number | undefined =>
  value.trim() === '' ? undefined : Number(value);

export const nonNegativeNumberRules = (
  t: TFunction,
  labelKey: string,
  required = false
) => ({
  ...(required
    ? { required: t('label.field-required', { field: t(labelKey) }) }
    : {}),
  validate: (value: string) =>
    value.trim() === '' ||
    Number(value) >= 0 ||
    `${t('label.greater-than-or-equal-to')} 0`,
});
