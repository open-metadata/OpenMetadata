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
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import MetricMeasures from './MetricMeasures';

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(),
}));

jest.mock('../MetricSemanticList/MetricSemanticList', () =>
  jest.fn(({ items, fieldKey, getBadge }) => (
    <div data-testid="semantic-list">
      <span data-testid="field-key">{fieldKey}</span>
      <span data-testid="count">{items.length}</span>
      {items.map((item: { name: string }) => (
        <span data-testid={`badge-${item.name}`} key={item.name}>
          {getBadge(item)}
        </span>
      ))}
    </div>
  ))
);

describe('MetricMeasures', () => {
  it('passes the metric measures through with aggregation as the badge', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: {
        id: 'metric-1',
        name: 'revenue',
        measures: [{ name: 'total_revenue', aggregation: 'SUM' }],
      },
    });

    render(<MetricMeasures />);

    expect(screen.getByTestId('field-key')).toHaveTextContent('measures');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('badge-total_revenue')).toHaveTextContent('SUM');
  });

  it('passes an empty list when the metric has no measures', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { id: 'metric-1', name: 'revenue' },
    });

    render(<MetricMeasures />);

    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
