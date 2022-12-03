/*
 *  Copyright 2021 Collate
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

import { AxiosError } from 'axios';
import { flatten, isEmpty } from 'lodash';
import { Bucket, EntityTags, TableColumn, TagOption } from 'Models';
import { getCategory, getTags } from '../axiosAPIs/tagAPI';
import { TAG_VIEW_CAP } from '../constants/constants';
import { SettledStatus } from '../enums/axios.enum';
import { TagCategory, TagClass } from '../generated/entity/tags/tagCategory';
import { LabelType, State, TagSource } from '../generated/type/tagLabel';
import { fetchGlossaryTerms, getGlossaryTermlist } from './GlossaryUtils';

export const getTagCategories = async (fields?: Array<string> | string) => {
  try {
    const listOfCategories: Array<TagCategory> = [];
    const categories = await getTags(fields);
    const categoryList = categories.data.map((category: TagCategory) => {
      return {
        name: category.name,
        description: category.description,
      } as TagCategory;
    });
    if (categoryList.length) {
      const promiseArr = categoryList.map((category: TagCategory) =>
        getCategory(category.name, fields)
      );

      const categories = await Promise.allSettled(promiseArr);

      categories.map((category) => {
        if (category.status === 'fulfilled') {
          listOfCategories.push(category.value as TagCategory);
        }
      });
    }

    return Promise.resolve({ data: listOfCategories });
  } catch (error) {
    return Promise.reject({ data: (error as AxiosError).response });
  }
};

export const getTaglist = (
  categories: Array<TagCategory> = []
): Array<string> => {
  const children = categories.map((category: TagCategory) => {
    return category.children || [];
  });
  const allChildren = flatten(children);
  const tagList = (allChildren as unknown as TagClass[]).map((tag) => {
    return tag?.fullyQualifiedName || '';
  });

  return tagList;
};

export const getTableTags = (
  columns: Array<Partial<TableColumn>>
): Array<EntityTags> => {
  const flag: { [x: string]: boolean } = {};
  const uniqueTags: Array<EntityTags> = [];
  const tags = columns
    .map((column) => column.tags || [])
    .reduce((prev, curr) => prev.concat(curr), [])
    .map((tag) => tag);

  tags.forEach((elem) => {
    if (!flag[elem.tagFQN]) {
      flag[elem.tagFQN] = true;
      uniqueTags.push(elem);
    }
  });

  return uniqueTags;
};

export const getTagOptionsFromFQN = (
  tagFQNs: Array<string>
): Array<TagOption> => {
  return tagFQNs.map((tag) => {
    return { fqn: tag, source: 'Tag' };
  });
};

export const getTagOptions = (tags: Array<string>): Array<EntityTags> => {
  return tags.map((tag) => {
    return {
      labelType: LabelType.Manual,
      state: State.Confirmed,
      tagFQN: tag,
      source: TagSource.Tag,
    };
  });
};

// Will add a label of value in the data object without it's FQN
export const getTagsWithLabel = (tags: Array<Bucket>) => {
  return tags.map((tag) => {
    const containQuotes = tag.key.split('"')[1];

    return {
      ...tag,
      label: isEmpty(containQuotes) ? tag.key.split('.').pop() : containQuotes,
    };
  });
};

//  Will return tag with ellipses if it exceeds the limit
export const getTagDisplay = (tag: string) => {
  return tag.length > TAG_VIEW_CAP ? `${tag.slice(0, TAG_VIEW_CAP)}...` : tag;
};

export const fetchTagsAndGlossaryTerms = async () => {
  const responses = await Promise.allSettled([
    getTagCategories(),
    fetchGlossaryTerms(),
  ]);

  let tagsAndTerms: TagOption[] = [];
  if (
    responses[0].status === SettledStatus.FULFILLED &&
    responses[0].value.data
  ) {
    tagsAndTerms = getTaglist(responses[0].value.data).map((tag) => {
      return { fqn: tag, source: 'Tag' };
    });
  }
  if (
    responses[1].status === SettledStatus.FULFILLED &&
    responses[1].value &&
    responses[1].value.length > 0
  ) {
    const glossaryTerms: TagOption[] = getGlossaryTermlist(
      responses[1].value
    ).map((tag) => {
      return { fqn: tag, source: 'Glossary' };
    });
    tagsAndTerms = [...tagsAndTerms, ...glossaryTerms];
  }

  return tagsAndTerms;
};
