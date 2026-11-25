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
import { fireEvent, render, screen } from '@testing-library/react';
import { GlobalSearchRow } from './GlobalSearch.types';
import GlobalSearchResultRow, {
  GlobalSearchResultRowProps,
} from './GlobalSearchResultRow';

const onHover = jest.fn();
const onSelect = jest.fn();

const row: GlobalSearchRow = {
  id: 'r1',
  title: 'customer_orders',
  meta: 'Table · svc › db',
  icon: null,
  badges: ['Tier1', 'Gold'],
  trailing: '2h ago',
};

const renderRow = (props: Partial<GlobalSearchResultRowProps> = {}) =>
  render(
    <GlobalSearchResultRow
      id="option-r1"
      isActive={false}
      query="orders"
      row={row}
      onHover={onHover}
      onSelect={onSelect}
      {...props}
    />
  );

describe('GlobalSearchResultRow', () => {
  it('highlights the matching part of the title', () => {
    renderRow();

    expect(screen.getByText('orders').tagName).toBe('SPAN');
    expect(screen.getByTestId('global-search-row-r1')).toHaveTextContent(
      'customer_orders'
    );
  });

  it('renders badges, meta and trailing text', () => {
    renderRow();

    expect(screen.getByText('Tier1')).toBeInTheDocument();
    expect(screen.getByText('Gold')).toBeInTheDocument();
    expect(screen.getByText('Table · svc › db')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('renders the row addon before the trailing text', () => {
    renderRow({
      row: { ...row, addon: <span data-testid="participants" /> },
    });

    expect(screen.getByTestId('participants')).toBeInTheDocument();
  });

  it('shows the enter hint only when active', () => {
    const { rerender } = renderRow();

    expect(screen.queryByText('↵')).not.toBeInTheDocument();

    rerender(
      <GlobalSearchResultRow
        isActive
        id="option-r1"
        query="orders"
        row={row}
        onHover={onHover}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('↵')).toBeInTheDocument();
    expect(screen.getByTestId('global-search-row-r1')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('removes without selecting', () => {
    const onRemove = jest.fn();
    renderRow({ isActive: true, onRemove });

    expect(screen.queryByText('↵')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('global-search-remove-recent'));

    expect(onRemove).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects on click and hovers on mouse move', () => {
    renderRow();
    const option = screen.getByTestId('global-search-row-r1');

    fireEvent.click(option);
    fireEvent.mouseMove(option);

    expect(onSelect).toHaveBeenCalled();
    expect(onHover).toHaveBeenCalled();
  });
});
