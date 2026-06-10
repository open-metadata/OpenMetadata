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

import { diffArrays, type ArrayChange } from 'diff';
import {
  cloneDeep,
  isEmpty,
  isEqual,
  isUndefined,
  toString,
  uniqBy,
} from 'lodash';
import type { ReactNode } from 'react';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityField } from '../constants/Feeds.constants';
import { TabSpecificField, type EntityType } from '../enums/entity.enum';
import { EntityChangeOperations } from '../enums/VersionPage.enum';
import type { Column as ContainerColumn } from '../generated/entity/data/container';
import type { Column as DataModelColumn } from '../generated/entity/data/dashboardDataModel';
import type { Column as TableColumn } from '../generated/entity/data/table';
import type { Field } from '../generated/entity/data/topic';
import type {
  ChangeDescription,
  FieldChange,
} from '../generated/entity/services/databaseService';
import type { MetadataService } from '../generated/entity/services/metadataService';
import type { EntityReference } from '../generated/entity/type';
import type { TestCaseParameterValue } from '../generated/tests/testCase';
import type { TagLabel } from '../generated/type/tagLabel';
import type { EntityDiffProps } from '../interface/EntityVersion.interface';
import {
  getAllChangedEntityNames,
  getAllDiffByFieldName,
  getChangeColumnNameFromDiffValue,
  getChangedEntityName,
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
  isEndsWithField,
} from './EntityDiffPureUtils';
import {
  getAddedDiffElement,
  getDiffValue,
  getRemovedDiffElement,
  getTextDiff,
} from './EntityDiffUtils';
import { getEntityBreadcrumbs } from './EntityBreadcrumbPureUtils';
import { getEntityName } from './EntityNameUtils';
import type {
  AssetsChildForVersionPages,
  TagLabelWithStatus,
  VersionEntityTypes,
} from './EntityVersionUtils.interface';
import { t } from './i18next/LocalUtil';
import { isValidJSONString } from './StringUtils';
import {
  getTagsWithoutTier,
  getTierTags,
} from './TablePureUtils';

type EntityColumn = TableColumn | ContainerColumn | Field;

export const getEntityVersionByField = (
  changeDescription: ChangeDescription,
  field: string,
  fallbackText?: string
) => {
  const fieldDiff = getDiffByFieldName(field, changeDescription, true);
  const oldField = getChangedEntityOldValue(fieldDiff);
  const newField = getChangedEntityNewValue(fieldDiff);

  return getTextDiff(
    toString(oldField) ?? '',
    toString(newField),
    toString(fallbackText)
  );
};

export const getTagsDiff = (
  oldTagList: Array<TagLabel>,
  newTagList: Array<TagLabel>
) => {
  const tagDiff = diffArrays<TagLabel>(oldTagList, newTagList);
  const result = tagDiff
    .map((part: ArrayChange<TagLabel>) =>
      part.value.map((tag) => ({
        ...tag,
        added: part.added,
        removed: part.removed,
      }))
    )
    ?.flat(Infinity) as Array<TagLabelWithStatus>;

  return result;
};

export const getEntityVersionTags = (
  currentVersionData: VersionEntityTypes,
  changeDescription: ChangeDescription
) => {
  const tagsDiff = getDiffByFieldName('tags', changeDescription, true);
  const oldTags: Array<TagLabel> = JSON.parse(
    getChangedEntityOldValue(tagsDiff) ?? '[]'
  );
  const newTags: Array<TagLabel> = JSON.parse(
    getChangedEntityNewValue(tagsDiff) ?? '[]'
  );
  const flag: { [x: string]: boolean } = {};
  const uniqueTags: Array<TagLabelWithStatus> = [];

  [
    ...(getTagsDiff(oldTags, newTags) ?? []),
    ...(currentVersionData.tags ?? []),
  ].forEach((elem) => {
    if (!flag[elem.tagFQN]) {
      flag[elem.tagFQN] = true;
      uniqueTags.push(elem as TagLabelWithStatus);
    }
  });

  return getTagsWithoutTier(uniqueTags);
};

export const summaryFormatter = (fieldChange: FieldChange) => {
  const newValueJSON = isValidJSONString(fieldChange?.newValue)
    ? JSON.parse(fieldChange?.newValue)
    : undefined;
  const oldValueJSON = isValidJSONString(fieldChange?.oldValue)
    ? JSON.parse(fieldChange?.oldValue)
    : {};

  const value = newValueJSON ?? oldValueJSON;

  if (fieldChange.name === EntityField.COLUMNS) {
    return `${t('label.column-lowercase-plural')} ${value
      ?.map((val: TableColumn) => val?.name)
      .join(', ')}`;
  } else if (
    fieldChange.name === 'tags' ||
    fieldChange.name?.endsWith('tags')
  ) {
    return `${t('label.tag-lowercase-plural')} ${value
      ?.map((val: TagLabel) => val?.tagFQN)
      ?.join(', ')}`;
  } else if (fieldChange.name === 'owner') {
    return `${fieldChange.name} ${value.name}`;
  } else {
    return fieldChange.name;
  }
};

export const getGlossaryTermApprovalText = (fieldsChanged: FieldChange[]) => {
  const statusFieldDiff = fieldsChanged.find(
    (field) => field.name === 'status'
  );
  let approvalText = '';

  if (statusFieldDiff) {
    let statusLabel: string;
    if (statusFieldDiff.newValue === 'Approved') {
      statusLabel = t('label.approved');
    } else if (statusFieldDiff.newValue === 'In Review') {
      statusLabel = t('label.in-review');
    } else {
      statusLabel = t('label.rejected');
    }
    approvalText = t('message.glossary-term-status', { status: statusLabel });
  }

  return approvalText;
};

export const getSummaryText = ({
  isPrefix,
  fieldsChanged,
  actionType,
  actionText,
  isGlossaryTerm,
}: {
  isPrefix: boolean;
  fieldsChanged: FieldChange[];
  actionType: string;
  actionText: string;
  isGlossaryTerm?: boolean;
}) => {
  const prefix = isPrefix ? `+ ${actionType}` : '';
  const filteredFieldsChanged = isGlossaryTerm
    ? fieldsChanged.filter((field) => field.name !== 'status')
    : fieldsChanged;

  let summaryText = '';

  if (!isEmpty(filteredFieldsChanged)) {
    const suffix = isPrefix
      ? ''
      : t('label.has-been-action-type-lowercase', {
          actionType: actionText,
        });
    summaryText = `${prefix} ${filteredFieldsChanged
      .map(summaryFormatter)
      .join(', ')} ${suffix} `;
  }

  const isGlossaryTermStatusUpdated = fieldsChanged.some(
    (field) => field.name === 'status'
  );

  const glossaryTermApprovalText = isGlossaryTermStatusUpdated
    ? getGlossaryTermApprovalText(fieldsChanged)
    : '';

  return `${glossaryTermApprovalText} ${summaryText}`;
};

export const isMajorVersion = (version1: string, version2: string) => {
  const v1 = Number.parseFloat(version1);
  const v2 = Number.parseFloat(version2);
  const flag = !Number.isNaN(v1) && !Number.isNaN(v2);
  if (flag) {
    return v1 + 1 === v2;
  }

  return flag;
};

// remove tags from a list if same present in b list
export const removeDuplicateTags = (a: TagLabel[], b: TagLabel[]): TagLabel[] =>
  a.filter(
    (item) => !b.map((secondItem) => secondItem.tagFQN).includes(item.tagFQN)
  );

export function getEntityDescriptionDiff<A extends AssetsChildForVersionPages>(
  entityDiff: EntityDiffProps,
  changedEntityName?: string,
  entityList: A[] = []
) {
  const oldDescription = getChangedEntityOldValue(entityDiff);
  const newDescription = getChangedEntityNewValue(entityDiff);

  const formatEntityData = (arr: Array<A>) => {
    arr?.forEach((i) => {
      if (isEqual(i.name, changedEntityName)) {
        i.description = getTextDiff(
          oldDescription ?? '',
          newDescription ?? '',
          i.description
        );
      } else {
        formatEntityData(i?.children as Array<A>);
      }
    });
  };

  formatEntityData(entityList);

  return entityList;
}

export function getStringEntityDiff<A extends EntityColumn>(
  entityDiff: EntityDiffProps,
  key: EntityField,
  changedEntityName?: string,
  entityList: A[] = []
) {
  const oldDisplayName = getChangedEntityOldValue(entityDiff);
  const newDisplayName = getChangedEntityNewValue(entityDiff);

  const formatEntityData = (arr: Array<A>) => {
    arr?.forEach((i) => {
      if (isEqual(i.name, changedEntityName)) {
        i[key as keyof A] = getTextDiff(
          oldDisplayName ?? '',
          newDisplayName ?? '',
          i[key as keyof typeof i] as unknown as string
        ) as unknown as A[keyof A];
      } else {
        formatEntityData(i?.children as Array<A>);
      }
    });
  };

  formatEntityData(entityList);

  return entityList;
}

export function getEntityTagDiff<A extends EntityColumn>(
  entityDiff: EntityDiffProps,
  changedEntityName?: string,
  entityList?: A[]
) {
  const oldTags: TagLabel[] = JSON.parse(
    getChangedEntityOldValue(entityDiff) ?? '[]'
  );
  const newTags: TagLabel[] = JSON.parse(
    getChangedEntityNewValue(entityDiff) ?? '[]'
  );

  const formatColumnData = (arr: Array<A>) => {
    arr?.forEach((i) => {
      if (isEqual(i.name, changedEntityName)) {
        const flag: { [x: string]: boolean } = {};
        const uniqueTags: TagLabelWithStatus[] = [];
        const tagsDiff = getTagsDiff(oldTags, newTags);

        [...tagsDiff, ...(i.tags as TagLabelWithStatus[])].forEach(
          (elem: TagLabelWithStatus) => {
            if (!flag[elem.tagFQN]) {
              flag[elem.tagFQN] = true;
              uniqueTags.push(elem);
            }
          }
        );
        i.tags = uniqueTags;
      } else {
        formatColumnData(i?.children as Array<A>);
      }
    });
  };

  formatColumnData(entityList ?? []);

  return entityList ?? [];
}

export const getEntityReferenceDiffFromFieldName = (
  fieldName: string,
  changeDescription: ChangeDescription,
  entity?: EntityReference
) => {
  const entityDiff = getDiffByFieldName(fieldName, changeDescription, true);

  const oldEntity = JSON.parse(getChangedEntityOldValue(entityDiff) ?? '{}');
  const newEntity = JSON.parse(getChangedEntityNewValue(entityDiff) ?? '{}');
  const entityPlaceholder = getEntityName(entity);

  let entityRef = entity;
  let entityDisplayName: ReactNode = getEntityName(entity);

  if (
    !isUndefined(entityDiff.added) ||
    !isUndefined(entityDiff.deleted) ||
    !isUndefined(entityDiff.updated)
  ) {
    entityRef = isEmpty(newEntity) ? oldEntity : newEntity;
    entityDisplayName = getDiffValue(
      getEntityName(oldEntity),
      getEntityName(newEntity)
    );
  } else if (entity) {
    entityDisplayName = entityPlaceholder;
  }

  return {
    entityRef,
    entityDisplayName,
  };
};

const getOwnerLabelName = (
  reviewer: EntityReference,
  operation: EntityChangeOperations
) => {
  switch (operation) {
    case EntityChangeOperations.ADDED:
      return getAddedDiffElement(getEntityName(reviewer));
    case EntityChangeOperations.DELETED:
      return getRemovedDiffElement(getEntityName(reviewer));
    case EntityChangeOperations.UPDATED:
    case EntityChangeOperations.NORMAL:
    default:
      return getEntityName(reviewer);
  }
};

export const getOwnerDiff = (
  defaultItems: EntityReference[],
  changeDescription?: ChangeDescription,
  ownerField = TabSpecificField.OWNERS
) => {
  const fieldDiff = getDiffByFieldName(
    ownerField,
    changeDescription as ChangeDescription
  );

  const addedItems: EntityReference[] = JSON.parse(
    getChangedEntityNewValue(fieldDiff) ?? '[]'
  );
  const deletedItems: EntityReference[] = JSON.parse(
    getChangedEntityOldValue(fieldDiff) ?? '[]'
  );

  const unchangedItems = defaultItems.filter(
    (item: EntityReference) =>
      !addedItems.some((addedItem: EntityReference) => addedItem.id === item.id)
  );

  const allItems = [
    ...unchangedItems.map((item) => ({
      item,
      operation: EntityChangeOperations.NORMAL,
    })),
    ...addedItems.map((item) => ({
      item,
      operation: EntityChangeOperations.ADDED,
    })),
    ...deletedItems.map((item) => ({
      item,
      operation: EntityChangeOperations.DELETED,
    })),
  ];

  const ownerDisplayName = new Map<string, ReactNode>();

  allItems.forEach(({ item, operation }) => {
    const displayName = getOwnerLabelName(item, operation);
    if (item.name) {
      ownerDisplayName.set(item.name, displayName);
    }
  });

  return {
    owners: allItems.map(({ item }) => item),
    ownerDisplayName: ownerDisplayName,
  };
};

export const getDomainDiff = (
  defaultItems: EntityReference[],
  changeDescription?: ChangeDescription,
  domainField = TabSpecificField.DOMAINS
) => {
  const fieldDiff = getDiffByFieldName(
    domainField,
    changeDescription as ChangeDescription
  );

  const addedItems: EntityReference[] = JSON.parse(
    getChangedEntityNewValue(fieldDiff) ?? '[]'
  );
  const deletedItems: EntityReference[] = JSON.parse(
    getChangedEntityOldValue(fieldDiff) ?? '[]'
  );

  const unchangedItems = defaultItems.filter(
    (item: EntityReference) =>
      !addedItems.some((addedItem: EntityReference) => addedItem.id === item.id)
  );

  const allItems = [
    ...unchangedItems.map((item) => ({
      item,
      operation: EntityChangeOperations.NORMAL,
    })),
    ...addedItems.map((item) => ({
      item,
      operation: EntityChangeOperations.ADDED,
    })),
    ...deletedItems.map((item) => ({
      item,
      operation: EntityChangeOperations.DELETED,
    })),
  ];

  return {
    domains: allItems.map(({ item }) => item),
    domainDisplayName: allItems.map(({ item, operation }) =>
      getOwnerLabelName(item, operation)
    ),
  };
};

export const getCommonExtraInfoForVersionDetails = (
  changeDescription: ChangeDescription,
  owners?: EntityReference[],
  tier?: TagLabel,
  domains?: EntityReference[]
) => {
  const { owners: ownerRef, ownerDisplayName } = getOwnerDiff(
    owners ?? [],
    changeDescription
  );

  const { domains: domainRef, domainDisplayName } = getDomainDiff(
    domains ?? [],
    changeDescription
  );

  const tagsDiff = getDiffByFieldName('tags', changeDescription, true);
  const newTier = [
    ...JSON.parse(getChangedEntityNewValue(tagsDiff) ?? '[]'),
  ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

  const oldTier = [
    ...JSON.parse(getChangedEntityOldValue(tagsDiff) ?? '[]'),
  ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

  let tierDisplayName: ReactNode = '';

  if (!isUndefined(newTier) || !isUndefined(oldTier)) {
    tierDisplayName = getDiffValue(
      oldTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] ?? '',
      newTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] ?? ''
    );
  } else if (tier?.tagFQN) {
    tierDisplayName = tier?.tagFQN.split(FQN_SEPARATOR_CHAR)[1];
  }

  const extraInfo = {
    ownerRef,
    ownerDisplayName,
    domainRef,
    domainDisplayName,
    tierDisplayName,
  };

  return extraInfo;
};

export function getNewColumnFromColDiff<
  A extends TableColumn | ContainerColumn
>(newCol: Array<A>): Array<A> {
  return newCol.map((col) => {
    let children: Array<A> | undefined;
    if (!isEmpty(col.children)) {
      children = getNewColumnFromColDiff(col.children as Array<A>);
    }

    return {
      ...col,
      tags: col.tags?.map((tag) => ({ ...tag, removed: true })),
      description: getTextDiff(col.description ?? '', ''),
      dataTypeDisplay: getTextDiff(col.dataTypeDisplay ?? '', ''),
      name: getTextDiff(col.name, ''),
      children,
    };
  });
}

function createAddedColumnsDiff<A extends TableColumn | ContainerColumn>(
  columnsDiff: EntityDiffProps,
  colList: A[] = []
) {
  try {
    const newCol: Array<A> = JSON.parse(columnsDiff.added?.newValue ?? '[]');

    newCol.forEach((col) => {
      const formatColumnData = (arr: Array<A>, updateAll?: boolean) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, col.name) || updateAll) {
            i.tags = i.tags?.map((tag) => ({ ...tag, added: true }));
            i.description = getTextDiff('', i.description ?? '');
            i.dataTypeDisplay = getTextDiff('', i.dataTypeDisplay ?? '');
            i.name = getTextDiff('', i.name);
            if (!isEmpty(i.children)) {
              formatColumnData(i?.children as Array<A>, true);
            }
          } else {
            formatColumnData(i?.children as Array<A>);
          }
        });
      };
      formatColumnData(colList);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

export function addDeletedColumnsDiff<A extends TableColumn | ContainerColumn>(
  columnsDiff: EntityDiffProps,
  colList: A[] = [],
  changedEntity = ''
) {
  try {
    const newCol: Array<A> = JSON.parse(columnsDiff.deleted?.oldValue ?? '[]');
    const newColumns = getNewColumnFromColDiff(newCol);

    const insertNewColumn = (
      changedEntityField: string,
      colArray: Array<TableColumn | ContainerColumn>
    ) => {
      const fieldsArray = changedEntityField.split(FQN_SEPARATOR_CHAR);
      if (isEmpty(changedEntityField)) {
        const nonExistingColumns = newColumns.filter((newColumn) =>
          isUndefined(colArray.find((col) => col.name === newColumn.name))
        );
        colArray.unshift(...nonExistingColumns);
      } else {
        const parentField = fieldsArray.shift();
        const arr = colArray.find((col) => col.name === parentField)?.children;

        insertNewColumn(fieldsArray.join(FQN_SEPARATOR_CHAR), arr ?? []);
      }
    };
    insertNewColumn(changedEntity, colList);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

export function getColumnsDiff<A extends TableColumn | ContainerColumn>(
  columnsDiff: EntityDiffProps,
  colList: A[] = [],
  changedEntity = ''
) {
  if (columnsDiff.added) {
    createAddedColumnsDiff(columnsDiff, colList);
  }
  if (columnsDiff.deleted) {
    addDeletedColumnsDiff(columnsDiff, colList, changedEntity);
  }

  return uniqBy(colList, 'name');
}

export function getColumnsDataWithVersionChanges<
  A extends TableColumn | ContainerColumn | DataModelColumn
>(
  changeDescription: ChangeDescription,
  colList?: A[],
  isContainerEntity?: boolean
): Array<A> {
  const columnsDiff = getAllDiffByFieldName(
    EntityField.COLUMNS,
    changeDescription
  );

  const changedFields = getAllChangedEntityNames(columnsDiff);

  let newColumnsList = cloneDeep(colList);

  changedFields?.forEach((changedField) => {
    const columnDiff = getDiffByFieldName(changedField, changeDescription);
    const changedEntityName = getChangedEntityName(columnDiff);
    const changedColName = getChangeColumnNameFromDiffValue(changedEntityName);

    if (isEndsWithField(EntityField.DESCRIPTION, changedEntityName)) {
      newColumnsList = [
        ...getEntityDescriptionDiff(columnDiff, changedColName, colList),
      ];
    } else if (isEndsWithField(EntityField.TAGS, changedEntityName)) {
      newColumnsList = [
        ...getEntityTagDiff(columnDiff, changedColName, colList),
      ];
    } else if (isEndsWithField(EntityField.DISPLAYNAME, changedEntityName)) {
      newColumnsList = [
        ...getStringEntityDiff(
          columnDiff,
          EntityField.DISPLAYNAME,
          changedColName,
          colList
        ),
      ];
    } else if (
      isEndsWithField(EntityField.DATA_TYPE_DISPLAY, changedEntityName)
    ) {
      newColumnsList = [
        ...getStringEntityDiff(
          columnDiff,
          EntityField.DATA_TYPE_DISPLAY,
          changedColName,
          colList
        ),
      ];
    } else if (!isEndsWithField(EntityField.CONSTRAINT, changedEntityName)) {
      const changedEntity = changedEntityName
        ?.split(FQN_SEPARATOR_CHAR)
        .slice(isContainerEntity ? 2 : 1)
        .join(FQN_SEPARATOR_CHAR);
      newColumnsList = [...getColumnsDiff(columnDiff, colList, changedEntity)];
    }
  });

  return newColumnsList ?? [];
}

export const getConstraintChanges = (
  changeDescription: ChangeDescription,
  fieldName: EntityField
) => {
  const constraintAddedDiff = getAllDiffByFieldName(
    fieldName,
    changeDescription
  ).added;
  const constraintDeletedDiff = getAllDiffByFieldName(
    fieldName,
    changeDescription
  ).deleted;
  const constraintUpdatedDiff = getAllDiffByFieldName(
    fieldName,
    changeDescription
  ).updated;

  const addedConstraintDiffs: FieldChange[] = [
    ...(constraintAddedDiff ?? []),
    ...(constraintUpdatedDiff ?? []),
  ];
  const deletedConstraintDiffs: FieldChange[] = [
    ...(constraintDeletedDiff ?? []),
    ...(constraintUpdatedDiff ?? []),
  ];

  return { addedConstraintDiffs, deletedConstraintDiffs };
};

export const getMutuallyExclusiveDiffLabel = (value: boolean) => {
  if (value) {
    return t('label.yes');
  } else {
    return t('label.no');
  }
};

export const getMutuallyExclusiveDiff = (
  changeDescription: ChangeDescription,
  field: string,
  fallbackText?: string
) => {
  const fieldDiff = getDiffByFieldName(field, changeDescription, true);
  const oldField = getChangedEntityOldValue(fieldDiff);
  const newField = getChangedEntityNewValue(fieldDiff);

  const oldDisplayField = getMutuallyExclusiveDiffLabel(oldField);
  const newDisplayField = getMutuallyExclusiveDiffLabel(newField);

  return getTextDiff(
    toString(oldDisplayField) ?? '',
    toString(newDisplayField),
    toString(fallbackText)
  );
};

export const getBasicEntityInfoFromVersionData = (
  currentVersionData: VersionEntityTypes,
  entityType: EntityType
) => ({
  tier: getTierTags(currentVersionData.tags ?? []),
  owners: currentVersionData.owners,
  domains: (currentVersionData as Exclude<VersionEntityTypes, MetadataService>)
    .domains,
  breadcrumbLinks: getEntityBreadcrumbs(currentVersionData, entityType),
  changeDescription:
    currentVersionData.changeDescription ?? ({} as ChangeDescription),
  deleted: Boolean(currentVersionData.deleted),
});

export const getCommonDiffsFromVersionData = (
  currentVersionData: VersionEntityTypes,
  changeDescription: ChangeDescription
) => ({
  tags: getEntityVersionTags(currentVersionData, changeDescription),
  displayName: getEntityVersionByField(
    changeDescription,
    EntityField.DISPLAYNAME,
    currentVersionData.displayName
  ),
  description: getEntityVersionByField(
    changeDescription,
    EntityField.DESCRIPTION,
    currentVersionData.description
  ),
});

export const getChangedEntityStatus = (
  oldValue?: string,
  newValue?: string
) => {
  if (oldValue && newValue) {
    return oldValue === newValue
      ? EntityChangeOperations.NORMAL
      : EntityChangeOperations.UPDATED;
  } else if (oldValue && !newValue) {
    return EntityChangeOperations.DELETED;
  } else if (!oldValue && newValue) {
    return EntityChangeOperations.ADDED;
  }

  return EntityChangeOperations.NORMAL;
};

export const getParameterValuesDiff = (
  changeDescription: ChangeDescription,
  defaultValues?: TestCaseParameterValue[]
): {
  name: string;
  oldValue: string;
  newValue: string;
  status: EntityChangeOperations;
}[] => {
  const fieldDiff = getDiffByFieldName(
    EntityField.PARAMETER_VALUES,
    changeDescription,
    true
  );

  const oldValues: TestCaseParameterValue[] =
    getChangedEntityOldValue(fieldDiff) ?? [];
  const newValues: TestCaseParameterValue[] =
    getChangedEntityNewValue(fieldDiff) ?? [];

  // If no diffs exist and we have default values, return them as unchanged
  if (
    isEmpty(oldValues) &&
    isEmpty(newValues) &&
    defaultValues &&
    !isEmpty(defaultValues)
  ) {
    return defaultValues.map((param) => ({
      name: String(param.name),
      oldValue: String(param.value),
      newValue: String(param.value),
      status: EntityChangeOperations.NORMAL,
    }));
  }

  const result: {
    name: string;
    oldValue: string;
    newValue: string;
    status: EntityChangeOperations;
  }[] = [];

  // Find all unique parameter names
  const allNames = Array.from(
    new Set([...oldValues.map((p) => p.name), ...newValues.map((p) => p.name)])
  );

  allNames.forEach((name) => {
    const oldParam = oldValues.find((p) => p.name === name);
    const newParam = newValues.find((p) => p.name === name);

    if (oldParam && newParam) {
      result.push({
        name: String(name),
        oldValue: String(oldParam.value),
        newValue: String(newParam.value),
        status:
          oldParam.value === newParam.value
            ? EntityChangeOperations.NORMAL
            : EntityChangeOperations.UPDATED,
      });
    } else if (!oldParam && newParam) {
      result.push({
        name: String(name),
        oldValue: '',
        newValue: String(newParam.value),
        status: EntityChangeOperations.ADDED,
      });
    } else if (oldParam && !newParam) {
      result.push({
        name: String(name),
        oldValue: String(oldParam.value),
        newValue: '',
        status: EntityChangeOperations.DELETED,
      });
    }
  });

  return result;
};
