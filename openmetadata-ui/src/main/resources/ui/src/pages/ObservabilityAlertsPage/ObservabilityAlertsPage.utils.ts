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
  AlertTableColumnId,
  ALERT_TABLE_CELL_LAYOUT_CLASS,
  ALERT_TABLE_CELL_VERTICAL_ALIGN_CLASS,
  ALERT_TABLE_HEADER_VERTICAL_ALIGN_CLASS,
} from './ObservabilityAlertsPage.constants';

const getAlertTableLayoutClassName = (
  columnId: AlertTableColumnId,
  verticalAlignClassName: string
) =>
  [verticalAlignClassName, ALERT_TABLE_CELL_LAYOUT_CLASS[columnId]]
    .filter(Boolean)
    .join(' ');

export const getAlertTableCellLayoutClassName = (
  columnId: AlertTableColumnId
) =>
  getAlertTableLayoutClassName(columnId, ALERT_TABLE_CELL_VERTICAL_ALIGN_CLASS);

export const getAlertTableHeaderLayoutClassName = (
  columnId: AlertTableColumnId
) =>
  getAlertTableLayoutClassName(
    columnId,
    ALERT_TABLE_HEADER_VERTICAL_ALIGN_CLASS
  );
