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

/**
 * Entity diff utilities that depend on React / DOM rendering.
 *
 * Pure entity diff accessors live in EntityDiffPureUtils.ts.
 */

import type { Change } from 'diff';
import { diffWords, diffWordsWithSpace } from 'diff';
import { isEmpty, isObject, toString, uniqueId } from 'lodash';
import type { ReactNode } from 'react';
import ReactDOMServer from 'react-dom/server';
import type {
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from '../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import { EntityChangeOperations } from '../enums/VersionPage.enum';
import type { EntityDiffProps } from '../interface/EntityVersion.interface';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
} from './EntityDiffPureUtils';
import { t } from './i18next/LocalUtil';
import { getJSONFromString } from './StringUtils';

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

export const getTextDiffElements = (
  oldText: string,
  newText: string
): ReactNode[] => {
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
