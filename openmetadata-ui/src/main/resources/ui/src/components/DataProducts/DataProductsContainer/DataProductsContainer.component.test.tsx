/*
 *  Copyright 2025 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityReference } from '../../../generated/entity/type';
import DataProductsContainer from './DataProductsContainer.component';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} - ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../../rest/dataProductAPI', () => ({
  fetchDataProductsElasticSearch: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../DataProductsSelectList/DataProductsSelectList', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(
      ({
        fetchOptions,
      }: {
        fetchOptions?: (searchText: string, page?: number) => void;
      }) => (
        <button
          data-testid="dps-fetch"
          onClick={() => fetchOptions?.('term', 2)}>
          Fetch
        </button>
      )
    ),
}));

// 1.13 uses PlusIconButton / EditIconButton, not WidgetPlusButton / WidgetEditButton
jest.mock('../../common/IconButtons/EditIconButton', () => ({
  PlusIconButton: jest.fn().mockImplementation(({ onClick, ...props }) => (
    <button onClick={onClick} {...props}>
      Add
    </button>
  )),
  EditIconButton: jest.fn().mockImplementation(({ onClick, ...props }) => (
    <button onClick={onClick} {...props}>
      Edit
    </button>
  )),
}));

// 1.13 wraps content in ExpandableCard, not WidgetCard
jest.mock('../../common/ExpandableCard/ExpandableCard', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children, header }) => (
    <div data-testid="expandable-card">
      {header}
      {children}
    </div>
  )),
}));

jest.mock('../../Tag/TagsV1/TagsV1.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>Tag</div>),
}));

const domains: EntityReference[] = [
  { id: 'd-1', fullyQualifiedName: 'domainA', type: 'domain' },
];

const defaultProps = {
  newLook: true,
  hasPermission: true,
  dataProducts: [] as EntityReference[],
  activeDomains: domains,
  onSave: jest.fn(),
};

describe('DataProductsContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes the fetch to active domains by default (rule enabled)', async () => {
    const { fetchDataProductsElasticSearch } = jest.requireMock(
      '../../../rest/dataProductAPI'
    );

    render(<DataProductsContainer {...defaultProps} />);

    fireEvent.click(screen.getByTestId('add-data-product'));
    fireEvent.click(screen.getByTestId('dps-fetch'));

    await waitFor(() => {
      expect(fetchDataProductsElasticSearch).toHaveBeenCalledWith(
        'term',
        ['domainA'],
        2
      );
    });
  });

  it('fetches across all domains when rule is disabled', async () => {
    const { fetchDataProductsElasticSearch } = jest.requireMock(
      '../../../rest/dataProductAPI'
    );

    render(
      <DataProductsContainer
        {...defaultProps}
        requireDomainForDataProduct={false}
      />
    );

    fireEvent.click(screen.getByTestId('add-data-product'));
    fireEvent.click(screen.getByTestId('dps-fetch'));

    await waitFor(() => {
      expect(fetchDataProductsElasticSearch).toHaveBeenCalledWith(
        'term',
        [],
        2
      );
    });
  });

  // In 1.13 the add button is conditionally rendered (not rendered-and-disabled):
  // when domainMissing is true, showAddTagButton is false so PlusIconButton is absent.
  it('hides add button and shows domain prompt when no domain and rule is enabled', () => {
    render(<DataProductsContainer {...defaultProps} activeDomains={[]} />);

    expect(screen.queryByTestId('add-data-product')).not.toBeInTheDocument();
    expect(
      screen.getByText('message.select-domain-to-add-data-product')
    ).toBeInTheDocument();
  });

  it('shows add button and hides domain prompt when no domain and rule is disabled', () => {
    render(
      <DataProductsContainer
        {...defaultProps}
        activeDomains={[]}
        requireDomainForDataProduct={false}
      />
    );

    expect(screen.getByTestId('add-data-product')).toBeInTheDocument();
    expect(
      screen.queryByText('message.select-domain-to-add-data-product')
    ).not.toBeInTheDocument();
  });
});
