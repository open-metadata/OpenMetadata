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
import type { SelectWidgetProps } from '@react-awesome-query-builder/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import OMSelectWidget from './OMSelectWidget';

// The real Select.ComboBox is react-aria driven and its overlay cannot be
// opened under jsdom (positioning hangs). It is a boundary from a separate
// package, so mock it with the minimal surface the widget uses: a "Show
// options" button that reports open via onOpenChange, and an input that reports
// typed text via onInputChange. This lets us assert the widget's own behaviour
// (reload the full list on open, honour the request-ordering guard) without
// react-aria internals.
jest.mock('@openmetadata/ui-core-components', () => {
  const ReactModule = jest.requireActual('react');
  const Select: {
    (props: { isDisabled?: boolean }): JSX.Element;
    ComboBox?: (props: {
      isDisabled?: boolean;
      items?: { id: string; label: string }[];
      selectedKey?: string | null;
      onOpenChange?: (isOpen: boolean) => void;
      onInputChange?: (value: string) => void;
    }) => JSX.Element;
  } = ({ isDisabled }) =>
    ReactModule.createElement('button', { disabled: isDisabled }, 'select');
  Select.ComboBox = ({
    isDisabled,
    items,
    selectedKey,
    onOpenChange,
    onInputChange,
  }) =>
    ReactModule.createElement(
      'div',
      // String() keeps null and undefined apart: they are a controlled empty selection and an uncontrolled one.
      { 'data-selected-key': String(selectedKey) },
      ReactModule.createElement(
        'button',
        {
          disabled: isDisabled,
          'aria-label': 'Show options',
          onClick: () => onOpenChange?.(true),
        },
        'open'
      ),
      ReactModule.createElement('input', {
        role: 'combobox',
        onChange: (event: { target: { value: string } }) =>
          onInputChange?.(event.target.value),
      }),
      ReactModule.createElement(
        'ul',
        { 'data-testid': 'options' },
        (items ?? []).map((item: { id: string; label: string }) =>
          ReactModule.createElement('li', { key: item.id }, item.label)
        )
      )
    );

  return { Select };
});

const baseProps = {
  placeholder: 'Select option',
  value: null,
  setValue: jest.fn(),
  readonly: false,
  listValues: [
    { value: 'opt1', title: 'Option 1' },
    { value: 'opt2', title: 'Option 2' },
  ],
  useAsyncSearch: false,
  showSearch: false,
  field: {},
  fieldDefinition: {},
  fieldSrc: 'value' as const,
  operator: 'select_equals',
  config: {},
  widgetId: 'test',
} as unknown as SelectWidgetProps;

describe('OMSelectWidget', () => {
  it('renders without crashing', () => {
    render(<OMSelectWidget {...baseProps} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is disabled when readonly', () => {
    render(<OMSelectWidget {...baseProps} readonly />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('searches static options by label and restores them when cleared', () => {
    render(
      <OMSelectWidget
        {...baseProps}
        showSearch
        listValues={[
          { value: 'table', title: 'Table' },
          { value: 'testCase', title: 'Test Case' },
        ]}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'tEsT' },
    });

    expect(screen.getByTestId('options')).toHaveTextContent('Test Case');
    expect(screen.getByTestId('options')).not.toHaveTextContent('Table');

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '' },
    });

    expect(screen.getByTestId('options').children).toHaveLength(2);
  });

  it('restores the full option list from cache when the dropdown is reopened', async () => {
    const allOptions = [
      { value: 'opt1', title: 'Option 1' },
      { value: 'opt2', title: 'Option 2' },
    ];
    // Mirror the server: an empty query returns the full page, a specific query
    // returns only its matches (so selecting narrows the list to one option).
    const asyncFetch = jest.fn().mockImplementation((search: string) =>
      Promise.resolve({
        values: search
          ? allOptions.filter((option) => option.title === search)
          : allOptions,
      })
    );
    render(
      <OMSelectWidget
        {...baseProps}
        useAsyncSearch
        asyncFetch={asyncFetch}
        listValues={undefined}
        value="opt1"
      />
    );

    // Seed fetch fires once on mount and populates the full option list.
    await waitFor(() => expect(asyncFetch).toHaveBeenCalledWith(''));
    await waitFor(() =>
      expect(screen.getByTestId('options').children).toHaveLength(2)
    );

    // React Aria echoes the selected item's label back through onInputChange
    // when the popup opens. Refetching on that echo searches for the value
    // already chosen, which collapsed the list to that one option and left the
    // user unable to switch. The echo must not refetch.
    const callsAfterSeed = asyncFetch.mock.calls.length;

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Option 1' },
    });

    expect(screen.getByTestId('options').children).toHaveLength(2);
    expect(asyncFetch).toHaveBeenCalledTimes(callsAfterSeed);

    // A genuine search still narrows.
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Option 2' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('options').children).toHaveLength(1)
    );

    // Reopening restores the full option set immediately from the cached
    // defaults. It must NOT trigger a background loadAsync('') — doing so
    // races the debounced default fetch against the user's typed search and
    // can clobber the search result (see onOpenChange in OMSelectWidget).
    const callsBeforeReopen = asyncFetch.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Show options' }));

    expect(screen.getByTestId('options').children).toHaveLength(2);
    expect(asyncFetch).toHaveBeenCalledTimes(callsBeforeReopen);
  });

  it('keeps the async select controlled when its value is cleared', async () => {
    const asyncProps = {
      ...baseProps,
      useAsyncSearch: true,
      asyncFetch: jest
        .fn()
        .mockResolvedValue({ values: [{ value: 'opt1', title: 'Option 1' }] }),
      listValues: undefined,
    } as unknown as SelectWidgetProps;
    const { container, rerender } = render(
      <OMSelectWidget {...asyncProps} value="opt1" />
    );
    const comboBox = () =>
      container.querySelector('[data-selected-key]') as HTMLElement;

    await waitFor(() =>
      expect(screen.getByTestId('options').children).toHaveLength(1)
    );

    expect(comboBox()).toHaveAttribute('data-selected-key', 'opt1');

    // An undefined selectedKey makes React Aria own the selection, and clearing the input (Cmd+Delete) then looped
    // until React threw "Maximum update depth exceeded".
    rerender(<OMSelectWidget {...asyncProps} value={null} />);

    expect(comboBox()).toHaveAttribute('data-selected-key', 'null');

    rerender(<OMSelectWidget {...asyncProps} value={undefined} />);

    expect(comboBox()).toHaveAttribute('data-selected-key', 'null');
  });

  it('still searches when the user types something other than the selection', async () => {
    const allOptions = [
      { value: 'opt1', title: 'Option 1' },
      { value: 'opt2', title: 'Option 2' },
    ];
    const asyncFetch = jest.fn().mockImplementation((search: string) =>
      Promise.resolve({
        values: search
          ? allOptions.filter((option) => option.title === search)
          : allOptions,
      })
    );
    render(
      <OMSelectWidget
        {...baseProps}
        useAsyncSearch
        asyncFetch={asyncFetch}
        listValues={undefined}
        value="opt1"
      />
    );

    await waitFor(() => expect(asyncFetch).toHaveBeenCalledWith(''));

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Option 2' },
    });

    await waitFor(() =>
      expect(asyncFetch).toHaveBeenLastCalledWith('Option 2')
    );
  });
});
