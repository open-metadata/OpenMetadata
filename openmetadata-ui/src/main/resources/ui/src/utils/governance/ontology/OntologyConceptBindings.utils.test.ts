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
import { DataType } from '../../../generated/entity/data/table';
import { getOntologyColumnOptions } from './OntologyConceptBindings.utils';

it('preserves exact nested segments including dots and escaped quotes', () => {
  const options = getOntologyColumnOptions(
    [
      {
        name: 'address',
        dataType: DataType.Struct,
        fullyQualifiedName: 'svc.db.schema."customer.data".address',
        children: [
          {
            name: 'zip.code',
            dataType: DataType.String,
            fullyQualifiedName:
              'svc.db.schema."customer.data".address."zip.code"',
          },
          {
            name: 'quoted"name',
            dataType: DataType.String,
            fullyQualifiedName:
              'svc.db.schema."customer.data".address."quoted""name"',
          },
        ],
      },
    ],
    'svc.db.schema."customer.data"'
  );

  expect(options.map((option) => option.path)).toEqual([
    ['address'],
    ['address', 'zip.code'],
    ['address', 'quoted"name'],
  ]);
});
