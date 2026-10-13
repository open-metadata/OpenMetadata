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
import type { MultiSelectWidgetProps } from '@react-awesome-query-builder/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OMMultiSelectWidget from './OMMultiSelectWidget';

// The real Autocomplete is react-aria driven and its overlay cannot be opened
// under jsdom. It is a boundary from a separate package, so mock the surface the
// widget uses — the offered options, the picked values, and the search callback
// — and assert the widget's own behaviour through it.
jest.mock('@openmetadata/ui-core-components', () => {
  const ReactModule = jest.requireActual('react');
  const Autocomplete: {
    (props: {
      isDisabled?: boolean;
      items?: { id: string; label: string }[];
      selectedItems?: { id: string; label: string }[];
      onSearchChange?: (value: string) => void;
      onItemInserted?: (key: string) => void;
    }): JSX.Element;
    Item?: (props: { children?: unknown }) => JSX.Element;
  } = ({ isDisabled, items, selectedItems, onSearchChange, onItemInserted }) =>
    ReactModule.createElement(
      'div',
      null,
      ReactModule.createElement('input', {
        role: 'combobox',
        disabled: isDisabled,
        onChange: (event: { target: { value: string } }) =>
          onSearchChange?.(event.target.value),
      }),
      ReactModule.createElement(
        'button',
        {
          'data-testid': 'pick-first-option',
          onClick: () => onItemInserted?.((items ?? [])[0]?.id),
        },
        'pick'
      ),
      ReactModule.createElement(
        'ul',
        { 'data-testid': 'options' },
        (items ?? []).map((item) =>
          ReactModule.createElement('li', { key: item.id }, item.label)
        )
      ),
      ReactModule.createElement(
        'ul',
        { 'data-testid': 'selected' },
        (selectedItems ?? []).map((item) =>
          ReactModule.createElement('li', { key: item.id }, item.label)
        )
      )
    );
  Autocomplete.Item = ({ children }) =>
    ReactModule.createElement('span', null, children);

  return { Autocomplete };
});

const baseProps = {
  placeholder: 'Select options',
  value: [],
  setValue: jest.fn(),
  readonly: false,
  listValues: [
    { value: 'a', title: 'Alpha' },
    { value: 'b', title: 'Beta' },
  ],
  useAsyncSearch: false,
  showSearch: false,
  field: {},
  fieldDefinition: {},
  fieldSrc: 'value' as const,
  operator: 'multiselect_equals',
  config: {},
  widgetId: 'test',
} as unknown as MultiSelectWidgetProps;

describe('OMMultiSelectWidget', () => {
  it('renders without crashing', () => {
    render(<OMMultiSelectWidget {...baseProps} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('is disabled when readonly', () => {
    render(<OMMultiSelectWidget {...baseProps} readonly />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});

// Every option ever fetched used to stay on offer, so a narrowed search still
// listed the whole catalogue. react-aria focuses whichever option the pointer
// passes over and commits the focused one when the input blurs, which turned a
// stale entry into a value the user never picked.
describe('OMMultiSelectWidget – async options', () => {
  const CATALOGUE = [
    { value: 'a', title: 'Alpha' },
    { value: 'b', title: 'Beta' },
    { value: 'g', title: 'Gamma' },
  ];

  const asyncProps = {
    ...baseProps,
    useAsyncSearch: true,
    listValues: undefined,
  } as unknown as MultiSelectWidgetProps;

  const fetchCatalogue = () =>
    jest.fn().mockImplementation((search: string) =>
      Promise.resolve({
        values: search
          ? CATALOGUE.filter((option) => option.title.includes(search))
          : CATALOGUE,
      })
    );

  const optionLabels = () =>
    Array.from(screen.getByTestId('options').children).map(
      (child) => child.textContent
    );

  it('offers only what the latest search returned', async () => {
    const asyncFetch = fetchCatalogue();
    render(<OMMultiSelectWidget {...asyncProps} asyncFetch={asyncFetch} />);

    await waitFor(() => expect(optionLabels()).toHaveLength(3));

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Gamma' },
    });

    await waitFor(() => expect(optionLabels()).toEqual(['Gamma']));
  });

  it('keeps the label of a picked value the current search dropped', async () => {
    const asyncFetch = fetchCatalogue();
    render(
      <OMMultiSelectWidget
        {...asyncProps}
        asyncFetch={asyncFetch}
        value={['a']}
      />
    );

    await waitFor(() => expect(optionLabels()).toHaveLength(3));

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Gamma' },
    });

    await waitFor(() => expect(optionLabels()).toEqual(['Gamma']));

    expect(
      Array.from(screen.getByTestId('selected').children).map(
        (child) => child.textContent
      )
    ).toEqual(['Alpha']);
  });

  // Picking clears the Autocomplete's input without reporting a search, so
  // nothing would refetch and the next value would have to be typed for.
  it('restores the unfiltered catalogue after a value is picked', async () => {
    const asyncFetch = fetchCatalogue();
    render(<OMMultiSelectWidget {...asyncProps} asyncFetch={asyncFetch} />);

    await waitFor(() => expect(optionLabels()).toHaveLength(3));

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Gamma' },
    });

    await waitFor(() => expect(optionLabels()).toEqual(['Gamma']));

    fireEvent.click(screen.getByTestId('pick-first-option'));

    await waitFor(() => expect(optionLabels()).toHaveLength(3));

    expect(asyncFetch).toHaveBeenLastCalledWith('');
  });
});
