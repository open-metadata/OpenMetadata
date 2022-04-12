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

import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import {
  getDatabaseDetailsByFQN,
  patchDatabaseDetails,
} from '../../axiosAPIs/databaseAPI';
import DatabaseDetails from './';

const mockDatabase = {
  id: 'b705cc69-55fd-4338-aa45-86f34b655ae6',
  type: 'database',
  name: 'bigquery_gcp.ecommerce_db',
  description:
    'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
  deleted: false,
  href: 'http://localhost:8585/api/v1/databases/b705cc69-55fd-4338-aa45-86f34b655ae6',

  service: {
    id: 'bc13e95f-83ac-458a-9528-f4ca26657568',
    type: 'databaseService',
    name: 'bigquery_gcp',
    description: '',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/databaseServices/bc13e95f-83ac-458a-9528-f4ca26657568',
  },
};

const mockServiceData = {
  id: 'bc13e95f-83ac-458a-9528-f4ca26657568',
  type: 'databaseService',
  name: 'bigquery_gcp',
  description: '',
  deleted: false,
  href: 'http://localhost:8585/api/v1/services/databaseServices/bc13e95f-83ac-458a-9528-f4ca26657568',
  jdbc: { driverClass: 'jdbc', connectionUrl: 'jdbc://localhost' },
};

const mockSchemaData = {
  data: [
    {
      id: 'ed2c5f5e-e0d7-4b90-9efe-d50b3ecd645f',
      name: 'shopify',
      fullyQualifiedName: 'bigquery_gcp.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      version: 0.1,
      updatedAt: 1649411380854,
      updatedBy: 'anonymous',
      href: 'http://localhost:8585/api/v1/databases/ed2c5f5e-e0d7-4b90-9efe-d50b3ecd645f',
      service: {
        id: 'bc13e95f-83ac-458a-9528-f4ca26657568',
        type: 'databaseService',
        name: 'bigquery_gcp',
        description: '',
        deleted: false,
        href: 'http://localhost:8585/api/v1/services/databaseServices/bc13e95f-83ac-458a-9528-f4ca26657568',
      },
      serviceType: 'BigQuery',
      database: {
        id: 'b705cc69-55fd-4338-aa45-86f34b655ae6',
        type: 'database',
        name: 'bigquery_gcp.ecommerce_db',
        description:
          'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/databases/b705cc69-55fd-4338-aa45-86f34b655ae6',
      },
      usageSummary: {
        dailyStats: {
          count: 0,
          percentileRank: 0,
        },
        weeklyStats: {
          count: 0,
          percentileRank: 0,
        },
        monthlyStats: {
          count: 0,
          percentileRank: 0,
        },
        date: '2022-04-08',
      },
      deleted: false,
    },
  ],
  paging: { after: 'ZMbpLOqQQsREk_7DmEOr', total: 12 },
};

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock(
  '../../components/common/rich-text-editor/RichTextEditorPreviewer',
  () => {
    return jest.fn().mockImplementation(({ markdown }) => <p>{markdown}</p>);
  }
);

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    databaseFQN: 'bigquery.shopify',
  }),
}));

jest.mock('../../AppState', () => {
  return jest.fn().mockReturnValue({
    inPageSearchText: '',
  });
});

jest.mock('../../axiosAPIs/databaseAPI', () => ({
  getDatabaseDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockDatabase })),
  patchDatabaseDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockDatabase })),

  getDatabaseSchemas: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockSchemaData })),
}));

jest.mock('../../components/containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div data-testid="PageContainer">{children}</div>
    ));
});

jest.mock('../../axiosAPIs/serviceAPI', () => ({
  getServiceById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockServiceData })),
}));

jest.mock('../../utils/TableUtils', () => ({
  getOwnerFromId: jest.fn().mockReturnValue({
    name: 'owner',
    id: 'string',
    type: 'user',
  }),
  getUsagePercentile: jest.fn().mockReturnValue('Medium - 45th pctile'),
}));

jest.mock('../../components/common/popover/PopOver', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div data-testid="popover">{children}</div>
    ));
});

jest.mock('../../utils/CommonUtils', () => ({
  getCurrentUserId: jest
    .fn()
    .mockReturnValue('5d5ca778-8bee-4ea0-bcb6-b17d92f7ef96'),
  isEven: jest.fn().mockReturnValue(true),
}));

jest.mock('../../components/tags/tags', () => {
  return jest.fn().mockReturnValue(<span>Tag</span>);
});

jest.mock('../../components/common/next-previous/NextPrevious', () => {
  return jest.fn().mockReturnValue(<div>NextPrevious</div>);
});

jest.mock(
  '../../components/common/title-breadcrumb/title-breadcrumb.component',
  () => {
    return jest.fn().mockReturnValue(<div>TitleBreadcrumb</div>);
  }
);

jest.mock('../../components/common/TabsPane/TabsPane', () => {
  return jest.fn().mockReturnValue(<div>TabsPane</div>);
});

jest.mock('../../components/FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor</p>);
});

jest.mock('../../utils/TagsUtils', () => ({
  getTableTags: jest.fn().mockReturnValue([
    {
      labelType: 'Manual',
      state: 'Confirmed',
      tagFQN: 'PersonalData.Personal',
    },
  ]),
}));

jest.mock(
  '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(<p>ModalWithMarkdownEditor</p>),
  })
);

jest.mock('../../components/common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
});

const mockObserve = jest.fn();
const mockunObserve = jest.fn();

window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockunObserve,
}));

describe('Test DatabaseDetails page', () => {
  it('Component should render', async () => {
    const { container } = render(<DatabaseDetails />, {
      wrapper: MemoryRouter,
    });

    const pageContainer = await findByTestId(container, 'page-container');
    const titleBreadcrumb = await findByText(container, /TitleBreadcrumb/i);
    const descriptionContainer = await findByTestId(
      container,
      'description-container'
    );
    const databaseTable = await findByTestId(
      container,
      'database-databaseSchemas'
    );

    expect(pageContainer).toBeInTheDocument();
    expect(titleBreadcrumb).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(databaseTable).toBeInTheDocument();
  });

  it('Table and its header should render', async () => {
    const { container } = render(<DatabaseDetails />, {
      wrapper: MemoryRouter,
    });
    const databaseTable = await findByTestId(
      container,
      'database-databaseSchemas'
    );
    const tableHeader = await findByTestId(container, 'table-header');
    const headerName = await findByTestId(container, 'header-name');
    const headerDescription = await findByTestId(
      container,
      'header-description'
    );
    const headerOwner = await findByTestId(container, 'header-owner');
    const headerUsage = await findByTestId(container, 'header-usage');
    const tableColumn = await findByTestId(container, 'tabale-column');

    expect(databaseTable).toBeInTheDocument();
    expect(tableHeader).toBeInTheDocument();
    expect(headerName).toBeInTheDocument();
    expect(headerDescription).toBeInTheDocument();
    expect(headerOwner).toBeInTheDocument();
    expect(headerUsage).toBeInTheDocument();
    expect(tableColumn).toBeInTheDocument();
  });

  it('Should render error placeholder if getDatabase Details Api fails', async () => {
    (getDatabaseDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: {
            message: 'Error!',
          },
        },
      })
    );
    const { container } = render(<DatabaseDetails />, {
      wrapper: MemoryRouter,
    });

    const errorPlaceholder = await findByTestId(container, 'error');

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('Should render database component if patchDatabaseDetails Api fails', async () => {
    (patchDatabaseDetails as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: {
            message: 'Error!',
          },
        },
      })
    );
    const { container } = render(<DatabaseDetails />, {
      wrapper: MemoryRouter,
    });

    const pageContainer = await findByTestId(container, 'page-container');
    const titleBreadcrumb = await findByText(container, /TitleBreadcrumb/i);
    const descriptionContainer = await findByTestId(
      container,
      'description-container'
    );
    const databaseTable = await findByTestId(
      container,
      'database-databaseSchemas'
    );

    expect(pageContainer).toBeInTheDocument();
    expect(titleBreadcrumb).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(databaseTable).toBeInTheDocument();
  });
});
