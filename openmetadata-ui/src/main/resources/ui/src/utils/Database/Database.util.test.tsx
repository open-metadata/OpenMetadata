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
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { TabSpecificField } from '../../enums/entity.enum';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import {
  DatabaseFields,
  ExtraDatabaseDropdownOptions,
  getQueryFilterForDatabase,
  schemaTableColumns,
} from './Database.util';

jest.mock(
  '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn().mockReturnValue({
      showModal: jest.fn(),
    }),
  })
);
jest.mock(
  '../../components/common/ManageButtonContentItem/ManageButtonContentItem.component',
  () => ({
    ManageButtonItemLabel: jest
      .fn()
      .mockImplementation(() => <div>ManageButtonItemLabel</div>),
  })
);

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: mockNavigate,
}));

jest.mock('../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue([
    {
      title: 'label.owner-plural',
      dataIndex: 'owners',
      key: 'owners',
      width: 180,
      filterIcon: () => <div>FilterIcon</div>,
      render: () => (
        <OwnerLabel
          isCompactView={false}
          maxVisibleOwners={4}
          owners={[{ id: '1', name: 'John Doe', type: 'user' }]}
          showLabel={false}
        />
      ),
    },
  ]),
}));

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
      const expectedFields = `${TabSpecificField.TAGS}, ${TabSpecificField.OWNERS}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;

      expect(DatabaseFields).toEqual(expectedFields);
    });
  });

  describe.skip('Database Util - schemaTableColumns', () => {
    it('should render the correct columns', () => {
      const record = {
        name: 'schema1',
        fullyQualifiedName: 'database.schema1',
        description: 'Schema 1 description',
        owners: [{ id: '1', type: 'user', name: 'John Doe' }],
        usageSummary: {
          weeklyStats: { percentileRank: 80, count: 10 },
          dailyStats: { count: 10 },
          date: new Date(),
        },
        database: { name: 'database', id: 'database', type: 'database' },
        service: { name: 'service1', id: 'service1', type: 'service' },
      } as DatabaseSchema;

      const expectedColumns = [
        {
          title: 'label.schema-name',
          dataIndex: 'name',
          key: 'name',
          width: 250,
          render: expect.any(Function),
        },
        {
          title: 'label.description',
          dataIndex: 'description',
          key: 'description',
          render: expect.any(Function),
        },
        {
          title: 'label.owner-plural',
          dataIndex: 'owners',
          key: 'owners',
          width: 180,
          render: expect.any(Function),
          filterIcon: expect.any(Function),
        },
        {
          title: 'label.usage',
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
        ownerRender && ownerRender(record.owners, record, 0);

      expect(ownerRenderResult).toMatchSnapshot();

      // Test render function for usage column
      const usageRender = usageColumn.render;
      const usageRenderResult =
        usageRender && usageRender(record.usageSummary, record, 0);

      expect(usageRenderResult).toMatchSnapshot();
    });
  });

  describe('Database Util - ExtraDatabaseDropdownOptions', () => {
    it('should render import button when user has editAll permission', () => {
      const permission = {
        ViewAll: false,
        EditAll: true,
      } as OperationPermission;

      const result = ExtraDatabaseDropdownOptions(
        'databaseFqn',
        permission,
        false,
        mockNavigate
      );

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('import-button');
    });

    it('should render export button when user has viewAll permission', () => {
      const permission = {
        ViewAll: true,
        EditAll: false,
      } as OperationPermission;

      const result = ExtraDatabaseDropdownOptions(
        'databaseFqn',
        permission,
        false,
        mockNavigate
      );

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('export-button');
    });

    it('should render both button when user has viewAll & editAll permission', () => {
      const permission = {
        ViewAll: true,
        EditAll: true,
      } as OperationPermission;

      const result = ExtraDatabaseDropdownOptions(
        'databaseFqn',
        permission,
        false,
        mockNavigate
      );

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('import-button');
      expect(result[1].key).toBe('export-button');
    });

    it('should not render any buttons when user has neither viewAll nor editAll permission', () => {
      const permission = {
        ViewAll: false,
        EditAll: false,
      } as OperationPermission;
      const result = ExtraDatabaseDropdownOptions(
        'databaseFqn',
        permission,
        false,
        mockNavigate
      );

      expect(result).toHaveLength(0);
      expect(result).toStrictEqual([]);
    });

    it('should not render any buttons when the entity is deleted', () => {
      const permission = {
        ViewAll: true,
        EditAll: true,
      } as OperationPermission;
      const result = ExtraDatabaseDropdownOptions(
        'databaseFqn',
        permission,
        true,
        mockNavigate
      );

      expect(result).toHaveLength(0);
      expect(result).toStrictEqual([]);
    });
  });
});
