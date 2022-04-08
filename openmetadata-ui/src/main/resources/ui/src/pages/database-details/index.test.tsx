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
  id: '44d92cbd-65d3-4755-aaf9-b4bf01e0d822',
  name: 'shopify',
  fullyQualifiedName: 'bigquery.shopify',
  description: 'This **mock** database contains tables related to',
  href: 'http://localhost',
  service: {
    id: '451ccbeb-24d4-490d-891c-d00b5f18a13b',
    type: 'databaseService',
    name: 'bigquery',
    description: 'BigQuery service used for shopify data',
    href: 'http://localhost',
  },
};

const mockServiceData = {
  id: '451ccbeb-24d4-490d-891c-d00b5f18a13b',
  name: 'bigquery',
  serviceType: 'BigQuery',
  description: 'BigQuery service used for shopify data',
  href: 'http://localhost',
  jdbc: { driverClass: 'jdbc', connectionUrl: 'jdbc://localhost' },
};

const mockTableData = {
  data: [
    {
      id: 'b69fef11-3cbe-42fb-8303-9ac8e55629ba',
      name: 'dim_address',
      description:
        'This dimension table contains the billing and shipping addresses of customers',
      href: 'http://localhost:8585/',
      tableType: 'Regular',
      fullyQualifiedName: 'bigquery.shopify.dim_address',
      columns: [
        {
          name: 'address_id',
          columnDataType: 'NUMERIC',
          description: 'Unique identifier for the address.',
          fullyQualifiedName: 'bigquery.shopify.dim_address.address_id',
          tags: [],
          columnConstraint: 'PRIMARY_KEY',
          ordinalPosition: 1,
        },
      ],
      usageSummary: {
        dailyStats: { count: 100, percentileRank: 45 },
        weeklyStats: { count: 100, percentileRank: 45 },
        monthlyStats: { count: 100, percentileRank: 45 },
        date: '2021-09-20',
      },
      tags: [
        {
          labelType: 'Manual',
          state: 'Confirmed',
          tagFQN: 'PersonalData.Personal',
        },
      ],
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

jest.mock('../../axiosAPIs/tableAPI', () => ({
  getDatabaseTables: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockTableData })),
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
    const databaseTable = await findByTestId(container, 'database-tables');

    expect(pageContainer).toBeInTheDocument();
    expect(titleBreadcrumb).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(databaseTable).toBeInTheDocument();
  });

  it('Table and its header should render', async () => {
    const { container } = render(<DatabaseDetails />, {
      wrapper: MemoryRouter,
    });
    const databaseTable = await findByTestId(container, 'database-tables');
    const tableHeader = await findByTestId(container, 'table-header');
    const headerName = await findByTestId(container, 'header-name');
    const headerDescription = await findByTestId(
      container,
      'header-description'
    );
    const headerOwner = await findByTestId(container, 'header-owner');
    const headerUsage = await findByTestId(container, 'header-usage');
    const headerTags = await findByTestId(container, 'header-tags');
    const tableColumn = await findByTestId(container, 'tabale-column');

    expect(databaseTable).toBeInTheDocument();
    expect(tableHeader).toBeInTheDocument();
    expect(headerName).toBeInTheDocument();
    expect(headerDescription).toBeInTheDocument();
    expect(headerOwner).toBeInTheDocument();
    expect(headerUsage).toBeInTheDocument();
    expect(headerTags).toBeInTheDocument();
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
    const databaseTable = await findByTestId(container, 'database-tables');

    expect(pageContainer).toBeInTheDocument();
    expect(titleBreadcrumb).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(databaseTable).toBeInTheDocument();
  });
});
