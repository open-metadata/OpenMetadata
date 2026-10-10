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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ClassicTestCaseFilter } from './ClassicTestCaseFilter';
import { FilterDescriptor, FilterValue } from './FilterChip.interface';

const descriptor: FilterDescriptor = {
  key: 'testCaseStatus',
  paramKey: 'testCaseStatus',
  label: 'Status',
  controlType: 'multiselect',
  searchable: false,
  options: [
    { value: 'Success', label: 'Success' },
    { value: 'Queued', label: 'Queued' },
    { value: 'Failed', label: 'Failed' },
  ],
  isLoading: false,
  onGetInitialOptions: () => undefined,
  onChange: () => undefined,
};
const ControlledFilter = ({
  filter = descriptor,
}: {
  filter?: FilterDescriptor;
}) => {
  const [value, setValue] = useState<FilterValue>(filter.value);

  return (
    <ClassicTestCaseFilter
      filter={{ ...filter, value, onChange: setValue }}
      testId="filter"
    />
  );
};

describe('ClassicTestCaseFilter', () => {
  it('filters local dimension options and submits the option value', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onChange = jest.fn();
    render(
      <ClassicTestCaseFilter
        filter={{
          ...descriptor,
          key: 'dataQualityDimension',
          label: 'Dimension',
          controlType: 'select',
          options: [
            { value: 'Completeness', label: 'Completeness' },
            { value: 'Accuracy', label: 'Accuracy' },
          ],
          onChange,
        }}
        testId="filter"
      />
    );
    await user.type(
      screen.getByRole('combobox', { name: 'Dimension' }),
      'Accuracy'
    );

    expect(
      screen.queryByRole('option', { name: 'Completeness' })
    ).not.toBeInTheDocument();

    await user.click(await screen.findByRole('option', { name: 'Accuracy' }));

    expect(onChange).toHaveBeenCalledWith('Accuracy');
  });

  it('keeps multiple selections and removes only the selected chip', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<ControlledFilter />);
    const input = screen.getByRole('combobox', { name: 'Status' });
    await user.click(input);
    await user.click(await screen.findByRole('option', { name: 'Success' }));
    await user.click(input);
    await user.click(await screen.findByRole('option', { name: 'Queued' }));
    await user.keyboard('{Escape}');

    expect(screen.getAllByTestId('autocomplete-selected-item')).toHaveLength(2);

    const successChip = screen
      .getByText('Success')
      .closest('[data-testid=autocomplete-selected-item]');
    if (!successChip) {
      throw new Error('Success chip missing');
    }
    await user.click(within(successChip as HTMLElement).getByRole('button'));

    expect(screen.getAllByTestId('autocomplete-selected-item')).toHaveLength(1);
    expect(screen.getByTestId('autocomplete-selected-item')).toHaveTextContent(
      'Queued'
    );
  });

  it('synchronizes a changed URL value and retains options missing from the first server page', async () => {
    const { rerender } = render(
      <ClassicTestCaseFilter
        filter={{ ...descriptor, value: 'Success' }}
        testId="filter"
      />
    );

    expect(screen.getByTestId('autocomplete-selected-item')).toHaveTextContent(
      'Success'
    );

    rerender(
      <ClassicTestCaseFilter
        filter={{ ...descriptor, value: ['Queued', 'Pending'] }}
        testId="filter"
      />
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('autocomplete-selected-item')).toHaveLength(
        2
      )
    );

    expect(screen.getByTestId('filter')).toHaveTextContent('Queued');
    expect(screen.getByTestId('filter')).toHaveTextContent('Pending');
    expect(screen.getByTestId('filter')).not.toHaveTextContent('Success');
  });

  it('searches manually typed text equal to a loaded label without selecting it', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onSearch = jest.fn();
    const onChange = jest.fn();
    render(
      <ClassicTestCaseFilter
        filter={{
          ...descriptor,
          key: 'tableFqn',
          label: 'Table',
          controlType: 'select',
          searchable: true,
          options: [{ value: 'service.table', label: 'Orders' }],
          onSearch,
          onChange,
        }}
        testId="filter"
      />
    );
    await user.type(screen.getByRole('combobox', { name: 'Table' }), 'Orders');

    expect(onSearch).toHaveBeenLastCalledWith('Orders');
    expect(onChange).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('option', { name: 'Orders' }));

    expect(onChange).toHaveBeenCalledWith('service.table');
  });

  it('clears the single selection without choosing a different option', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ControlledFilter
        filter={{
          ...descriptor,
          key: 'testCaseType',
          label: 'Type',
          controlType: 'select',
          value: 'Success',
        }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'label.clear Type' }));

    expect(screen.getByRole('button', { name: 'Type Type' })).toHaveTextContent(
      'Type'
    );
    expect(
      screen.queryByRole('button', { name: 'label.clear Type' })
    ).not.toBeInTheDocument();
  });
});
