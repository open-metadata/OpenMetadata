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

import { reduce } from 'lodash';
import { TagFilterOptions, TagsData } from 'Models';
import React from 'react';
import { TableTagsProps } from '../../components/Database/TableTags/TableTags.interface';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';

export const getFilterTags = (tags: TagLabel[]): TableTagsProps =>
  reduce(
    tags,
    (acc, cv) => {
      if (cv.source === TagSource.Classification) {
        return { ...acc, Classification: [...acc.Classification, cv] };
      } else {
        return { ...acc, Glossary: [...acc.Glossary, cv] };
      }
    },
    { Classification: [] as TagLabel[], Glossary: [] as TagLabel[] }
  );

const extractTags = (item: TagsData, allTags: TagFilterOptions[]) => {
  if (item?.tags?.length) {
    item.tags.forEach((tag) => {
      allTags.push({
        text: tag.tagFQN,
        value: tag.tagFQN,
        source: tag.source,
      });
    });
  }

  if (item?.children?.length) {
    item.children.forEach((child) => {
      extractTags(child, allTags);
    });
  }
};

export const getAllTags = (data: TagsData[]) => {
  return data.reduce((allTags, item) => {
    extractTags(item, allTags);

    return allTags;
  }, [] as TagFilterOptions[]);
};

export const searchTagInData = (
  tagToSearch: React.Key | boolean,
  data: TagsData
) => {
  if (data.tags && data.tags.some((tag) => tag.tagFQN === tagToSearch)) {
    return true;
  }

  if (data.children?.length) {
    for (const child of data.children) {
      if (searchTagInData(tagToSearch, child)) {
        return true;
      }
    }
  }

  return false;
};
