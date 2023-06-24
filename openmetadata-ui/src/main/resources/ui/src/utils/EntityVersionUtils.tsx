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

import { Space, Typography } from 'antd';
import { ReactComponent as IconTeamsGrey } from 'assets/svg/teams-grey.svg';
import classNames from 'classnames';
import { EntityDetails } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { getTeamAndUserDetailsPath, getUserPath } from 'constants/constants';
import {
  ArrayChange,
  Change,
  diffArrays,
  diffWords,
  diffWordsWithSpace,
} from 'diff';
import { Glossary } from 'generated/entity/data/glossary';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { Field, MessageSchemaObject, Topic } from 'generated/entity/data/topic';
import { EntityReference } from 'generated/entity/type';
import { t } from 'i18next';
import { EntityDiffProps } from 'interface/EntityVersion.interface';
import {
  cloneDeep,
  isEmpty,
  isEqual,
  isUndefined,
  toString,
  uniqueId,
} from 'lodash';
import { VersionData } from 'pages/EntityVersionPage/EntityVersionPage.component';
import React, { Fragment, ReactNode } from 'react';
import ReactDOMServer from 'react-dom/server';
import { Link } from 'react-router-dom';
import { EntityField } from '../constants/Feeds.constants';
import { Column as ContainerColumn } from '../generated/entity/data/container';
import { Column as TableColumn } from '../generated/entity/data/table';
import {
  ChangeDescription,
  FieldChange,
} from '../generated/entity/services/databaseService';
import { TagLabel } from '../generated/type/tagLabel';
import { getEntityName } from './EntityUtils';
import { TagLabelWithStatus } from './EntityVersionUtils.interface';
import { isValidJSONString } from './StringsUtils';
import { getTagsWithoutTier } from './TableUtils';

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
  return name?.split(FQN_SEPARATOR_CHAR)?.slice(-2, -1)[0];
};

export const getChangeSchemaFieldsName = (name: string) => {
  const formattedName = name.replaceAll(/"/g, '');

  return getChangeColumnNameFromDiffValue(formattedName);
};

export const isEndsWithField = (checkWith: string, name?: string) => {
  return name?.endsWith(checkWith);
};

export const getDiffByFieldName = (
  name: string,
  changeDescription: ChangeDescription,
  exactMatch?: boolean
): EntityDiffProps => {
  const fieldsAdded = changeDescription?.fieldsAdded || [];
  const fieldsDeleted = changeDescription?.fieldsDeleted || [];
  const fieldsUpdated = changeDescription?.fieldsUpdated || [];
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
    return (
      <span
        className={classNames(
          { 'diff-added': part.added },
          { 'diff-removed': part.removed }
        )}
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
    return latestText || '';
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
  field: EntityField,
  fallbackText?: string
) => {
  const fieldDiff = getDiffByFieldName(field, changeDescription, true);
  const oldField = getChangedEntityOldValue(fieldDiff);
  const newField = getChangedEntityNewValue(fieldDiff);

  return getTextDiff(oldField ?? '', newField, fallbackText);
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
  currentVersionData: VersionData | Glossary | GlossaryTerm,
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

const getSummaryText = (
  isPrefix: boolean,
  fieldsChanged: FieldChange[],
  actionType: string,
  actionText: string
) => {
  const prefix = isPrefix ? `+ ${actionType}` : '';

  return `${prefix} ${fieldsChanged.map(summaryFormatter).join(', ')} ${
    !isPrefix
      ? t('label.has-been-action-type-lowercase', {
          actionType: actionText,
        })
      : ''
  } `;
};

export const getSummary = (
  changeDescription: ChangeDescription,
  isPrefix = false
) => {
  const fieldsAdded = [...(changeDescription?.fieldsAdded || [])];
  const fieldsDeleted = [...(changeDescription?.fieldsDeleted || [])];
  const fieldsUpdated = [
    ...(changeDescription?.fieldsUpdated?.filter(
      (field) => field.name !== 'deleted'
    ) || []),
  ];
  const isDeleteUpdated = [
    ...(changeDescription?.fieldsUpdated?.filter(
      (field) => field.name === 'deleted'
    ) || []),
  ];

  return (
    <Fragment>
      {isDeleteUpdated?.length > 0 ? (
        <p className="tw-mb-2">
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
        </p>
      ) : null}
      {fieldsAdded?.length > 0 ? (
        <p className="tw-mb-2">
          {getSummaryText(
            isPrefix,
            fieldsAdded,
            t('label.added'),
            t('label.added-lowercase')
          )}
        </p>
      ) : null}
      {fieldsUpdated?.length ? (
        <p className="tw-mb-2">
          {getSummaryText(
            isPrefix,
            fieldsUpdated,
            t('label.edited'),
            t('label.updated-lowercase')
          )}
        </p>
      ) : null}
      {fieldsDeleted?.length ? (
        <p className="tw-mb-2">
          {getSummaryText(
            isPrefix,
            fieldsDeleted,
            t('label.removed'),
            t('label.deleted-lowercase')
          )}
        </p>
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

export function getEntityDescriptionDiff<
  A extends TableColumn | ContainerColumn | Field
>(
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

function getNewSchemaFromSchemaDiff(newField: Array<Field>) {
  return newField.map((field) => ({
    ...field,
    tags: field.tags?.map((tag) => ({ ...tag, removed: true })),
    description: getTextDiff(field.description ?? '', ''),
    dataTypeDisplay: getTextDiff(field.dataTypeDisplay ?? '', ''),
    name: getTextDiff(field.name, ''),
  }));
}

export function getSchemasDiff(
  schemaFieldsDiff: EntityDiffProps,
  schemaFields: Array<Field> = [],
  clonedMessageSchema?: MessageSchemaObject
) {
  let newFields: Array<Field>;
  if (schemaFieldsDiff.added) {
    const newField: Array<Field> = JSON.parse(
      schemaFieldsDiff.added?.newValue ?? '[]'
    );
    newField.forEach((field) => {
      const formatSchemaFieldsData = (arr: Array<Field>) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, field.name)) {
            i.tags = field.tags?.map((tag) => ({ ...tag, added: true }));
            i.description = getTextDiff('', field.description ?? '');
            i.dataTypeDisplay = getTextDiff('', field.dataTypeDisplay ?? '');
            i.name = getTextDiff('', field.name);
          } else {
            formatSchemaFieldsData(i?.children as Array<Field>);
          }
        });
      };
      formatSchemaFieldsData(schemaFields ?? []);
    });
  }
  if (schemaFieldsDiff.deleted) {
    const newField: Array<Field> = JSON.parse(
      schemaFieldsDiff.deleted?.oldValue ?? '[]'
    );
    newFields = getNewSchemaFromSchemaDiff(newField);
  } else {
    return { ...clonedMessageSchema, schemaFields };
  }

  return {
    ...clonedMessageSchema,
    schemaFields: [...newFields, ...(schemaFields ?? [])],
  };
}

export const getUpdatedMessageSchema = (
  currentVersionData: VersionData,
  changeDescription: ChangeDescription
): Topic['messageSchema'] => {
  const clonedMessageSchema = cloneDeep(
    (currentVersionData as Topic).messageSchema
  );
  const schemaFields = clonedMessageSchema?.schemaFields;
  const schemaFieldsDiff = getDiffByFieldName(
    EntityField.SCHEMA_FIELDS,
    changeDescription
  );
  const changedSchemaFieldName = getChangeSchemaFieldsName(
    getChangedEntityName(schemaFieldsDiff) ?? ''
  );

  if (
    isEndsWithField(
      EntityField.DESCRIPTION,
      getChangedEntityName(schemaFieldsDiff)
    )
  ) {
    const formattedSchema = getEntityDescriptionDiff(
      schemaFieldsDiff,
      changedSchemaFieldName,
      schemaFields
    );

    return { ...clonedMessageSchema, schemaFields: formattedSchema };
  } else if (
    isEndsWithField(EntityField.TAGS, getChangedEntityName(schemaFieldsDiff))
  ) {
    const formattedSchema = getEntityTagDiff(
      schemaFieldsDiff,
      changedSchemaFieldName,
      schemaFields
    );

    return { ...clonedMessageSchema, schemaFields: formattedSchema };
  } else {
    const schemaFieldsDiff = getDiffByFieldName(
      EntityField.SCHEMA_FIELDS,
      changeDescription,
      true
    );

    return getSchemasDiff(schemaFieldsDiff, schemaFields, clonedMessageSchema);
  }
};

export const getOwnerInfo = (owner: EntityReference, ownerLabel: ReactNode) => {
  const isTeamType = owner.type === 'team';

  return (
    <Space className="m-r-xss" size={4}>
      {isTeamType ? (
        <IconTeamsGrey height={18} width={18} />
      ) : (
        <ProfilePicture
          displayName={getEntityName(owner)}
          id={owner.id ?? ''}
          name={owner.name ?? ''}
          textClass="text-xs"
          type="circle"
          width="20"
        />
      )}
      <Link
        to={
          isTeamType
            ? getTeamAndUserDetailsPath(owner.name ?? '')
            : getUserPath(owner.name ?? '')
        }>
        {ownerLabel}
      </Link>
    </Space>
  );
};

export const getCommonExtraInfoForVersionDetails = (
  changeDescription: ChangeDescription,
  owner?: EntityReference,
  tier?: TagLabel
) => {
  const ownerDiff = getDiffByFieldName('owner', changeDescription);

  const oldOwner = JSON.parse(getChangedEntityOldValue(ownerDiff) ?? '{}');
  const newOwner = JSON.parse(getChangedEntityNewValue(ownerDiff) ?? '{}');
  const ownerPlaceHolder = getEntityName(owner);

  const tagsDiff = getDiffByFieldName('tags', changeDescription, true);
  const newTier = [
    ...JSON.parse(getChangedEntityNewValue(tagsDiff) ?? '[]'),
  ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

  const oldTier = [
    ...JSON.parse(getChangedEntityOldValue(tagsDiff) ?? '[]'),
  ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

  let ownerValue: ReactNode = getEntityName(owner);
  let ownerRef = owner;
  let tierValue: ReactNode = '';

  if (
    !isUndefined(ownerDiff.added) ||
    !isUndefined(ownerDiff.deleted) ||
    !isUndefined(ownerDiff.updated)
  ) {
    ownerRef = isEmpty(newOwner) ? oldOwner : newOwner;
    ownerValue = getDiffValue(getEntityName(oldOwner), getEntityName(newOwner));
  } else if (owner) {
    getDiffValue(ownerPlaceHolder, ownerPlaceHolder);
  }

  if (!isUndefined(newTier) || !isUndefined(oldTier)) {
    tierValue = getDiffValue(
      oldTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] || '',
      newTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] || ''
    );
  } else if (tier?.tagFQN) {
    tierValue = tier?.tagFQN.split(FQN_SEPARATOR_CHAR)[1];
  }

  const extraInfo = {
    ownerDisplayName: ownerValue,
    tierDisplayName: tierValue,
    ownerRef,
  };

  return extraInfo;
};

function getNewColumnFromColDiff<A extends TableColumn | ContainerColumn>(
  newCol: Array<A>
) {
  return newCol.map((col) => ({
    ...col,
    tags: col.tags?.map((tag) => ({ ...tag, removed: true })),
    description: getTextDiff(col.description ?? '', ''),
    dataTypeDisplay: getTextDiff(col.dataTypeDisplay ?? '', ''),
    name: getTextDiff(col.name, ''),
  }));
}

export function getColumnsDiff<A extends TableColumn | ContainerColumn>(
  columnsDiff: EntityDiffProps,
  colList: A[] = []
) {
  let newColumns: Array<A> = [];
  if (columnsDiff.added) {
    const newCol: Array<A> = JSON.parse(columnsDiff.added?.newValue ?? '[]');
    newCol.forEach((col) => {
      const formatColumnData = (arr: Array<A>) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, col.name)) {
            i.tags = col.tags?.map((tag) => ({ ...tag, added: true }));
            i.description = getTextDiff('', col.description ?? '');
            i.dataTypeDisplay = getTextDiff('', col.dataTypeDisplay ?? '');
            i.name = getTextDiff('', col.name);
          } else {
            formatColumnData(i?.children as Array<A>);
          }
        });
      };
      formatColumnData(colList);
    });
  }
  if (columnsDiff.deleted) {
    const newCol: Array<A> = JSON.parse(columnsDiff.deleted?.oldValue ?? '[]');
    newColumns = getNewColumnFromColDiff(newCol);
  } else {
    return colList;
  }

  return [...newColumns, ...colList];
}

export function getColumnsDataWithVersionChanges<
  A extends TableColumn | ContainerColumn
>(changeDescription: ChangeDescription, colList?: A[]): Array<A> {
  const columnsDiff = getDiffByFieldName(
    EntityField.COLUMNS,
    changeDescription
  );
  const changedColName = getChangeColumnNameFromDiffValue(
    getChangedEntityName(columnsDiff)
  );

  if (
    isEndsWithField(EntityField.DESCRIPTION, getChangedEntityName(columnsDiff))
  ) {
    return getEntityDescriptionDiff(columnsDiff, changedColName, colList);
  } else if (
    isEndsWithField(EntityField.TAGS, getChangedEntityName(columnsDiff))
  ) {
    return getEntityTagDiff(columnsDiff, changedColName, colList);
  } else {
    const columnsDiff = getDiffByFieldName(
      EntityField.COLUMNS,
      changeDescription,
      true
    );

    return getColumnsDiff(columnsDiff, colList);
  }
}

export const getUpdatedExtensionDiffFields = (
  entityDetails: EntityDetails,
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
