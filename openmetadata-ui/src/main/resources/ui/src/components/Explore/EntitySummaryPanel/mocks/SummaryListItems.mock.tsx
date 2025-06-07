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

import { Constraint } from '../../../../generated/entity/data/table';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';

export const mockEntityDetails = {
  children: [],
  constraint: undefined,
  description: 'Description for shipping_address',
  name: 'shipping_address',
  tags: [],
  title: <div data-testid="title">Title</div>,
  type: 'ARRAY',
};

export const mockEntityDetailsWithTagsAndAlgorithm = {
  children: [],
  algorithm: 'The Algo',
  constraint: undefined,
  description: undefined,
  name: 'shipping_address',
  tags: [
    {
      tagFQN: 'PersonalData.SpecialCategory',
      labelType: LabelType.Manual,
      description: 'Test Description',
      source: TagSource.Classification,
      state: State.Confirmed,
    },
  ],
  title: <div data-testid="title">Title</div>,
  type: 'ARRAY',
};

export const mockEntityDetailsWithoutDescription = {
  children: [],
  constraint: undefined,
  description: undefined,
  name: 'shipping_address',
  tags: [],
  title: <div data-testid="title">Title</div>,
  type: 'ARRAY',
};

export const mockEntityDetailsWithConstraint = {
  children: [],
  constraint: Constraint.PrimaryKey,
  description: undefined,
  name: 'shipping_address',
  tags: [],
  title: <div data-testid="title">Title</div>,
  type: 'ARRAY',
};
