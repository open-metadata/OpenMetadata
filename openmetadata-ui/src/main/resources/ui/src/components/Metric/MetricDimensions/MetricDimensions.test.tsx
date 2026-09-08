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
import { Type } from '../../../generated/entity/data/metric';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import MetricDimensions from './MetricDimensions';

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(),
}));

jest.mock('../MetricSemanticList/MetricSemanticList', () =>
  jest.fn(({ items, title, fieldKey, getBadge }) => (
    <div data-testid="semantic-list">
      <span data-testid="title">{title}</span>
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

describe('MetricDimensions', () => {
  it('passes the metric dimensions through with type as the badge', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: {
        id: 'metric-1',
        name: 'revenue',
        dimensions: [{ name: 'order_date', type: Type.Time }],
      },
    });

    render(<MetricDimensions />);

    expect(screen.getByTestId('field-key')).toHaveTextContent('dimensions');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('badge-order_date')).toHaveTextContent('TIME');
  });

  it('passes an empty list when the metric has no dimensions', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { id: 'metric-1', name: 'revenue' },
    });

    render(<MetricDimensions />);

    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
