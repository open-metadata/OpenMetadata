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

export const mockFormattedEntityData = [
  {
    children: [],
    constraint: undefined,
    description: 'Description for name1',
    name: 'name1',
    tags: [],
    title: 'Title1',
    type: 'ARRAY',
  },
  {
    children: [],
    constraint: undefined,
    description: 'Description for name2',
    name: 'name2',
    tags: [],
    title: 'Title2',
    type: 'OBJECT',
  },
];

export const mockFormattedEntityDataWithChildren = [
  {
    children: [
      {
        children: [],
        constraint: undefined,
        description: 'Description for child1',
        name: 'child1',
        tags: [],
        title: 'ChildTitle2',
        type: 'OBJECT',
      },
    ],
    constraint: undefined,
    description: 'Description for name1',
    name: 'name1',
    tags: [],
    title: 'Title1',
    type: 'ARRAY',
  },
  {
    children: [],
    constraint: undefined,
    description: 'Description for name2',
    name: 'name2',
    tags: [],
    title: 'Title2',
    type: 'OBJECT',
  },
];
