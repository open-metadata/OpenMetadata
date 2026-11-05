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

export type {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
  ModifiedEventSubscription,
  ModifiedWebhookConfig,
} from '../../../../../../utils/AlertsClassBase.interface';

export type NotificationView =
  | { type: 'landing' }
  | { type: 'list' }
  | { type: 'add' }
  | { type: 'edit'; fqn: string }
  | { type: 'detail'; fqn: string; name: string }
  | { type: 'section'; key: string; subPath?: string };

export type NotificationIcon = FC<{ className?: string }>;

/** A card on the Notification landing; each one opens a view of the panel. */
export interface NotificationLandingCard {
  id: string;
  icon: NotificationIcon;
  title: string;
  description: string;
  view: NotificationView;
  isBeta?: boolean;
}

export interface NotificationLandingProps {
  onNavigate: (view: NotificationView) => void;
}
