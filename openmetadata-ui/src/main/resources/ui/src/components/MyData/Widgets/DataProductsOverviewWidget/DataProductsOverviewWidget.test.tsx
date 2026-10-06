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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { useDataProducts } from '../../../../hooks/useDataProducts';
import DataProductsOverviewWidget from './DataProductsOverviewWidget';
import { FilterButtonOption } from '../Common/TopicWidget/FilterButton';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

jest.mock('../../../../hooks/useDataProducts', () => ({
  useDataProducts: jest.fn(),
}));

// The real control is a popover listbox; here each option is a button so a
// test can pick one without driving react-aria's pointer dance.
jest.mock('../Common/TopicWidget/FilterButton', () => ({
  __esModule: true,
  default: ({
    options,
    value,
    onChange,
    testId,
  }: {
    options: FilterButtonOption[];
    value: string;
    onChange: (next: string) => void;
    testId?: string;
  }) => (
    <div data-selected={value} data-testid={testId}>
      {options.map((option) => (
        <button
          data-testid={`${testId}-${option.value}`}
          key={option.value}
          onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

const PRODUCTS = [
  {
    assetCount: 8,
    domainName: 'Retail Banking',
    fullyQualifiedName: 'marketing',
    id: 'id-marketing',
    name: 'Marketing Analytics',
    ownerName: 'Dale Kim',
    updatedAt: 300,
  },
  {
    assetCount: 56,
    domainName: 'Retail Banking',
    fullyQualifiedName: 'campaign',
    id: 'id-campaign',
    name: 'Campaign Attribution',
    ownerName: 'Dale Kim',
    updatedAt: 100,
  },
  {
    // Owned but empty: one problem, so it ranks below the unowned-and-empty row.
    assetCount: 0,
    domainName: 'Compliance and AML',
    fullyQualifiedName: 'fraud',
    id: 'id-fraud',
    name: 'Fraud Signals',
    ownerName: 'Teddy',
    updatedAt: 200,
  },
  {
    assetCount: 0,
    domainName: 'Clinical',
    fullyQualifiedName: 'orphan',
    id: 'id-orphan',
    name: 'Zebra Metrics',
    ownerName: undefined,
    updatedAt: 50,
  },
];

const renderWidget = () => {
  (useDataProducts as jest.Mock).mockReturnValue({
    domainCount: 2,
    emptyCount: 2,
    isError: false,
    isLoading: false,
    products: PRODUCTS,
    totalCount: PRODUCTS.length,
    unownedCount: 1,
  });

  return render(
    <DataProductsOverviewWidget widgetKey="KnowledgePanel.DataProducts-1" />
  );
};

const renderedNames = () =>
  within(screen.getByTestId('data-product-rows'))
    .getAllByRole('listitem')
    .map((row) => row.textContent);

describe('DataProductsOverviewWidget sort', () => {
  beforeEach(() => jest.clearAllMocks());

  // The estate's biggest products are the ones worth a glance, and the search
  // response arrives in relevance order — so the card has to sort for itself.
  it('orders by asset count, largest first, by default', () => {
    renderWidget();

    expect(renderedNames().slice(0, 2)).toEqual([
      expect.stringContaining('Campaign Attribution'),
      expect.stringContaining('Marketing Analytics'),
    ]);
  });

  it('switches to alphabetical order', () => {
    renderWidget();

    fireEvent.click(
      screen.getByTestId('data-product-sort-filter-alphabetical')
    );

    expect(renderedNames()).toEqual([
      expect.stringContaining('Campaign Attribution'),
      expect.stringContaining('Fraud Signals'),
      expect.stringContaining('Marketing Analytics'),
      expect.stringContaining('Zebra Metrics'),
    ]);
  });

  it('switches to most recently updated', () => {
    renderWidget();

    fireEvent.click(
      screen.getByTestId('data-product-sort-filter-recentlyUpdated')
    );

    expect(renderedNames()).toEqual([
      expect.stringContaining('Marketing Analytics'),
      expect.stringContaining('Fraud Signals'),
      expect.stringContaining('Campaign Attribution'),
      expect.stringContaining('Zebra Metrics'),
    ]);
  });

  // Unowned *and* empty is two problems and outranks either on its own; the
  // products with nothing wrong sink to the bottom in alphabetical order.
  it('ranks the most neglected products first', () => {
    renderWidget();

    fireEvent.click(
      screen.getByTestId('data-product-sort-filter-needsAttention')
    );

    expect(renderedNames()).toEqual([
      expect.stringContaining('Zebra Metrics'),
      expect.stringContaining('Fraud Signals'),
      expect.stringContaining('Campaign Attribution'),
      expect.stringContaining('Marketing Analytics'),
    ]);
  });
});
