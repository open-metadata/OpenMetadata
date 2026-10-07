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
  BookOpen01,
  Customize,
  Dataflow02,
  DataQuality,
  FileCheck02,
  HeartRounded,
  Link01,
  Lock01,
  Mail01,
  RunProfiler,
  SwitchHorizontal01,
} from '@openmetadata/ui-core-components/icons';
import { isLoginConfigurationApplicable } from '../../../../../../utils/AuthProvider.util';
import type { PlatformSettingsPage } from './PlatformSettings.types';

export const PLATFORM_SETTINGS_HASH_TAB = 'platform-settings';

export const PLATFORM_SETTINGS_PAGES: PlatformSettingsPage[] = [
  {
    id: 'theme',
    icon: Customize,
    titleKey: 'label.theme',
    descriptionKey: 'message.appearance-configuration-message',
    hasEditView: true,
  },
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
    id: 'profiler-configuration',
    icon: RunProfiler,
    titleKey: 'label.profiler-configuration',
    descriptionKey: 'message.page-sub-header-for-profiler-configuration',
    hasEditView: true,
    hasFieldHints: false,
  },
  {
    id: 'data-quality',
    icon: DataQuality,
    titleKey: 'label.data-quality',
    descriptionKey: 'message.page-sub-header-for-data-quality-settings',
    hasEditView: true,
    getEditTitle: (t, itemId) =>
      t(itemId ? 'label.edit-entity' : 'label.add-entity', {
        entity: t('label.dimension'),
      }),
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
    id: 'data-asset-rules',
    icon: FileCheck02,
    titleKey: 'label.data-asset-rules',
    descriptionKey: 'message.data-asset-rules-message',
    isBeta: true,
  },
  {
    id: 'learning-resources',
    icon: BookOpen01,
    titleKey: 'label.learning-resources',
    descriptionKey: 'message.learning-resources-management-description',
    hasEditView: true,
    hasFieldHints: false,
    getEditTitle: (t, itemId) =>
      t(itemId ? 'label.edit-resource' : 'label.add-resource'),
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
