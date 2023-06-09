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

import classNames from 'classnames';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import {
  ArrayChange,
  Change,
  diffArrays,
  diffWords,
  diffWordsWithSpace,
} from 'diff';
import { Field, Topic } from 'generated/entity/data/topic';
import { t } from 'i18next';
import { ColumnDiffProps } from 'interface/EntityVersion.interface';
import { cloneDeep, isEqual, isUndefined, toString, uniqueId } from 'lodash';
import { VersionData } from 'pages/EntityVersionPage/EntityVersionPage.component';
import React, { Fragment } from 'react';
import ReactDOMServer from 'react-dom/server';
import { EntityField } from '../constants/Feeds.constants';
import { Column } from '../generated/entity/data/table';
import {
  ChangeDescription,
  FieldChange,
} from '../generated/entity/services/databaseService';
import { TagLabel } from '../generated/type/tagLabel';
import { TagLabelWithStatus } from './EntityVersionUtils.interface';
import { isValidJSONString } from './StringsUtils';

export const getChangeColName = (name?: string) => {
  return name?.split(FQN_SEPARATOR_CHAR)?.slice(-2, -1)[0];
};

export const getChangeSchemaFieldsName = (name: string) => {
  const formattedName = name.replaceAll(/"/g, '');

  return getChangeColName(formattedName);
};

export const isEndsWithField = (checkWith: string, name?: string) => {
  return name?.endsWith(checkWith);
};

export const getDiffByFieldName = (
  name: string,
  changeDescription: ChangeDescription,
  exactMatch?: boolean
): {
  added: FieldChange | undefined;
  deleted: FieldChange | undefined;
  updated: FieldChange | undefined;
} => {
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

  return diff.map((part: Change, index: number) => {
    return (
      <span
        className={classNames(
          { 'diff-added': part.added },
          { 'diff-removed': part.removed }
        )}
        key={index}>
        {part.value}
      </span>
    );
  });
};

export const getDescriptionDiff = (
  oldDescription: string | undefined,
  newDescription: string | undefined,
  latestDescription: string | undefined
) => {
  if (isUndefined(newDescription) || isUndefined(oldDescription)) {
    return latestDescription || '';
  }

  const diffArr = diffWords(toString(oldDescription), toString(newDescription));

  const result = diffArr.map((diff) => {
    if (diff.added) {
      return ReactDOMServer.renderToString(
        <ins className="diff-added" data-testid="diff-added" key={uniqueId()}>
          {diff.value}
        </ins>
      );
    }
    if (diff.removed) {
      return ReactDOMServer.renderToString(
        <del
          data-testid="diff-removed"
          key={uniqueId()}
          style={{ color: 'grey', textDecoration: 'line-through' }}>
          {diff.value}
        </del>
      );
    }

    return ReactDOMServer.renderToString(
      <span data-testid="diff-normal" key={uniqueId()}>
        {diff.value}
      </span>
    );
  });

  return result.join('');
};

export const getTagsDiff = (
  oldTagList: Array<TagLabel>,
  newTagList: Array<TagLabel>
) => {
  const tagDiff = diffArrays<TagLabel, TagLabel>(oldTagList, newTagList);
  const result = tagDiff
    .map((part: ArrayChange<TagLabel>) =>
      (part.value as Array<TagLabel>).map((tag) => ({
        ...tag,
        added: part.added,
        removed: part.removed,
      }))
    )
    ?.flat(Infinity) as Array<TagLabelWithStatus>;

  return result;
};

export const summaryFormatter = (fieldChange: FieldChange) => {
  const value = JSON.parse(
    isValidJSONString(fieldChange?.newValue)
      ? fieldChange?.newValue
      : isValidJSONString(fieldChange?.oldValue)
      ? fieldChange?.oldValue
      : '{}'
  );
  if (fieldChange.name === EntityField.COLUMNS) {
    return `columns ${value?.map((val: Column) => val?.name).join(', ')}`;
  } else if (
    fieldChange.name === 'tags' ||
    fieldChange.name?.endsWith('tags')
  ) {
    return `tags ${value?.map((val: TagLabel) => val?.tagFQN)?.join(', ')}`;
  } else if (fieldChange.name === 'owner') {
    return `${fieldChange.name} ${value.name}`;
  } else {
    return fieldChange.name;
  }
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
          {`${isPrefix ? `+ ${t('label.added')}` : ''} ${fieldsAdded
            .map(summaryFormatter)
            .join(', ')} ${
            !isPrefix
              ? t('label.has-been-action-type-lowercase', {
                  actionType: t('label.added-lowercase'),
                })
              : ''
          }`}{' '}
        </p>
      ) : null}
      {fieldsUpdated?.length ? (
        <p className="tw-mb-2">
          {`${isPrefix ? t('label.edited') : ''} ${fieldsUpdated
            .map(summaryFormatter)
            .join(', ')} ${
            !isPrefix
              ? t('label.has-been-action-type-lowercase', {
                  actionType: t('label.updated-lowercase'),
                })
              : ''
          }`}{' '}
        </p>
      ) : null}
      {fieldsDeleted?.length ? (
        <p className="tw-mb-2">
          {`${isPrefix ? `- ${t('label.removed')}` : ''} ${fieldsDeleted
            .map(summaryFormatter)
            .join(', ')} ${
            !isPrefix
              ? t('label.has-been-action-type-lowercase', {
                  actionType: t('label.deleted-lowercase'),
                })
              : ''
          }`}{' '}
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

export const getColumnDiffValue = (column: ColumnDiffProps) =>
  column?.added?.name ?? column?.deleted?.name ?? column?.updated?.name;

export const getColumnDiffOldValue = (column: ColumnDiffProps) =>
  column?.added?.oldValue ??
  column?.deleted?.oldValue ??
  column?.updated?.oldValue;

export const getColumnDiffNewValue = (column: ColumnDiffProps) =>
  column?.added?.newValue ??
  column?.deleted?.newValue ??
  column?.updated?.newValue;

// remove tags from a list if same present in b list
export const removeDuplicateTags = (a: TagLabel[], b: TagLabel[]): TagLabel[] =>
  a.filter(
    (item) => !b.map((secondItem) => secondItem.tagFQN).includes(item.tagFQN)
  );

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
    schemaFieldsDiff?.added?.name ??
      schemaFieldsDiff?.deleted?.name ??
      schemaFieldsDiff?.updated?.name ??
      ''
  );

  if (
    isEndsWithField(
      EntityField.DESCRIPTION,
      schemaFieldsDiff?.added?.name ??
        schemaFieldsDiff?.deleted?.name ??
        schemaFieldsDiff?.updated?.name
    )
  ) {
    const oldDescription =
      schemaFieldsDiff?.added?.oldValue ??
      schemaFieldsDiff?.deleted?.oldValue ??
      schemaFieldsDiff?.updated?.oldValue;
    const newDescription =
      schemaFieldsDiff?.added?.newValue ??
      schemaFieldsDiff?.deleted?.newValue ??
      schemaFieldsDiff?.updated?.newValue;

    const formatSchemaFieldsData = (messageSchemaFields: Array<Field>) => {
      messageSchemaFields?.forEach((i) => {
        if (isEqual(i.name, changedSchemaFieldName)) {
          i.description = getDescriptionDiff(
            oldDescription ?? '',
            newDescription,
            i.description
          );
        } else {
          formatSchemaFieldsData(i?.children as Array<Field>);
        }
      });
    };

    formatSchemaFieldsData(schemaFields ?? []);

    return { ...clonedMessageSchema, schemaFields };
  } else if (
    isEndsWithField(
      EntityField.TAGS,
      schemaFieldsDiff?.added?.name ??
        schemaFieldsDiff?.deleted?.name ??
        schemaFieldsDiff?.updated?.name
    )
  ) {
    const oldTags: Array<TagLabel> = JSON.parse(
      schemaFieldsDiff?.added?.oldValue ??
        schemaFieldsDiff?.deleted?.oldValue ??
        schemaFieldsDiff?.updated?.oldValue ??
        '[]'
    );
    const newTags: Array<TagLabel> = JSON.parse(
      schemaFieldsDiff?.added?.newValue ??
        schemaFieldsDiff?.deleted?.newValue ??
        schemaFieldsDiff?.updated?.newValue ??
        '[]'
    );

    const formatSchemaFieldsData = (messageSchemaFields: Array<Field>) => {
      messageSchemaFields?.forEach((i) => {
        if (isEqual(i.name, changedSchemaFieldName)) {
          const flag: { [x: string]: boolean } = {};
          const uniqueTags: Array<TagLabelWithStatus> = [];
          const tagsDiff = getTagsDiff(oldTags, newTags);
          [...tagsDiff, ...(i.tags as Array<TagLabelWithStatus>)].forEach(
            (elem: TagLabelWithStatus) => {
              if (!flag[elem.tagFQN as string]) {
                flag[elem.tagFQN as string] = true;
                uniqueTags.push(elem);
              }
            }
          );
          i.tags = uniqueTags;
        } else {
          formatSchemaFieldsData(i?.children as Array<Field>);
        }
      });
    };

    formatSchemaFieldsData(schemaFields ?? []);

    return { ...clonedMessageSchema, schemaFields };
  } else {
    const schemaFieldsDiff = getDiffByFieldName(
      EntityField.COLUMNS,
      changeDescription,
      true
    );
    let newColumns: Array<Field> = [] as Array<Field>;
    if (schemaFieldsDiff.added) {
      const newCol: Array<Field> = JSON.parse(
        schemaFieldsDiff.added?.newValue ?? '[]'
      );
      newCol.forEach((col) => {
        const formatSchemaFieldsData = (arr: Array<Field>) => {
          arr?.forEach((i) => {
            if (isEqual(i.name, col.name)) {
              i.tags = col.tags?.map((tag) => ({ ...tag, added: true }));
              i.description = getDescriptionDiff(
                undefined,
                col.description,
                col.description
              );
              i.dataTypeDisplay = getDescriptionDiff(
                undefined,
                col.dataTypeDisplay,
                col.dataTypeDisplay
              );
              i.name = getDescriptionDiff(undefined, col.name, col.name);
            } else {
              formatSchemaFieldsData(i?.children as Array<Field>);
            }
          });
        };
        formatSchemaFieldsData(schemaFields ?? []);
      });
    }
    if (schemaFieldsDiff.deleted) {
      const newCol: Array<Field> = JSON.parse(
        schemaFieldsDiff.deleted?.oldValue ?? '[]'
      );
      newColumns = newCol.map((col) => ({
        ...col,
        tags: col.tags?.map((tag) => ({ ...tag, removed: true })),
        description: getDescriptionDiff(
          col.description,
          undefined,
          col.description
        ),
        dataTypeDisplay: getDescriptionDiff(
          col.dataTypeDisplay,
          undefined,
          col.dataTypeDisplay
        ),
        name: getDescriptionDiff(col.name, undefined, col.name),
      }));
    } else {
      return { ...clonedMessageSchema, schemaFields };
    }

    return {
      ...clonedMessageSchema,
      schemaFields: [...newColumns, ...(schemaFields ?? [])],
    };
  }
};
