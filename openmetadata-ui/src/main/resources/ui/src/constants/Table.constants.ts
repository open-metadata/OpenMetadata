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
  Constraint,
  ConstraintType,
  RelationshipType,
} from '../generated/entity/data/table';

export const TABLE_SCROLL_VALUE = { x: 1200 };

export const SUPPORTED_TABLE_CONSTRAINTS = [
  ConstraintType.ForeignKey,
  ConstraintType.PrimaryKey,
];

export const COLUMN_CONSTRAINT_TYPE_OPTIONS = [
  {
    label: 'Primary Key',
    value: Constraint.PrimaryKey,
  },
  {
    label: 'Not Null',
    value: Constraint.NotNull,
  },
  {
    label: 'Null',
    value: Constraint.Null,
  },
  {
    label: 'Unique',
    value: Constraint.Unique,
  },
];

export const RELATIONSHIP_TYPE_OPTION = [
  {
    label: 'One-to-One',
    value: RelationshipType.OneToOne,
  },
  {
    label: 'One-to-Many',
    value: RelationshipType.OneToMany,
  },
  {
    label: 'Many-to-One',
    value: RelationshipType.ManyToOne,
  },
  {
    label: 'Many-to-Many',
    value: RelationshipType.ManyToMany,
  },
];
