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

import {
  findByTestId,
  findByText,
  getByTestId,
  queryByTestId,
  render,
} from '@testing-library/react';
import { LeafNodes, LoadingNodeState } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  ColumnJoins,
  Table,
  TableJoins,
  TableType,
  TypeUsedToReturnUsageDetailsOfAnEntity,
} from '../../generated/entity/data/table';
import { EntityLineage } from '../../generated/type/entityLineage';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import { DatasetTestModeType } from '../../interface/dataQuality.interface';
import DatasetDetails from './DatasetDetails.component';
import { DatasetOwner } from './DatasetDetails.interface';

jest.mock('../../auth-provider/AuthProvider', () => {
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

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
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
    about: '<#E/table/bigquery_gcp.shopify.raw_product_catalog/description>',
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
    about: '<#E/table/bigquery_gcp.shopify.raw_product_catalog/description>',
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

const DatasetDetailsProps = {
  activeTab: 1,
  columns: [],
  columnsUpdateHandler: jest.fn(),
  datasetFQN: '',
  description: '',
  descriptionUpdateHandler: jest.fn(),
  entityLineage: {} as EntityLineage,
  entityName: '',
  followers: [],
  followTableHandler: jest.fn(),
  joins: {
    columnJoins: [] as ColumnJoins[],
  } as TableJoins,
  owner: {} as DatasetOwner,
  sampleData: {},
  setActiveTabHandler: jest.fn(),
  settingsUpdateHandler: jest.fn(),
  slashedTableName: [],
  tableDetails: {} as Table,
  tableProfile: [],
  tableTags: [],
  tableType: TableType.Regular,
  tier: {} as TagLabel,
  unfollowTableHandler: jest.fn(),
  usageSummary: {} as TypeUsedToReturnUsageDetailsOfAnEntity,
  users: [],
  versionHandler: jest.fn(),
  loadNodeHandler: jest.fn(),
  lineageLeafNodes: {} as LeafNodes,
  isNodeLoading: {} as LoadingNodeState,
  addLineageHandler: jest.fn(),
  removeLineageHandler: jest.fn(),
  entityLineageHandler: jest.fn(),
  tableQueries: [],
  entityThread: mockThreads,
  isentityThreadLoading: false,
  postFeedHandler: jest.fn(),
  feedCount: 0,
  entityFieldThreadCount: [],
  showTestForm: false,
  testMode: 'table' as DatasetTestModeType,
  handleAddTableTestCase: jest.fn(),
  tableTestCase: [],
  selectedColumn: '',
  paging: {} as Paging,
  handleAddColumnTestCase: jest.fn(),
  handleSelectedColumn: jest.fn(),
  createThread: jest.fn(),
  handleShowTestForm: jest.fn(),
  handleRemoveTableTest: jest.fn(),
  handleRemoveColumnTest: jest.fn(),
  handleTestModeChange: jest.fn(),
  qualityTestFormHandler: jest.fn(),
  deletePostHandler: jest.fn(),
  tagUpdateHandler: jest.fn(),
  fetchFeedHandler: jest.fn(),
};
jest.mock('../ManageTab/ManageTab.component', () => {
  return jest.fn().mockReturnValue(<p data-testid="manage">ManageTab</p>);
});

jest.mock('../EntityLineage/EntityLineage.component', () => {
  return jest.fn().mockReturnValue(<p data-testid="lineage">Lineage</p>);
});

jest.mock('../TableProfiler/TableProfiler.component', () => {
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

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCountBadge: jest.fn(),
  getCurrentUserId: jest.fn().mockReturnValue('CurrentUserId'),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  getUserTeams: () => mockUserTeam,
}));

const mockObserve = jest.fn();
const mockunObserve = jest.fn();

window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockunObserve,
}));

describe('Test MyDataDetailsPage page', () => {
  it('Checks if the page has all the proper components rendered', async () => {
    const { container } = render(<DatasetDetails {...DatasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });

    const relatedTables = getByTestId(container, 'related-tables-container');
    const EntityPageInfo = await findByText(container, /EntityPageInfo/i);
    const description = await findByText(container, /Description/i);
    const tabs = await findByTestId(container, 'tabs');
    const schemaTab = await findByTestId(tabs, 'Schema');
    const activityFeedTab = await findByTestId(tabs, 'Activity Feed');
    const sampleDataTab = await findByTestId(tabs, 'Sample Data');
    const queriesTab = await findByTestId(tabs, 'Queries');
    const profilerTab = await findByTestId(tabs, 'Profiler');
    const dataQualityTab = await findByTestId(tabs, 'Data Quality');
    const lineageTab = await findByTestId(tabs, 'Lineage');
    const manageTab = await findByTestId(tabs, 'Manage');
    const dbtTab = queryByTestId(tabs, 'DBT');

    expect(relatedTables).toBeInTheDocument();
    expect(EntityPageInfo).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(schemaTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(sampleDataTab).toBeInTheDocument();
    expect(queriesTab).toBeInTheDocument();
    expect(profilerTab).toBeInTheDocument();
    expect(dataQualityTab).toBeInTheDocument();
    expect(lineageTab).toBeInTheDocument();
    expect(manageTab).toBeInTheDocument();
    expect(dbtTab).not.toBeInTheDocument();
  });

  it('Check if active tab is schema', async () => {
    const { container } = render(<DatasetDetails {...DatasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const schema = await findByText(container, /SchemaTab/i);

    expect(schema).toBeInTheDocument();
  });

  it('Check if active tab is activity feed', async () => {
    const { container } = render(
      <DatasetDetails {...DatasetDetailsProps} activeTab={2} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const activityFeedList = await findByText(container, /ActivityFeedList/i);

    expect(activityFeedList).toBeInTheDocument();
  });

  it('Check if active tab is sample data', async () => {
    const { container } = render(
      <DatasetDetails {...DatasetDetailsProps} activeTab={3} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const sampleData = await findByTestId(container, 'sample-data');

    expect(sampleData).toBeInTheDocument();
  });

  it('Check if active tab is queries', async () => {
    const { container } = render(
      <DatasetDetails {...DatasetDetailsProps} activeTab={4} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const tableQueries = await findByTestId(container, 'table-queries');

    expect(tableQueries).toBeInTheDocument();
  });

  it('Check if active tab is profiler', async () => {
    const { container } = render(
      <DatasetDetails {...DatasetDetailsProps} activeTab={5} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const tableProfiler = await findByTestId(container, 'TableProfiler');

    expect(tableProfiler).toBeInTheDocument();
  });

  it('Check if active tab is data quality', async () => {
    const { container } = render(
      <DatasetDetails {...DatasetDetailsProps} activeTab={6} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const dataQuality = await findByTestId(container, 'data-quality-tab');

    expect(dataQuality).toBeInTheDocument();
  });

  it('Check if active tab is lineage', async () => {
    const { container } = render(
      <DatasetDetails {...DatasetDetailsProps} activeTab={7} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const lineage = await findByTestId(container, 'lineage');

    expect(lineage).toBeInTheDocument();
  });

  it('Check if active tab is manage', async () => {
    const { container } = render(
      <DatasetDetails {...DatasetDetailsProps} activeTab={9} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const manage = await findByTestId(container, 'manage');

    expect(manage).toBeInTheDocument();
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    const { container } = render(
      <DatasetDetails {...DatasetDetailsProps} activeTab={9} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();

    expect(mockObserve).toHaveBeenCalled();
  });
});
