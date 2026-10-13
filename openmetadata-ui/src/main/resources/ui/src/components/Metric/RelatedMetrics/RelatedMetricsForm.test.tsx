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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { searchQuery } from '../../../rest/searchAPI';
import { RelatedMetricsForm } from './RelatedMetricsForm';

jest.mock('../../../rest/searchAPI');

const mockSearchQuery = searchQuery as jest.Mock;
const onSubmit = jest.fn().mockResolvedValue(undefined);
const onCancel = jest.fn();

const renderForm = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <RelatedMetricsForm
        defaultValue={['existing']}
        initialOptions={[
          {
            label: 'Existing Metric',
            value: 'existing',
            reference: { id: 'existing', type: 'metric' },
          },
        ]}
        metricFqn="finance.current"
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </QueryClientProvider>
  );

describe('RelatedMetricsForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [], total: { value: 0 } },
    });
  });

  it('searches metrics, excludes the current metric, and submits selected references', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'current',
              name: 'current',
              fullyQualifiedName: 'finance.current',
            },
          },
          {
            _source: {
              id: 'candidate',
              name: 'candidate',
              displayName: 'Candidate Metric',
              fullyQualifiedName: 'finance.candidate',
            },
          },
        ],
        total: { value: 2 },
      },
    });
    renderForm();

    expect(await screen.findByText('Candidate Metric')).toBeInTheDocument();
    expect(screen.queryByText('current')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Candidate Metric' }));
    fireEvent.click(screen.getByTestId('saveRelatedMetrics'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith([
        expect.objectContaining({ value: 'existing' }),
        expect.objectContaining({ value: 'candidate' }),
      ])
    );
  });

  it('disables actions while submitting and supports cancellation', async () => {
    let resolveSubmit: () => void = () => undefined;
    onSubmit.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      })
    );
    renderForm();
    await screen.findByText('Existing Metric');

    fireEvent.click(screen.getByTestId('saveRelatedMetrics'));

    expect(screen.getByTestId('saveRelatedMetrics')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByTestId('cancelRelatedMetrics')).toBeDisabled();

    resolveSubmit();
    await waitFor(() =>
      expect(screen.getByTestId('saveRelatedMetrics')).not.toHaveAttribute(
        'aria-disabled',
        'true'
      )
    );
    fireEvent.click(screen.getByTestId('cancelRelatedMetrics'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable fetch error', async () => {
    mockSearchQuery.mockRejectedValue(new Error('search failed'));
    renderForm();

    expect(
      await screen.findByText('server.entity-fetch-error')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.try-again' }));
    await waitFor(() => expect(mockSearchQuery).toHaveBeenCalledTimes(2));
  });

  it('supports an embedded picker without rendering nested actions', async () => {
    const onSelectionChange = jest.fn();
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'candidate',
              name: 'candidate',
              fullyQualifiedName: 'finance.candidate',
            },
          },
        ],
        total: { value: 1 },
      },
    });
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }>
        <RelatedMetricsForm
          metricFqn="finance.current"
          showActions={false}
          onCancel={jest.fn()}
          onSelectionChange={onSelectionChange}
          onSubmit={jest.fn()}
        />
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByRole('checkbox', { name: 'candidate' }));

    expect(onSelectionChange).toHaveBeenCalledWith([
      expect.objectContaining({ value: 'candidate' }),
    ]);
    expect(screen.queryByTestId('saveRelatedMetrics')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('cancelRelatedMetrics')
    ).not.toBeInTheDocument();
  });
});
