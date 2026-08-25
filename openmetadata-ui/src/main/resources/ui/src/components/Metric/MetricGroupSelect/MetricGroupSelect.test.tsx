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
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import {
  getMetricGroupByFqn,
  getMetricGroups,
} from '../../../rest/metricGroupsAPI';
import MetricGroupSelect from './MetricGroupSelect';

interface MockItem {
  id: string;
  label: string;
  supportingText?: string;
}

jest.mock('../../../rest/metricGroupsAPI', () => ({
  getMetricGroupByFqn: jest.fn(),
  getMetricGroups: jest.fn(),
}));

// The real ComboBox is react-aria and needs a live popover to expose its options; the mock renders
// every item as a button so the test can assert on what the component decided to offer.
jest.mock('@openmetadata/ui-core-components', () => ({
  Alert: ({ children, title }: { children: ReactNode; title: string }) => (
    <div role="alert">
      {title}
      {children}
    </div>
  ),
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComboBox: ({
    children,
    hint,
    inputValue,
    items,
    onKeyDown,
    onInputChange,
    onSelectionChange,
    'data-testid': testId,
  }: {
    hint?: string;
    inputValue: string;
    items: MockItem[];
    onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
    onInputChange: (value: string) => void;
    onSelectionChange: (key: string | null) => void;
    'data-testid'?: string;
    children: (item: MockItem) => ReactNode;
  }) => (
    <div data-testid={testId}>
      <input
        aria-label={hint}
        data-testid="group-input"
        value={inputValue}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown(event);
          if (event.key === 'Enter') {
            onSelectionChange(null);
          }
        }}
      />
      <button
        aria-label="group-null-selection"
        data-testid="group-null-selection"
        type="button"
        onClick={() => onSelectionChange(null)}
      />
      {hint && <span>{hint}</span>}
      {items.map((item) => (
        <div key={item.id}>
          {children(item)}
          <button
            data-testid={`group-option-${item.id}`}
            type="button"
            onClick={() => onSelectionChange(item.id)}>
            {item.label}
          </button>
        </div>
      ))}
    </div>
  ),
  SelectItem: jest.fn(() => null),
  Skeleton: () => <div data-testid="group-loading" />,
}));

const renderSelect = (onChange = jest.fn()) => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <MetricGroupSelect onChange={onChange} />
    </QueryClientProvider>
  );

  return onChange;
};

describe('MetricGroupSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMetricGroups as jest.Mock).mockResolvedValue({
      data: [{ id: 'grp-1', name: 'profitability', description: 'Margins' }],
      paging: { total: 1 },
    });
    (getMetricGroupByFqn as jest.Mock).mockRejectedValue(
      Object.assign(new Error('not found'), {
        isAxiosError: true,
        response: { status: 404 },
      })
    );
  });

  it('reports an existing group as existing so the caller does not recreate it', async () => {
    const onChange = renderSelect();

    fireEvent.click(await screen.findByTestId('group-option-profitability'));

    expect(onChange).toHaveBeenCalledWith('profitability', false);
  });

  it('offers to create a group when the typed name is not on the server', async () => {
    const onChange = renderSelect();

    await screen.findByTestId('group-option-profitability');

    fireEvent.change(screen.getByTestId('group-input'), {
      target: { value: 'retention' },
    });

    fireEvent.click(await screen.findByTestId('group-option-retention'));

    expect(onChange).toHaveBeenLastCalledWith('retention', true);
    expect(getMetricGroupByFqn).toHaveBeenCalledWith('retention');
  });

  it('preserves unresolved input when the ComboBox reports a null selection', async () => {
    const onChange = renderSelect();

    await screen.findByTestId('group-option-profitability');
    fireEvent.change(screen.getByTestId('group-input'), {
      target: { value: 'retention' },
    });
    fireEvent.click(screen.getByTestId('group-null-selection'));

    expect(screen.getByTestId('group-input')).toHaveValue('retention');
    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByTestId('group-option-retention')).toBeVisible();
  });

  it('commits a synthetic create option with the Enter key', async () => {
    const onChange = renderSelect();

    await screen.findByTestId('group-option-profitability');
    fireEvent.change(screen.getByTestId('group-input'), {
      target: { value: 'retention' },
    });
    await screen.findByTestId('group-option-retention');

    fireEvent.keyDown(screen.getByTestId('group-input'), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('retention', true);
  });

  it('does not offer to create a group that already exists', async () => {
    renderSelect();

    await screen.findByTestId('group-option-profitability');

    fireEvent.change(screen.getByTestId('group-input'), {
      target: { value: 'profitability' },
    });

    // Two rows for one group would let the user "create" a duplicate that the server then rejects.
    await waitFor(() =>
      expect(screen.getAllByTestId('group-option-profitability')).toHaveLength(
        1
      )
    );
  });

  it('treats a name that differs only by surrounding space as the same group', async () => {
    renderSelect();

    await screen.findByTestId('group-option-profitability');

    fireEvent.change(screen.getByTestId('group-input'), {
      target: { value: '  profitability  ' },
    });

    // Untrimmed, the padded text looks like a different name and the component would offer to
    // create a second "profitability" group.
    await waitFor(() =>
      expect(
        screen.queryByTestId('group-option-  profitability  ')
      ).not.toBeInTheDocument()
    );

    expect(screen.getAllByTestId(/^group-option-/)).toHaveLength(1);
  });

  it('bounds the option request and renders an accessible loading state', async () => {
    let resolveGroups: (value: unknown) => void = (_value) => undefined;
    (getMetricGroups as jest.Mock).mockReturnValueOnce(
      new Promise((resolve: (value: unknown) => void) => {
        resolveGroups = resolve;
      })
    );
    renderSelect();

    expect(
      screen.getByRole('status', { name: 'label.loading' })
    ).toBeInTheDocument();
    expect(getMetricGroups).toHaveBeenCalledWith({ limit: 50 });

    resolveGroups({ data: [], paging: { total: 0 } });
    await waitFor(() =>
      expect(screen.queryByTestId('group-loading')).not.toBeInTheDocument()
    );
  });

  it('shows a retry action when groups cannot be loaded', async () => {
    (getMetricGroups as jest.Mock).mockRejectedValue(new Error('failed'));
    renderSelect();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'server.entity-fetch-error'
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.try-again' }));
    await waitFor(() => expect(getMetricGroups).toHaveBeenCalledTimes(2));
  });

  it('resolves an existing group beyond the bounded initial page', async () => {
    (getMetricGroups as jest.Mock).mockResolvedValue({
      data: [{ id: 'grp-1', name: 'profitability' }],
      paging: { after: 'next-page', total: 51 },
    });
    (getMetricGroupByFqn as jest.Mock).mockResolvedValue({
      id: 'grp-51',
      name: 'retention',
      description: 'Customer retention',
    });
    const onChange = renderSelect();

    fireEvent.change(await screen.findByTestId('group-input'), {
      target: { value: 'retention' },
    });

    fireEvent.click(await screen.findByTestId('group-option-retention'));

    expect(getMetricGroups).toHaveBeenCalledWith({ limit: 50 });
    expect(getMetricGroupByFqn).toHaveBeenCalledWith('retention');
    expect(onChange).toHaveBeenCalledWith('retention', false);
    expect(screen.getAllByTestId('group-option-retention')).toHaveLength(1);
  });

  it('does not offer creation while exact resolution fails and supports retry', async () => {
    (getMetricGroupByFqn as jest.Mock).mockRejectedValue(
      Object.assign(new Error('failed'), { isAxiosError: true })
    );
    renderSelect();

    fireEvent.change(await screen.findByTestId('group-input'), {
      target: { value: 'retention' },
    });

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('server.entity-fetch-error');
    expect(
      screen.queryByTestId('group-option-retention')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.try-again' }));

    await waitFor(() => expect(getMetricGroupByFqn).toHaveBeenCalledTimes(2));
  });
});
