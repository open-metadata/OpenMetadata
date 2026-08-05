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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import {
  LabelType,
  Metric,
  State,
  TagSource,
} from '../../../generated/entity/data/metric';
import { searchQuery } from '../../../rest/searchAPI';
import { TaskEntityType } from '../../../rest/tasksAPI';
import MetricTaskCreateDialog from './MetricTaskCreateDialog';

jest.mock('@openmetadata/ui-core-components', () => ({
  Alert: ({ title }: { title: ReactNode }) => <div>{title}</div>,
  Box: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  Button: ({
    children,
    'data-testid': dataTestId,
    isDisabled,
    onPress,
  }: {
    children: ReactNode;
    'data-testid'?: string;
    isDisabled?: boolean;
    onPress?: () => void;
  }) => (
    <button data-testid={dataTestId} disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
  Checkbox: ({
    'aria-label': ariaLabel,
    isSelected,
    onChange,
  }: {
    'aria-label': string;
    isSelected: boolean;
    onChange: () => void;
  }) => (
    <input
      aria-label={ariaLabel}
      checked={isSelected}
      type="checkbox"
      onChange={onChange}
    />
  ),
  Dialog: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Footer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    }
  ),
  Input: ({
    'aria-label': ariaLabel,
    inputDataTestId,
    onChange,
    value,
  }: {
    'aria-label': string;
    inputDataTestId: string;
    onChange: (value: string) => void;
    value: string;
  }) => (
    <input
      aria-label={ariaLabel}
      data-testid={inputDataTestId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModalOverlay: ({
    children,
    isOpen,
  }: {
    children: ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div>{children}</div> : null),
  Select: Object.assign(
    ({
      children,
      'data-testid': dataTestId,
      onChange,
      value,
    }: {
      children: ReactNode;
      'data-testid'?: string;
      onChange: (value: string) => void;
      value: string;
    }) => (
      <select
        data-testid={dataTestId}
        value={value}
        onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    ),
    {
      Item: ({ id, label }: { id: string; label: ReactNode }) => (
        <option value={id}>{label}</option>
      ),
    }
  ),
  Skeleton: () => <div data-testid="skeleton" />,
  TextArea: ({
    'aria-label': ariaLabel,
    'data-testid': dataTestId,
    onChange,
    value,
  }: {
    'aria-label': string;
    'data-testid': string;
    onChange: (value: string) => void;
    value: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      data-testid={dataTestId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  Typography: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('../../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));

const metric: Metric = {
  description: 'Current definition',
  fullyQualifiedName: 'revenue',
  id: 'metric-1',
  name: 'revenue',
  tags: [
    {
      labelType: LabelType.Manual,
      source: TagSource.Classification,
      state: State.Confirmed,
      tagFQN: 'Tier.Tier1',
    },
  ],
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('MetricTaskCreateDialog', () => {
  it('creates a description update task with the metric entity link', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'user-1',
            _source: {
              displayName: 'Alice',
              entityType: 'user',
              fullyQualifiedName: 'alice',
            },
          },
        ],
      },
    });
    const onCreate = jest.fn().mockResolvedValue({ id: 'task-1' });
    render(
      <MetricTaskCreateDialog
        open
        metric={metric}
        onClose={jest.fn()}
        onCreate={onCreate}
      />,
      { wrapper }
    );

    fireEvent.change(screen.getByTestId('metric-task-create-title'), {
      target: { value: 'Clarify definition' },
    });
    await waitFor(() => expect(screen.getByLabelText('Alice')).toBeVisible());
    fireEvent.click(screen.getByLabelText('Alice'));
    fireEvent.change(screen.getByTestId('metric-task-create-value'), {
      target: { value: 'Net recurring revenue' },
    });
    fireEvent.click(screen.getByTestId('metric-task-create-submit'));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        about: '<#E::metric::revenue>',
        assignees: ['alice'],
        category: 'MetadataUpdate',
        payload: {
          currentDescription: 'Current definition',
          fieldPath: 'description',
          newDescription: 'Net recurring revenue',
        },
        type: TaskEntityType.DescriptionUpdate,
      })
    );
  });

  it('supports keyboard selection and accessible picker paging', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'user-1',
            _source: {
              displayName: 'Alice',
              entityType: 'user',
              fullyQualifiedName: 'alice',
            },
          },
        ],
        total: { value: 20 },
      },
    });
    render(
      <MetricTaskCreateDialog
        open
        metric={metric}
        onClose={jest.fn()}
        onCreate={jest.fn()}
      />,
      { wrapper }
    );

    const checkbox = await screen.findByRole('checkbox', { name: 'Alice' });
    act(() => checkbox.focus());

    expect(checkbox).toHaveFocus();

    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(
      screen.getByRole('list', { name: 'label.assignee-plural' })
    ).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    fireEvent.click(
      screen.getByTestId('metric-task-create-assignees-load-more')
    );
    await waitFor(() =>
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 20 })
      )
    );
  });

  it('creates a tag update task with suggested classification tags', async () => {
    (searchQuery as jest.Mock).mockImplementation(
      ({ searchIndex }: { searchIndex: SearchIndex[] }) =>
        Promise.resolve({
          hits: {
            hits: searchIndex.includes(SearchIndex.USER)
              ? [
                  {
                    _id: 'user-1',
                    _source: {
                      displayName: 'Alice',
                      entityType: 'user',
                      fullyQualifiedName: 'alice',
                    },
                  },
                ]
              : [
                  {
                    _id: 'tag-1',
                    _source: {
                      displayName: 'Sensitive',
                      entityType: 'tag',
                      fullyQualifiedName: 'PII.Sensitive',
                    },
                  },
                  {
                    _id: 'term-1',
                    _source: {
                      displayName: 'Critical',
                      entityType: 'glossaryTerm',
                      fullyQualifiedName: 'Business.Critical',
                    },
                  },
                ],
          },
        })
    );
    const onCreate = jest.fn().mockResolvedValue({ id: 'task-2' });
    render(
      <MetricTaskCreateDialog
        open
        metric={metric}
        onClose={jest.fn()}
        onCreate={onCreate}
      />,
      { wrapper }
    );

    fireEvent.change(screen.getByTestId('metric-task-create-type'), {
      target: { value: TaskEntityType.TagUpdate },
    });
    fireEvent.change(screen.getByTestId('metric-task-create-title'), {
      target: { value: 'Add governance tags' },
    });
    await waitFor(() => expect(screen.getByLabelText('Alice')).toBeVisible());
    fireEvent.click(screen.getByLabelText('Alice'));
    await waitFor(() =>
      expect(screen.getByLabelText('Sensitive')).toBeVisible()
    );
    fireEvent.click(screen.getByLabelText('Sensitive'));
    fireEvent.click(screen.getByLabelText('Critical'));
    fireEvent.click(screen.getByTestId('metric-task-create-submit'));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          operation: 'Add',
          tagsToAdd: [
            expect.objectContaining({
              source: 'Classification',
              tagFQN: 'PII.Sensitive',
            }),
            expect.objectContaining({
              source: 'Glossary',
              tagFQN: 'Business.Critical',
            }),
          ],
        }),
        type: TaskEntityType.TagUpdate,
      })
    );
  });
});
