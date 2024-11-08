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
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, TabSpecificField } from '../enums/entity.enum';
import { Column, ContainerDataModel } from '../generated/entity/data/container';
import { LabelType, State, TagLabel } from '../generated/type/tagLabel';

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
  containerColumns: ContainerDataModel['columns'] = [],
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

      // stop condition
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
  containerColumns: ContainerDataModel['columns'] = [],
  changedColumnFQN: string,
  description: string
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.fullyQualifiedName === changedColumnFQN) {
      containerColumn.description = description;
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      // stop condition
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

export const getContainerDetailsPageDefaultLayout = (tab: EntityTabs) => {
  switch (tab) {
    case EntityTabs.SCHEMA:
      return [
        {
          h: 2,
          i: DetailPageWidgetKeys.DESCRIPTION,
          w: 6,
          x: 0,
          y: 0,
          static: false,
        },
        {
          h: 8,
          i: DetailPageWidgetKeys.TABLE_SCHEMA,
          w: 6,
          x: 0,
          y: 0,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
          w: 2,
          x: 6,
          y: 0,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.DATA_PRODUCTS,
          w: 2,
          x: 6,
          y: 1,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.TAGS,
          w: 2,
          x: 6,
          y: 2,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.GLOSSARY_TERMS,
          w: 2,
          x: 6,
          y: 3,
          static: false,
        },
        {
          h: 3,
          i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
          w: 2,
          x: 6,
          y: 4,
          static: false,
        },
      ];

    default:
      return [];
  }
};

// eslint-disable-next-line max-len
export const ContainerFields = `${TabSpecificField.TAGS}, ${TabSpecificField.OWNERS},${TabSpecificField.FOLLOWERS},${TabSpecificField.DATAMODEL}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;
