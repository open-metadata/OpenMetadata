/*
 *  Copyright 2023 Collate.
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

import { cloneDeep, isEqual, uniqBy } from 'lodash';
import { EntityField } from '../constants/Feeds.constants';
import {
  ChangeDescription,
  SearchIndex,
} from '../generated/entity/data/searchIndex';
import { TagLabel } from '../generated/type/tagLabel';
import { EntityDiffProps } from '../interface/EntityVersion.interface';
import { VersionData } from '../pages/EntityVersionPage/EntityVersionPage.component';
import {
  getAllChangedEntityNames,
  getAllDiffByFieldName,
  getChangeColumnNameFromDiffValue,
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
  getTagsDiff,
  getTextDiff,
  isEndsWithField,
} from './EntityVersionUtils';
import { TagLabelWithStatus } from './EntityVersionUtils.interface';

const handleFieldDescriptionChangeDiff = (
  fieldsDiff: EntityDiffProps,
  fieldList: SearchIndex['fields'] = [],
  changedFieldName?: string
) => {
  const oldDescription = getChangedEntityOldValue(fieldsDiff);
  const newDescription = getChangedEntityNewValue(fieldsDiff);

  fieldList?.forEach((i) => {
    if (isEqual(i.name, changedFieldName)) {
      i.description = getTextDiff(
        oldDescription,
        newDescription,
        i.description
      );
    }
  });

  return fieldList;
};

const handleFieldTagChangeDiff = (
  fieldsDiff: EntityDiffProps,
  fieldList: SearchIndex['fields'] = [],
  changedFieldName?: string
) => {
  const oldTags: Array<TagLabel> = JSON.parse(
    getChangedEntityOldValue(fieldsDiff) ?? '[]'
  );
  const newTags: Array<TagLabel> = JSON.parse(
    getChangedEntityNewValue(fieldsDiff) ?? '[]'
  );

  fieldList?.forEach((i) => {
    if (isEqual(i.name, changedFieldName)) {
      const flag: { [x: string]: boolean } = {};
      const uniqueTags: Array<TagLabelWithStatus> = [];
      const tagsDiff = getTagsDiff(oldTags, newTags);
      [...tagsDiff, ...(i.tags as Array<TagLabelWithStatus>)].forEach(
        (elem: TagLabelWithStatus) => {
          if (!flag[elem.tagFQN]) {
            flag[elem.tagFQN] = true;
            uniqueTags.push(elem);
          }
        }
      );
      i.tags = uniqueTags;
    }
  });

  return fieldList;
};

const handleFieldDiffAdded = (
  fieldsDiff: EntityDiffProps,
  fieldList: SearchIndex['fields'] = []
) => {
  const newField: SearchIndex['fields'] = JSON.parse(
    fieldsDiff.added?.newValue ?? '[]'
  );
  newField?.forEach((field) => {
    const formatFieldData = (arr: SearchIndex['fields']) => {
      arr?.forEach((i) => {
        if (isEqual(i.name, field.name)) {
          i.tags = field.tags?.map((tag) => ({ ...tag, added: true }));
          i.description = getTextDiff('', field.description ?? '');
          i.dataTypeDisplay = getTextDiff('', field.dataTypeDisplay ?? '');
          i.name = getTextDiff('', field.name);
          i.displayName = getTextDiff('', field.displayName ?? '');
        }
      });
    };
    formatFieldData(fieldList);
  });

  return fieldList;
};

const getDeletedFields = (fieldsDiff: EntityDiffProps) => {
  const newField: SearchIndex['fields'] = JSON.parse(
    fieldsDiff.deleted?.oldValue ?? '[]'
  );

  return newField?.map((field) => ({
    ...field,
    tags: field.tags?.map((tag) => ({ ...tag, removed: true })),
    description: getTextDiff(field.description ?? '', ''),
    dataTypeDisplay: getTextDiff(field.dataTypeDisplay ?? '', ''),
    name: getTextDiff(field.name, ''),
    displayName: getTextDiff(field.displayName ?? '', ''),
  }));
};

export const getUpdatedSearchIndexFields = (
  currentVersionData: VersionData,
  changeDescription: ChangeDescription
) => {
  const fieldsList = cloneDeep(
    (currentVersionData as SearchIndex).fields ?? []
  );
  const fieldsDiff = getAllDiffByFieldName(
    EntityField.FIELDS,
    changeDescription
  );
  const changedFields = getAllChangedEntityNames(fieldsDiff);

  let newFieldsList = cloneDeep(fieldsList);

  changedFields?.forEach((changedField) => {
    const fieldDiff = getDiffByFieldName(changedField, changeDescription);
    const changedFieldName = getChangeColumnNameFromDiffValue(changedField);

    if (isEndsWithField(EntityField.DESCRIPTION, changedField)) {
      newFieldsList = handleFieldDescriptionChangeDiff(
        fieldDiff,
        fieldsList,
        changedFieldName
      );
    } else if (isEndsWithField(EntityField.TAGS, changedField)) {
      newFieldsList = handleFieldTagChangeDiff(
        fieldDiff,
        fieldsList,
        changedFieldName
      );
    } else {
      const fieldsDiff = getDiffByFieldName(
        EntityField.TASKS,
        changeDescription,
        true
      );
      if (fieldsDiff.added) {
        newFieldsList = handleFieldDiffAdded(fieldsDiff, fieldsList);
      }
      if (fieldsDiff.deleted) {
        const deletedFields = getDeletedFields(fieldsDiff);
        newFieldsList.unshift(...(deletedFields ?? []));
      }
    }
  });

  return uniqBy(newFieldsList, 'name');
};
