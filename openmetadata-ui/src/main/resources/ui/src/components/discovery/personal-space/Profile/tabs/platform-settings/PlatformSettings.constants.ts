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

import {
  Dataflow02,
  HeartRounded,
  Link01,
  Lock01,
  Mail01,
  SwitchHorizontal01,
} from '@openmetadata/ui-core-components/icons';
import { isLoginConfigurationApplicable } from '../../../../../../utils/AuthProvider.util';
import type { PlatformSettingsPage } from './PlatformSettings.types';

export const PLATFORM_SETTINGS_HASH_TAB = 'platform-settings';

export const PLATFORM_SETTINGS_PAGES: PlatformSettingsPage[] = [
  {
    id: 'email',
    icon: Mail01,
    titleKey: 'label.email',
    descriptionKey: 'message.email-configuration-message',
    hasEditView: true,
  },
  {
    id: 'login-configuration',
    icon: Lock01,
    titleKey: 'label.login-configuration',
    descriptionKey: 'message.page-sub-header-for-login-configuration',
    hasEditView: true,
    isVisible: isLoginConfigurationApplicable,
  },
  {
    id: 'health-check',
    icon: HeartRounded,
    titleKey: 'label.health-check',
    descriptionKey: 'message.page-sub-header-for-om-health-configuration',
  },
  {
    id: 'lineage',
    icon: Dataflow02,
    titleKey: 'label.lineage',
    descriptionKey: 'message.page-sub-header-for-lineage-config-setting',
    hasEditView: true,
  },
  {
    id: 'brand-url',
    icon: Link01,
    titleKey: 'label.brand-name-url',
    descriptionKey: 'message.om-url-configuration-message',
    hasEditView: true,
  },
  {
    id: 'app-mode',
    icon: SwitchHorizontal01,
    titleKey: 'label.default-app-mode',
    descriptionKey: 'message.default-app-mode-description',
    hasEditView: true,
    hasFieldHints: false,
  },
];
