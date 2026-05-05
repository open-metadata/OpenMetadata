/*
 *  Copyright 2022 Collate.
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
import { EventSubscription } from '../../generated/events/eventSubscription';
import {
  AlertPermission,
  AlertTableColumnId,
  ALERT_TABLE_CELL_LAYOUT_CLASS,
  ALERT_TABLE_CELL_VERTICAL_ALIGN_CLASS,
  ALERT_TABLE_HEADER_VERTICAL_ALIGN_CLASS,
  getDefaultAlertPermission,
} from './ObservabilityAlertsPage.constants';

const getPermissionTimeoutFallback = (
  alert: EventSubscription,
  timeoutInMs: number
) =>
  new Promise<AlertPermission>((resolve) =>
    setTimeout(() => resolve(getDefaultAlertPermission(alert)), timeoutInMs)
  );

export const getDefaultAlertPermissions = (alerts: EventSubscription[]) =>
  alerts.map((alert) => getDefaultAlertPermission(alert));

export const getAlertPermissionsWithFallback = async (
  alerts: EventSubscription[],
  getAlertPermissionByFqn: (alert: EventSubscription) => Promise<AlertPermission>,
  timeoutInMs: number
) => {
  const permissionPromises = alerts.map((alert) =>
    Promise.race([
      getAlertPermissionByFqn(alert),
      getPermissionTimeoutFallback(alert, timeoutInMs),
    ])
  );

  const permissionResults = await Promise.allSettled(permissionPromises);

  return permissionResults.map((permissionResult, index) =>
    permissionResult.status === 'fulfilled'
      ? permissionResult.value
      : getDefaultAlertPermission(alerts[index])
  );
};


const getAlertTableLayoutClassName = (
  columnId: AlertTableColumnId,
  verticalAlignClassName: string
) =>
  [verticalAlignClassName, ALERT_TABLE_CELL_LAYOUT_CLASS[columnId]]
    .filter(Boolean)
    .join(' ');

export const getAlertTableCellLayoutClassName = (columnId: AlertTableColumnId) =>
  getAlertTableLayoutClassName(columnId, ALERT_TABLE_CELL_VERTICAL_ALIGN_CLASS);

export const getAlertTableHeaderLayoutClassName = (
  columnId: AlertTableColumnId
) =>
  getAlertTableLayoutClassName(columnId, ALERT_TABLE_HEADER_VERTICAL_ALIGN_CLASS);
