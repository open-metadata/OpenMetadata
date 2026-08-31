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
import { EntityType } from '../../../enums/entity.enum';
import { Direction } from '../../../generated/api/data/metricObservability';
import MetricAssetSummary from './MetricAssetSummary';
import { useMetricAssetLineage } from './useMetricAssetLineage';

jest.mock('./useMetricAssetLineage');

describe('MetricAssetSummary', () => {
  it('separates asset columns from columns explicitly feeding the metric', () => {
    const onClose = jest.fn();
    (useMetricAssetLineage as jest.Mock).mockReturnValue({
      columns: [
        { fromColumns: ['orders.amount'], toColumn: 'revenue.value' },
        { fromColumns: ['orders.discount'] },
      ],
      error: undefined,
      isLoading: false,
      refetch: jest.fn(),
    });
    render(
      <MemoryRouter>
        <MetricAssetSummary
          details={{
            asset: {
              fullyQualifiedName: 'service.database.schema.orders',
              id: 'table-1',
              name: 'orders',
              type: EntityType.TABLE,
            },
            columns: ['amount', 'order_id'],
            containment: ['service', 'database', 'schema'],
            domains: [],
            glossaryTerms: [],
            owners: [],
            tags: ['PII.Sensitive'],
            tier: 'Tier.Tier1',
            usageCount: 42,
          }}
          metricFqn="revenue"
          relation={{
            affectsHealth: false,
            asset: {
              id: 'table-1',
              name: 'orders',
              type: EntityType.TABLE,
            },
            direction: Direction.Downstream,
          }}
          onClose={onClose}
        />
      </MemoryRouter>
    );

    const summary = screen.getByTestId('metric-asset-summary');

    expect(summary).toHaveTextContent('label.column-plural');
    expect(summary).toHaveTextContent('amount');
    expect(summary).toHaveTextContent('service');
    expect(summary).toHaveTextContent('database');
    expect(summary).toHaveTextContent('schema');
    expect(summary).toHaveTextContent('42');
    expect(summary).toHaveTextContent('label.columns-feeding-metric');
    expect(summary).toHaveTextContent('orders.amount');
    expect(summary).toHaveTextContent('label.empty-dash');
    expect(summary).toHaveTextContent(
      'message.metric-asset-not-health-relevant'
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/table/service.database.schema.orders'
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
