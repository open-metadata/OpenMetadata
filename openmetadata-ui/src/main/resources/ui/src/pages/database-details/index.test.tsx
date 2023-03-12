/*
 *  Copyright 2022 Collate.
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
} from 'rest/databaseAPI';
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

const mockAllFeeds = {
  data: [
    {
      id: 'ac2e6128-9f23-4f28-acf8-31d50b06f8cc',
      type: 'Task',
      href: 'http://localhost:8585/api/v1/feed/ac2e6128-9f23-4f28-acf8-31d50b06f8cc',
      threadTs: 1664445686074,
      about: '<#E::table::sample_data.ecommerce_db.shopify.raw_order::tags>',
      entityId: 'c514ca18-2ea4-44b1-aa06-0c66bc0cd355',
      createdBy: 'bharatdussa',
      updatedAt: 1664445691373,
      updatedBy: 'bharatdussa',
      resolved: false,
      message: 'Update tags for table',
      postsCount: 1,
      posts: [
        {
          id: 'd497bea2-0bfe-4a9f-9ce6-d560129fef4a',
          message: 'Resolved the Task with Tag(s) - PersonalData.Personal',
          postTs: 1664445691368,
          from: 'bharatdussa',
          reactions: [],
        },
      ],
      reactions: [],
      task: {
        id: 11,
        type: 'UpdateTag',
        assignees: [
          {
            id: 'f187364d-114c-4426-b941-baf6a15f70e4',
            type: 'user',
            name: 'bharatdussa',
            fullyQualifiedName: 'bharatdussa',
            displayName: 'Bharat Dussa',
            deleted: false,
          },
        ],
        status: 'Closed',
        closedBy: 'bharatdussa',
        closedAt: 1664445691340,
        oldValue:
          '[{"tagFQN":"PersonalData.Personal","description":"","source":"Classification","labelType":"Manual","state":"Suggested"},]',
        suggestion:
          '[{"tagFQN":"PersonalData.Personal","description":"","source":"Classification","labelType":"Manual","state":"Suggested"},]',
        newValue:
          '[{"tagFQN":"PersonalData.Personal","description":"","source":"Classification","labelType":"Manual","state":"Suggested"},]',
      },
    },
  ],
  paging: { after: 'MTY2NDQ0NDcyODY1MA==', total: 134 },
};

const mockFeedCount = {
  totalCount: 6,
  counts: [
    {
      count: 3,
      entityLink:
        '<#E::table::sample_data.ecommerce_db.shopify.raw_order::columns::comments::tags>',
    },
    {
      count: 1,
      entityLink:
        '<#E::table::sample_data.ecommerce_db.shopify.raw_order::owner>',
    },
    {
      count: 1,
      entityLink:
        '<#E::table::sample_data.ecommerce_db.shopify.raw_order::tags>',
    },
    {
      count: 1,
      entityLink:
        '<#E::table::sample_data.ecommerce_db.shopify.raw_order::description>',
    },
  ],
};

jest.mock('components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockReturnValue({
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

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockImplementation(({ markdown }) => <p>{markdown}</p>);
});

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

jest.mock('rest/databaseAPI', () => ({
  getDatabaseDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDatabase)),
  patchDatabaseDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDatabase)),

  getDatabaseSchemas: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockSchemaData)),
}));

jest.mock('rest/feedsAPI', () => ({
  getAllFeeds: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockAllFeeds)),
  getFeedCount: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockFeedCount)),

  postFeedById: jest.fn().mockImplementation(() => Promise.resolve({})),

  postThread: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('components/containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div data-testid="PageContainer">{children}</div>
    ));
});

jest.mock('rest/serviceAPI', () => ({
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

jest.mock('../../utils/CommonUtils', () => ({
  getCurrentUserId: jest
    .fn()
    .mockReturnValue('5d5ca778-8bee-4ea0-bcb6-b17d92f7ef96'),
  isEven: jest.fn().mockReturnValue(true),
  getEntityName: jest.fn().mockReturnValue('entityname'),
}));

jest.mock('components/Tag/Tags/tags', () => {
  return jest.fn().mockReturnValue(<span>Tag</span>);
});

jest.mock('components/common/next-previous/NextPrevious', () => {
  return jest.fn().mockReturnValue(<div>NextPrevious</div>);
});

jest.mock(
  'components/common/title-breadcrumb/title-breadcrumb.component',
  () => {
    return jest.fn().mockReturnValue(<div>TitleBreadcrumb</div>);
  }
);

jest.mock('components/common/TabsPane/TabsPane', () => {
  return jest.fn().mockReturnValue(<div>TabsPane</div>);
});

jest.mock('components/FeedEditor/FeedEditor', () => {
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
  'components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(<p>ModalWithMarkdownEditor</p>),
  })
);

jest.mock('components/common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
});

jest.mock('components/common/EntitySummaryDetails/EntitySummaryDetails', () => {
  return jest
    .fn()
    .mockReturnValue(
      <p data-testid="entity-summary-details">EntitySummaryDetails component</p>
    );
});

jest.mock('components/common/DeleteWidget/DeleteWidgetModal', () => {
  return jest
    .fn()
    .mockReturnValue(
      <p data-testid="delete-entity">DeleteWidgetModal component</p>
    );
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
    const headerName = await findByText(container, 'label.schema-name');
    const headerDescription = await findByText(
      databaseTable,
      'label.description'
    );
    const headerOwner = await findByText(container, 'label.owner');
    const headerUsage = await findByText(container, 'label.usage');

    expect(databaseTable).toBeInTheDocument();
    expect(headerName).toBeInTheDocument();
    expect(headerDescription).toBeInTheDocument();
    expect(headerOwner).toBeInTheDocument();
    expect(headerUsage).toBeInTheDocument();
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
