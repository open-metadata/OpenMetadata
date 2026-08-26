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
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { EntityTabs } from '../../enums/entity.enum';
import { TableType } from '../../generated/entity/data/table';
import { getQueriesList } from '../../rest/queryAPI';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import TableDetailsPageV1 from './TableDetailsPageV1';

const mockEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => DEFAULT_ENTITY_PERMISSION);
const mockNavigate = jest.fn();

const COMMON_API_FIELDS =
  'columns,followers,joins,tags,owners,dataModel,tableConstraints,schemaDefinition,domains,dataProducts,votes,extension';

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
      columns: [],
    })
  ),
  getTableColumnsByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [],
      paging: { total: 0 },
    })
  ),
  addFollower: jest.fn(),
  patchTableDetails: jest.fn(),
  removeFollower: jest.fn(),
  restoreTable: jest.fn(),
  updateTablesVotes: jest.fn(),
}));

jest.mock('../../rest/suggestionsAPI', () => ({
  getSuggestionsList: jest.fn().mockImplementation(() => Promise.resolve([])),
}));

jest.mock('../../utils/RecentActivityUtils', () => ({
  ...jest.requireActual('../../utils/RecentActivityUtils'),
  addToRecentViewed: jest.fn(),
}));
jest.mock('../../utils/FeedUtilsPure', () => ({
  fetchEntityActivityCountInto: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
  getFeedCounts: jest.fn(),
}));
jest.mock('../../utils/FqnUtils', () => ({
  getPartialNameFromTableFQN: jest.fn().mockImplementation(() => 'fqn'),
  getTableFQNFromColumnFQN: jest.fn(),
}));
jest.mock('../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn().mockReturnValue('/table/fqn/sample_data'),
  getVersionPath: jest.fn(),
  refreshPage: jest.fn(),
}));
jest.mock('../../utils/TagsUtils', () => ({
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

jest.mock('../../components/common/EntityDescription/Description', () => {
  return jest.fn().mockImplementation(() => <p>testDescription</p>);
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
    DataAssetsHeader: jest.fn().mockImplementation(({ breadcrumbData }) => (
      <div>
        testDataAssetsHeader
        <span data-testid="header-breadcrumb-data">
          {JSON.stringify(breadcrumbData)}
        </span>
      </div>
    )),
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

// Mock removed - TableProfiler component doesn't exist as a single file anymore
// jest.mock(
//   '../../components/Database/Profiler/TableProfiler/TableProfiler',
//   () => {
//     return jest.fn().mockImplementation(() => <p>testTableProfiler</p>);
//   }
// );

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

jest.mock(
  '../../components/Suggestions/SuggestionsProvider/SuggestionsProvider',
  () => ({
    useSuggestionsContext: jest.fn().mockImplementation(() => ({
      suggestions: [],
      suggestionsByUser: new Map(),
      selectedUserSuggestions: [],
      entityFqn: 'fqn',
      loading: false,
      allSuggestionsUsers: [],
      onUpdateActiveUser: jest.fn(),
      fetchSuggestions: jest.fn(),
      acceptRejectSuggestion: jest.fn(),
    })),
    __esModule: true,
    default: 'SuggestionsProvider',
  })
);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest
    .fn()
    .mockImplementation(() => ({ fqn: 'fqn', tab: 'schema' })),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn().mockImplementation(() => ({
    isTourOpen: false,
    activeTabForTourDatasetPage: 'schema',
    isTourPage: false,
  })),
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <>testLoader</>),
  PageLoader: jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>),
}));

jest.useFakeTimers();

jest.mock('../../hoc/LimitWrapper', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => <>LimitWrapper{children}</>);
});

jest.mock('../../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockImplementation(() => <>GenericTab</>),
}));

jest.mock(
  '../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn(),
      getEntityRuleValidation: jest.fn(),
    })),
  })
);

describe('TestDetailsPageV1 component', () => {
  it('TableDetailsPageV1 should fetch permissions', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <TableDetailsPageV1 />
      </MemoryRouter>
    );

    expect(mockEntityPermissionByFqn).toHaveBeenCalledWith('table', 'fqn');
  });

  it('TableDetailsPageV1 should not fetch table details if permission is there', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <TableDetailsPageV1 />
      </MemoryRouter>
    );

    expect(getTableDetailsByFQN).not.toHaveBeenCalled();
  });

  it('TableDetailsPageV1 should fetch table details with basic fields', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
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
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: `${COMMON_API_FIELDS},usageSummary,testSuite`,
    });
  });

  it('TableDetailsPageV1 should render page for ViewBasic permissions', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: COMMON_API_FIELDS,
    });

    expect(await screen.findByText('testDataAssetsHeader')).toBeInTheDocument();
    expect(await screen.findByText('label.column-plural')).toBeInTheDocument();
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
      await screen.findByText('label.data-observability')
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
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should dbt tab for rawSql, when sql is empty', async () => {
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
        dataModel: { sql: '', rawSql: 'rawSql' },
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should dbt tab for rawSql, when there is no sql available', async () => {
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
        dataModel: { rawSql: 'rawSql' },
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should show dbt tab when path is available without sql', async () => {
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
        dataModel: { path: 'data/seeds/my_seed.csv' },
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should show dbt tab when dbtSourceProject is available without sql', async () => {
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
        dataModel: { dbtSourceProject: 'my_dbt_project' },
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should render schema definition tab table type is not view', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        schemaDefinition: 'schemaDefinition query',
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    // useQuery resolves its promise on a microtask after the initial render — use findByText
    // (waits up to the testing-library default timeout) rather than getByText, which would
    // otherwise race the cache settle. The act-wrapper flushes effects but not the chained
    // promise inside react-query's internal scheduler.
    expect(
      await screen.findByText('label.schema-definition')
    ).toBeInTheDocument();
    expect(screen.queryByText('label.dbt-lowercase')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should render view definition tab if table type is view', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        schemaDefinition: 'viewDefinition query',
        tableType: TableType.View,
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

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
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: COMMON_API_FIELDS,
    });

    expect(await screen.findByText('GenericTab')).toBeInTheDocument();
    expect(GenericTab).toHaveBeenCalledWith({ type: 'Table' }, {});
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    const mockTableData = {
      name: 'test-table',
      id: '123',
      columns: [],
    };

    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockTableData)
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    // Same reason as the schema-definition test above — useQuery's data is available on a
    // subsequent render, not immediately after `act` flushes. waitFor polls until the page
    // re-renders with the resolved title.
    await waitFor(() =>
      expect(PageLayoutV1).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: 'test-table',
        }),
        expect.anything()
      )
    );
  });

  it('should preserve the table suite breadcrumb in the header and tab navigation', async () => {
    const breadcrumbData = [
      {
        name: 'Test Suites',
        url: '/data-quality/test-suites/table-suites',
      },
      {
        name: 'orders',
        url: '/table/service.database.schema.orders/profiler/data-quality',
      },
    ];

    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockResolvedValue({
        ViewBasic: true,
      }),
    }));
    mockNavigate.mockClear();

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/table/fqn/profiler/data-quality',
              state: { breadcrumbData },
            },
          ]}>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(
      await screen.findByTestId('header-breadcrumb-data')
    ).toHaveTextContent(JSON.stringify(breadcrumbData));

    fireEvent.click(screen.getByText('label.sample-data'));

    expect(mockNavigate).toHaveBeenCalledWith('/table/fqn/sample_data', {
      replace: true,
      state: { breadcrumbData },
    });
  });

  describe('Queries tab count', () => {
    const getQueriesTabProps = () =>
      (TabsLabel as unknown as jest.Mock).mock.calls
        .map(([props]) => props)
        .filter((props) => props.id === EntityTabs.TABLE_QUERIES);

    const getLatestQueriesTabProps = () => getQueriesTabProps().pop();

    const renderOnSchemaTab = async () => {
      (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
        getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
          ViewBasic: true,
        })),
      }));

      await act(async () => {
        renderWithQueryClient(
          <MemoryRouter>
            <TableDetailsPageV1 />
          </MemoryRouter>
        );
      });
    };

    beforeEach(() => {
      (TabsLabel as unknown as jest.Mock).mockClear();
      (getQueriesList as jest.Mock).mockClear();
    });

    it('should fetch the count on mount without activating the Queries tab', async () => {
      (getQueriesList as jest.Mock).mockResolvedValue({
        paging: { total: 7 },
      });

      await renderOnSchemaTab();

      // tableDetails resolves on a later render, so the count query starts after the act
      // flush — poll rather than asserting synchronously.
      await waitFor(() =>
        expect(getQueriesList).toHaveBeenCalledWith({
          limit: 0,
          entityId: '123',
        })
      );

      await waitFor(() =>
        expect(getLatestQueriesTabProps()).toEqual(
          expect.objectContaining({ count: 7, isLoading: false })
        )
      );
    });

    it('should render the skeleton instead of a count while the request is in flight', async () => {
      let resolveCount: (value: { paging: { total: number } }) => void = () =>
        undefined;
      (getQueriesList as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCount = resolve;
          })
      );

      await renderOnSchemaTab();

      await waitFor(() => expect(getQueriesList).toHaveBeenCalled());

      // Every render so far, not just the latest — one frame with isLoading false is the
      // 0 flash this guards against.
      expect(getQueriesTabProps()).not.toHaveLength(0);
      expect(
        getQueriesTabProps().every((props) => props.isLoading)
      ).toBeTruthy();

      await act(async () => {
        // eslint-disable-next-line sonarjs/no-extra-arguments -- deferred test resolver
        resolveCount({ paging: { total: 7 } });
      });

      await waitFor(() =>
        expect(getLatestQueriesTabProps()).toEqual(
          expect.objectContaining({ count: 7, isLoading: false })
        )
      );
    });

    it('should fall back to 0 when the count request fails', async () => {
      (getQueriesList as jest.Mock).mockRejectedValue(new Error('failed'));

      await renderOnSchemaTab();

      await waitFor(() => expect(getQueriesList).toHaveBeenCalled());

      await waitFor(() =>
        expect(getLatestQueriesTabProps()).toEqual(
          expect.objectContaining({ count: 0, isLoading: false })
        )
      );
    });
  });
});
