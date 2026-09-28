/*
 *  Copyright 2025 Collate.
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
import { isString } from 'lodash';
import { EntityType } from '../../../enums/entity.enum';
import { Column } from '../../../generated/entity/data/table';
import { ChangeSummaryEntry } from '../../../rest/changeSummaryAPI';
import EntityLink from '../../../utils/EntityLink';
import { ColumnOrTask } from './ColumnDetailPanel.interface';

export const isColumn = (item: ColumnOrTask | null): item is Column => {
  return item !== null && 'dataType' in item;
};

export const computeEditPermission = (
  fieldPermission: boolean | undefined,
  editAllPermission: boolean | undefined,
  deleted: boolean
): boolean => Boolean((fieldPermission || editAllPermission) && !deleted);

export const getColumnDescriptionChangeSummary = (
  changeSummary: Record<string, ChangeSummaryEntry> | undefined,
  columnFqn?: string
) =>
  changeSummary?.[
    `columns.${EntityLink.getTableColumnNameFromColumnFqn(
      columnFqn ?? '',
      false
    )}.description`
  ];

export const shouldShowKeyProfileMetrics = (
  column: ColumnOrTask | null,
  entityType: EntityType
): boolean => isColumn(column) && entityType === EntityType.TABLE;

export const getEntityNameModalEntity = (activeColumn: Column) => ({
  name: isString(activeColumn.name) ? activeColumn.name : '',
  displayName: isString((activeColumn as { displayName?: string }).displayName)
    ? (activeColumn as { displayName?: string }).displayName
    : undefined,
});

export const isTitleEditableEntityType = (entityType: EntityType): boolean =>
  entityType === EntityType.TABLE ||
  entityType === EntityType.DASHBOARD_DATA_MODEL;

export const computeCanShowDisplayNameEdit = (
  hasDisplayNameEditPermission: boolean,
  entityType: EntityType
): boolean =>
  hasDisplayNameEditPermission && isTitleEditableEntityType(entityType);

export const computeShowOriginalName = (
  activeColumn: Column,
  entityType: EntityType
): boolean =>
  Boolean(activeColumn.displayName) &&
  activeColumn.displayName !== activeColumn.name &&
  isTitleEditableEntityType(entityType);

export const getColumnTitleText = (activeColumn: Column): string =>
  (activeColumn as { displayName?: string }).displayName ||
  activeColumn.name ||
  '';
