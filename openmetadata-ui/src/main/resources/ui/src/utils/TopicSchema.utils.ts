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

import { isEmpty } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import { Field } from '../generated/entity/data/topic';
import { LabelType, State, TagLabel } from '../generated/type/tagLabel';

export const updateFieldDescription = (
  schemaFields: Field[] = [],
  changedFieldName: string,
  description: string
) => {
  schemaFields.forEach((field) => {
    if (field.name === changedFieldName) {
      field.description = description;
    } else {
      const hasChildren = !isEmpty(field.children);

      // stop condition
      if (hasChildren) {
        updateFieldDescription(field.children, changedFieldName, description);
      }
    }
  });
};

const getUpdatedFieldTags = (field: Field, newFieldTags: TagOption[] = []) => {
  const newTagsFqnList = newFieldTags.map((newTag) => newTag.fqn);

  const prevTags = field?.tags?.filter((tag) =>
    newTagsFqnList.includes(tag.tagFQN)
  );

  const prevTagsFqnList = prevTags?.map((prevTag) => prevTag.tagFQN);

  const newTags: EntityTags[] = newFieldTags.reduce((prev, curr) => {
    const isExistingTag = prevTagsFqnList?.includes(curr.fqn);

    return isExistingTag
      ? prev
      : [
          ...prev,
          {
            labelType: LabelType.Manual,
            state: State.Confirmed,
            source: curr.source,
            tagFQN: curr.fqn,
          },
        ];
  }, [] as EntityTags[]);

  return [...(prevTags as TagLabel[]), ...newTags];
};

export const updateFieldTags = (
  schemaFields: Field[] = [],
  changedFieldName: string,
  newFieldTags: TagOption[] = []
) => {
  schemaFields.forEach((field) => {
    if (field.name === changedFieldName) {
      field.tags = getUpdatedFieldTags(field, newFieldTags);
    } else {
      const hasChildren = !isEmpty(field.children);

      // stop condition
      if (hasChildren) {
        updateFieldTags(field.children, changedFieldName, newFieldTags);
      }
    }
  });
};
