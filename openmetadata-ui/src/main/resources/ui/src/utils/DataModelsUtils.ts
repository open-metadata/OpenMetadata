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
  PLACEHOLDER_ROUTE_DATA_MODEL_FQN,
  PLACEHOLDER_ROUTE_TAB,
  ROUTES,
} from 'constants/constants';
import { Column } from 'generated/entity/data/dashboardDataModel';
import { LabelType, State, TagLabel } from 'generated/type/tagLabel';
import { isEmpty } from 'lodash';
import { EntityTags, TagOption } from 'Models';

export const getDataModelsDetailPath = (dataModelFQN: string, tab?: string) => {
  let path = tab
    ? ROUTES.DATA_MODEL_DETAILS_WITH_TAB
    : ROUTES.DATA_MODEL_DETAILS;
  path = path.replace(PLACEHOLDER_ROUTE_DATA_MODEL_FQN, dataModelFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

export const updateDataModelColumnDescription = (
  containerColumns: Column[] = [],
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
        updateDataModelColumnDescription(
          containerColumn.children,
          changedColumnName,
          description
        );
      }
    }
  });
};

const getUpdatedDataModelColumnTags = (
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

export const updateDataModelColumnTags = (
  containerColumns: Column[] = [],
  changedColumnName: string,
  newColumnTags: TagOption[] = []
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.name === changedColumnName) {
      containerColumn.tags = getUpdatedDataModelColumnTags(
        containerColumn,
        newColumnTags
      );
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      // stop condition
      if (hasChildren) {
        updateDataModelColumnTags(
          containerColumn.children,
          changedColumnName,
          newColumnTags
        );
      }
    }
  });
};
