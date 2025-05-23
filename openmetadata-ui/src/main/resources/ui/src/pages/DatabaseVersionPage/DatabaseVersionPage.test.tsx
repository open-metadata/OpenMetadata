/*
 *  Copyright 2024 Collate.
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
import { EntityTabs } from '../../enums/entity.enum';
import DatabaseVersionPage from './DatabaseVersionPage';

const ERROR_PLACEHOLDER = 'ErrorPlaceHolder';
const DATA_ASSET_VERSION_HEADER = 'DataAssetVersionHeader';
const CUSTOM_PROPERTY_TABLE = 'CustomPropertyTable';
const DATA_PRODUCT_CONTAINER = 'DataProductsContainer';
const ENTITY_VERSION_TIMELINE = 'EntityVersionTimeLine';
const DESCRIPTION_V1 = 'DescriptionV1';
const DATABASE_SCHEMA_TABLE = 'DatabaseSchemaTable';
const TAGS_CONTAINER_V2 = 'TagsContainerV2';
const CUSTOM_PROPERTY_TAB_NAME = 'label.custom-property-plural';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(() => ({
    version: '1.2',
    tab: EntityTabs.SCHEMA,
  })),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock(
  '../../components/common/CustomPropertyTable/CustomPropertyTable',
  () => ({
    CustomPropertyTable: jest
      .fn()
      .mockImplementation(() => <div>{CUSTOM_PROPERTY_TABLE}</div>),
  })
);

jest.mock('../../components/common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockImplementation(() => <div>{DESCRIPTION_V1}</div>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>{ERROR_PLACEHOLDER}</div>)
);

jest.mock(
  '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () =>
    jest
      .fn()
      .mockImplementation(({ onVersionClick }) => (
        <button onClick={onVersionClick}>{DATA_ASSET_VERSION_HEADER}</button>
      ))
);

jest.mock(
  '../../components/Database/DatabaseSchema/DatabaseSchemaTable/DatabaseSchemaTable',
  () => ({
    DatabaseSchemaTable: jest
      .fn()
      .mockImplementation(() => <>{DATABASE_SCHEMA_TABLE}</>),
  })
);

jest.mock(
  '../../components/DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => jest.fn().mockImplementation(() => <div>{DATA_PRODUCT_CONTAINER}</div>)
);

jest.mock(
  '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine',
  () =>
    jest
      .fn()
      .mockImplementation(({ versionHandler }) => (
        <button onClick={versionHandler}>{ENTITY_VERSION_TIMELINE}</button>
      ))
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

const mockGetEntityPermissionByFqn = jest.fn().mockReturnValue({
  ViewAll: true,
});

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn(() => mockGetEntityPermissionByFqn()),
  }),
}));

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(() => <div>{TAGS_CONTAINER_V2}</div>)
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: 'mockFQN' })),
}));

const mockGetDatabaseDetailsByFQN = jest
  .fn()
  .mockResolvedValue({ id: 'database id' });
const mockGetDatabaseVersionData = jest.fn().mockResolvedValue({});
const mockGetDatabaseVersions = jest.fn().mockResolvedValue({});

jest.mock('../../rest/databaseAPI', () => ({
  getDatabaseDetailsByFQN: jest.fn(() => mockGetDatabaseDetailsByFQN()),
  getDatabaseVersionData: jest.fn(() => mockGetDatabaseVersionData()),
  getDatabaseVersions: jest.fn(() => mockGetDatabaseVersions()),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
}));

jest.mock('../../utils/EntityVersionUtils', () => ({
  getBasicEntityInfoFromVersionData: jest.fn().mockReturnValue({}),
  getCommonDiffsFromVersionData: jest.fn().mockReturnValue({}),
  getCommonExtraInfoForVersionDetails: jest.fn().mockReturnValue({}),
}));

describe('DatabaseVersionPage', () => {
  it('should render all necessary components', async () => {
    await act(async () => {
      render(<DatabaseVersionPage />);
    });

    expect(screen.getByText(DATA_ASSET_VERSION_HEADER)).toBeInTheDocument();
    expect(screen.getByText(DESCRIPTION_V1)).toBeInTheDocument();
    expect(screen.getByText(DATABASE_SCHEMA_TABLE)).toBeInTheDocument();
    expect(screen.getByText(DATA_PRODUCT_CONTAINER)).toBeInTheDocument();
    expect(screen.getAllByText(TAGS_CONTAINER_V2)).toHaveLength(2);
    expect(screen.getByText(ENTITY_VERSION_TIMELINE)).toBeInTheDocument();
  });

  it('tab change, version handler, back handler should work', async () => {
    await act(async () => {
      render(<DatabaseVersionPage />);
    });

    // for tab change
    fireEvent.click(
      screen.getByRole('tab', {
        name: CUSTOM_PROPERTY_TAB_NAME,
      })
    );

    expect(screen.getByText(CUSTOM_PROPERTY_TABLE)).toBeInTheDocument();

    // for back handler
    fireEvent.click(
      screen.getByRole('button', {
        name: DATA_ASSET_VERSION_HEADER,
      })
    );

    // for version handler
    fireEvent.click(
      screen.getByRole('button', {
        name: ENTITY_VERSION_TIMELINE,
      })
    );

    expect(mockNavigate).toHaveBeenCalledTimes(3);
  });

  it('should show ErrorPlaceHolder if not have view permission', async () => {
    mockGetEntityPermissionByFqn.mockResolvedValueOnce({});

    await act(async () => {
      render(<DatabaseVersionPage />);
    });

    expect(screen.getByText(ERROR_PLACEHOLDER)).toBeInTheDocument();
  });
});
