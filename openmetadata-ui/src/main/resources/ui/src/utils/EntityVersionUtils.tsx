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

import { Typography } from 'antd';
import {
  ArrayChange,
  Change,
  diffArrays,
  diffWords,
  diffWordsWithSpace,
} from 'diff';
import { t } from 'i18next';
import {
  cloneDeep,
  isEmpty,
  isEqual,
  isUndefined,
  toString,
  uniqBy,
  uniqueId,
} from 'lodash';
import React, { Fragment, ReactNode } from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from '../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityField } from '../constants/Feeds.constants';
import { EntityType } from '../enums/entity.enum';
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
import { isValidJSONString } from './StringsUtils';
import { getTagsWithoutTier, getTierTags } from './TableUtils';

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
    <Typography.Text
      underline
      className="diff-added"
      data-testid="diff-added"
      key={uniqueId()}>
      {text}
    </Typography.Text>
  );
};

export const getRemovedDiffElement = (text: string) => {
  return (
    <Typography.Text
      delete
      className="text-grey-muted"
      data-testid="diff-removed"
      key={uniqueId()}>
      {text}
    </Typography.Text>
  );
};

export const getNormalDiffElement = (text: string) => {
  return (
    <Typography.Text data-testid="diff-normal" key={uniqueId()}>
      {text}
    </Typography.Text>
  );
};

export const getTextDiff = (
  oldText: string,
  newText: string,
  latestText?: string
) => {
  if (isEmpty(oldText) && isEmpty(newText)) {
    return latestText ?? '';
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

export function getEntityDisplayNameDiff<
  A extends TableColumn | ContainerColumn | Field
>(
  entityDiff: EntityDiffProps,
  changedEntityName?: string,
  entityList: A[] = []
) {
  const oldDisplayName = getChangedEntityOldValue(entityDiff);
  const newDisplayName = getChangedEntityNewValue(entityDiff);

  const formatEntityData = (arr: Array<A>) => {
    arr?.forEach((i) => {
      if (isEqual(i.name, changedEntityName)) {
        i.displayName = getTextDiff(
          oldDisplayName ?? '',
          newDisplayName ?? '',
          i.displayName
        );
      } else {
        formatEntityData(i?.children as Array<A>);
      }
    });
  };

  formatEntityData(entityList);

  return entityList;
}

export function getEntityTagDiff<
  A extends TableColumn | ContainerColumn | Field
>(entityDiff: EntityDiffProps, changedEntityName?: string, entityList?: A[]) {
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

export const getCommonExtraInfoForVersionDetails = (
  changeDescription: ChangeDescription,
  owner?: EntityReference,
  tier?: TagLabel,
  domain?: EntityReference
) => {
  const { entityRef: ownerRef, entityDisplayName: ownerDisplayName } =
    getEntityReferenceDiffFromFieldName('owner', changeDescription, owner);

  const { entityDisplayName: domainDisplayName } =
    getEntityReferenceDiffFromFieldName('domain', changeDescription, domain);

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
      oldTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] || '',
      newTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] || ''
    );
  } else if (tier?.tagFQN) {
    tierDisplayName = tier?.tagFQN.split(FQN_SEPARATOR_CHAR)[1];
  }

  const extraInfo = {
    ownerRef,
    ownerDisplayName,
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
        ...getEntityDisplayNameDiff(columnDiff, changedColName, colList),
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
  owner: currentVersionData.owner,
  domain: (currentVersionData as Exclude<VersionEntityTypes, MetadataService>)
    .domain,
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
