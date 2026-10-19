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
  const [pageId, mode, ...rest] = subPath.split('/');
  const page = pages.find((item) => item.id === pageId);

  if (!page) {
    return LANDING_VIEW;
  }

  const isEditing = Boolean(page.hasEditView) && mode === EDIT_SEGMENT;
  let itemId: string | undefined;
  if (isEditing) {
    itemId = rest.length ? rest.join('/') : undefined;
  } else if (page.hasItemViews && mode && mode !== EDIT_SEGMENT) {
    itemId = [mode, ...rest].join('/');
  }

  return {
    type: 'page',
    page: page.id,
    isEditing,
    ...(itemId ? { itemId } : {}),
  };
};

export const viewToSubPath = (
  view: PlatformSettingsView
): string | undefined => {
  if (view.type === 'landing') {
    return undefined;
  }

  if (!view.isEditing) {
    return view.itemId ? `${view.page}/${view.itemId}` : view.page;
  }

  return view.itemId
    ? `${view.page}/${EDIT_SEGMENT}/${view.itemId}`
    : `${view.page}/${EDIT_SEGMENT}`;
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

/** The page's header title and the breadcrumbs below the Platform Settings root. */
export const getPageHeader = (
  page: PlatformSettingsPage,
  view: PlatformSettingsView,
  t: TFunction
): { title: string; breadcrumbs: { id: string; label: string }[] } => {
  const pageTitle = t(page.titleKey);
  const breadcrumbs = [{ id: page.id, label: pageTitle }];
  if (view.type !== 'page') {
    return { title: pageTitle, breadcrumbs };
  }

  if (view.isEditing) {
    const title =
      page.getEditTitle?.(t, view.itemId) ??
      String(t('label.edit-entity', { entity: pageTitle }));

    return {
      title,
      breadcrumbs: [...breadcrumbs, { id: 'edit', label: title }],
    };
  }

  if (view.itemId) {
    const title = page.getItemTitle?.(t, view.itemId) ?? view.itemId;

    return {
      title,
      breadcrumbs: [...breadcrumbs, { id: 'item', label: title }],
    };
  }

  return { title: pageTitle, breadcrumbs };
};
