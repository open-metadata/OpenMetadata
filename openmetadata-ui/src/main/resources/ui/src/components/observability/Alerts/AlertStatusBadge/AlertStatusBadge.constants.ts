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

import { Status } from '../../../../generated/events/eventSubscription';
import { AlertListStatus } from '../../../../utils/observability/alerts/alertStatus.utils';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';

// Disabled reads as stopped, as other switched-off items do.
export const ALERT_STATUS_BADGE: Record<
  AlertListStatus,
  { status: StatusType; labelKey: string }
> = {
  [Status.Active]: { status: StatusType.Success, labelKey: 'label.active' },
  [Status.Disabled]: { status: StatusType.Stopped, labelKey: 'label.disabled' },
  [Status.Failed]: { status: StatusType.Failure, labelKey: 'label.failed' },
};
