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
import { TabSpecificField } from '../../enums/entity.enum';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import {
  DatabaseFields,
  getQueryFilterForDatabase,
  schemaTableColumns,
} from './Database.util';

describe('Database Util', () => {
  describe('getQueryFilterForDatabase', () => {
    it('should return the correct query filter', () => {
      const serviceType = 'mysql';
      const databaseName = 'mydatabase';

      const expectedFilter = JSON.stringify({
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    { term: { serviceType: [serviceType.toLowerCase()] } },
                  ],
                },
              },
              {
                bool: {
                  should: [
                    { term: { 'database.name.keyword': [databaseName] } },
                  ],
                },
              },
            ],
          },
        },
      });

      const actualFilter = getQueryFilterForDatabase(serviceType, databaseName);

      expect(actualFilter).toEqual(expectedFilter);
    });
  });

  describe('Database Util - DatabaseFields', () => {
    it('should have the correct fields', () => {
      const expectedFields = `${TabSpecificField.TAGS}, ${TabSpecificField.OWNER}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;

      expect(DatabaseFields).toEqual(expectedFields);
    });
  });

  describe('Database Util - schemaTableColumns', () => {
    it('should render the correct columns', () => {
      const record = {
        name: 'schema1',
        fullyQualifiedName: 'database.schema1',
        description: 'Schema 1 description',
        owner: { id: '1', type: 'user', name: 'John Doe' },
        usageSummary: {
          weeklyStats: { percentileRank: 80 },
        },
      } as DatabaseSchema;

      const expectedColumns = [
        {
          title: 'Schema Name',
          dataIndex: 'name',
          key: 'name',
          width: 250,
          render: expect.any(Function),
        },
        {
          title: 'Description',
          dataIndex: 'description',
          key: 'description',
          render: expect.any(Function),
        },
        {
          title: 'Owner',
          dataIndex: 'owner',
          key: 'owner',
          width: 120,
          render: expect.any(Function),
        },
        {
          title: 'Usage',
          dataIndex: 'usageSummary',
          key: 'usageSummary',
          width: 120,
          render: expect.any(Function),
        },
      ];

      const columns = schemaTableColumns;

      expect(columns).toEqual(expectedColumns);

      // Test render functions
      const nameColumn = columns[0];
      const descriptionColumn = columns[1];
      const ownerColumn = columns[2];
      const usageColumn = columns[3];

      // Test render function for name column
      const nameRender = nameColumn.render;
      const nameRenderResult = nameRender && nameRender(record.name, record, 0);

      expect(nameRenderResult).toMatchSnapshot();

      // Test render function for description column
      const descriptionRender = descriptionColumn.render;
      const descriptionRenderResult =
        descriptionRender && descriptionRender(record.description, record, 0);

      expect(descriptionRenderResult).toMatchSnapshot();

      // Test render function for owner column
      const ownerRender = ownerColumn.render;
      const ownerRenderResult =
        ownerRender && ownerRender(record.owner, record, 0);

      expect(ownerRenderResult).toMatchSnapshot();

      // Test render function for usage column
      const usageRender = usageColumn.render;
      const usageRenderResult =
        usageRender && usageRender(record.usageSummary, record, 0);

      expect(usageRenderResult).toMatchSnapshot();
    });
  });
});
