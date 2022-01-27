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

import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import { LeafNodes, LoadingNodeState } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  ColumnJoins,
  Table,
  TableJoins,
  TypeUsedToReturnUsageDetailsOfAnEntity,
} from '../../generated/entity/data/table';
import { EntityLineage } from '../../generated/type/entityLineage';
import { TagLabel } from '../../generated/type/tagLabel';
import DatasetDetails from './DatasetDetails.component';
import { DatasetOwner } from './DatasetDetails.interface';

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
};
jest.mock('../ManageTab/ManageTab.component', () => {
  return jest.fn().mockReturnValue(<p>ManageTab</p>);
});

jest.mock('../EntityLineage/EntityLineage.component', () => {
  return jest.fn().mockReturnValue(<p>Lineage</p>);
});

jest.mock('../TableProfiler/TableProfiler.component', () => {
  return jest.fn().mockReturnValue(<p>ProfilerTable</p>);
});

jest.mock('../../components/common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
});

jest.mock('../SchemaTab/SchemaTab.component', () => {
  return jest.fn().mockReturnValue(<p>SchemaTab</p>);
});

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCurrentUserId: jest.fn().mockReturnValue('CurrentUserId'),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  // getTableFQNFromColumnFQN: jest.fn().mockReturnValue('TableFQNFromColumnFQN'),
  getUserTeams: () => mockUserTeam,
}));

describe('Test MyDataDetailsPage page', () => {
  it('Checks if the page has all the proper components rendered', () => {
    const { container } = render(<DatasetDetails {...DatasetDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const followButton = getByTestId(container, 'follow-button');
    const relatedTables = getByTestId(container, 'related-tables-container');
    const tabs = getAllByTestId(container, 'tab');

    expect(followButton).toBeInTheDocument();
    expect(relatedTables).toBeInTheDocument();
    // we have 4 for now => schema, Profiler, Lineage & manage
    expect(tabs.length).toBe(4);
  });
});
