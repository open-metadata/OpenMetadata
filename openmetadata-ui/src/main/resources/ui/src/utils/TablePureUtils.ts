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

import {
  isEmpty,
  isUndefined,
  lowerCase,
  omit,
  toString,
  uniqueId,
  upperCase,
} from 'lodash';
import type { EntityTags } from 'Models';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityType, FqnPart } from '../enums/entity.enum';
import { PrimaryTableDataTypes } from '../enums/table.enum';
import type { MlFeature } from '../generated/entity/data/mlmodel';
import type { Task } from '../generated/entity/data/pipeline';
import type { SearchIndexField } from '../generated/entity/data/searchIndex';
import type {
  Column,
  ConstraintType,
  JoinedWith,
  Table,
  TableJoins,
} from '../generated/entity/data/table';
import { DataType } from '../generated/entity/data/table';
import type { EntityReference } from '../generated/entity/type';
import type { Field } from '../generated/type/schema';
import {
  LabelType,
  State,
  TagSource,
  type TagLabel,
} from '../generated/type/tagLabel';
import { extractApiEndpointFields } from './APIEndpoints/APIEndpointFieldUtils';
import { extractContainerColumns } from './ContainerDetailPureUtils';
import { extractDataModelColumns } from './DashboardDataModelUtils';
import EntityLink from './EntityLink';
import {
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
} from './FqnUtils';
import { t } from './i18next/LocalUtil';
import { extractMlModelFeatures } from './MlModelDetailsUtils';
import { extractPipelineTasks } from './PipelineDetailsUtils';
import { extractSearchIndexFields } from './SearchIndexUtils';
import { ordinalize } from './StringUtils';
import type { TableFieldsInfoCommonEntities } from './TableUtils.interface';
import { extractTopicFields } from './TopicDetailsUtils';

export const getUsagePercentile = (pctRank: number, isLiteral = false) => {
  const percentile = Math.round(pctRank * 10) / 10;
  const ordinalPercentile = ordinalize(percentile);
  const usagePercentile = `${
    isLiteral ? t('label.usage') : ''
  } ${ordinalPercentile} ${t('label.pctile-lowercase')}`;

  return usagePercentile;
};

export const isTierTag = (tagFQN: string) =>
  tagFQN.startsWith(`Tier${FQN_SEPARATOR_CHAR}`);

export const isCertificationTag = (tagFQN: string) =>
  tagFQN.startsWith(`Certification${FQN_SEPARATOR_CHAR}`);

export const getTierTags = (tags: Array<TagLabel>) => {
  return tags.find((item) => isTierTag(item.tagFQN));
};

export const getTagsWithoutTier = (
  tags: Array<EntityTags>
): Array<EntityTags> => {
  return tags.filter((item) => !isTierTag(item.tagFQN));
};

export const getCertificationTag = (tags: Array<TagLabel>) => {
  return tags.find((item) => isCertificationTag(item.tagFQN));
};

export const getTagsWithoutCertification = (
  tags: Array<EntityTags>
): Array<EntityTags> => {
  return tags.filter((item) => !isCertificationTag(item.tagFQN));
};

export const makeData = <T extends Column | SearchIndexField>(
  columns: T[] = []
): Array<T & { id: string }> => {
  return columns.map((column) => ({
    ...column,
    id: uniqueId(column.name),
    children: column.children ? makeData<T>(column.children as T[]) : undefined,
  }));
};

export const getDataTypeString = (dataType: string): string => {
  switch (upperCase(dataType)) {
    case DataType.String:
    case DataType.Char:
    case DataType.Text:
    case DataType.Varchar:
    case DataType.Mediumtext:
    case DataType.Mediumblob:
    case DataType.Blob:
      return PrimaryTableDataTypes.VARCHAR;
    case DataType.Timestamp:
    case DataType.Time:
      return PrimaryTableDataTypes.TIMESTAMP;
    case DataType.Date:
      return PrimaryTableDataTypes.DATE;
    case DataType.Int:
    case DataType.Float:
    case DataType.Smallint:
    case DataType.Bigint:
    case DataType.Numeric:
    case DataType.Tinyint:
    case DataType.Decimal:
      return PrimaryTableDataTypes.NUMERIC;
    case DataType.Boolean:
    case DataType.Enum:
      return PrimaryTableDataTypes.BOOLEAN;
    default:
      return dataType;
  }
};

export const generateEntityLink = (fqn: string, includeColumn = false) => {
  if (includeColumn) {
    const tableFqn = getTableFQNFromColumnFQN(fqn);
    const columnName = getPartialNameFromTableFQN(fqn, [FqnPart.NestedColumn]);

    return EntityLink.getTableEntityLink(tableFqn, columnName);
  }

  return EntityLink.getTableEntityLink(fqn);
};

export const getAllRowKeysByKeyName = <
  T extends Column | Field | SearchIndexField
>(
  data: T[],
  keyName: keyof T
) => {
  let keys: string[] = [];

  data.forEach((item) => {
    if (item.children && item.children.length > 0) {
      keys.push(toString(item[keyName]));
      keys = [
        ...keys,
        ...getAllRowKeysByKeyName(item.children as T[], keyName),
      ];
    }
  });

  return keys;
};

export const searchInFields = <T extends SearchIndexField | Column>(
  searchIndex: Array<T>,
  searchText: string
): Array<T> => {
  const searchedValue: Array<T> = searchIndex.reduce(
    (searchedFields, field) => {
      const isContainData =
        lowerCase(field.name).includes(searchText) ||
        lowerCase(field.description).includes(searchText) ||
        lowerCase(getDataTypeString(field.dataType)).includes(searchText);

      if (isContainData) {
        return [...searchedFields, field];
      } else if (!isUndefined(field.children)) {
        const searchedChildren = searchInFields(
          field.children as T[],
          searchText
        );
        if (searchedChildren.length > 0) {
          return [
            ...searchedFields,
            {
              ...field,
              children: searchedChildren,
            },
          ];
        }
      }

      return searchedFields;
    },
    [] as Array<T>
  );

  return searchedValue;
};

export const getUpdatedTags = (newFieldTags: Array<EntityTags>): TagLabel[] => {
  const mappedNewTags: TagLabel[] = newFieldTags.map((tag) => ({
    ...omit(tag, 'isRemovable'),
    labelType: LabelType.Manual,
    state: State.Confirmed,
    source: tag.source ?? 'Classification',
    tagFQN: tag.tagFQN,
  }));

  return mappedNewTags;
};

export const updateFieldTags = <T extends TableFieldsInfoCommonEntities>(
  changedFieldFQN: string,
  newFieldTags: EntityTags[],
  searchIndexFields?: Array<T>
) => {
  searchIndexFields?.forEach((field) => {
    if (field.fullyQualifiedName === changedFieldFQN) {
      field.tags = getUpdatedTags(newFieldTags);
    } else {
      updateFieldTags(
        changedFieldFQN,
        newFieldTags,
        field?.children as Array<T>
      );
    }
  });
};

export const updateFieldDescription = <T extends TableFieldsInfoCommonEntities>(
  changedFieldFQN: string,
  description: string,
  searchIndexFields?: Array<T>
) => {
  searchIndexFields?.forEach((field) => {
    if (field.fullyQualifiedName === changedFieldFQN) {
      field.description = description;
    } else {
      updateFieldDescription(
        changedFieldFQN,
        description,
        field?.children as Array<T>
      );
    }
  });
};

export const updateFieldDisplayName = <T extends TableFieldsInfoCommonEntities>(
  changedFieldFQN: string,
  displayName: string,
  searchIndexFields?: Array<T>
) => {
  searchIndexFields?.forEach((field) => {
    if (field.fullyQualifiedName === changedFieldFQN) {
      field.displayName = displayName;
    } else {
      updateFieldDisplayName(
        changedFieldFQN,
        displayName,
        field?.children as Array<T>
      );
    }
  });
};

export const updateFieldExtension = <T extends TableFieldsInfoCommonEntities>(
  changedFieldFQN: string,
  extension: Record<string, unknown>,
  searchIndexFields?: Array<T>
) => {
  searchIndexFields?.forEach((field) => {
    if (field.fullyQualifiedName === changedFieldFQN) {
      field.extension = extension;
    } else {
      updateFieldExtension(
        changedFieldFQN,
        extension,
        field?.children as Array<T>
      );
    }
  });
};

export const getJoinsFromTableJoins = (
  joins?: TableJoins
): Array<JoinedWith & { name: string }> => {
  const tableFQNGrouping = [
    ...(joins?.columnJoins?.flatMap(
      (cjs) =>
        cjs.joinedWith?.map<JoinedWith>((jw) => ({
          fullyQualifiedName: getTableFQNFromColumnFQN(jw.fullyQualifiedName),
          joinCount: jw.joinCount,
        })) ?? []
    ) ?? []),
    ...(joins?.directTableJoins ?? []),
  ].reduce(
    (result, jw) => ({
      ...result,
      [jw.fullyQualifiedName]:
        (result[jw.fullyQualifiedName] ?? 0) + jw.joinCount,
    }),
    {} as Record<string, number>
  );

  return Object.entries(tableFQNGrouping)
    .map<JoinedWith & { name: string }>(([fullyQualifiedName, joinCount]) => ({
      fullyQualifiedName,
      joinCount,
      name: getPartialNameFromTableFQN(
        fullyQualifiedName,
        [FqnPart.Database, FqnPart.Table],
        FQN_SEPARATOR_CHAR
      ),
    }))
    .sort((a, b) => b.joinCount - a.joinCount);
};

export const createTableConstraintObject = (
  constraints: string[],
  type: ConstraintType
) =>
  isEmpty(constraints) ? [] : [{ columns: constraints, constraintType: type }];

export const getColumnOptionsFromTableColumn = (
  columns: Column[],
  useFullyQualifiedName = false
) => {
  const options: {
    label: string;
    value: string;
  }[] = [];

  columns.forEach((item) => {
    options.push({
      label: item.name,
      value: useFullyQualifiedName
        ? item.fullyQualifiedName ?? item.name
        : item.name,
    });

    if (!isEmpty(item.children)) {
      options.push(
        ...getColumnOptionsFromTableColumn(
          item.children ?? [],
          useFullyQualifiedName
        )
      );
    }
  });

  return options;
};

export const findColumnByEntityLink = (
  tableFqn: string,
  columns: Column[],
  entityLink: string
): Column | null => {
  for (const column of columns) {
    const columnName = EntityLink.getTableColumnNameFromColumnFqn(
      column.fullyQualifiedName ?? '',
      false
    );

    const columnEntityLink = EntityLink.getTableEntityLink(
      tableFqn,
      columnName
    );
    if (columnEntityLink === entityLink) {
      return column;
    }

    if (column.children && column.children.length > 0) {
      const found = findColumnByEntityLink(
        tableFqn,
        column.children,
        entityLink
      );
      if (found) {
        return found;
      }
    }
  }

  return null;
};

export const updateColumnInNestedStructure = (
  columns: Column[],
  targetFqn: string,
  update: Partial<Column>,
  field?: string
): Column[] => {
  return columns.map((column: Column) => {
    if (column.fullyQualifiedName === targetFqn) {
      const newCol = omit(column, field ?? '');

      return {
        ...(newCol as Column),
        ...update,
      };
    } else if (column.children && column.children.length > 0) {
      return {
        ...column,
        children: updateColumnInNestedStructure(
          column.children,
          targetFqn,
          update,
          field
        ),
      };
    } else {
      return column;
    }
  });
};

export const pruneEmptyChildren = (columns: Column[]): Column[] => {
  return columns.map((column) => {
    if (!column.children || column.children.length === 0) {
      return omit(column, 'children');
    }

    const prunedChildren = pruneEmptyChildren(column.children);

    if (prunedChildren.length === 0) {
      return omit(column, 'children');
    }

    return {
      ...column,
      children: prunedChildren,
    };
  });
};

export const getSchemaFieldCount = <T extends { children?: T[] }>(
  fields: T[]
): number => {
  let count = 0;

  const countFields = (items: T[]): void => {
    items.forEach((item) => {
      count++;
      if (item.children && item.children.length > 0) {
        countFields(item.children);
      }
    });
  };

  countFields(fields);

  return count;
};

export const getSchemaDepth = <T extends { children?: T[] }>(
  fields: T[]
): number => {
  if (!fields || fields.length === 0) {
    return 0;
  }

  let maxDepth = 1;

  const calculateDepth = (items: T[], currentDepth: number): void => {
    items.forEach((item) => {
      maxDepth = Math.max(maxDepth, currentDepth);
      if (item.children && item.children.length > 0) {
        calculateDepth(item.children, currentDepth + 1);
      }
    });
  };

  calculateDepth(fields, 1);

  return maxDepth;
};

export const isLargeSchema = <T extends { children?: T[] }>(
  fields: T[],
  threshold = 500
): boolean => {
  return getSchemaFieldCount(fields) > threshold;
};

export const shouldCollapseSchema = <T extends { children?: T[] }>(
  fields: T[],
  threshold = 50
): boolean => {
  return getSchemaFieldCount(fields) > threshold;
};

export const getExpandAllKeysToDepth = <
  T extends { children?: T[]; fullyQualifiedName?: string }
>(
  fields: T[],
  maxDepth = 3
): string[] => {
  const keys: string[] = [];

  const collectKeys = (items: T[], currentDepth = 0): void => {
    if (currentDepth >= maxDepth) {
      return;
    }

    items.forEach((item) => {
      if (item.children && item.children.length > 0) {
        if (item.fullyQualifiedName) {
          keys.push(item.fullyQualifiedName);
        }
        collectKeys(item.children, currentDepth + 1);
      }
    });
  };

  collectKeys(fields);

  return keys;
};

export const getSafeExpandAllKeys = <
  T extends { children?: T[]; fullyQualifiedName?: string }
>(
  fields: T[],
  isLargeSchema: boolean,
  allKeys: string[]
): string[] => {
  if (!isLargeSchema) {
    return allKeys;
  }

  return getExpandAllKeysToDepth(fields, 2);
};

export const flattenColumns = <T extends { children?: T[] }>(
  items: T[]
): T[] => {
  const result: T[] = [];
  items.forEach((item) => {
    result.push(item);
    if (item.children && item.children.length > 0) {
      result.push(...flattenColumns(item.children));
    }
  });

  return result;
};

export const findFieldByFQN = <
  T extends { fullyQualifiedName?: string; children?: T[] }
>(
  items: T[],
  targetFqn: string
): T | undefined => {
  for (const item of items) {
    if (item.fullyQualifiedName === targetFqn) {
      return item;
    }
    if (item.children && item.children.length > 0) {
      const found = findFieldByFQN(item.children, targetFqn);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
};

export const fieldExistsByFQN = <
  T extends { fullyQualifiedName?: string; children?: T[] }
>(
  items: T[],
  targetFqn: string
): boolean => {
  for (const item of items) {
    if (
      item.fullyQualifiedName === targetFqn ||
      targetFqn.startsWith((item.fullyQualifiedName ?? '') + '.')
    ) {
      return true;
    }
    if (item.children?.length && fieldExistsByFQN(item.children, targetFqn)) {
      return true;
    }
  }

  return false;
};

export const getParentKeysToExpand = <
  T extends { fullyQualifiedName?: string; children?: T[]; name?: string }
>(
  items: T[],
  targetFqn: string,
  parentKeys: string[] = []
): string[] => {
  for (const item of items) {
    if (item.fullyQualifiedName === targetFqn) {
      return parentKeys;
    }

    const shouldExploreChildren =
      item.children?.length &&
      (item.fullyQualifiedName
        ? targetFqn.startsWith(item.fullyQualifiedName + '.')
        : true);

    if (shouldExploreChildren) {
      const newParentKeys = [
        ...parentKeys,
        item.fullyQualifiedName ?? item.name ?? '',
      ];
      const result = getParentKeysToExpand(
        item.children!,
        targetFqn,
        newParentKeys
      );
      if (result.length > 0) {
        return result;
      }
    }
  }

  return [];
};

export const getDataTypeDisplay = (
  column: { dataTypeDisplay?: string; dataType?: string } | null
): string | undefined => {
  if (!column) {
    return undefined;
  }

  return column.dataTypeDisplay || String(column.dataType || '');
};

export const normalizeTags = (tags: TagLabel[]): TagLabel[] => {
  if (!tags || tags.length === 0) {
    return [];
  }

  return tags.map((tag) => {
    if (tag.source === TagSource.Glossary) {
      return omit(tag, 'style') as TagLabel;
    }

    return tag;
  });
};

export const mergeTagsWithGlossary = (
  columnTags: Column['tags'],
  updatedTags: Column['tags']
): Column['tags'] => {
  const existingGlossaryTags =
    columnTags?.filter((tag) => tag.source === TagSource.Glossary) || [];
  const updatedTagsWithoutGlossary =
    updatedTags?.filter((tag) => tag.source !== TagSource.Glossary) || [];

  const normalizedExistingGlossaryTags = normalizeTags(existingGlossaryTags);
  const normalizedUpdatedTags = normalizeTags(updatedTagsWithoutGlossary);

  return [...normalizedUpdatedTags, ...normalizedExistingGlossaryTags];
};

export const findOriginalColumnIndex = <
  T extends { fullyQualifiedName?: string }
>(
  column: T,
  allColumns: T[]
): number => {
  return allColumns.findIndex(
    (col) => col.fullyQualifiedName === column.fullyQualifiedName
  );
};

export const findParentColumn = <
  T extends { fullyQualifiedName?: string; children?: T[] }
>(
  targetColumn: T,
  columns: T[],
  parent?: T | null
): T | null | undefined => {
  for (const col of columns) {
    if (col.fullyQualifiedName === targetColumn.fullyQualifiedName) {
      return parent ?? null;
    }
    if (col.children && col.children.length > 0) {
      const found = findParentColumn(targetColumn, col.children, col);
      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
};

export const buildColumnBreadcrumbPath = <
  T extends { fullyQualifiedName?: string; children?: T[] }
>(
  column: T | null,
  allColumns: T[]
): T[] => {
  if (!column?.fullyQualifiedName) {
    return [];
  }

  const breadcrumbs: T[] = [column];
  let currentColumn: T | null = column;
  const visited = new Set<string>();
  visited.add(column.fullyQualifiedName);

  while (currentColumn) {
    const parent: T | null | undefined = findParentColumn(
      currentColumn,
      allColumns
    );
    if (parent === undefined || parent === null) {
      break;
    }

    if (parent.fullyQualifiedName && visited.has(parent.fullyQualifiedName)) {
      break;
    }

    breadcrumbs.unshift(parent);
    if (parent.fullyQualifiedName) {
      visited.add(parent.fullyQualifiedName);
    }
    currentColumn = parent;
  }

  return breadcrumbs;
};

export const extractTableColumns = <T extends Omit<EntityReference, 'type'>>(
  data: T
): Column[] => {
  const table = data as Partial<Table>;

  return (table.columns ?? []).map(
    (column) => ({ ...column, tags: column.tags ?? [] } as Column)
  );
};

export const extractColumnsFromData = <T extends Omit<EntityReference, 'type'>>(
  data: T,
  entityType: EntityType
): Array<Column | SearchIndexField | Field | Task | MlFeature> => {
  switch (entityType) {
    case EntityType.TABLE:
      return extractTableColumns(data);
    case EntityType.API_ENDPOINT:
      return extractApiEndpointFields(data);
    case EntityType.DASHBOARD_DATA_MODEL:
      return extractDataModelColumns(data);
    case EntityType.MLMODEL:
      return extractMlModelFeatures(data);
    case EntityType.PIPELINE:
      return extractPipelineTasks(data);
    case EntityType.TOPIC:
      return extractTopicFields(data);
    case EntityType.CONTAINER:
      return extractContainerColumns(data);
    case EntityType.SEARCH_INDEX:
      return extractSearchIndexFields(data);
    case EntityType.WORKSHEET:
      return extractTableColumns(data);
    default:
      return [];
  }
};

export const getHighlightedRowClassName = <
  T extends { fullyQualifiedName?: string }
>(
  record: T,
  highlightedFqn?: string
): string => {
  if (highlightedFqn && record.fullyQualifiedName === highlightedFqn) {
    return 'highlighted-row';
  }

  return '';
};

export const getNestedSectionTitle = (
  entityType: EntityType | undefined
): string => {
  switch (entityType) {
    case EntityType.TOPIC:
    case EntityType.API_ENDPOINT:
      return 'label.schema-field-plural';
    case EntityType.SEARCH_INDEX:
      return 'label.field-plural';
    default:
      return 'label.nested-column-plural';
  }
};
