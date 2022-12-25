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
import { isEmpty } from 'lodash';
import { Bucket, EntityTags, TableColumn, TagOption } from 'Models';
import { getClassification, getTags } from '../axiosAPIs/tagAPI';
import { TAG_VIEW_CAP } from '../constants/constants';
import { SettledStatus } from '../enums/axios.enum';
import { Classification } from '../generated/entity/classification/classification';
import { LabelType, State, TagSource } from '../generated/type/tagLabel';
import { fetchGlossaryTerms, getGlossaryTermlist } from './GlossaryUtils';

export const getClassifications = async (fields?: Array<string> | string) => {
  try {
    const listOfClassifications: Array<Classification> = [];
    const classifications = await getTags(fields);
    const classificationList = classifications.data.map(
      (category: Classification) => {
        return {
          name: category.name,
          description: category.description,
        } as Classification;
      }
    );
    if (classificationList.length) {
      const promiseArr = classificationList.map((category: Classification) =>
        getClassification(category.name, fields)
      );

      const categories = await Promise.allSettled(promiseArr);

      categories.map((category) => {
        if (category.status === 'fulfilled') {
          listOfClassifications.push(category.value as Classification);
        }
      });
    }

    return Promise.resolve({ data: listOfClassifications });
  } catch (error) {
    return Promise.reject({ data: (error as AxiosError).response });
  }
};

export const getTaglist = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _categories: Array<Classification> = []
): Array<string> => {
  return [] as string[];
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
    getClassifications(),
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
