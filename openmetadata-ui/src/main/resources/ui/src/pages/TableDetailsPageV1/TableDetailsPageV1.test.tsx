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
import React from 'react';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import TableDetailsPageV1 from './TableDetailsPageV1';

const mockEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => DEFAULT_ENTITY_PERMISSION);

const COMMON_API_FIELDS =
  'columns,followers,joins,tags,owner,dataModel,tableConstraints,viewDefinition,domain,dataProducts,votes,extension';

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockEntityPermissionByFqn,
  })),
}));

jest.mock('../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      name: 'test',
      id: '123',
    })
  ),
  addFollower: jest.fn(),
  patchTableDetails: jest.fn(),
  removeFollower: jest.fn(),
  restoreTable: jest.fn(),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getFeedCounts: jest.fn(),
  getPartialNameFromTableFQN: jest.fn().mockImplementation(() => 'fqn'),
  getTableFQNFromColumnFQN: jest.fn(),
  refreshPage: jest.fn(),
  sortTagsCaseInsensitive: jest.fn(),
}));

jest.mock('../../rest/queryAPI', () => ({
  getQueriesList: jest.fn(),
}));

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <p>testActivityFeedTab</p>),
  })
);

jest.mock(
  '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel',
  () => {
    return jest.fn().mockImplementation(() => <p>testActivityThreadPanel</p>);
  }
);

jest.mock('../../components/common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <p>testDescriptionV1</p>);
});
jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockImplementation(() => <p>testErrorPlaceHolder</p>);
  }
);

jest.mock('../../components/common/QueryViewer/QueryViewer.component', () => {
  return jest.fn().mockImplementation(() => <p>testQueryViewer</p>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <p>{children}</p>);
});

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(() => <p>testDataAssetsHeader</p>),
  })
);

jest.mock('../../components/Lineage/Lineage.component', () => {
  return jest.fn().mockImplementation(() => <p>testEntityLineage</p>);
});

jest.mock(
  '../../components/Database/SampleDataTable/SampleDataTable.component',
  () => {
    return jest.fn().mockImplementation(() => <p>testSampleDataTable</p>);
  }
);

jest.mock('../../components/Database/SchemaTab/SchemaTab.component', () => {
  return jest.fn().mockImplementation(() => <p>testSchemaTab</p>);
});

jest.mock(
  '../../components/Database/Profiler/TableProfiler/TableProfiler',
  () => {
    return jest.fn().mockImplementation(() => <p>testTableProfiler</p>);
  }
);

jest.mock('../../components/Database/TableQueries/TableQueries', () => {
  return jest.fn().mockImplementation(() => <p>testTableQueries</p>);
});

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ name }) => <p>{name}</p>);
});

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockImplementation(() => <p>testTagsContainerV2</p>);
});

jest.mock('./FrequentlyJoinedTables/FrequentlyJoinedTables.component', () => ({
  FrequentlyJoinedTables: jest
    .fn()
    .mockImplementation(() => <p>testFrequentlyJoinedTables</p>),
}));

jest.mock('./FrequentlyJoinedTables/FrequentlyJoinedTables.component', () => ({
  FrequentlyJoinedTables: jest
    .fn()
    .mockImplementation(() => <p>testFrequentlyJoinedTables</p>),
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

jest.mock('react-router-dom', () => ({
  useParams: jest
    .fn()
    .mockImplementation(() => ({ fqn: 'fqn', tab: 'schema' })),
  useHistory: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn().mockImplementation(() => ({
    isTourOpen: false,
    activeTabForTourDatasetPage: 'schema',
    isTourPage: false,
  })),
}));

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <>testLoader</>);
});

jest.useFakeTimers();

describe('TestDetailsPageV1 component', () => {
  it('TableDetailsPageV1 should fetch permissions', () => {
    render(<TableDetailsPageV1 />);

    expect(mockEntityPermissionByFqn).toHaveBeenCalledWith('table', 'fqn');
  });

  it('TableDetailsPageV1 should not fetch table details if permission is there', () => {
    render(<TableDetailsPageV1 />);

    expect(getTableDetailsByFQN).not.toHaveBeenCalled();
  });

  it('TableDetailsPageV1 should fetch table details with basic fields', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<TableDetailsPageV1 />);
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: COMMON_API_FIELDS,
    });
  });

  it('TableDetailsPageV1 should fetch table details with all the permitted fields', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewAll: true,
        ViewBasic: true,
        ViewUsage: true,
      })),
    }));

    await act(async () => {
      render(<TableDetailsPageV1 />);
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: `${COMMON_API_FIELDS},usageSummary`,
    });
  });

  it('TableDetailsPageV1 should render page for ViewBasic permissions', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<TableDetailsPageV1 />);
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: COMMON_API_FIELDS,
    });

    expect(await screen.findByText('testDataAssetsHeader')).toBeInTheDocument();
    expect(await screen.findByText('label.schema')).toBeInTheDocument();
    expect(
      await screen.findByText('label.activity-feed-and-task-plural')
    ).toBeInTheDocument();
    expect(await screen.findByText('label.sample-data')).toBeInTheDocument();
    expect(await screen.findByText('label.query-plural')).toBeInTheDocument();
    expect(await screen.findByText('label.lineage')).toBeInTheDocument();

    expect(
      await screen.findByText('label.custom-property-plural')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('label.profiler-amp-data-quality')
    ).toBeInTheDocument();
  });

  it('TableDetailsPageV1 should dbt tab if data is present', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        tableFqn: 'fqn',
        dataModel: { sql: 'somequery' },
      })
    );

    await act(async () => {
      render(<TableDetailsPageV1 />);
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should render view defination if data is present', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        viewDefinition: 'viewDefinition',
      })
    );

    await act(async () => {
      render(<TableDetailsPageV1 />);
    });

    expect(screen.queryByText('label.dbt-lowercase')).not.toBeInTheDocument();

    expect(
      await screen.findByText('label.view-definition')
    ).toBeInTheDocument();
  });

  it('TableDetailsPageV1 should render schemaTab by default', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<TableDetailsPageV1 />);
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: COMMON_API_FIELDS,
    });

    expect(await screen.findByText('testSchemaTab')).toBeInTheDocument();
  });
});
