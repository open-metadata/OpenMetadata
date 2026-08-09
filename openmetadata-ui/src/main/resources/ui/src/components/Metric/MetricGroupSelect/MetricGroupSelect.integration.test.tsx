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
import {
  getMetricGroupByFqn,
  getMetricGroups,
} from '../../../rest/metricGroupsAPI';
import MetricGroupSelect from './MetricGroupSelect';

jest.mock('../../../rest/metricGroupsAPI', () => ({
  getMetricGroupByFqn: jest.fn(),
  getMetricGroups: jest.fn(),
}));

describe('MetricGroupSelect Untitled ComboBox integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMetricGroups as jest.Mock).mockResolvedValue({
      data: [{ id: 'grp-1', name: 'profitability' }],
      paging: { total: 1 },
    });
    (getMetricGroupByFqn as jest.Mock).mockRejectedValue(
      Object.assign(new Error('not found'), {
        isAxiosError: true,
        response: { status: 404 },
      })
    );
  });

  it('commits a keyboard-selected custom group through the real ComboBox', async () => {
    const onChange = jest.fn();

    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }>
        <MetricGroupSelect onChange={onChange} />
      </QueryClientProvider>
    );

    const input = await screen.findByRole('combobox', {
      name: 'label.metric-group',
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'retention' } });
    await waitFor(() =>
      expect(getMetricGroupByFqn).toHaveBeenCalledWith('retention')
    );
    await waitFor(() => {
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenLastCalledWith('retention', true);
    });
  });
});
