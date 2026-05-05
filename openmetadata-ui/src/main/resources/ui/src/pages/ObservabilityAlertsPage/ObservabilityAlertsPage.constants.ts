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

export const ALERT_PERMISSION_REQUEST_TIMEOUT_MS = 5000;

export const ALERT_TABLE_COLUMN_IDS = {
  ACTIONS: 'actions',
  DESCRIPTION: 'description',
  NAME: 'name',
  TRIGGER: 'trigger',
} as const;

export type AlertTableColumnId =
  (typeof ALERT_TABLE_COLUMN_IDS)[keyof typeof ALERT_TABLE_COLUMN_IDS];

export type AlertTableColumn = {
  id: AlertTableColumnId;
  name: string;
};

export type AlertPermission = {
  id: string;
  edit: boolean;
  delete: boolean;
};

export const ALERT_TABLE_CELL_LAYOUT_CLASS: Partial<
  Record<AlertTableColumnId, string>
> = {
  [ALERT_TABLE_COLUMN_IDS.ACTIONS]: 'tw:w-[90px]',
  [ALERT_TABLE_COLUMN_IDS.DESCRIPTION]: 'tw:w-auto',
  [ALERT_TABLE_COLUMN_IDS.NAME]: 'tw:w-[200px]',
  [ALERT_TABLE_COLUMN_IDS.TRIGGER]: 'tw:w-[200px]',
};

export const ALERT_TABLE_CELL_VERTICAL_ALIGN_CLASS = 'tw:[vertical-align:top]';

export const ALERT_TABLE_HEADER_VERTICAL_ALIGN_CLASS =
  'tw:[vertical-align:middle]';

export const getDefaultAlertPermission = (
  alert: Pick<EventSubscription, 'id'>
): AlertPermission => ({
  id: alert.id,
  edit: false,
  delete: false,
});
