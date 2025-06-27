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
import { ColumnsType } from 'antd/lib/table';
import React from 'react';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { PIPELINE_SERVICE_PLATFORM } from '../../../constants/Services.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { PipelineServiceType } from '../../../generated/entity/data/pipeline';
import LimitWrapper from '../../../hoc/LimitWrapper';
import Services from './Services';

let isDescription = true;

const mockService = {
  name: ServiceCategory.PIPELINE_SERVICES,
  serviceType: PipelineServiceType.Airbyte,
};

const services = [
  {
    name: ServiceCategory.DATABASE_SERVICES,
    header: PAGE_HEADERS.DATABASES_SERVICES,
  },
  {
    name: ServiceCategory.DASHBOARD_SERVICES,
    header: PAGE_HEADERS.DASHBOARD_SERVICES,
  },
  {
    name: ServiceCategory.MESSAGING_SERVICES,
    header: PAGE_HEADERS.MESSAGING_SERVICES,
  },
  {
    name: ServiceCategory.METADATA_SERVICES,
    header: PAGE_HEADERS.METADATA_SERVICES,
  },
  {
    name: ServiceCategory.ML_MODEL_SERVICES,
    header: PAGE_HEADERS.ML_MODELS_SERVICES,
  },
  {
    name: ServiceCategory.PIPELINE_SERVICES,
    header: PAGE_HEADERS.PIPELINES_SERVICES,
  },
  {
    name: ServiceCategory.SEARCH_SERVICES,
    header: PAGE_HEADERS.SEARCH_SERVICES,
  },
  {
    name: ServiceCategory.STORAGE_SERVICES,
    header: PAGE_HEADERS.STORAGE_SERVICES,
  },
];

const mockGetServicesData = [
  {
    id: '518dea5f-28b7-4c3d-a4ef-4b1791e41d47',
    name: 'Glue',
    fullyQualifiedName: 'Glue',
    serviceType: 'Glue',
    connection: {
      config: {
        type: 'Glue',
        awsConfig: {
          awsAccessKeyId: 'aws accessKey id',
          awsSecretAccessKey: '*********',
          awsRegion: 'aws region',
          endPointURL: 'https://glue.region_name.amazonaws.com/',
          assumeRoleSessionName: 'OpenMetadataSession',
        },
        supportsMetadataExtraction: true,
        supportsDBTExtraction: true,
      },
    },
    version: 0.1,
    updatedAt: 1708326433711,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/services/databaseServices/518dea5f-28b7-4c3d-a4ef-4b1791e41d47',
    deleted: false,
  },
];

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
  }),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    paging: {},
    pageSize: 10,
    showPagination: true,
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
  }),
}));

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockImplementation(() => ({
      isFetchingStatus: false,
      isAirflowAvailable: true,
      fetchAirflowStatus: jest.fn(),
      platform: PIPELINE_SERVICE_PLATFORM,
    })),
  })
);

jest.mock('../../../utils/CommonUtils', () => ({
  getServiceLogo: jest.fn().mockReturnValue('Pipeline Service'),
}));

const mockSearchService = jest.fn();
jest.mock('../../../rest/serviceAPI', () => ({
  getServices: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockGetServicesData)),
  searchService: mockSearchService,
}));

jest.mock('../../../utils/StringsUtils', () => ({
  ...jest.requireActual('../../../utils/StringsUtils'),
  stringToHTML: jest.fn((text) => text),
}));

jest.mock('../../../utils/EntityUtils', () => {
  const actual = jest.requireActual('../../../utils/EntityUtils');

  return {
    ...actual,
    getEntityName: jest.fn().mockReturnValue('Glue'),
    highlightSearchText: jest.fn((text) => text),
  };
});

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../utils/ServiceUtils', () => ({
  getOptionalFields: jest.fn(),
  getResourceEntityFromServiceCategory: jest.fn(),
  getServiceTypesFromServiceCategory: jest.fn(),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return () => <div data-testid="error-placeholder">ErrorPlaceHolder</div>;
});

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <p>OwnerLabel</p>),
}));

jest.mock('../../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue([
    {
      title: 'label.owner-plural',
      dataIndex: 'owners',
      key: 'owners',
      width: 180,
      render: () => <div>OwnerLabel</div>,
    },
  ]),
}));

jest.mock('../../common/ListView/ListView.component', () => ({
  ListView: jest.fn().mockImplementation(({ cardRenderer, tableProps }) => (
    <div data-testid="mocked-list-view">
      <div data-testid="card-renderer-container">
        {cardRenderer({
          ...mockService,
          description: isDescription ? 'test description' : '',
        })}
      </div>
      <div data-testid="table-props-container">
        {tableProps.columns.map(
          (column: ColumnsType[0], key: string) =>
            column.render && (
              <>
                <div key={key}>{column.title}</div>
                <div key={key}>{column.render(column.title, column, 1)}</div>
              </>
            )
        )}
      </div>
    </div>
  )),
}));

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest
    .fn()
    .mockReturnValue(
      <div data-testid="RichTextPreviewer">RichTextPreviewer</div>
    );
});

jest.mock(
  '../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="button-skeleton">ButtonSkeleton</div>
      ))
);

jest.mock('../../Database/ColumnFilter/ColumnFilter.component', () => ({
  __esModule: true,

  default: jest.fn().mockImplementation(() => <p>ColumnFilter</p>),
}));

jest.mock('../../PageHeader/PageHeader.component', () =>
  jest
    .fn()
    .mockImplementation(({ data = ServiceCategory.PIPELINE_SERVICES }) => (
      <div>
        PageHeader
        <p data-testid="page-header">{data.header}</p>
        <p data-testid="page-subHeader">{data.subHeader}</p>
      </div>
    ))
);

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),

  Tooltip: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));
const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
}));

jest.mock('../../../hoc/LimitWrapper', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => <>LimitWrapper{children}</>);
});

describe('Services', () => {
  it('should render Services', async () => {
    await act(async () => {
      render(<Services serviceName={ServiceCategory.PIPELINE_SERVICES} />);
    });

    expect(await screen.findByTestId('services-container')).toBeInTheDocument();
    expect(await screen.findByTestId('header')).toBeInTheDocument();
  });

  services.map((service) => {
    it(`should renders ${service.name} heading and subheading`, async () => {
      await act(async () => {
        render(<Services serviceName={service.name} />);
      });

      expect(await screen.findByText('PageHeader')).toBeInTheDocument();
      expect(
        await screen.findByText(service.header.header)
      ).toBeInTheDocument();
      expect(
        await screen.findByText(service.header.subHeader)
      ).toBeInTheDocument();
    });
  });

  it('should render add service skeleton loader while airflow status is not fetching', async () => {
    await act(async () => {
      render(<Services serviceName={ServiceCategory.PIPELINE_SERVICES} />);
    });

    expect(await screen.findByTestId('add-service-button')).toBeInTheDocument();

    expect(LimitWrapper).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'dataAssets' }),
      {}
    );
  });

  it('should call mock push add service skeleton loader while airflow status is not fetching', async () => {
    await act(async () => {
      render(<Services serviceName={ServiceCategory.PIPELINE_SERVICES} />);
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId('add-service-button'));
    });

    expect(mockPush).toHaveBeenCalledWith('/pipelineServices/add-service');
  });

  it('should render columns', async () => {
    await act(async () => {
      render(<Services serviceName={ServiceCategory.PIPELINE_SERVICES} />);
    });

    expect(
      await screen.findByTestId('card-renderer-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('table-props-container')
    ).toBeInTheDocument();
    expect(await screen.findByText('label.name')).toBeInTheDocument();
    expect(
      await screen.findByTestId('service-name-pipelineServices')
    ).toHaveTextContent('Glue');

    expect(await screen.findByText('label.owner-plural')).toBeInTheDocument();
    expect(await screen.findByText('OwnerLabel')).toBeInTheDocument();
  });

  it('should render service card with description', async () => {
    render(<Services serviceName={ServiceCategory.PIPELINE_SERVICES} />);

    expect(await screen.findByTestId('service-card')).toBeInTheDocument();
    expect(
      await screen.findByTestId('service-name-pipelineServices')
    ).toHaveTextContent('Glue');
    expect(await screen.findByTestId('service-description')).toHaveTextContent(
      'RichTextPreviewer'
    );
    expect(await screen.findByTestId('service-type')).toHaveTextContent(
      'Airbyte'
    );
  });

  it('should render service card without description', async () => {
    isDescription = false;
    render(<Services serviceName={ServiceCategory.PIPELINE_SERVICES} />);

    expect(await screen.findByTestId('service-card')).toBeInTheDocument();

    expect(await screen.findByTestId('service-description')).toHaveTextContent(
      'label.no-description'
    );
  });
});
