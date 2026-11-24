/*
 *  Copyright 2024 Collate.
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
import { APP_MODE_SIDEBAR_CUSTOMIZATION_KEY } from '../../components/platform/ai-shell/Sidebar/appModeSidebar.constants';
import { SettingMenuItem } from '../GlobalSettingsUtils';
import personaClassBase from '../PersonaClassBase';

export type { CustomizeIconKeys } from '../PersonaClassBase';

export const getCustomizePageCategories = (): SettingMenuItem[] =>
  personaClassBase.getCustomizePageCategories();

/**
 * The categories shown as cards. The AI sidebar has no card of its own: the
 * Navigation card opens it in AI mode. It stays in `getCustomizePageCategories`
 * so breadcrumbs and the `/customize-page/<persona>/askCollateSidebar` route
 * keep resolving its label. ADR:2026-11-02-persona-navigation-card-opens-the-editor-for-the-app-mode
 */
export const getCustomizePageCategoryCards = (): SettingMenuItem[] =>
  getCustomizePageCategories().filter(
    (category) => category.key !== APP_MODE_SIDEBAR_CUSTOMIZATION_KEY
  );

export const getCustomizePageOptions = (category: string): SettingMenuItem[] =>
  personaClassBase.getCustomizePageOptions(category);
