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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { Column } from '../../../generated/entity/data/table';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import {
  mockTableData,
  tableVersionMockProps,
} from '../../../mocks/TableVersion.mock';
import VersionTable from '../../Entity/VersionTable/VersionTable.component';
import TableVersion from './TableVersion.component';

const mockNavigate = jest.fn();

jest.mock(
  '../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () => jest.fn().mockImplementation(() => <div>DataAssetsVersionHeader</div>)
);

jest.mock('../../common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(() => <div>TagsContainerV2</div>)
);

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockImplementation(() => <div>CustomPropertyTable</div>),
}));

jest.mock('../../common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockImplementation(() => <div>DescriptionV1</div>)
);

jest.mock('../../Entity/EntityVersionTimeLine/EntityVersionTimeLine', () =>
  jest.fn().mockImplementation(() => <div>EntityVersionTimeLine</div>)
);

jest.mock('../../Entity/VersionTable/VersionTable.component', () =>
  jest.fn().mockImplementation(() => <div>VersionTable</div>)
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
  useLocation: jest.fn().mockImplementation(() => ({ pathname: 'pathname' })),
}));

jest.mock(
  '../../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn(),
      getEntityRuleValidation: jest.fn(),
    })),
  })
);

describe('TableVersion tests', () => {
  beforeEach(() => {
    (VersionTable as jest.Mock).mockClear();
  });

  it('Should render component properly if not loading', async () => {
    await act(async () => {
      render(<TableVersion {...tableVersionMockProps} />);
    });

    const dataAssetsVersionHeader = screen.getByText('DataAssetsVersionHeader');
    const description = screen.getByText('DescriptionV1');
    const schemaTabLabel = screen.getByText('label.schema');
    const customPropertyTabLabel = screen.getByText(
      'label.custom-property-plural'
    );
    const entityVersionTimeLine = screen.getByText('EntityVersionTimeLine');
    const versionTable = screen.getByText('VersionTable');

    expect(dataAssetsVersionHeader).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(schemaTabLabel).toBeInTheDocument();
    expect(customPropertyTabLabel).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(versionTable).toBeInTheDocument();
  });

  it('Should display Loader if isVersionLoading is true', async () => {
    await act(async () => {
      render(<TableVersion {...tableVersionMockProps} isVersionLoading />);
    });

    const loader = screen.getByText('Loader');
    const entityVersionTimeLine = screen.getByText('EntityVersionTimeLine');
    const dataAssetsVersionHeader = screen.queryByText(
      'DataAssetsVersionHeader'
    );
    const schemaTabLabel = screen.queryByText('label.schema');
    const customPropertyTabLabel = screen.queryByText(
      'label.custom-property-plural'
    );
    const versionTable = screen.queryByText('VersionTable');

    expect(loader).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(dataAssetsVersionHeader).toBeNull();
    expect(schemaTabLabel).toBeNull();
    expect(customPropertyTabLabel).toBeNull();
    expect(versionTable).toBeNull();
  });

  it('Should update url on click of tab', async () => {
    await act(async () => {
      render(<TableVersion {...tableVersionMockProps} />);
    });

    const customPropertyTabLabel = screen.getByText(
      'label.custom-property-plural'
    );
    const versionTable = screen.getByText('VersionTable');

    expect(customPropertyTabLabel).toBeInTheDocument();
    expect(versionTable).toBeInTheDocument();

    fireEvent.click(customPropertyTabLabel);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/table/sample_data.ecommerce_db.shopify.raw_product_catalog/versions/0.3/custom_properties'
    );
  });

  it('Should use historical columns from currentVersionData, not live API columns', async () => {
    await act(async () => {
      render(<TableVersion {...tableVersionMockProps} />);
    });

    expect(VersionTable as jest.Mock).toHaveBeenCalled();

    const receivedColumns: Column[] = (VersionTable as jest.Mock).mock
      .calls[0][0].columns;

    const historicalColumnNames = (mockTableData.columns ?? []).map(
      (col) => col.name
    );

    historicalColumnNames.forEach((name) => {
      expect(receivedColumns.some((col) => col.name === name)).toBe(true);
    });
  });

  it('Should reflect updated currentVersionData columns when version changes', async () => {
    const updatedColumns: Column[] = [
      {
        name: 'updated_col',
        dataType: 'VARCHAR' as Column['dataType'],
        description: 'Historical description for updated_col',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.raw_product_catalog.updated_col',
        tags: [],
        ordinalPosition: 1,
      },
    ];

    const updatedProps = {
      ...tableVersionMockProps,
      currentVersionData: {
        ...mockTableData,
        columns: updatedColumns,
      },
    };

    await act(async () => {
      render(<TableVersion {...updatedProps} />);
    });

    expect(VersionTable as jest.Mock).toHaveBeenCalled();

    const receivedColumns: Column[] = (VersionTable as jest.Mock).mock
      .calls[0][0].columns;

    expect(receivedColumns.some((col) => col.name === 'updated_col')).toBe(
      true
    );
    expect(receivedColumns.some((col) => col.name === 'shop_id')).toBe(false);
  });

  describe('ViewCustomFields Permission Tests', () => {
    it('should render custom properties tab when ViewCustomFields is true', async () => {
      await act(async () => {
        render(
          <TableVersion
            {...tableVersionMockProps}
            entityPermissions={{
              ...ENTITY_PERMISSIONS,
              ViewCustomFields: true,
            }}
          />
        );
      });

      const customPropertyTabLabel = screen.getByText(
        'label.custom-property-plural'
      );

      expect(customPropertyTabLabel).toBeInTheDocument();

      fireEvent.click(customPropertyTabLabel);

      expect(screen.getByText('CustomPropertyTable')).toBeInTheDocument();
    });

    it('should render custom properties tab when ViewCustomFields is false', async () => {
      await act(async () => {
        render(
          <TableVersion
            {...tableVersionMockProps}
            entityPermissions={{
              ...ENTITY_PERMISSIONS,
              ViewCustomFields: false,
            }}
          />
        );
      });

      const customPropertyTabLabel = screen.getByText(
        'label.custom-property-plural'
      );

      expect(customPropertyTabLabel).toBeInTheDocument();

      fireEvent.click(customPropertyTabLabel);

      expect(screen.getByText('CustomPropertyTable')).toBeInTheDocument();
    });
  });
});
