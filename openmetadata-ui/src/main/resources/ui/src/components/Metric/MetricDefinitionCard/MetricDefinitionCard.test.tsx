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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  Language,
  Metric,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/entity/data/metric';
import MetricDefinitionCard from './MetricDefinitionCard';

jest.mock('../RelatedMetrics/RelatedMetricsForm', () => ({
  RelatedMetricsForm: ({
    onSelectionChange,
  }: {
    onSelectionChange: (options: unknown[]) => void;
  }) => (
    <button
      data-testid="select-related-definition"
      onClick={() =>
        onSelectionChange([
          {
            label: 'Revenue',
            value: 'revenue-id',
            reference: {
              id: 'revenue-id',
              name: 'revenue',
              type: 'metric',
            },
          },
        ])
      }>
      select related
    </button>
  ),
}));

const metric = {
  id: 'metric-id',
  name: 'gross_margin',
  fullyQualifiedName: 'finance.gross_margin',
  metricExpression: { code: 'SUM(profit)', language: Language.SQL },
  metricType: MetricType.Ratio,
  unitOfMeasurement: UnitOfMeasurement.Percentage,
  granularity: MetricGranularity.Day,
  relatedMetrics: [
    {
      id: 'related-id',
      name: 'net_margin',
      displayName: 'Net Margin',
      fullyQualifiedName: 'finance.net_margin',
      type: 'metric',
    },
  ],
} as Metric;

describe('MetricDefinitionCard', () => {
  it('renders the complete definition and related metrics', () => {
    const { container } = render(
      <MemoryRouter>
        <MetricDefinitionCard canEdit metric={metric} onUpdate={jest.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('metric-definition-card')).toHaveClass(
      'tw:shadow-xs'
    );
    expect(screen.getByTestId('metric-definition-icon')).toHaveClass(
      'tw:size-4',
      'tw:text-fg-tertiary'
    );
    expect(
      container.querySelector('[data-testid="metric-definition-icon"]')
        ?.parentElement
    ).not.toHaveClass('tw:rounded-lg');
    expect(screen.getByText(Language.SQL)).toBeInTheDocument();
    expect(screen.getByText('SUM(profit)')).toBeInTheDocument();
    expect(screen.getByTestId('metric-expression-panel')).toHaveClass(
      'tw:border',
      'tw:border-secondary'
    );
    expect(screen.getByTestId('metric-expression-header')).toHaveClass(
      'tw:bg-primary'
    );
    expect(screen.getByTestId('metric-expression-code')).toHaveClass(
      'tw:bg-secondary'
    );
    expect(screen.getByTestId('metric-definition-fields')).toHaveClass(
      'tw:grid',
      'tw:lg:grid-cols-4'
    );
    expect(screen.getByTestId('metric-definition-type')).toHaveTextContent(
      'label.ratio'
    );
    expect(screen.getByText('label.ratio')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase',
      'tw:tracking-wide'
    );
    expect(screen.getByTestId('metric-definition-unit')).toHaveTextContent(
      'label.percentage'
    );
    expect(
      screen.getByTestId('metric-definition-granularity')
    ).toHaveTextContent('label.day');

    const relatedMetricLink = screen.getByRole('link', {
      name: 'Net Margin',
    });

    expect(relatedMetricLink).toHaveAttribute(
      'href',
      expect.stringContaining('finance.net_margin')
    );
    expect(relatedMetricLink).toHaveClass('tw:bg-secondary', 'tw:text-xs');
    expect(screen.getByTestId('metric-definition-edit')).toHaveClass(
      'tw:shadow-none',
      'tw:after:outline-dashed'
    );
  });

  it('does not render excluded metric preview, execution, values, or trends', () => {
    render(
      <MemoryRouter>
        <MetricDefinitionCard metric={metric} onUpdate={jest.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/metric preview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current value/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/value trend/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /run/i })
    ).not.toBeInTheDocument();
  });

  it('shows a stable empty state when the metric has no expression or properties', () => {
    render(
      <MemoryRouter>
        <MetricDefinitionCard
          metric={{ id: 'empty', name: 'empty' } as Metric}
          onUpdate={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('metric-definition-card')).toBeInTheDocument();
    expect(screen.getAllByText('label.empty-dash')).not.toHaveLength(0);
  });

  it('edits every definition field and related Metric references in one update', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <MetricDefinitionCard canEdit metric={metric} onUpdate={onUpdate} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('metric-definition-edit'));

    expect(
      screen.getByTestId('metric-definition-edit-dialog')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /label.code/ }), {
      target: { value: 'SUM(gross_profit) / SUM(revenue)' },
    });
    fireEvent.click(screen.getByTestId('select-related-definition'));
    fireEvent.click(screen.getByTestId('metric-definition-save'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: MetricType.Ratio,
          unitOfMeasurement: UnitOfMeasurement.Percentage,
          granularity: MetricGranularity.Day,
          metricExpression: {
            code: 'SUM(gross_profit) / SUM(revenue)',
            language: Language.SQL,
          },
          relatedMetrics: [
            expect.objectContaining({ id: 'revenue-id', type: 'metric' }),
          ],
        })
      )
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId('metric-definition-edit-dialog')
      ).not.toBeInTheDocument()
    );
  });

  it('requires an expression before saving', async () => {
    const onUpdate = jest.fn();
    render(
      <MemoryRouter>
        <MetricDefinitionCard
          canEdit
          metric={{
            ...metric,
            metricExpression: { language: Language.SQL, code: '' },
          }}
          onUpdate={onUpdate}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('metric-definition-edit'));
    fireEvent.click(screen.getByTestId('metric-definition-save'));

    expect(await screen.findByText('label.field-required')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /label.code/ })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('requires a custom unit when Unit is Other', async () => {
    const onUpdate = jest.fn();
    render(
      <MemoryRouter>
        <MetricDefinitionCard
          canEdit
          metric={{
            ...metric,
            unitOfMeasurement: UnitOfMeasurement.Other,
            customUnitOfMeasurement: undefined,
          }}
          onUpdate={onUpdate}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('metric-definition-edit'));
    fireEvent.click(screen.getByTestId('metric-definition-save'));

    expect(await screen.findByText('label.field-required')).toBeInTheDocument();
    expect(screen.getByTestId('metric-definition-custom-unit')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('keeps a failed edit open and disables dismissal while saving', async () => {
    let rejectUpdate: (error: Error) => void = (_error) => undefined;
    const onUpdate = jest.fn().mockReturnValue(
      new Promise((_, reject) => {
        rejectUpdate = reject;
      })
    );
    render(
      <MemoryRouter>
        <MetricDefinitionCard canEdit metric={metric} onUpdate={onUpdate} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('metric-definition-edit'));
    fireEvent.click(screen.getByTestId('metric-definition-save'));

    expect(screen.getByTestId('metric-definition-save')).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    rejectUpdate(new Error('save failed'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByTestId('metric-definition-edit-dialog')
    ).toBeInTheDocument();
  });

  it('does not expose definition editing without permission or on deleted Metrics', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MetricDefinitionCard metric={metric} onUpdate={jest.fn()} />
      </MemoryRouter>
    );

    expect(
      screen.queryByTestId('metric-definition-edit')
    ).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <MetricDefinitionCard
          canEdit
          metric={{ ...metric, deleted: true }}
          onUpdate={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(
      screen.queryByTestId('metric-definition-edit')
    ).not.toBeInTheDocument();
  });
});
