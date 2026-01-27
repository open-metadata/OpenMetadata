/*
 *  Copyright 2025 Collate.
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
import { Column } from '../generated/entity/data/table';
import { getColumnOptionsFromTableColumn } from './TableUtils';

describe('getColumnOptionsFromTableColumn', () => {
  it('should use fullyQualifiedName when useFullyQualifiedName is true', () => {
    const columns = [
      {
        name: 'column1',
        fullyQualifiedName: 'table.column1',
        dataType: 'STRING',
        children: [],
      },
      {
        name: 'nested',
        fullyQualifiedName: 'table.nested',
        dataType: 'STRUCT',
        children: [
          {
            name: 'field1',
            fullyQualifiedName: 'table.nested.field1',
            dataType: 'STRING',
            children: [],
          },
        ],
      },
    ] as Column[];

    const result = getColumnOptionsFromTableColumn(columns, true);

    expect(result).toEqual([
      { label: 'column1', value: 'table.column1' },
      { label: 'nested', value: 'table.nested' },
      { label: 'field1', value: 'table.nested.field1' },
    ]);
  });

  it('should use name when useFullyQualifiedName is false', () => {
    const columns = [
      {
        name: 'column1',
        fullyQualifiedName: 'table.column1',
        dataType: 'STRING',
        children: [],
      },
    ] as Column[];

    const result = getColumnOptionsFromTableColumn(columns, false);

    expect(result).toEqual([{ label: 'column1', value: 'column1' }]);
  });

  it('should use name by default when useFullyQualifiedName is not provided', () => {
    const columns = [
      {
        name: 'column1',
        fullyQualifiedName: 'table.column1',
        dataType: 'STRING',
        children: [],
      },
    ] as Column[];

    const result = getColumnOptionsFromTableColumn(columns);

    expect(result).toEqual([{ label: 'column1', value: 'column1' }]);
  });
});
