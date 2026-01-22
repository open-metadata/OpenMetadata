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
import Icon from '@ant-design/icons';
import { Button } from 'antd';
import { Column } from 'react-data-grid';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ProfilerTabPath } from '../../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { ROUTES } from '../../constants/constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { DataQualityPageTabs } from '../../pages/DataQuality/DataQualityPage.interface';
import {
  exportDatabaseDetailsInCSV,
  exportDatabaseSchemaDetailsInCSV,
} from '../../rest/databaseAPI';
import {
  exportGlossaryInCSVFormat,
  exportGlossaryTermsInCSVFormat,
} from '../../rest/glossaryAPI';
import { exportDatabaseServiceDetailsInCSV } from '../../rest/serviceAPI';
import { exportTableDetailsInCSV } from '../../rest/tableAPI';
import { exportTestCasesInCSV } from '../../rest/testAPI';
import entityUtilClassBase from '../EntityUtilClassBase';
import { t } from '../i18next/LocalUtil';
import { getDataQualityPagePath } from '../RouterUtils';

export const isBulkEditRoute = (pathname: string) => {
  return pathname.includes(ROUTES.BULK_EDIT_ENTITY);
};

export const getBulkEditCSVExportEntityApi = (entityType: EntityType) => {
  switch (entityType) {
    case EntityType.DATABASE_SERVICE:
      return exportDatabaseServiceDetailsInCSV;

    case EntityType.DATABASE:
      return exportDatabaseDetailsInCSV;

    case EntityType.DATABASE_SCHEMA:
      return exportDatabaseSchemaDetailsInCSV;

    case EntityType.GLOSSARY_TERM:
      return exportGlossaryTermsInCSVFormat;

    case EntityType.GLOSSARY:
      return exportGlossaryInCSVFormat;

    case EntityType.TABLE:
      return exportTableDetailsInCSV;

    case EntityType.TEST_CASE:
      return exportTestCasesInCSV;

    default:
      return exportTableDetailsInCSV;
  }
};

export const getBulkEditButton = (
  hasPermission: boolean,
  onClickHandler: () => void,
  editTableBulkButton?: string
) => {
  return hasPermission ? (
    <Button
      className={`remove-button-background-hover ${
        !editTableBulkButton ? 'p-0 text-primary ' : 'p-1'
      }`}
      data-testid="bulk-edit-table"
      icon={<Icon component={IconEdit} />}
      type="text"
      onClick={onClickHandler}>
      {t('label.edit')}
    </Button>
  ) : null;
};

export const getBulkEntityNavigationPath = (
  entityType: EntityType,
  fqn: string,
  sourceEntityType?: EntityType
): string => {
  if (entityType === EntityType.TEST_CASE) {
    if (fqn === WILD_CARD_CHAR) {
      return getDataQualityPagePath(DataQualityPageTabs.TEST_CASES);
    } else if (sourceEntityType === EntityType.TABLE) {
      return entityUtilClassBase.getEntityLink(
        EntityType.TABLE,
        fqn,
        EntityTabs.PROFILER,
        ProfilerTabPath.DATA_QUALITY
      );
    } else if (sourceEntityType === EntityType.TEST_SUITE) {
      return entityUtilClassBase.getEntityLink(EntityType.TEST_SUITE, fqn);
    } else {
      return getDataQualityPagePath(DataQualityPageTabs.TEST_CASES);
    }
  }

  return entityUtilClassBase.getEntityLink(entityType, fqn);
};

interface TagValue {
  tagFQN: string;
  source: string;
}

const parseTagsArray = (value: string | undefined): TagValue[] => {
  if (!value) {
    return [];
  }
  try {
    return JSON.parse(value) as TagValue[];
  } catch {
    return [];
  }
};

const getChangedTagTypes = (
  oldValue: string | undefined,
  newValue: string | undefined
): Set<string> => {
  const oldTags = parseTagsArray(oldValue);
  const newTags = parseTagsArray(newValue);

  const getTagsBySource = (tags: TagValue[]) => ({
    classification: tags.filter((t) => t.source === 'Classification'),
    glossary: tags.filter((t) => t.source === 'Glossary'),
  });

  const oldBySource = getTagsBySource(oldTags);
  const newBySource = getTagsBySource(newTags);

  const changedTypes = new Set<string>();

  const classificationChanged =
    JSON.stringify(oldBySource.classification.map((t) => t.tagFQN).sort()) !==
    JSON.stringify(newBySource.classification.map((t) => t.tagFQN).sort());

  const glossaryChanged =
    JSON.stringify(oldBySource.glossary.map((t) => t.tagFQN).sort()) !==
    JSON.stringify(newBySource.glossary.map((t) => t.tagFQN).sort());

  if (classificationChanged) {
    const oldTiers = oldBySource.classification.filter((t) =>
      t.tagFQN.startsWith('Tier.')
    );
    const newTiers = newBySource.classification.filter((t) =>
      t.tagFQN.startsWith('Tier.')
    );
    const oldNonTiers = oldBySource.classification.filter(
      (t) => !t.tagFQN.startsWith('Tier.')
    );
    const newNonTiers = newBySource.classification.filter(
      (t) => !t.tagFQN.startsWith('Tier.')
    );

    if (
      JSON.stringify(oldTiers.map((t) => t.tagFQN).sort()) !==
      JSON.stringify(newTiers.map((t) => t.tagFQN).sort())
    ) {
      changedTypes.add('tiers');
    }

    if (
      JSON.stringify(oldNonTiers.map((t) => t.tagFQN).sort()) !==
      JSON.stringify(newNonTiers.map((t) => t.tagFQN).sort())
    ) {
      changedTypes.add('tags');
    }
  }

  if (glossaryChanged) {
    changedTypes.add('glossaryTerms');
  }

  return changedTypes;
};

/**
 * Parses the changeDescription JSON from a row and extracts the updated field names.
 * Returns both the raw field name and prefixed version (e.g., 'description' and 'column.description')
 * to handle different column key formats in CSV import/export.
 * For 'tags' field, it analyzes the actual values to determine which specific columns
 * (tags, glossaryTerms, tiers) were updated.
 */
export const getUpdatedFields = (row: Record<string, string>): Set<string> => {
  if (!row.changeDescription) {
    return new Set();
  }

  try {
    const parsed = JSON.parse(row.changeDescription);
    const fields: string[] = [];

    const processField = (f: {
      name: string;
      oldValue?: string;
      newValue?: string;
    }) => {
      if (f.name === 'tags') {
        const changedTagTypes = getChangedTagTypes(f.oldValue, f.newValue);
        changedTagTypes.forEach((type) => {
          fields.push(type);
          fields.push(`column.${type}`);
        });
      } else {
        fields.push(f.name);
        fields.push(`column.${f.name}`);
      }
    };

    (parsed.fieldsAdded || []).forEach(processField);
    (parsed.fieldsUpdated || []).forEach(processField);
    (parsed.fieldsDeleted || []).forEach(processField);

    return new Set(fields);
  } catch {
    return new Set();
  }
};

/**
 * Transforms columns to include cellClass for highlighting updated cells.
 * Used in the validation/preview step of bulk edit to visually indicate:
 * - Newly added rows (all cells highlighted)
 * - Updated fields in existing rows (only changed cells highlighted)
 * Excludes the 'changeDescription' column from the output.
 */
export const getColumnsWithUpdatedFlag = (
  columns: Column<Record<string, string>>[] | undefined,
  newRowIds: Set<string>
): Column<Record<string, string>>[] | undefined => {
  return columns
    ?.filter((col) => col.key !== 'changeDescription')
    .map((col) => ({
      ...col,
      cellClass: (row: Record<string, string>) => {
        if (newRowIds.has(row.id)) {
          return 'cell-updated';
        }
        const updatedFields = getUpdatedFields(row);

        return updatedFields.has(col.key) ? 'cell-updated' : '';
      },
    }));
};
