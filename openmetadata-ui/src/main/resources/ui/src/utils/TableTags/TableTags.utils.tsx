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
import { isCertificationTag, isTierTag } from '../TablePureUtils';

export const getFilterTags = (tags: TagLabel[]): TableTagsProps =>
  reduce(
    tags,
    (acc, cv) => {
      if (
        cv.source === TagSource.Classification &&
        !isTierTag(cv.tagFQN) &&
        !isCertificationTag(cv.tagFQN)
      ) {
        return { ...acc, Classification: [...acc.Classification, cv] };
      } else if (cv.source === TagSource.Glossary) {
        return { ...acc, Glossary: [...acc.Glossary, cv] };
      }

      return acc;
    },
    { Classification: [] as TagLabel[], Glossary: [] as TagLabel[] }
  );

const extractTags = (
  item: TagsData,
  tagMap: Map<string, TagFilterOptions>
): void => {
  if (item?.tags?.length) {
    for (const tag of item.tags) {
      if (!tagMap.has(tag.tagFQN)) {
        tagMap.set(tag.tagFQN, {
          text: tag.tagFQN,
          value: tag.tagFQN,
          source: tag.source,
        });
      }
    }
  }

  if (item?.children?.length) {
    for (const child of item.children) {
      extractTags(child, tagMap);
    }
  }
};

export const getAllTags = (data: TagsData[]): TagFilterOptions[] => {
  const tagMap = new Map<string, TagFilterOptions>();

  for (const item of data) {
    extractTags(item, tagMap);
  }

  return Array.from(tagMap.values());
};

/**
 * Antd's column filter only prunes top-level rows and leaves nested `children`
 * untouched, so filtering by a tag on a tree (schema fields, table columns)
 * would keep every child of a matched parent. This recursively prunes the tree
 * to only the nodes that carry one of the selected tags, while retaining the
 * ancestor path needed to reach a matched descendant.
 */
export const getFilteredTagsData = <T extends TagsData>(
  data: T[],
  selectedTags: (React.Key | boolean)[]
): T[] =>
  data.reduce<T[]>((acc, item) => {
    const filteredChildren = item.children?.length
      ? getFilteredTagsData(item.children as T[], selectedTags)
      : [];
    const isSelfTagged = (item.tags ?? []).some((tag) =>
      selectedTags.includes(tag.tagFQN)
    );

    return isSelfTagged || filteredChildren.length
      ? acc.concat({ ...item, children: filteredChildren })
      : acc;
  }, []);

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
