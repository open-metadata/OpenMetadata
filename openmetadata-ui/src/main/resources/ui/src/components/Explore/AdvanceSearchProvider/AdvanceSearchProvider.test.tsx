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
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ROUTES } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { getAllCustomProperties } from '../../../rest/metadataTypeAPI';
import { showWarningToast } from '../../../utils/ToastUtils';
import {
  AdvanceSearchProvider,
  useAdvanceSearch,
} from './AdvanceSearchProvider.component';

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getAllCustomProperties: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn().mockResolvedValue({}),
}));

jest.mock('../AdvanceSearchModal.component', () => ({
  AdvancedSearchModal: jest
    .fn()
    .mockImplementation(({ visible, onSubmit, onCancel }) => (
      <>
        {visible ? (
          <p>AdvanceSearchModal Open</p>
        ) : (
          <p>AdvanceSearchModal Close</p>
        )}
        <button onClick={onSubmit}>Apply Advance Search</button>
        <button onClick={onCancel}>Close Modal</button>
      </>
    )),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showWarningToast: jest.fn(),
}));

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

// The global mock in setupTests.js stubs getQbConfigs to return an empty object,
// but this provider feeds the config straight into the react-awesome-query-builder
// utilities, which require a fully-formed config (settings, types, widgets...).
// Restore the real getQbConfigs here so the tree utilities receive a valid config.
jest.mock('../../../utils/AdvancedSearchClassBase', () => {
  const actual = jest.requireActual('../../../utils/AdvancedSearchClassBase');

  // Keep the prototype: spreading the instance would drop its methods (`getCustomPropertiesSubFields`, …).
  const instance = Object.assign(
    Object.create(Object.getPrototypeOf(actual.default)),
    actual.default,
    { autocomplete: jest.fn().mockReturnValue(jest.fn()) }
  );

  return {
    __esModule: true,
    ...actual,
    default: instance,
  };
});

const mockNavigate = jest.fn();
const DEFAULT_SEARCH = 'queryFilter={"some":"value"}';
let mockLocationSearch = DEFAULT_SEARCH;

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    search: mockLocationSearch,
    pathname: ROUTES.EXPLORE,
  }));
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    tab: 'tabValue',
  }),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const Children = () => {
  const { toggleModal, onResetAllFilters } = useAdvanceSearch();

  return (
    <>
      <button onClick={() => toggleModal(true)}>
        Open AdvanceSearch Modal
      </button>
      <button onClick={onResetAllFilters}>Reset All Filters</button>
    </>
  );
};

const mockWithAdvanceSearch =
  (Component: React.FC) =>
  (props: JSX.IntrinsicAttributes & { children?: React.ReactNode }) => {
    return (
      <AdvanceSearchProvider>
        <Component {...props} />
      </AdvanceSearchProvider>
    );
  };

const ComponentWithProvider = mockWithAdvanceSearch(Children);

describe('AdvanceSearchProvider component', () => {
  // Fake timers are enabled globally, so user-event must be told how to advance
  // them, otherwise its internal delays never resolve and clicks hang.
  const setupUser = () =>
    userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  it('should render the provider children with the modal closed by default', async () => {
    await act(async () => {
      render(<ComponentWithProvider />);
    });

    expect(screen.getByText('Open AdvanceSearch Modal')).toBeInTheDocument();
    // The modal is only mounted when it is opened, so nothing modal related
    // should be present on the initial render.
    expect(screen.queryByText('AdvanceSearchModal Open')).toBeNull();
    expect(screen.queryByText('Apply Advance Search')).toBeNull();
  });

  it('should open the AdvanceSearchModal on call of toggleModal with true', async () => {
    const user = setupUser();
    await act(async () => {
      render(<ComponentWithProvider />);
    });

    expect(screen.queryByText('AdvanceSearchModal Open')).toBeNull();

    await user.click(screen.getByText('Open AdvanceSearch Modal'));

    expect(
      await screen.findByText('AdvanceSearchModal Open')
    ).toBeInTheDocument();
  });

  it('should call navigate after submitting the advance search form', async () => {
    const user = setupUser();
    await act(async () => {
      render(<ComponentWithProvider />);
    });

    await user.click(screen.getByText('Open AdvanceSearch Modal'));

    const applyButton = await screen.findByText('Apply Advance Search');

    mockNavigate.mockClear();

    await user.click(applyButton);

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('onResetAllFilters should navigate to the reset filters search params', async () => {
    const user = setupUser();
    await act(async () => {
      render(<ComponentWithProvider />);
    });

    mockNavigate.mockClear();

    await user.click(screen.getByText('Reset All Filters'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: ROUTES.EXPLORE })
    );
  });
});

describe('AdvanceSearchProvider — search index changes', () => {
  const IndexProbe = () => {
    const { onChangeSearchIndex, isUpdating, searchIndex, config } =
      useAdvanceSearch();

    return (
      <>
        <span data-testid="is-updating">{String(isUpdating)}</span>
        <span data-testid="fields">{Object.keys(config.fields).join(',')}</span>
        <button onClick={() => onChangeSearchIndex(SearchIndex.TABLE)}>
          select tables
        </button>
        <button
          data-testid="reselect-same"
          onClick={() =>
            onChangeSearchIndex(searchIndex as SearchIndex | SearchIndex[])
          }>
          reselect
        </button>
      </>
    );
  };

  const ProbeWithProvider = mockWithAdvanceSearch(IndexProbe);

  it('ignores stale configuration responses after StrictMode remounts and the index changes', async () => {
    let finishOldRequest!: (value: Record<string, never>) => void;
    jest.mocked(getAllCustomProperties).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldRequest = resolve;
        })
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await act(async () => {
      render(
        <React.StrictMode>
          <ProbeWithProvider />
        </React.StrictMode>
      );
    });
    await user.click(screen.getByRole('button', { name: 'select tables' }));

    expect(screen.getByTestId('fields')).toHaveTextContent(
      'databaseSchema.displayName.keyword'
    );

    await act(async () => {
      finishOldRequest({});
    });

    expect(screen.getByTestId('fields')).toHaveTextContent(
      'databaseSchema.displayName.keyword'
    );
    expect(screen.getByTestId('is-updating')).toHaveTextContent('false');
  });

  // `loadData` is what clears `isUpdating`, and it only re-runs when
  // `searchIndex` actually changes. Flipping the flag for a no-op change
  // strands every consumer in "updating" forever — which is how the workflow
  // Exclude Filter, asking for the provider's own default index, rendered
  // nothing while Data Asset Filter (a different index) worked.
  it('should not enter the updating state when the index is unchanged', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      render(<ProbeWithProvider />);
    });

    await act(async () => {
      await user.click(screen.getByTestId('reselect-same'));
    });

    expect(screen.getByTestId('is-updating')).toHaveTextContent('false');
  });
});

describe('AdvanceSearchProvider — the advanced search in the URL', () => {
  type Node = {
    type: string;
    properties?: Record<string, unknown>;
    children1?: Node[];
  };

  // The groups the modal would show: each with its conjunction and its rules.
  const describeGroups = (root: Node) =>
    (root.children1 ?? []).map((group) => {
      const rules: Array<Record<string, unknown>> = [];
      const collect = (node: Node) =>
        node.type === 'rule'
          ? rules.push({
              field: node.properties?.field,
              operator: node.properties?.operator,
              value: node.properties?.value,
            })
          : (node.children1 ?? []).forEach(collect);
      (group.children1 ?? []).forEach(collect);

      return { conjunction: group.properties?.conjunction, rules };
    });

  const FilterProbe = () => {
    const { queryFilter, sqlQuery, treeInternal, onSubmit } =
      useAdvanceSearch();
    const root = QbUtils.getTree(treeInternal) as unknown as Node;

    return (
      <>
        <span data-testid="query-filter">
          {JSON.stringify(queryFilter ?? null)}
        </span>
        <span data-testid="sql">{sqlQuery}</span>
        <span data-testid="root-conjunction">
          {String(root.properties?.conjunction)}
        </span>
        <span data-testid="groups">{JSON.stringify(describeGroups(root))}</span>
        <button onClick={onSubmit}>apply</button>
      </>
    );
  };

  const ProbeWithProvider = mockWithAdvanceSearch(FilterProbe);

  const renderWithSearch = async (search: Record<string, unknown>) => {
    mockLocationSearch = new URLSearchParams(
      Object.entries(search).map(([key, value]) => [key, JSON.stringify(value)])
    ).toString();
    await act(async () => {
      render(<ProbeWithProvider />);
    });
  };

  const readJson = (testId: string) =>
    JSON.parse(screen.getByTestId(testId).textContent ?? 'null');

  // (tier AND owner) OR (tag), as the modal writes it.
  const twoGroupFilter = {
    query: {
      bool: {
        should: [
          {
            bool: {
              must: [
                { term: { 'tier.tagFQN': 'Tier.Tier1' } },
                { term: { ownerDisplayName: 'admin' } },
              ],
            },
          },
          { bool: { should: [{ term: { 'tags.tagFQN': 'PII.Sensitive' } }] } },
        ],
      },
    },
  };

  afterEach(() => {
    mockLocationSearch = DEFAULT_SEARCH;
    jest.mocked(getAllCustomProperties).mockResolvedValue({});
  });

  it('loads an Elasticsearch filter from the URL into its groups', async () => {
    await renderWithSearch({ queryFilter: twoGroupFilter });

    expect(screen.getByTestId('root-conjunction')).toHaveTextContent('OR');
    expect(readJson('groups')).toEqual([
      {
        conjunction: 'AND',
        rules: [
          {
            field: 'tier.tagFQN',
            operator: 'select_equals',
            value: ['Tier.Tier1'],
          },
          {
            field: 'ownerDisplayName',
            operator: 'select_equals',
            value: ['admin'],
          },
        ],
      },
      {
        conjunction: 'OR',
        rules: [
          {
            field: 'tags.tagFQN',
            operator: 'select_equals',
            value: ['PII.Sensitive'],
          },
        ],
      },
    ]);
    expect(readJson('query-filter')).toEqual(twoGroupFilter);
    expect(screen.getByTestId('sql')).not.toBeEmptyDOMElement();
  });

  it('still loads a link that carries the builder tree', async () => {
    const legacyTree = {
      id: 'root',
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        group: {
          id: 'group',
          type: 'group',
          properties: { conjunction: 'AND', not: false },
          children1: {
            rule: {
              id: 'rule',
              type: 'rule',
              properties: {
                field: 'tier.tagFQN',
                operator: 'select_equals',
                value: ['Tier.Tier1'],
                valueSrc: ['value'],
                valueType: ['select'],
              },
            },
          },
        },
      },
    };

    await renderWithSearch({ queryFilter: legacyTree });

    expect(readJson('groups')).toEqual([
      {
        conjunction: 'AND',
        rules: [
          {
            field: 'tier.tagFQN',
            operator: 'select_equals',
            value: ['Tier.Tier1'],
          },
        ],
      },
    ]);
    expect(readJson('query-filter')).toEqual({
      query: {
        bool: {
          must: [
            { bool: { must: [{ term: { 'tier.tagFQN': 'Tier.Tier1' } }] } },
          ],
        },
      },
    });
  });

  it('reads custom properties once they have loaded', async () => {
    jest.mocked(getAllCustomProperties).mockResolvedValue({
      table: [{ name: 'strCP', type: 'string' }],
    } as never);
    // Root, group, then one `bool.must` per drill level (`extension`, `extension.table`), around the rule.
    const wrap = (clause: unknown) => ({ bool: { must: [clause] } });
    const rule = {
      bool: {
        must: [
          {
            nested: {
              path: 'customPropertiesTyped',
              ignore_unmapped: true,
              query: {
                bool: {
                  must: [
                    { term: { 'customPropertiesTyped.name': 'strCP' } },
                    {
                      wildcard: {
                        'customPropertiesTyped.stringValue': {
                          value: '*gold*',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          { term: { entityType: 'table' } },
        ],
      },
    };
    const customPropertyFilter = { query: wrap(wrap(wrap(wrap(rule)))) };

    await renderWithSearch({ queryFilter: customPropertyFilter });

    expect(readJson('groups')).toEqual([
      {
        conjunction: 'AND',
        rules: [
          {
            field: 'extension.table.strCP.keyword',
            operator: 'like',
            value: ['gold'],
          },
        ],
      },
    ]);
    expect(readJson('query-filter')).toEqual(customPropertyFilter);
  });

  it("searches with a link's whole filter and warns when some of it cannot be shown", async () => {
    const partlyReadable = {
      query: {
        bool: {
          must: [
            {
              bool: {
                must: [
                  { term: { 'tier.tagFQN': 'Tier.Tier1' } },
                  { prefix: { 'name.keyword': 'dim_' } },
                ],
              },
            },
          ],
        },
      },
    };

    await renderWithSearch({ queryFilter: partlyReadable });

    expect(readJson('query-filter')).toEqual(partlyReadable);
    expect(readJson('groups')).toEqual([
      {
        conjunction: 'AND',
        rules: [
          {
            field: 'tier.tagFQN',
            operator: 'select_equals',
            value: ['Tier.Tier1'],
          },
        ],
      },
    ]);
    expect(showWarningToast).toHaveBeenCalledWith(
      'message.explore-filter-partially-shown'
    );
  });

  it('warns about a partly shown link once, not again when paging through its results', async () => {
    const partlyReadable = {
      query: {
        bool: {
          must: [{ bool: { must: [{ prefix: { 'name.keyword': 'dim_' } }] } }],
        },
      },
    };
    const queryFilter = JSON.stringify(partlyReadable);
    mockLocationSearch = new URLSearchParams({ queryFilter }).toString();
    let rerender!: (ui: React.ReactElement) => void;
    await act(async () => {
      ({ rerender } = render(<ProbeWithProvider />));
    });

    mockLocationSearch = new URLSearchParams({
      queryFilter,
      currentPage: '2',
    }).toString();
    await act(async () => {
      rerender(<ProbeWithProvider />);
    });

    expect(showWarningToast).toHaveBeenCalledTimes(1);
    expect(readJson('query-filter')).toEqual(partlyReadable);
  });

  it('does not warn when the whole link can be shown', async () => {
    await renderWithSearch({ queryFilter: twoGroupFilter });

    expect(showWarningToast).not.toHaveBeenCalled();
  });

  it('writes the Elasticsearch filter, not the tree, when the search is applied', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderWithSearch({ queryFilter: twoGroupFilter });
    mockNavigate.mockClear();

    await user.click(screen.getByRole('button', { name: 'apply' }));

    const { search } = mockNavigate.mock.calls[0][0];

    expect(
      JSON.parse(new URLSearchParams(search).get('queryFilter') ?? '')
    ).toEqual(twoGroupFilter);
  });
});
