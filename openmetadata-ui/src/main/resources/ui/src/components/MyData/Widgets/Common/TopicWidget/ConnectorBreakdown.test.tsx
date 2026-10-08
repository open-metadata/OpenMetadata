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
import { render, screen } from '@testing-library/react';
import ConnectorBreakdown from './ConnectorBreakdown';

jest.mock('@openmetadata/ui-core-components/charts', () => ({
  BarChart: () => <div data-testid="bar-chart" />,
  getSeriesColor: (index: number) => `color-${index}`,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const CONNECTORS = [
  { count: 800, key: 'Snowflake', name: 'Snowflake' },
  { count: 120, key: 'Datalake', name: 'Datalake' },
  { count: 75, key: 'Redshift', name: 'Redshift' },
];

const renderBreakdown = () =>
  render(
    <ConnectorBreakdown
      connectors={CONNECTORS}
      format={(value) => String(value)}
    />
  );

describe('ConnectorBreakdown', () => {
  it('renders one row per connector, count beside its name', () => {
    renderBreakdown();
    const rows = screen.getAllByRole('listitem');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Snowflake');
    expect(rows[0]).toHaveTextContent('800');
  });

  // A grid sized every entry to the widest one, so a short name and a long
  // count sat a column apart and the rows-per-line was decided by a breakpoint
  // rather than by what actually fits.
  it('packs entries at their natural width and wraps', () => {
    renderBreakdown();
    const list = screen.getByRole('list');

    expect(list).toHaveClass('tw:flex', 'tw:flex-wrap');
    expect(list.className).not.toMatch(/grid/);
  });

  it('does not push the count away from its connector', () => {
    renderBreakdown();
    const count = screen.getByText('800');

    expect(count).not.toHaveClass('tw:ml-auto');
  });

  // Truncating is what forces a fixed width; at natural width the name is
  // simply as wide as it is and the entry wraps to the next line instead.
  it('shows connector names in full rather than truncating them', () => {
    render(
      <ConnectorBreakdown
        connectors={[{ count: 65, key: 'BigQuery', name: 'Big Query' }]}
        format={String}
      />
    );

    expect(screen.getByText('Big Query')).toBeInTheDocument();
  });

  it('cases the heading in CSS so translations are not pre-uppercased', () => {
    renderBreakdown();

    expect(screen.getByText('label.by-connector')).toHaveClass('tw:uppercase');
  });

  it('renders nothing when every connector is empty', () => {
    const { container } = render(
      <ConnectorBreakdown
        connectors={[{ count: 0, key: 'Snowflake', name: 'Snowflake' }]}
        format={String}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
