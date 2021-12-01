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

import { AxiosError, AxiosPromise, AxiosResponse } from 'axios';
import { flatten } from 'lodash';
import { EntityTags, TableColumn } from 'Models';
import { getCategory, getTags } from '../axiosAPIs/tagAPI';
import { TagCategory, TagClass } from '../generated/entity/tags/tagCategory';

export const getTagCategories = async (fields?: Array<string> | string) => {
  try {
    let listOfCategories: Array<TagCategory> = [];
    const categories = await getTags(fields);
    const categoryList = categories.data.data.map((category: TagCategory) => {
      return {
        name: category.name,
        description: category.description,
      };
    });
    if (categoryList.length) {
      let promiseArr: Array<AxiosPromise> = [];
      promiseArr = categoryList.map((category: TagCategory) => {
        return getCategory(category.name, fields);
      });

      await Promise.allSettled(promiseArr).then(
        (res: PromiseSettledResult<AxiosResponse>[]) => {
          if (res.length) {
            listOfCategories = res
              .filter((category) => category.status === 'fulfilled')
              .map((category) => {
                return (category as PromiseFulfilledResult<AxiosResponse>).value
                  ?.data;
              });
          }
        }
      );
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
