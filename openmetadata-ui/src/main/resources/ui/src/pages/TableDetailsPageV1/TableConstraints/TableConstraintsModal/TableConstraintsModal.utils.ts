/*
 *  Copyright 2026 Collate.
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

import { ConstraintType, Table } from '../../../../generated/entity/data/table';
import {
  ForeignConstraintFormValues,
  TableConstraintFormValues,
} from './TableConstraintsModal.interface';

export const EMPTY_FOREIGN_CONSTRAINT: ForeignConstraintFormValues = {
  columns: undefined,
  relationshipType: undefined,
  referredColumns: undefined,
};

/** Saved table constraints → modal form values; the editor opens on primary keys. */
export const toConstraintFormValues = (
  constraints: Table['tableConstraints'] = []
): TableConstraintFormValues => {
  const columnsOf = (type: ConstraintType) =>
    constraints.find((item) => item.constraintType === type)?.columns;
  const foreign = constraints
    .filter(
      (item) =>
        ![
          ConstraintType.PrimaryKey,
          ConstraintType.DistKey,
          ConstraintType.ClusterKey,
          ConstraintType.SortKey,
          ConstraintType.Unique,
        ].includes(item.constraintType as ConstraintType)
    )
    .map((item) => ({
      columns: item.columns?.[0],
      relationshipType: item.relationshipType,
      referredColumns: item.referredColumns?.[0],
    }));

  return {
    constraintType: ConstraintType.PrimaryKey,
    primaryConstraints: columnsOf(ConstraintType.PrimaryKey),
    distConstraints: columnsOf(ConstraintType.DistKey),
    clusterConstraints: columnsOf(ConstraintType.ClusterKey),
    sortConstraints: columnsOf(ConstraintType.SortKey),
    uniqueConstraints: columnsOf(ConstraintType.Unique),
    foreignConstraints: foreign.length ? foreign : [EMPTY_FOREIGN_CONSTRAINT],
  };
};
