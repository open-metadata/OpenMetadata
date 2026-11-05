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
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { EntityReference } from '../../../generated/entity/type';
import { getDomainStyles } from '../../../rest/domainAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import DataProductsContainer from './DataProductsContainer.component';

jest.mock('../../../rest/domainAPI', () => ({
  getDomainStyles: jest.fn(),
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
        children,
        fetchOptions,
        isOpen,
        onOpenChange,
      }: {
        children?: React.ReactNode;
        fetchOptions?: (searchText: string, page?: number) => void;
        isOpen?: boolean;
        onOpenChange?: (open: boolean) => void;
      }) => (
        <>
          {/* Like FilterSelect, the trigger toggles the picker. */}
          <span onClickCapture={() => onOpenChange?.(!isOpen)}>{children}</span>
          {isOpen && (
            <button
              data-testid="dps-fetch"
              onClick={() => fetchOptions?.('term', 2)}>
              Fetch
            </button>
          )}
        </>
      )
    ),
}));

jest.mock('../../common/WidgetCard/WidgetCard', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children, headerExtra }) => (
    <div data-testid="widget-card">
      {headerExtra}
      {children}
    </div>
  )),
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
    (getDomainStyles as jest.Mock).mockResolvedValue({ data: [] });
  });

  // Data product chips drew a plain grey badge whatever the data product's
  // style; they now read its colour and icon by id, like domain chips.
  it('draws each data product chip in its own colour and icon', async () => {
    (getDomainStyles as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'dp-1',
          type: 'dataProduct',
          style: { color: '#F79009', iconURL: 'Tag01' },
        },
      ],
    });

    renderWithQueryClient(
      <DataProductsContainer
        {...defaultProps}
        dataProducts={[
          {
            id: 'dp-1',
            type: 'dataProduct',
            name: 'orders',
            fullyQualifiedName: 'orders',
          },
          {
            id: 'dp-2',
            type: 'dataProduct',
            name: 'returns',
            fullyQualifiedName: 'returns',
          },
        ]}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('data-product-orders')).toHaveStyle({
        '--tag-color': '#F79009',
      })
    );

    expect(screen.getByTestId('data-product-returns')).not.toHaveStyle({
      '--tag-color': '#F79009',
    });
    expect(screen.getByTestId('data-product-orders')).toHaveAttribute(
      'href',
      expect.stringContaining('orders')
    );
  });

  it('closes the picker when its button is pressed again, saving nothing', () => {
    renderWithQueryClient(<DataProductsContainer {...defaultProps} />);

    fireEvent.click(screen.getByTestId('add-data-product'));

    expect(screen.getByTestId('dps-fetch')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-data-product'));

    expect(screen.queryByTestId('dps-fetch')).not.toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('scopes the fetch to active domains by default (rule enabled)', async () => {
    const { fetchDataProductsElasticSearch } = jest.requireMock(
      '../../../rest/dataProductAPI'
    );

    renderWithQueryClient(<DataProductsContainer {...defaultProps} />);

    fireEvent.click(screen.getByTestId('add-data-product'));
    fireEvent.click(screen.getByTestId('dps-fetch'));

    await waitFor(() => {
      expect(fetchDataProductsElasticSearch).toHaveBeenCalledWith(
        'term',
        ['domainA'],
        2,
        50
      );
    });
  });

  it('fetches across all domains when rule is disabled', async () => {
    const { fetchDataProductsElasticSearch } = jest.requireMock(
      '../../../rest/dataProductAPI'
    );

    renderWithQueryClient(
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
        2,
        50
      );
    });
  });

  it('disables add button with no domain when rule is enabled', () => {
    renderWithQueryClient(
      <DataProductsContainer {...defaultProps} activeDomains={[]} />
    );

    const addButton = screen.getByTestId('add-data-product');

    expect(addButton).toBeDisabled();
    expect(addButton).toHaveAccessibleName(
      'message.select-domain-to-add-data-product'
    );
  });

  it('enables add button with no domain when rule is disabled', () => {
    renderWithQueryClient(
      <DataProductsContainer
        {...defaultProps}
        activeDomains={[]}
        requireDomainForDataProduct={false}
      />
    );

    const addButton = screen.getByTestId('add-data-product');

    expect(addButton).toBeEnabled();
    expect(addButton).not.toHaveAccessibleName(
      'message.select-domain-to-add-data-product'
    );
  });
});
