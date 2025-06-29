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
} from '../../rest/databaseAPI';
import DatabaseDetailsPage from './DatabaseDetailsPage';

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

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
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

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => {
    return jest.fn().mockImplementation(({ markdown }) => <p>{markdown}</p>);
  }
);

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ search: '?schema=sales' }));
});

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
  useParams: jest.fn().mockReturnValue({
    fqn: 'bigquery.shopify',
  }),
  useNavigate: jest.fn(),
}));

jest.mock(
  '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      postFeed: jest.fn(),
      deleteFeed: jest.fn(),
      updateFeed: jest.fn(),
    })),
    __esModule: true,
    default: 'ActivityFeedProvider',
  })
);

jest.mock('../../rest/databaseAPI', () => ({
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

jest.mock('../../rest/feedsAPI', () => ({
  getFeedCount: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockFeedCount)),
  postThread: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../utils/TableUtils', () => ({
  getUsagePercentile: jest.fn().mockReturnValue('Medium - 45th pctile'),
  getTierTags: jest.fn().mockImplementation(() => ({})),
  getTagsWithoutTier: jest.fn().mockImplementation(() => []),
  getTableExpandableConfig: jest.fn().mockReturnValue({}),
}));

jest.mock('../../components/common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockReturnValue(<div>NextPrevious</div>);
});

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockReturnValue(<div>TagsContainerV2</div>);
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
jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => {
  return jest
    .fn()
    .mockImplementation(({ name, id }) => <div data-testid={id}>{name}</div>);
});

jest.mock(
  '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(<p>ModalWithMarkdownEditor</p>),
  })
);

jest.mock('../../components/common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => {
    return jest.fn().mockReturnValue(<p>ActivityFeedTab</p>);
  }
);

jest.mock(
  '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel',
  () => {
    return jest.fn().mockReturnValue(<p>ActivityThreadPanel</p>);
  }
);
jest.mock(
  '../../components/common/SearchBarComponent/SearchBar.component',
  () => {
    return jest.fn().mockReturnValue(<p>Searchbar.component</p>);
  }
);

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(() => <p>DataAssetsHeader</p>),
  })
);

jest.mock('../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((Some) => Some),
}));

jest.mock(
  '../../components/Database/DatabaseSchema/DatabaseSchemaTable/DatabaseSchemaTable',
  () => ({
    DatabaseSchemaTable: jest
      .fn()
      .mockImplementation(() => <>testDatabaseSchemaTable</>),
  })
);

describe('Test DatabaseDetails page', () => {
  it('Component should render', async () => {
    const { container } = render(<DatabaseDetailsPage />, {
      wrapper: MemoryRouter,
    });

    const entityHeader = await findByText(container, 'DataAssetsHeader');
    const descriptionContainer = await findByText(container, 'Description');
    const databaseTable = await findByText(
      container,
      'testDatabaseSchemaTable'
    );

    expect(getDatabaseDetailsByFQN).toHaveBeenCalledWith('bigquery.shopify', {
      fields: 'owners,tags,domain,votes,extension,dataProducts,followers',
      include: 'all',
    });
    expect(entityHeader).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(databaseTable).toBeInTheDocument();
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
    const { container } = render(<DatabaseDetailsPage />, {
      wrapper: MemoryRouter,
    });

    const errorPlaceholder = await findByTestId(
      container,
      'no-data-placeholder'
    );

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
    const { container } = render(<DatabaseDetailsPage />, {
      wrapper: MemoryRouter,
    });

    const entityHeader = await findByText(container, 'DataAssetsHeader');
    const descriptionContainer = await findByText(container, 'Description');
    const databaseTable = await findByText(
      container,
      'testDatabaseSchemaTable'
    );

    expect(entityHeader).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(databaseTable).toBeInTheDocument();
  });
});
