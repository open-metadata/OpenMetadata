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
import {
  PLACEHOLDER_CONTAINER_NAME,
  PLACEHOLDER_ROUTE_TAB,
  ROUTES,
} from 'constants/constants';
import { Column, ContainerDataModel } from 'generated/entity/data/container';
import { LabelType, State, TagLabel } from 'generated/type/tagLabel';
import { isEmpty } from 'lodash';
import { EntityTags, TagOption } from 'Models';

export const getContainerDetailPath = (containerFQN: string, tab?: string) => {
  let path = tab ? ROUTES.CONTAINER_DETAILS_WITH_TAB : ROUTES.CONTAINER_DETAILS;
  path = path.replace(PLACEHOLDER_CONTAINER_NAME, containerFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

const getUpdatedContainerColumnTags = (
  containerColumn: Column,
  newContainerColumnTags: TagOption[] = []
) => {
  const newTagsFqnList = newContainerColumnTags.map((newTag) => newTag.fqn);

  const prevTags = containerColumn?.tags?.filter((tag) =>
    newTagsFqnList.includes(tag.tagFQN)
  );

  const prevTagsFqnList = prevTags?.map((prevTag) => prevTag.tagFQN);

  const newTags: EntityTags[] = newContainerColumnTags.reduce((prev, curr) => {
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

export const updateContainerColumnTags = (
  containerColumns: ContainerDataModel['columns'] = [],
  changedColumnName: string,
  newColumnTags: TagOption[] = []
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.name === changedColumnName) {
      containerColumn.tags = getUpdatedContainerColumnTags(
        containerColumn,
        newColumnTags
      );
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      // stop condition
      if (hasChildren) {
        updateContainerColumnTags(
          containerColumn.children,
          changedColumnName,
          newColumnTags
        );
      }
    }
  });
};

export const updateContainerColumnDescription = (
  containerColumns: ContainerDataModel['columns'] = [],
  changedColumnName: string,
  description: string
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.name === changedColumnName) {
      containerColumn.description = description;
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      // stop condition
      if (hasChildren) {
        updateContainerColumnDescription(
          containerColumn.children,
          changedColumnName,
          description
        );
      }
    }
  });
};
