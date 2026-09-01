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
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import RelatedMetrics from './RelatedMetrics';

jest.mock('../../Customization/GenericProvider/GenericContext');
jest.mock('./RelatedMetricsForm', () => ({
  RelatedMetricsForm: ({ onCancel, onSubmit }: Record<string, unknown>) => (
    <div data-testid="related-form">
      <button onClick={onCancel as () => void}>cancel</button>
      <button
        onClick={() =>
          (onSubmit as (options: unknown[]) => Promise<void>)([
            {
              value: 'new',
              label: 'New',
              reference: { id: 'new', type: 'metric' },
            },
          ])
        }>
        submit
      </button>
    </div>
  ),
}));

const mockUseGenericContext = useGenericContext as jest.Mock;
const onUpdate = jest.fn().mockResolvedValue(undefined);
const relatedMetrics = Array.from({ length: 6 }, (_, index) => ({
  id: `metric-${index}`,
  name: `metric_${index}`,
  fullyQualifiedName: `finance.metric_${index}`,
  type: 'metric',
}));

const renderRelated = () =>
  render(
    <MemoryRouter>
      <RelatedMetrics />
    </MemoryRouter>
  );

describe('RelatedMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGenericContext.mockReturnValue({
      data: {
        id: 'metric',
        name: 'metric',
        fullyQualifiedName: 'finance.metric',
        relatedMetrics,
      },
      permissions: { EditAll: true },
      onUpdate,
    });
  });

  it('shows five metrics by default and expands the remainder', () => {
    renderRelated();

    expect(screen.getByText('metric_0')).toBeInTheDocument();
    expect(screen.queryByText('metric_5')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('show-more'));

    expect(screen.getByText('metric_5')).toBeInTheDocument();
  });

  it('edits and persists related Metric references', async () => {
    renderRelated();
    fireEvent.click(screen.getByTestId('edit-related-metrics'));
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedMetrics: [{ id: 'new', type: 'metric' }],
        }),
        'relatedMetrics'
      )
    );
  });

  it('hides edit controls without permission', () => {
    mockUseGenericContext.mockReturnValue({
      data: { id: 'metric', name: 'metric', relatedMetrics },
      permissions: { EditAll: false },
      onUpdate,
    });
    renderRelated();

    expect(
      screen.queryByTestId('edit-related-metrics')
    ).not.toBeInTheDocument();
  });
});
