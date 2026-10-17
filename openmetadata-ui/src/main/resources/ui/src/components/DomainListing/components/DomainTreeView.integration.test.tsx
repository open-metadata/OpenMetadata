/*
 *  Copyright 2026 Collate.
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
import type { Selection } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosRequestConfig } from 'axios';
import { ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { EntityTabs } from '../../../enums/entity.enum';
import { usePersistentStorage } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { DOMAINS_LIST } from '../../../mocks/Domains.mock';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import APIClient from '../../../rest/axiosClient';
import { getQueryFilterForDataProducts } from '../../../utils/DomainFilterUtils';
import { useUrlState } from '../../common/atoms/data/useUrlState';
import { DomainDetailsProps } from '../../Domain/DomainDetails/DomainDetails.interface';
import DataProductsTab from '../../Domain/DomainTabs/DataProductsTab/DataProductsTab.component';
import DomainTreeView from './DomainTreeView';

let mockSelectDomain: (selection: Selection) => void;
let mockSetFilters: ReturnType<typeof useUrlState>['setFilters'];

jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');
  const Tree = ({
    children,
    onSelectionChange,
  }: {
    children: ReactNode;
    onSelectionChange: typeof mockSelectDomain;
  }) => {
    mockSelectDomain = onSelectionChange;

    return <div>{children}</div>;
  };
  const Item = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return {
    ...actual,
    Tree: Object.assign(Tree, {
      Item,
      Header: Item,
      ItemContent: Item,
      Section: Item,
      ExpandButton: () => null,
    }),
  };
});

jest.mock('../../../rest/axiosClient', () => ({ get: jest.fn() }));
jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector?: (state: { currentUser: { id: string; name: string } }) => unknown
  ) => {
    const state = {
      currentUser: { id: 'domain-paging-user', name: 'domain-paging-user' },
    };

    return selector ? selector(state) : state;
  },
}));
jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: () => ({ userDomains: [], isDomainRestricted: false }),
}));
jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: { domain: ENTITY_PERMISSIONS },
  }),
}));

// Keep real tab remounts and URL paging, omitting unrelated domain widgets.
jest.mock('../../Domain/DomainDetails/DomainDetails.component', () => {
  const { Tabs } = jest.requireActual('@openmetadata/ui-core-components');
  const Products = jest.requireActual<
    typeof import('../../Domain/DomainTabs/DataProductsTab/DataProductsTab.component')
  >(
    '../../Domain/DomainTabs/DataProductsTab/DataProductsTab.component'
  ).default;

  return ({ domain, activeTab, onActiveTabChange }: DomainDetailsProps) => (
    <Tabs
      selectedKey={activeTab ?? EntityTabs.ASSETS}
      onSelectionChange={(key: string) =>
        onActiveTabChange?.(key as EntityTabs)
      }>
      <Tabs.List aria-label="Domain tabs">
        <Tabs.Item id={EntityTabs.ASSETS}>Assets</Tabs.Item>
        <Tabs.Item id={EntityTabs.DATA_PRODUCTS}>Data products</Tabs.Item>
      </Tabs.List>
      <Tabs.Panel id={EntityTabs.ASSETS}>
        <span data-testid="selected-domain">{domain.name}</span>
      </Tabs.Panel>
      <Tabs.Panel id={EntityTabs.DATA_PRODUCTS}>
        <Products
          domainFqn={domain.fullyQualifiedName}
          permissions={ENTITY_PERMISSIONS}
          onAddDataProduct={jest.fn()}
        />
      </Tabs.Panel>
    </Tabs>
  );
});
jest.mock(
  '../../common/ResizablePanels/ResizableLeftPanels',
  () =>
    ({
      firstPanel,
      secondPanel,
    }: {
      firstPanel: { children: ReactNode };
      secondPanel: { children: ReactNode };
    }) =>
      (
        <>
          {firstPanel.children}
          {secondPanel.children}
        </>
      )
);
jest.mock(
  '../../common/ResizablePanels/ResizablePanels',
  () =>
    ({ firstPanel }: { firstPanel: { children: ReactNode } }) =>
      firstPanel.children
);
jest.mock(
  '../../ExploreV1/ExploreSearchCard/ExploreSearchCard',
  () =>
    ({ source }: { source: { name: string } }) =>
      <div data-testid="product-card">{source.name}</div>
);

type ProductRequest = { domain: string; from: number; size: number };
const requests: ProductRequest[] = [];
let secondDomainTotal = 1;
const domains = DOMAINS_LIST.map((domain) => ({
  ...domain,
  children: [],
  childrenCount: 0,
}));
const mockGet = APIClient.get as jest.Mock;
const FILTER_KEYS = ['domainType'];
const UrlDrivenTree = () => {
  const { urlState, setFilters } = useUrlState({ filterKeys: FILTER_KEYS });
  mockSetFilters = setFilters;

  return (
    <DomainTreeView
      filters={urlState.filters}
      searchQuery={urlState.searchQuery}
    />
  );
};
const openProducts = async () =>
  fireEvent.click(await screen.findByRole('tab', { name: 'Data products' }));
const renderTree = (
  pathname = '/domain',
  search = '?currentPage=3&pageSize=25',
  withUrlState = false
) => {
  window.history.replaceState({}, '', `${pathname}${search}`);

  return render(
    <BrowserRouter>
      {withUrlState ? <UrlDrivenTree /> : <DomainTreeView />}
    </BrowserRouter>
  );
};

describe('Domain tree pagination with the real URL paging hooks', () => {
  beforeEach(() => {
    requests.length = 0;
    secondDomainTotal = 1;
    usePersistentStorage.getState().clearUserPreference('domain-paging-user');
    mockGet.mockImplementation(
      async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/domains/hierarchy') {
          return { data: { data: domains, paging: { total: domains.length } } };
        }
        if (url.startsWith('/domains/name/')) {
          return {
            data: domains.find(
              (domain) =>
                domain.fullyQualifiedName ===
                decodeURIComponent(url.slice('/domains/name/'.length))
            ),
          };
        }
        if (url.startsWith('/search/query')) {
          if (config?.params.index === 'domain') {
            return {
              data: String(config.params.query_filter).includes(
                'Consumer-aligned'
              )
                ? [domains[1]]
                : domains,
            };
          }
          const domain = String(config?.params.query_filter).includes('Domain2')
            ? 'Domain2'
            : 'Domain1';
          const total = domain === 'Domain2' ? secondDomainTotal : 75;
          const from = Number(config?.params.from);
          requests.push({ domain, from, size: Number(config?.params.size) });

          return {
            data: {
              hits: {
                hits:
                  from < total
                    ? [
                        {
                          _source: {
                            id: `${domain}-product`,
                            name: `${domain} product`,
                            fullyQualifiedName: `${domain}.product`,
                          },
                        },
                      ]
                    : [],
                total: { value: total },
              },
            },
          };
        }

        throw new Error(`Unexpected API request: ${url}`);
      }
    );
  });

  afterEach(() => window.history.replaceState({}, '', '/'));

  it('keeps the clicked domain selected when paging changes recreate active URL filters', async () => {
    renderTree(
      '/domain',
      '?q=Domain&domainType=Aggregate&currentPage=3&pageSize=25',
      true
    );
    await screen.findByTestId('selected-domain');

    await act(async () => mockSelectDomain(new Set(['Domain2'])));

    expect(await screen.findByTestId('selected-domain')).toHaveTextContent(
      'Domain2'
    );

    await openProducts();

    expect(await screen.findByText('Domain2 product')).toBeInTheDocument();
    expect(requests).toEqual([{ domain: 'Domain2', from: 0, size: 25 }]);
  });

  it('reloads the domain tree when an active filter value changes', async () => {
    renderTree('/domain', '?q=Domain&domainType=Aggregate', true);
    await screen.findByTestId('selected-domain');

    await act(async () =>
      mockSetFilters([
        {
          key: 'domainType',
          label: 'Domain type',
          value: [{ key: 'Consumer-aligned', label: 'Consumer-aligned' }],
        },
      ])
    );

    expect(await screen.findByTestId('selected-domain')).toHaveTextContent(
      'Domain2'
    );
    expect(new URLSearchParams(window.location.search).get('domainType')).toBe(
      'Consumer-aligned'
    );
  });

  it.each([1, 75])(
    'starts the new domain on page one when it has %i products',
    async (total) => {
      secondDomainTotal = total;
      renderTree();
      await openProducts();

      expect(await screen.findByText('Domain1 product')).toBeInTheDocument();
      expect(requests).toContainEqual({
        domain: 'Domain1',
        from: 50,
        size: 25,
      });

      act(() => mockSelectDomain(new Set(['Domain2'])));
      await waitFor(() =>
        expect(screen.getByTestId('selected-domain')).toHaveTextContent(
          'Domain2'
        )
      );
      await openProducts();

      await waitFor(() =>
        expect(requests.some(({ domain }) => domain === 'Domain2')).toBe(true)
      );
      const nextDomainRequests = requests.filter(
        ({ domain }) => domain === 'Domain2'
      );

      expect(nextDomainRequests.length).toBeGreaterThan(0);
      expect(
        nextDomainRequests.every(({ from, size }) => from === 0 && size === 25)
      ).toBe(true);
      expect(await screen.findByText('Domain2 product')).toBeInTheDocument();
      expect(
        screen.queryByText('label.no-data-products-yet')
      ).not.toBeInTheDocument();
      expect(
        mockGet.mock.calls
          .filter(([url]) => url.startsWith('/search/query'))
          .pop()?.[1].params.query_filter
      ).toBe(JSON.stringify(getQueryFilterForDataProducts('Domain2')));
    }
  );

  it.each(['/domain', '/data-marketplace/domains'])(
    'preserves query settings and history on %s',
    async (pathname) => {
      renderTree(
        pathname,
        '?currentPage=3&pageSize=50&cursorType=after&cursorValue=A%2BB&keep=a%2Bb&keep=two&filters%5Bowners%5D%5B%5D=owner#members/probe'
      );
      await screen.findByTestId('selected-domain');
      const historyLength = window.history.length;

      act(() => mockSelectDomain(new Set(['Domain2'])));

      await waitFor(() =>
        expect(
          new URLSearchParams(window.location.search).has('currentPage')
        ).toBe(false)
      );
      const params = new URLSearchParams(window.location.search);

      expect(params.has('cursorType')).toBe(false);
      expect(params.has('cursorValue')).toBe(false);
      expect(params.get('pageSize')).toBe('50');
      expect(params.getAll('keep')).toEqual(['a+b', 'two']);
      expect(params.getAll('filters[owners][]')).toEqual(['owner']);
      expect(window.location.pathname).toBe(pathname);
      expect(window.location.hash).toBe('#members/probe');
      expect(window.history.length).toBe(historyLength);
    }
  );

  it.each<Selection>([
    'all',
    new Set(),
    new Set(['Domain1']),
    new Set(['Domain1__load_more']),
  ])('keeps pagination for an ignored selection %p', async (selection) => {
    renderTree();
    await screen.findByTestId('selected-domain');
    const location = window.location.href;

    act(() => mockSelectDomain(selection));

    expect(window.location.href).toBe(location);
  });

  it.each(['cursorType=after', 'cursorValue=old'])(
    'clears an isolated cursor parameter %s',
    async (cursor) => {
      renderTree('/domain', `?${cursor}&pageSize=25`);
      await screen.findByTestId('selected-domain');

      act(() => mockSelectDomain(new Set(['Domain2'])));

      await waitFor(() => expect(window.location.search).toBe('?pageSize=25'));
    }
  );

  it('does not rewrite the URL when the domain switch has no paging position to clear', async () => {
    renderTree('/domain', '?pageSize=25&keep=two%20words#probe');
    await screen.findByTestId('selected-domain');
    const location = window.location.href;

    act(() => mockSelectDomain(new Set(['Domain2'])));

    await waitFor(() =>
      expect(screen.getByTestId('selected-domain')).toHaveTextContent('Domain2')
    );

    expect(window.location.href).toBe(location);
  });

  it('preserves the saved page size when the URL has no size', async () => {
    usePersistentStorage
      .getState()
      .setUserPreference('domain-paging-user', { globalPageSize: 50 });
    renderTree('/domain', '?currentPage=3');
    await screen.findByTestId('selected-domain');

    act(() => mockSelectDomain(new Set(['Domain2'])));
    await waitFor(() =>
      expect(screen.getByTestId('selected-domain')).toHaveTextContent('Domain2')
    );
    await openProducts();

    expect(await screen.findByText('Domain2 product')).toBeInTheDocument();
    expect(requests).toEqual([{ domain: 'Domain2', from: 0, size: 50 }]);
    expect(
      usePersistentStorage.getState().getUserPreference('domain-paging-user')
        .globalPageSize
    ).toBe(50);
  });

  it('honors standalone detail links to a later page', async () => {
    window.history.replaceState(
      {},
      '',
      '/domain/Domain2/data_products?currentPage=3&pageSize=25'
    );
    secondDomainTotal = 75;
    render(
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <DataProductsTab
                permissions={ENTITY_PERMISSIONS}
                onAddDataProduct={jest.fn()}
              />
            }
            path="/domain/:fqn/:tab"
          />
        </Routes>
      </BrowserRouter>
    );

    expect(await screen.findByText('Domain2 product')).toBeInTheDocument();
    expect(requests).toEqual([{ domain: 'Domain2', from: 50, size: 25 }]);
    expect(new URLSearchParams(window.location.search).get('currentPage')).toBe(
      '3'
    );
  });
});
