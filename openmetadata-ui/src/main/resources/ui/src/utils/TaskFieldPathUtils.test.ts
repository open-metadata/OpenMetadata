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
  buildTaskFieldPath,
  getTaskFieldName,
  parseTaskFieldPath,
} from './TaskFieldPathUtils';

describe('buildTaskFieldPath', () => {
  it.each([
    ['columns', 'amount', 'description', 'columns.amount.description'],
    ['columns', '"profile.child"', 'tags', 'columns.profile.child.tags'],
    ['columns', '""a.b""', 'description', 'columns."a.b".description'],
    [
      'messageSchema',
      'user_id',
      'description',
      'messageSchema.schemaFields.user_id.description',
    ],
    [
      'messageSchema.schemaFields',
      'user_id',
      'tags',
      'messageSchema.schemaFields.user_id.tags',
    ],
    ['dataModel', 'total', 'tags', 'dataModel.columns.total.tags'],
    ['tasks', 'extract', 'description', 'tasks.extract.description'],
  ] as const)(
    'builds %s / %s / %s as %s',
    (field, value, property, expected) => {
      expect(buildTaskFieldPath(field, value, property)).toBe(expected);
    }
  );

  it('names the entity itself without a field', () => {
    expect(buildTaskFieldPath(null, null, 'description')).toBe('description');
    expect(buildTaskFieldPath('columns', '', 'tags')).toBe('tags');
  });
});

describe('parseTaskFieldPath', () => {
  it('reads what buildTaskFieldPath writes', () => {
    expect(parseTaskFieldPath('columns.profile.child.description')).toEqual({
      container: 'columns',
      names: ['profile', 'child'],
      property: 'description',
    });
    expect(
      parseTaskFieldPath('messageSchema.schemaFields."order.id".tags')
    ).toEqual({
      container: 'messageSchema.schemaFields',
      names: ['order.id'],
      property: 'tags',
    });
    expect(parseTaskFieldPath('tags')).toEqual({ names: [], property: 'tags' });
  });

  it.each([
    undefined,
    '',
    'columns::id::description',
    'columns.id',
    'charts.revenue.description',
    'columns.description',
  ])('refuses %s', (fieldPath) => {
    expect(parseTaskFieldPath(fieldPath)).toBeUndefined();
  });
});

describe('getTaskFieldName', () => {
  it('joins the field names, and is empty for the entity', () => {
    expect(getTaskFieldName('columns.profile.child.description')).toBe(
      'profile.child'
    );
    expect(getTaskFieldName('description')).toBe('');
  });
});
