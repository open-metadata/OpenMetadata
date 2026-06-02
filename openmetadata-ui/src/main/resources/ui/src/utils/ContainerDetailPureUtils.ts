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

import { isEmpty, omit } from 'lodash';
import { EntityTags } from 'Models';
import { TabSpecificField } from '../enums/entity.enum';
import {
  Column,
  Container,
  ContainerDataModel as ContainerDataModelType,
} from '../generated/entity/data/container';
import { EntityReference } from '../generated/type/entityReference';
import { LabelType, State, TagLabel } from '../generated/type/tagLabel';

// eslint-disable-next-line max-len
export const ContainerFields = `${TabSpecificField.TAGS}, ${TabSpecificField.OWNERS},${TabSpecificField.FOLLOWERS},${TabSpecificField.DATAMODEL}, ${TabSpecificField.DOMAINS},${TabSpecificField.DATA_PRODUCTS}`;

const getUpdatedContainerColumnTags = (
  containerColumn: Column,
  newContainerColumnTags: EntityTags[] = []
) => {
  const newTagsFqnList = newContainerColumnTags.map((newTag) => newTag.tagFQN);

  const prevTags = containerColumn?.tags?.filter((tag) =>
    newTagsFqnList.includes(tag.tagFQN)
  );

  const prevTagsFqnList = prevTags?.map((prevTag) => prevTag.tagFQN);

  const newTags: EntityTags[] = newContainerColumnTags.reduce((prev, curr) => {
    const isExistingTag = prevTagsFqnList?.includes(curr.tagFQN);

    return isExistingTag
      ? prev
      : [
          ...prev,
          {
            ...omit(curr, 'isRemovable'),
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ];
  }, [] as EntityTags[]);

  return [...(prevTags as TagLabel[]), ...newTags];
};

export const updateContainerColumnTags = (
  containerColumns: ContainerDataModelType['columns'] = [],
  changedColumnFQN: string,
  newColumnTags: EntityTags[] = []
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.fullyQualifiedName === changedColumnFQN) {
      containerColumn.tags = getUpdatedContainerColumnTags(
        containerColumn,
        newColumnTags
      );
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      if (hasChildren) {
        updateContainerColumnTags(
          containerColumn.children,
          changedColumnFQN,
          newColumnTags
        );
      }
    }
  });
};

export const updateContainerColumnDescription = (
  containerColumns: ContainerDataModelType['columns'] = [],
  changedColumnFQN: string,
  description: string
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.fullyQualifiedName === changedColumnFQN) {
      containerColumn.description = description;
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      if (hasChildren) {
        updateContainerColumnDescription(
          containerColumn.children,
          changedColumnFQN,
          description
        );
      }
    }
  });
};

export const extractContainerColumns = <
  T extends Omit<EntityReference, 'type'>
>(
  data: T
): Column[] => {
  const container = data as Partial<Container>;

  return (container.dataModel?.columns ?? []).map(
    (column) =>
      ({
        ...column,
        tags: column.tags ?? [],
      } as Column)
  );
};
