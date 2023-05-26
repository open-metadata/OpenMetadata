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

import {
  findByTestId,
  findByText,
  getByTestId,
  queryByText,
  render,
} from '@testing-library/react';
import { EntityTabs } from 'enums/entity.enum';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ModelType, Table } from '../../generated/entity/data/table';
import { Paging } from '../../generated/type/paging';
import DatasetDetails from './DatasetDetails.component';
import { DatasetDetailsProps } from './DatasetDetails.interface';

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('../common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<p data-testid="error">ErrorPlaceHolder</p>);
});

const mockUserTeam = [
  {
    description: 'description',
    displayName: 'displayName',
    href: 'href',
    id: 'id',
    name: 'name',
    type: 'type',
  },
  {
    description: 'description',
    displayName: 'displayName',
    href: 'href',
    id: 'id',
    name: 'name',
    type: 'type',
  },
];

const mockThreads = [
  {
    id: '465b2dfb-300e-45f5-a1a6-e19c6225e9e7',
    href: 'http://localhost:8585/api/v1/feed/465b2dfb-300e-45f5-a1a6-e19c6225e9e7',
    threadTs: 1647434125848,
    about: '<#E::table::bigquery_gcp.shopify.raw_product_catalog::description>',
    entityId: 'f1ebcfdf-d4b8-43bd-add2-1789e25ddde3',
    createdBy: 'aaron_johnson0',
    updatedAt: 1647434125848,
    updatedBy: 'anonymous',
    resolved: false,
    message: 'New thread.',
    postsCount: 0,
    posts: [],
    relativeDay: 'Today',
  },
  {
    id: '40c2faec-0159-4d86-9b15-c17f3e1c081b',
    href: 'http://localhost:8585/api/v1/feed/40c2faec-0159-4d86-9b15-c17f3e1c081b',
    threadTs: 1647411418056,
    about: '<#E::table::bigquery_gcp.shopify.raw_product_catalog::description>',
    entityId: 'f1ebcfdf-d4b8-43bd-add2-1789e25ddde3',
    createdBy: 'sachin.c',
    updatedAt: 1647434031435,
    updatedBy: 'anonymous',
    resolved: false,
    message: 'New thread.',
    postsCount: 0,
    posts: [],
    relativeDay: 'Today',
  },
];

const datasetDetailsProps: DatasetDetailsProps = {
  followTableHandler: jest.fn(),
  tableDetails: {
    columns: [],
    id: '',
    name: '',
  } as Table,
  tableProfile: {} as Table['profile'],
  unfollowTableHandler: jest.fn(),
  versionHandler: jest.fn(),
  entityThread: mockThreads,
  isEntityThreadLoading: false,
  postFeedHandler: jest.fn(),
  feedCount: 0,
  entityFieldThreadCount: [],
  entityFieldTaskCount: [],
  paging: {} as Paging,
  createThread: jest.fn(),
  deletePostHandler: jest.fn(),
  fetchFeedHandler: jest.fn(),
  updateThreadHandler: jest.fn(),
  onTableUpdate: jest.fn(),
};

const mockParams = {
  datasetFQN: 'test',
  tab: EntityTabs.SCHEMA,
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest.fn().mockReturnValue({ pathname: 'table' }),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../containers/PageContainerV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../EntityLineage/EntityLineage.component', () => {
  return jest.fn().mockReturnValue(<p data-testid="lineage">Lineage</p>);
});

jest.mock('../TableProfiler/TableProfilerV1', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="TableProfiler">TableProfiler</p>);
});

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
});

jest.mock('../SchemaTab/SchemaTab.component', () => {
  return jest.fn().mockReturnValue(<p>SchemaTab</p>);
});
jest.mock('../TableQueries/TableQueries', () => {
  return jest.fn().mockReturnValue(<p>TableQueries</p>);
});

jest.mock('../common/entityPageInfo/EntityPageInfo', () => {
  return jest.fn().mockReturnValue(<p>EntityPageInfo</p>);
});

jest.mock('../ActivityFeed/ActivityFeedList/ActivityFeedList.tsx', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedList</p>);
});

jest.mock('../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel.tsx', () => {
  return jest.fn().mockReturnValue(<p>Conversations</p>);
});
jest.mock('../ActivityFeed/ActivityFeedEditor/ActivityFeedEditor.tsx', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor</p>);
});
jest.mock('../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<p>CustomPropertyTable.component</p>),
}));

jest.mock('../SampleDataTable/SampleDataTable.component', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="sample-data">Sample Data</p>);
});
jest.mock('./DbtTab/DbtTab.component', () => {
  return jest.fn().mockReturnValue(<div>DbtTab.component</div>);
});

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCountBadge: jest.fn(),
  getCurrentUserId: jest.fn().mockReturnValue('CurrentUserId'),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  getUserTeams: () => mockUserTeam,
  getPartialNameFromTableFQN: jest.fn().mockReturnValue('xyz'),
  getEntityPlaceHolder: jest.fn().mockReturnValue('value'),
  getEntityName: jest.fn().mockReturnValue('entityName'),
  getEntityId: jest.fn().mockReturnValue('id-entity-test'),
  getOwnerValue: jest.fn().mockReturnValue('Owner'),
}));

jest.mock('../PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {},
    getEntityPermission: jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
      EditCustomFields: true,
      EditDataProfile: true,
      EditDescription: true,
      EditDisplayName: true,
      EditLineage: true,
      EditOwner: true,
      EditQueries: true,
      EditSampleData: true,
      EditTags: true,
      EditTests: true,
      EditTier: true,
      ViewAll: true,
      ViewDataProfile: true,
      ViewQueries: true,
      ViewSampleData: true,
      ViewTests: true,
      ViewUsage: true,
    }),
  })),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: {
    Create: true,
    Delete: true,
    EditAll: true,
    EditCustomFields: true,
    EditDataProfile: true,
    EditDescription: true,
    EditDisplayName: true,
    EditLineage: true,
    EditOwner: true,
    EditQueries: true,
    EditSampleData: true,
    EditTags: true,
    EditTests: true,
    EditTier: true,
    ViewAll: true,
    ViewDataProfile: true,
    ViewQueries: true,
    ViewSampleData: true,
    ViewTests: true,
    ViewUsage: true,
  },
}));

jest.mock('components/containers/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

describe('Test MyDataDetailsPage page', () => {
  it('Checks if the page has all the proper components rendered', async () => {
    const { container } = render(<DatasetDetails {...datasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });

    const relatedTables = getByTestId(container, 'related-tables-container');
    const EntityPageInfo = await findByText(container, /EntityPageInfo/i);
    const description = await findByText(container, /Description/i);
    const tabs = await findByTestId(container, 'tabs');
    const schemaTab = await findByText(tabs, 'label.schema');
    const activityFeedTab = await findByText(
      tabs,
      'label.activity-feed-and-task-plural'
    );
    const sampleDataTab = await findByText(tabs, 'label.sample-data');
    const queriesTab = await findByText(tabs, 'label.query-plural');
    const profilerTab = await findByText(
      tabs,
      'label.profiler-amp-data-quality'
    );
    const lineageTab = await findByText(tabs, 'label.lineage');
    const dbtTab = queryByText(tabs, 'label.dbt-lowercase');

    expect(relatedTables).toBeInTheDocument();
    expect(EntityPageInfo).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(schemaTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(sampleDataTab).toBeInTheDocument();
    expect(queriesTab).toBeInTheDocument();
    expect(profilerTab).toBeInTheDocument();
    expect(lineageTab).toBeInTheDocument();
    expect(dbtTab).not.toBeInTheDocument();
  });

  it('Check if active tab is schema', async () => {
    const { container } = render(<DatasetDetails {...datasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const schema = await findByText(container, /SchemaTab/i);

    expect(schema).toBeInTheDocument();
  });

  it('Check if active tab is activity feed', async () => {
    mockParams.tab = EntityTabs.ACTIVITY_FEED;
    const { container } = render(<DatasetDetails {...datasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const activityFeedList = await findByText(container, /ActivityFeedList/i);

    expect(activityFeedList).toBeInTheDocument();
  });

  it('Check if active tab is sample data', async () => {
    mockParams.tab = EntityTabs.SAMPLE_DATA;
    const { container } = render(<DatasetDetails {...datasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const sampleData = await findByTestId(container, 'sample-data');

    expect(sampleData).toBeInTheDocument();
  });

  it('Check if active tab is queries', async () => {
    mockParams.tab = EntityTabs.TABLE_QUERIES;
    const { container } = render(<DatasetDetails {...datasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const tableQueries = await findByText(container, 'TableQueries');

    expect(tableQueries).toBeInTheDocument();
  });

  it('Check if active tab is profiler', async () => {
    mockParams.tab = EntityTabs.PROFILER;
    const { container } = render(<DatasetDetails {...datasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const tableProfiler = await findByTestId(container, 'TableProfiler');

    expect(tableProfiler).toBeInTheDocument();
  });

  it('Check if active tab is lineage', async () => {
    mockParams.tab = EntityTabs.LINEAGE;
    const { container } = render(<DatasetDetails {...datasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const lineage = await findByTestId(container, 'lineage');

    expect(lineage).toBeInTheDocument();
  });

  it('Check if active tab is custom properties', async () => {
    mockParams.tab = EntityTabs.CUSTOM_PROPERTIES;
    const { container } = render(<DatasetDetails {...datasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const customProperties = await findByText(
      container,
      'CustomPropertyTable.component'
    );

    expect(customProperties).toBeInTheDocument();
  });

  it('Check if active tab is dbt', async () => {
    mockParams.tab = EntityTabs.DBT;
    const { container } = render(
      <DatasetDetails
        {...datasetDetailsProps}
        dataModel={{ sql: 'select * from table', modelType: ModelType.Dbt }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const dbtComponent = await findByText(container, 'DbtTab.component');

    expect(dbtComponent).toBeInTheDocument();
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    mockParams.tab = EntityTabs.ACTIVITY_FEED;
    const { container } = render(<DatasetDetails {...datasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();
  });
});
