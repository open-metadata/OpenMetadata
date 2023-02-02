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
import {
  ArrayChange,
  Change,
  diffArrays,
  diffWords,
  diffWordsWithSpace,
} from 'diff';
import { t } from 'i18next';
import { isUndefined, toString, uniqueId } from 'lodash';
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
      added: fieldsAdded.find((ch) => ch.name?.startsWith(name)),
      deleted: fieldsDeleted.find((ch) => ch.name?.startsWith(name)),
      updated: fieldsUpdated.find((ch) => ch.name?.startsWith(name)),
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
          {`${isPrefix ? '- Removed' : ''} ${fieldsDeleted
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
