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
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import { TagSource } from '../../../../generated/type/tagLabel';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import AssetSummaryPanel from './AssetSummaryPanel';
import { GlobalSearchRow } from './GlobalSearch.types';
import { useAssetSummaryStats } from './useAssetSummaryStats';

jest.mock('./useAssetSummaryStats', () => ({
  useAssetSummaryStats: jest.fn(),
}));

const onClose = jest.fn();
const onOpen = jest.fn();

const makeRow = (source: Record<string, unknown>): GlobalSearchRow => ({
  id: 'r1',
  title: 'orders',
  path: 'svc › db › schema',
  icon: null,
  source: source as unknown as SearchSourceAlias,
});

const tableRow = makeRow({
  entityType: EntityType.TABLE,
  fullyQualifiedName: 'svc.db.schema.orders',
  columns: [{ name: 'id' }, { name: 'total' }, { name: 'status' }],
  owners: [{ displayName: 'Alice' }, { name: 'bob' }],
  domains: [],
  tags: [
    { tagFQN: 'PII.Sensitive', source: TagSource.Classification },
    { tagFQN: 'Tier.Tier1', source: TagSource.Classification },
    {
      tagFQN: 'Business.Revenue',
      name: 'Revenue',
      source: TagSource.Glossary,
    },
  ],
});

// Text of the closest ancestor that holds more than the label: the stat or
// detail block the label heads.
const statValue = (label: string) => {
  let element: HTMLElement = screen.getByText(label);
  while (element.parentElement && element.textContent === label) {
    element = element.parentElement;
  }

  return element.textContent;
};

const renderPanel = (row?: GlobalSearchRow) =>
  render(
    <MemoryRouter>
      <AssetSummaryPanel row={row} onClose={onClose} onOpen={onOpen} />
    </MemoryRouter>
  );

describe('AssetSummaryPanel', () => {
  beforeEach(() => {
    (useAssetSummaryStats as jest.Mock).mockReturnValue({
      upstream: 2,
      downstream: 5,
      incidents: undefined,
    });
  });

  it('renders nothing without a row', () => {
    renderPanel();

    expect(
      screen.queryByTestId('global-search-summary')
    ).not.toBeInTheDocument();
  });

  it('shows column, incident and lineage stats for a table', () => {
    renderPanel(tableRow);

    expect(statValue('label.column-plural')).toBe('label.column-plural3');
    expect(statValue('label.incident-plural')).toBe('label.incident-plural—');
    expect(statValue('label.upstream')).toBe('label.upstream2');
    expect(statValue('label.downstream')).toBe('label.downstream5');
  });

  it('shows data type and parent table for a column', () => {
    renderPanel(
      makeRow({ entityType: EntityType.TABLE_COLUMN, dataType: 'BIGINT' })
    );

    expect(statValue('label.data-type')).toBe('label.data-typeBIGINT');
    expect(statValue('label.in-table')).toBe('label.in-tableschema');
    expect(screen.queryByText('label.upstream')).not.toBeInTheDocument();
  });

  it('shows owners, glossary terms and tags the way Explore does, without counts', () => {
    (useAssetSummaryStats as jest.Mock).mockReturnValue({});
    renderPanel(tableRow);

    expect(screen.getByTestId('Alice')).toBeInTheDocument();
    expect(screen.getByTestId('tag-PII.Sensitive')).toBeInTheDocument();
    expect(screen.queryByTestId('tag-Tier.Tier1')).not.toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText('label.no-entity')).toBeInTheDocument();
  });

  it('shows a Markdown or HTML description as plain text', () => {
    renderPanel(
      makeRow({
        entityType: EntityType.TABLE,
        description:
          '<p>**Orders** placed by [customers](https://x.io)</p><p>Daily</p>',
      })
    );

    expect(
      screen.getByText('Orders placed by customers Daily')
    ).toBeInTheDocument();
    expect(screen.queryByText(/\*\*|<p>|\]\(/)).not.toBeInTheDocument();
  });

  it('opens and closes through its buttons', () => {
    renderPanel(tableRow);

    fireEvent.click(screen.getByTestId('global-search-summary-open'));

    expect(onOpen).toHaveBeenCalledWith(tableRow);

    fireEvent.click(screen.getByTestId('global-search-summary-close'));

    expect(onClose).toHaveBeenCalled();
  });
});
