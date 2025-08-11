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

import { Divider, Space, Typography } from 'antd';
import {
  ArrayChange,
  Change,
  diffArrays,
  diffWords,
  diffWordsWithSpace,
} from 'diff';
import {
  cloneDeep,
  get,
  isEmpty,
  isEqual,
  isObject,
  isUndefined,
  startCase,
  toString,
  uniqBy,
  uniqueId,
} from 'lodash';
import { Fragment, ReactNode } from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from '../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import { OwnerLabel } from '../components/common/OwnerLabel/OwnerLabel.component';
import { VersionButton } from '../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { EntityField } from '../constants/Feeds.constants';
import { EntityType, TabSpecificField } from '../enums/entity.enum';
import { EntityChangeOperations } from '../enums/VersionPage.enum';
import { Column as ContainerColumn } from '../generated/entity/data/container';
import { Column as DataModelColumn } from '../generated/entity/data/dashboardDataModel';
import { Column as TableColumn } from '../generated/entity/data/table';
import { Field } from '../generated/entity/data/topic';
import {
  ChangeDescription,
  FieldChange,
} from '../generated/entity/services/databaseService';
import { MetadataService } from '../generated/entity/services/metadataService';
import { EntityReference } from '../generated/entity/type';
import { TestCaseParameterValue } from '../generated/tests/testCase';
import { TagLabel } from '../generated/type/tagLabel';
import {
  EntityDiffProps,
  EntityDiffWithMultiChanges,
} from '../interface/EntityVersion.interface';
import { getEntityBreadcrumbs, getEntityName } from './EntityUtils';
import {
  AssetsChildForVersionPages,
  TagLabelWithStatus,
  VersionEntityTypes,
} from './EntityVersionUtils.interface';
import { t } from './i18next/LocalUtil';
import { getJSONFromString, isValidJSONString } from './StringsUtils';
import { getTagsWithoutTier, getTierTags } from './TableUtils';

type EntityColumn = TableColumn | ContainerColumn | Field;

export const getChangedEntityName = (diffObject?: EntityDiffProps) =>
  diffObject?.added?.name ??
  diffObject?.deleted?.name ??
  diffObject?.updated?.name;

export const getChangedEntityOldValue = (diffObject?: EntityDiffProps) =>
  diffObject?.added?.oldValue ??
  diffObject?.deleted?.oldValue ??
  diffObject?.updated?.oldValue;

export const getChangedEntityNewValue = (diffObject?: EntityDiffProps) =>
  diffObject?.added?.newValue ??
  diffObject?.deleted?.newValue ??
  diffObject?.updated?.newValue;

export const getChangeColumnNameFromDiffValue = (name?: string) => {
  const nameWithoutInternalQuotes = name?.replaceAll(/"/g, '');

  return nameWithoutInternalQuotes?.split(FQN_SEPARATOR_CHAR)?.slice(-2, -1)[0];
};

export const isEndsWithField = (checkWith: string, name?: string) => {
  return name?.endsWith(checkWith);
};

export const getDiffByFieldName = (
  name: string,
  changeDescription: ChangeDescription,
  exactMatch?: boolean
): EntityDiffProps => {
  const fieldsAdded = changeDescription?.fieldsAdded ?? [];
  const fieldsDeleted = changeDescription?.fieldsDeleted ?? [];
  const fieldsUpdated = changeDescription?.fieldsUpdated ?? [];
  if (exactMatch) {
    return {
      added: fieldsAdded.find((ch) => ch.name === name),
      deleted: fieldsDeleted.find((ch) => ch.name === name),
      updated: fieldsUpdated.find((ch) => ch.name === name),
    };
  } else {
    return {
      added: fieldsAdded.find((ch) => ch.name?.includes(name)),
      deleted: fieldsDeleted.find((ch) => ch.name?.includes(name)),
      updated: fieldsUpdated.find((ch) => ch.name?.includes(name)),
    };
  }
};

export const getDiffValue = (oldValue: string, newValue: string) => {
  const diff = diffWordsWithSpace(oldValue, newValue);

  return diff.map((part: Change) => {
    const diffChangeText = part.added ? 'diff-added' : 'diff-removed';

    return (
      <span
        className={diffChangeText}
        data-testid={`${diffChangeText}`}
        key={part.value}>
        {part.value}
      </span>
    );
  });
};

export const getAddedDiffElement = (text: string) => {
  return (
    <span
      className="diff-added text-underline"
      data-diff="true"
      data-testid="diff-added"
      key={uniqueId()}>
      {text}
    </span>
  );
};

export const getRemovedDiffElement = (text: string) => {
  return (
    <span
      className="text-grey-muted text-line-through"
      data-diff="true"
      data-testid="diff-removed"
      key={uniqueId()}>
      {text}
    </span>
  );
};

export const getNormalDiffElement = (text: string) => {
  return (
    <span data-diff="true" data-testid="diff-normal" key={uniqueId()}>
      {text}
    </span>
  );
};

export const getTextDiff = (
  oldText: string,
  newText: string,
  latestText?: string
) => {
  const imagePlaceholder = 'data:image';
  if (isEmpty(oldText) && isEmpty(newText)) {
    return latestText ?? '';
  }

  if (
    newText?.includes(imagePlaceholder) ||
    oldText?.includes(imagePlaceholder)
  ) {
    return newText;
  }

  const diffArr = diffWords(toString(oldText), toString(newText));

  const result = diffArr.map((diff) => {
    if (diff.added) {
      return ReactDOMServer.renderToString(getAddedDiffElement(diff.value));
    }
    if (diff.removed) {
      return ReactDOMServer.renderToString(getRemovedDiffElement(diff.value));
    }

    return ReactDOMServer.renderToString(getNormalDiffElement(diff.value));
  });

  return result.join('');
};

const getCustomPropertyValue = (value: unknown) => {
  if (isObject(value)) {
    return JSON.stringify(value);
  }

  return toString(value);
};

export const getTextDiffCustomProperty = (
  fieldName: string,
  oldText: string,
  newText: string
) => {
  if (oldText && newText) {
    return `* ${t('message.custom-property-is-set-to-message', {
      fieldName,
    })} **${getTextDiff(oldText, newText)}**`;
  }

  const resultArray: unknown = getJSONFromString(oldText || newText);

  if (Array.isArray(resultArray)) {
    const result = resultArray.map((diff: Record<string, string>) => {
      const objKeys = Object.keys(diff);

      return `* ${t('message.custom-property-is-set-to-message', {
        fieldName: objKeys[0],
      })} **${getCustomPropertyValue(diff[objKeys[0]])}** \n`;
    });

    return result.join('');
  }

  return '';
};

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
  const tagDiff = diffArrays<TagLabel, TagLabel>(oldTagList, newTagList);
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

const getGlossaryTermApprovalText = (fieldsChanged: FieldChange[]) => {
  const statusFieldDiff = fieldsChanged.find(
    (field) => field.name === 'status'
  );
  let approvalText = '';

  if (statusFieldDiff) {
    approvalText = t('message.glossary-term-status', {
      status:
        statusFieldDiff.newValue === 'Approved'
          ? t('label.approved')
          : statusFieldDiff.newValue === 'In Review'
          ? t('label.in-review')
          : t('label.rejected'),
    });
  }

  return approvalText;
};

const getSummaryText = ({
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
    summaryText = `${prefix} ${filteredFieldsChanged
      .map(summaryFormatter)
      .join(', ')} ${
      !isPrefix
        ? t('label.has-been-action-type-lowercase', {
            actionType: actionText,
          })
        : ''
    } `;
  }

  const isGlossaryTermStatusUpdated = fieldsChanged.some(
    (field) => field.name === 'status'
  );

  const glossaryTermApprovalText = isGlossaryTermStatusUpdated
    ? getGlossaryTermApprovalText(fieldsChanged)
    : '';

  return `${glossaryTermApprovalText} ${summaryText}`;
};

export const getSummary = ({
  changeDescription,
  isPrefix = false,
  isGlossaryTerm = false,
}: {
  changeDescription: ChangeDescription;
  isPrefix?: boolean;
  isGlossaryTerm?: boolean;
}) => {
  const fieldsAdded = [...(changeDescription?.fieldsAdded ?? [])];
  const fieldsDeleted = [...(changeDescription?.fieldsDeleted ?? [])];
  const fieldsUpdated = [
    ...(changeDescription?.fieldsUpdated?.filter(
      (field) => field.name !== 'deleted'
    ) ?? []),
  ];
  const isDeleteUpdated = [
    ...(changeDescription?.fieldsUpdated?.filter(
      (field) => field.name === 'deleted'
    ) ?? []),
  ];

  return (
    <Fragment>
      {isDeleteUpdated?.length > 0 ? (
        <Typography.Paragraph>
          {isDeleteUpdated
            .map((field) => {
              return field.newValue
                ? t('message.data-asset-has-been-action-type', {
                    actionType: t('label.deleted-lowercase'),
                  })
                : t('message.data-asset-has-been-action-type', {
                    actionType: t('label.restored-lowercase'),
                  });
            })
            .join(', ')}
        </Typography.Paragraph>
      ) : null}
      {fieldsAdded?.length > 0 ? (
        <Typography.Paragraph>
          {getSummaryText({
            isPrefix,
            fieldsChanged: fieldsAdded,
            actionType: t('label.added'),
            actionText: t('label.added-lowercase'),
          })}
        </Typography.Paragraph>
      ) : null}
      {fieldsUpdated?.length ? (
        <Typography.Paragraph>
          {getSummaryText({
            isPrefix,
            fieldsChanged: fieldsUpdated,
            actionType: t('label.edited'),
            actionText: t('label.updated-lowercase'),
            isGlossaryTerm,
          })}
        </Typography.Paragraph>
      ) : null}
      {fieldsDeleted?.length ? (
        <Typography.Paragraph>
          {getSummaryText({
            isPrefix,
            fieldsChanged: fieldsDeleted,
            actionType: t('label.removed'),
            actionText: t('label.deleted-lowercase'),
          })}
        </Typography.Paragraph>
      ) : null}
    </Fragment>
  );
};

export const isMajorVersion = (version1: string, version2: string) => {
  const v1 = parseFloat(version1);
  const v2 = parseFloat(version2);
  const flag = !isNaN(v1) && !isNaN(v2);
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
      !addedItems.find((addedItem: EntityReference) => addedItem.id === item.id)
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
    owners: allItems.map(({ item }) => item),
    ownerDisplayName: allItems.map(({ item, operation }) =>
      getOwnerLabelName(item, operation)
    ),
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
      !addedItems.find((addedItem: EntityReference) => addedItem.id === item.id)
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

export const getAllDiffByFieldName = (
  name: string,
  changeDescription: ChangeDescription,
  exactMatch?: boolean
): EntityDiffWithMultiChanges => {
  const fieldsAdded = changeDescription?.fieldsAdded ?? [];
  const fieldsDeleted = changeDescription?.fieldsDeleted ?? [];
  const fieldsUpdated = changeDescription?.fieldsUpdated ?? [];
  if (exactMatch) {
    return {
      added: fieldsAdded.filter((ch) => ch.name === name),
      deleted: fieldsDeleted.filter((ch) => ch.name === name),
      updated: fieldsUpdated.filter((ch) => ch.name === name),
    };
  } else {
    return {
      added: fieldsAdded.filter((ch) => ch.name?.includes(name)),
      deleted: fieldsDeleted.filter((ch) => ch.name?.includes(name)),
      updated: fieldsUpdated.filter((ch) => ch.name?.includes(name)),
    };
  }
};

export const getAllChangedEntityNames = (
  diffObject: EntityDiffWithMultiChanges
) => {
  const changedEntityNames: string[] = [];
  Object.keys(diffObject).forEach((key) => {
    const changedValues = diffObject[key as keyof EntityDiffWithMultiChanges];

    if (changedValues) {
      changedValues.forEach((value) => {
        if (value.name) {
          changedEntityNames.push(value.name);
        }
      });
    }
  });

  return changedEntityNames;
};

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

export const getUpdatedExtensionDiffFields = (
  entityDetails: ExtentionEntities[ExtentionEntitiesKeys],
  extensionDiff: EntityDiffProps
) => {
  const extensionObj = entityDetails.extension;
  const newValues = getChangedEntityNewValue(extensionDiff);
  const oldValues = getChangedEntityOldValue(extensionDiff);

  const changedFieldName = extensionDiff.updated?.name?.split('.')[1];

  return extensionObj && changedFieldName
    ? {
        extensionObject: {
          ...extensionObj,
          [changedFieldName]: getTextDiff(oldValues, newValues),
        },
      }
    : { extensionObject: {} };
};

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

const getMutuallyExclusiveDiffLabel = (value: boolean) => {
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

export const renderVersionButton = (
  version: string,
  current: string,
  versionHandler: (version: string) => void,
  className?: string
) => {
  const currV = JSON.parse(version);

  const majorVersionChecks = () => {
    return isMajorVersion(
      parseFloat(currV?.changeDescription?.previousVersion)
        .toFixed(1)
        .toString(),
      parseFloat(currV?.version).toFixed(1).toString()
    );
  };

  return (
    <Fragment key={currV.version}>
      <VersionButton
        className={className}
        isMajorVersion={majorVersionChecks()}
        selected={toString(currV.version) === current}
        version={currV}
        onVersionSelect={versionHandler}
      />
    </Fragment>
  );
};

export const getChangedEntityStatus = (
  oldValue?: string,
  newValue?: string
) => {
  if (oldValue && newValue) {
    return oldValue !== newValue
      ? EntityChangeOperations.UPDATED
      : EntityChangeOperations.NORMAL;
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
      if (oldParam.value !== newParam.value) {
        result.push({
          name: String(name),
          oldValue: String(oldParam.value),
          newValue: String(newParam.value),
          status: EntityChangeOperations.UPDATED,
        });
      } else {
        result.push({
          name: String(name),
          oldValue: String(oldParam.value),
          newValue: String(newParam.value),
          status: EntityChangeOperations.NORMAL,
        });
      }
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

// New function for React element diff (for parameter value diff only)
export const getTextDiffElements = (
  oldText: string,
  newText: string
): React.ReactNode[] => {
  const diffArr = diffWords(toString(oldText), toString(newText));

  return diffArr.map((diff) => {
    if (diff.added) {
      return getAddedDiffElement(diff.value);
    }
    if (diff.removed) {
      return getRemovedDiffElement(diff.value);
    }

    return getNormalDiffElement(diff.value);
  });
};

export const getDiffDisplayValue = (diff: {
  oldValue: string;
  newValue: string;
  status: EntityChangeOperations;
}) => {
  switch (diff.status) {
    case EntityChangeOperations.UPDATED:
      return getTextDiffElements(diff.oldValue, diff.newValue);
    case EntityChangeOperations.ADDED:
      return getAddedDiffElement(diff.newValue);
    case EntityChangeOperations.DELETED:
      return getRemovedDiffElement(diff.oldValue);
    case EntityChangeOperations.NORMAL:
    default:
      return diff.oldValue;
  }
};

export const getParameterValueDiffDisplay = (
  changeDescription: ChangeDescription,
  defaultValues?: TestCaseParameterValue[]
): React.ReactNode => {
  const diffs = getParameterValuesDiff(changeDescription, defaultValues);

  // Separate sqlExpression from other params
  const sqlParamDiff = diffs.find((diff) => diff.name === 'sqlExpression');
  const otherParamDiffs = diffs.filter((diff) => diff.name !== 'sqlExpression');

  return (
    <>
      {/* Render non-sqlExpression parameters as before */}
      <Space
        wrap
        className="parameter-value-container parameter-value"
        size={6}>
        {otherParamDiffs.length === 0 ? (
          <Typography.Text type="secondary">
            {t('label.no-parameter-available')}
          </Typography.Text>
        ) : (
          otherParamDiffs.map((diff, index) => (
            <Space data-testid={diff.name} key={diff.name} size={4}>
              <Typography.Text className="text-grey-muted">
                {`${diff.name}:`}
              </Typography.Text>
              <Typography.Text>{getDiffDisplayValue(diff)}</Typography.Text>
              {otherParamDiffs.length - 1 !== index && (
                <Divider type="vertical" />
              )}
            </Space>
          ))
        )}
      </Space>
      {/* Render sqlExpression parameter separately, using inline diff in a code-style block */}
      {sqlParamDiff && (
        <div className="m-t-md">
          <Typography.Text className="right-panel-label">
            {startCase(sqlParamDiff.name)}
          </Typography.Text>

          <div className="m-t-sm version-sql-expression-container">
            {getDiffDisplayValue(sqlParamDiff)}
          </div>
        </div>
      )}
    </>
  );
};

export const getComputeRowCountDiffDisplay = (
  changeDescription: ChangeDescription,
  fallbackValue?: boolean
): React.ReactNode => {
  const fieldDiff = getDiffByFieldName(
    'computePassedFailedRowCount',
    changeDescription,
    true
  );
  const oldValue = getChangedEntityOldValue(fieldDiff);
  const newValue = getChangedEntityNewValue(fieldDiff);

  const isOldValueUndefined = isUndefined(oldValue);
  const isNewValueUndefined = isUndefined(newValue);

  // If there's no diff, return the fallback value as normal text
  if (isOldValueUndefined && isNewValueUndefined) {
    return toString(fallbackValue);
  }

  // If there's a diff, show the diff styling
  if (!isOldValueUndefined && !isNewValueUndefined) {
    // Field was updated
    return getTextDiffElements(toString(oldValue), toString(newValue));
  } else if (isOldValueUndefined && !isNewValueUndefined) {
    // Field was added
    return getAddedDiffElement(toString(newValue));
  } else if (!isOldValueUndefined && isNewValueUndefined) {
    // Field was deleted
    return getRemovedDiffElement(toString(oldValue));
  }

  // Fallback
  return toString(fallbackValue);
};

export const getOwnerVersionLabel = (
  entity: {
    [TabSpecificField.OWNERS]?: EntityReference[];
    changeDescription?: ChangeDescription;
  },
  isVersionView: boolean,
  ownerField = TabSpecificField.OWNERS, // Can be owners, experts, reviewers all are OwnerLabels
  hasPermission = true
) => {
  const defaultItems: EntityReference[] = get(entity, ownerField, []);

  if (isVersionView) {
    const { owners, ownerDisplayName } = getOwnerDiff(
      defaultItems,
      entity.changeDescription,
      ownerField
    );

    if (!isEmpty(owners)) {
      return <OwnerLabel ownerDisplayName={ownerDisplayName} owners={owners} />;
    }
  }

  if (defaultItems.length > 0) {
    return (
      <OwnerLabel
        ownerDisplayName={defaultItems.map((item: EntityReference) =>
          getOwnerLabelName(item, EntityChangeOperations.NORMAL)
        )}
        owners={defaultItems}
      />
    );
  }

  return hasPermission ? null : <div>{NO_DATA_PLACEHOLDER}</div>;
};
