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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { tableVersionMockProps } from '../../mocks/TableVersion.mock';
import TableVersion from './TableVersion.component';

const mockPush = jest.fn();

jest.mock(
  'components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="DataAssetsVersionHeader">DataAssetsVersionHeader</div>
      ))
);

jest.mock('components/TabsLabel/TabsLabel.component', () =>
  jest
    .fn()
    .mockImplementation(({ name }) => (
      <div data-testid={`TabsLabel-${name}`}>{name}</div>
    ))
);

jest.mock('components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="TagsContainerV2">TagsContainerV2</div>
    ))
);

jest.mock('components/common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="CustomPropertyTable">CustomPropertyTable</div>
    )),
}));

jest.mock('components/common/description/DescriptionV1', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="DescriptionV1">DescriptionV1</div>
    ))
);

jest.mock('components/common/error-with-placeholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="ErrorPlaceHolder">ErrorPlaceHolder</div>
    ))
);

jest.mock('components/EntityVersionTimeLine/EntityVersionTimeLine', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="EntityVersionTimeLine">EntityVersionTimeLine</div>
    ))
);

jest.mock('components/VersionTable/VersionTable.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="VersionTable">VersionTable</div>
    ))
);

jest.mock('components/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="Loader">Loader</div>)
);

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  useParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
}));

describe('TableVersion tests', () => {
  it('Component should render properly when not loading', async () => {
    await act(async () => {
      render(<TableVersion {...tableVersionMockProps} />);
    });

    const dataAssetsVersionHeader = screen.getByTestId(
      'DataAssetsVersionHeader'
    );
    const description = screen.getByTestId('DescriptionV1');
    const schemaTabLabel = screen.getByTestId('TabsLabel-label.schema');
    const customPropertyTabLabel = screen.getByTestId(
      'TabsLabel-label.custom-property-plural'
    );
    const entityVersionTimeLine = screen.getByTestId('EntityVersionTimeLine');
    const versionTable = screen.getByTestId('VersionTable');

    expect(dataAssetsVersionHeader).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(schemaTabLabel).toBeInTheDocument();
    expect(customPropertyTabLabel).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(versionTable).toBeInTheDocument();
  });

  it('Only loader should be visible when the isVersionLoading is true', async () => {
    await act(async () => {
      render(<TableVersion {...tableVersionMockProps} isVersionLoading />);
    });

    const loader = screen.getByTestId('Loader');
    const entityVersionTimeLine = screen.getByTestId('EntityVersionTimeLine');
    const dataAssetsVersionHeader = screen.queryByTestId(
      'DataAssetsVersionHeader'
    );
    const schemaTabLabel = screen.queryByTestId('TabsLabel-label.schema');
    const customPropertyTabLabel = screen.queryByTestId(
      'TabsLabel-label.custom-property-plural'
    );
    const versionTable = screen.queryByTestId('VersionTable');

    expect(loader).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(dataAssetsVersionHeader).toBeNull();
    expect(schemaTabLabel).toBeNull();
    expect(customPropertyTabLabel).toBeNull();
    expect(versionTable).toBeNull();
  });

  it('Only error placeholder should be displayed in case of no view permissions', async () => {
    await act(async () => {
      render(
        <TableVersion
          {...tableVersionMockProps}
          entityPermissions={DEFAULT_ENTITY_PERMISSION}
        />
      );
    });

    const errorPlaceHolder = screen.getByTestId('ErrorPlaceHolder');
    const loader = screen.queryByTestId('Loader');
    const dataAssetsVersionHeader = screen.queryByTestId(
      'DataAssetsVersionHeader'
    );
    const schemaTabLabel = screen.queryByTestId('TabsLabel-label.schema');
    const customPropertyTabLabel = screen.queryByTestId(
      'TabsLabel-label.custom-property-plural'
    );
    const entityVersionTimeLine = screen.queryByTestId('EntityVersionTimeLine');
    const versionTable = screen.queryByTestId('VersionTable');

    expect(errorPlaceHolder).toBeInTheDocument();
    expect(loader).toBeNull();
    expect(entityVersionTimeLine).toBeNull();
    expect(dataAssetsVersionHeader).toBeNull();
    expect(schemaTabLabel).toBeNull();
    expect(customPropertyTabLabel).toBeNull();
    expect(versionTable).toBeNull();
  });

  it('New path should be pushed to the history object on click of customProperty tab', async () => {
    await act(async () => {
      render(<TableVersion {...tableVersionMockProps} />);
    });

    const customPropertyTabLabel = screen.getByTestId(
      'TabsLabel-label.custom-property-plural'
    );
    const versionTable = screen.getByTestId('VersionTable');

    expect(customPropertyTabLabel).toBeInTheDocument();
    expect(versionTable).toBeInTheDocument();

    await act(async () => {
      userEvent.click(customPropertyTabLabel);
    });

    expect(mockPush).toHaveBeenCalledWith(
      '/table/sample_data.ecommerce_db.shopify.raw_product_catalog/versions/0.3/custom_properties'
    );
  });

  it('Custom property tab should show error placeholder in case of no "ViewAll" permission', async () => {
    await act(async () => {
      render(
        <TableVersion
          {...tableVersionMockProps}
          entityPermissions={{ ...DEFAULT_ENTITY_PERMISSION, ViewBasic: true }}
        />
      );
    });

    const customPropertyTabLabel = screen.getByTestId(
      'TabsLabel-label.custom-property-plural'
    );
    const versionTable = screen.getByTestId('VersionTable');
    let errorPlaceHolder = screen.queryByTestId('ErrorPlaceHolder');

    expect(customPropertyTabLabel).toBeInTheDocument();
    expect(versionTable).toBeInTheDocument();
    expect(errorPlaceHolder).toBeNull();

    await act(async () => {
      userEvent.click(customPropertyTabLabel);
    });

    errorPlaceHolder = screen.getByTestId('ErrorPlaceHolder');

    expect(errorPlaceHolder).toBeInTheDocument();
  });
});
