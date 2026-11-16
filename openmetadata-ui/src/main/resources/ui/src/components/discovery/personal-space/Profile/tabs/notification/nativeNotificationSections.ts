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
import { Announcement02 } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { GlobalSettingOptions } from '../../../../../../constants/GlobalSettings.constants';
import { NotificationSectionContribution } from '../../../../../../utils/ExtensionPointTypes';
import { withSuspenseFallback } from '../../../../../AppRouter/withSuspenseFallback';

/**
 * Sections OpenMetadata itself ships in the Notification tab. They go through
 * the same contract as a downstream build's contributions, so the card, the
 * hash routing, the header and the "hidden card cannot be deep-linked" rule are
 * one code path for both. Each still needs its Notifications menu item, which
 * is what decides who sees it.
 */
export const NATIVE_NOTIFICATION_SECTIONS: NotificationSectionContribution[] = [
  {
    key: GlobalSettingOptions.ANNOUNCEMENTS,
    icon: Announcement02,
    component: withSuspenseFallback(
      React.lazy(
        () =>
          import(
            '../../../../../platform/settings/announcements/AnnouncementsNotificationSection/AnnouncementsNotificationSection'
          )
      )
    ),
  },
];
