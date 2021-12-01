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

const APIHits = [
  {
    _source: {
      description: 'this is the table to hold data on dim_shop',
      fqdn: 'hive.dim_shop',
      tableName: 'dim_shop',
      tableId: 'd2b34d55-8cc5-4a7e-9064-04dd37ef27b8',
      tableType: 'REGULAR',
    },
  },
];
const formatDataResponse = jest.fn().mockImplementation((hist) => {
  const formatedData = hist.map((hit) => {
    const newData = {};
    newData.id = hit._source.tableId;
    newData.name = hit._source.tableName;
    newData.description = hit._source.description;
    newData.fullyQualifiedName = hit._source.fqdn;
    newData.tableType = hit._source.tableType;

    return newData;
  });

  return formatedData;
});

describe('Test APIUtils utility', () => {
  it('Returns the proper formatted data', () => {
    const formattedData = formatDataResponse(APIHits);

    expect(formattedData).toStrictEqual([
      {
        fullyQualifiedName: 'hive.dim_shop',
        description: 'this is the table to hold data on dim_shop',
        name: 'dim_shop',
        id: 'd2b34d55-8cc5-4a7e-9064-04dd37ef27b8',
        tableType: 'REGULAR',
      },
    ]);
  });
});
