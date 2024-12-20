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
import i18n from '../utils/i18next/LocalUtil';

export const TABLE_SCROLL_VALUE = { x: 1200 };

export const TABLE_CONSTRAINTS_TYPE_OPTIONS = [
  {
    label: i18n.t('label.entity-key', {
      entity: i18n.t('label.primary'),
    }),
    value: ConstraintType.PrimaryKey,
  },
  {
    label: i18n.t('label.entity-key', {
      entity: i18n.t('label.foreign'),
    }),
    value: ConstraintType.ForeignKey,
  },
  {
    label: i18n.t('label.unique'),
    value: ConstraintType.Unique,
  },
  {
    label: i18n.t('label.entity-key', {
      entity: i18n.t('label.dist'),
    }),
    value: ConstraintType.DistKey,
  },
  {
    label: i18n.t('label.entity-key', {
      entity: i18n.t('label.sort'),
    }),
    value: ConstraintType.SortKey,
  },
];

export const COLUMN_CONSTRAINT_TYPE_OPTIONS = [
  {
    label: i18n.t('label.primary-key'),
    value: Constraint.PrimaryKey,
  },
  {
    label: i18n.t('label.not-null'),
    value: Constraint.NotNull,
  },
  {
    label: i18n.t('label.null'),
    value: Constraint.Null,
  },
  {
    label: i18n.t('label.unique'),
    value: Constraint.Unique,
  },
];

export const RELATIONSHIP_TYPE_OPTION = [
  {
    label: i18n.t('label.one-to-one'),
    value: RelationshipType.OneToOne,
  },
  {
    label: i18n.t('label.one-to-many'),
    value: RelationshipType.OneToMany,
  },
  {
    label: i18n.t('label.many-to-one'),
    value: RelationshipType.ManyToOne,
  },
  {
    label: i18n.t('label.many-to-many'),
    value: RelationshipType.ManyToMany,
  },
];
