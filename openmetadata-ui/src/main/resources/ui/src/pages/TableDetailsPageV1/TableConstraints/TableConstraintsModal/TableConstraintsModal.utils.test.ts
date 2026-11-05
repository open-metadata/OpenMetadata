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
import {
  ConstraintType,
  RelationshipType,
} from '../../../../generated/entity/data/table';
import {
  EMPTY_FOREIGN_CONSTRAINT,
  toConstraintFormValues,
} from './TableConstraintsModal.utils';

describe('toConstraintFormValues', () => {
  it('starts on primary keys with one empty foreign key row', () => {
    expect(toConstraintFormValues()).toEqual(
      expect.objectContaining({
        constraintType: ConstraintType.PrimaryKey,
        primaryConstraints: undefined,
        foreignConstraints: [EMPTY_FOREIGN_CONSTRAINT],
      })
    );
  });

  it('splits saved constraints by type', () => {
    const values = toConstraintFormValues([
      { constraintType: ConstraintType.PrimaryKey, columns: ['id'] },
      { constraintType: ConstraintType.Unique, columns: ['email'] },
      {
        constraintType: ConstraintType.ForeignKey,
        columns: ['user_id'],
        relationshipType: RelationshipType.ManyToOne,
        referredColumns: ['svc.db.schema.users.id'],
      },
    ]);

    expect(values.primaryConstraints).toEqual(['id']);
    expect(values.uniqueConstraints).toEqual(['email']);
    expect(values.foreignConstraints).toEqual([
      {
        columns: 'user_id',
        relationshipType: RelationshipType.ManyToOne,
        referredColumns: 'svc.db.schema.users.id',
      },
    ]);
  });
});
