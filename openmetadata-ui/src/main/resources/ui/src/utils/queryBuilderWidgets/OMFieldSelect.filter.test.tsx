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
import type { Config, FieldProps } from '@react-awesome-query-builder/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import OMFieldSelect from './OMFieldSelect';

// The real popup never opens under jsdom, so stand in for the ComboBox and
// render the collection it is handed — that collection is what this suite is
// about.
jest.mock('@openmetadata/ui-core-components', () => ({
  Select: {
    ComboBox: ({
      items,
      inputValue,
      onInputChange,
      onSelectionChange,
      children,
    }: {
      items: { id: string; label: string }[];
      inputValue: string;
      onInputChange: (next: string) => void;
      onSelectionChange: (key: string | null) => void;
      children: (item: { id: string; label: string }) => JSX.Element;
    }) => (
      <div>
        <input
          aria-label="field"
          data-testid="combobox"
          value={inputValue ?? ''}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <ul data-testid="options">
          {(items ?? []).map((item) => (
            <li key={item.id}>
              {children(item)}
              <button
                aria-label={`choose ${item.label}`}
                data-testid={`choose-${item.id}`}
                type="button"
                onClick={() => onSelectionChange(item.id)}
              />
            </li>
          ))}
        </ul>
        <button
          aria-label="clear"
          data-testid="clear"
          type="button"
          onClick={() => onSelectionChange(null)}
        />
      </div>
    ),
    Item: ({ children }: { children: string }) => <li>{children}</li>,
  },
}));

const OPERATORS = [
  { key: 'equal', path: 'equal', label: '==' },
  { key: 'not_equal', path: 'not_equal', label: '!=' },
  { key: 'is_null', path: 'is_null', label: 'Is null' },
];

const renderSelect = (props: Partial<FieldProps> = {}) =>
  render(
    <OMFieldSelect
      {...({
        config: {} as Config,
        items: OPERATORS,
        placeholder: 'Select field',
        readonly: false,
        setField: jest.fn(),
        ...props,
      } as FieldProps)}
    />
  );

const optionLabels = () =>
  Array.from(screen.getByTestId('options').children).map(
    (item) => item.textContent
  );

describe('OMFieldSelect – what may narrow the list', () => {
  it('should offer every option when the box shows the label of the selection', () => {
    renderSelect({ selectedKey: 'equal' } as Partial<FieldProps>);

    expect(screen.getByTestId('combobox')).toHaveValue('==');
    expect(optionLabels()).toEqual(['==', '!=', 'Is null']);
  });

  it('should narrow the list to what the user types', () => {
    renderSelect();

    fireEvent.change(screen.getByTestId('combobox'), {
      target: { value: 'nul' },
    });

    expect(optionLabels()).toEqual(['Is null']);
  });

  it('should stop narrowing once the selection is changed from outside', () => {
    // The regression: choosing a field makes RAQB set a default operator and
    // clear it a render later. This box mounts holding that transient label,
    // and treating it as a filter left the operator list showing nothing but
    // the one option the label named until a further render cleared the text.
    const { rerender } = renderSelect({
      selectedKey: 'equal',
    } as Partial<FieldProps>);

    fireEvent.change(screen.getByTestId('combobox'), {
      target: { value: 'nul' },
    });

    expect(optionLabels()).toEqual(['Is null']);

    rerender(
      <OMFieldSelect
        config={{} as Config}
        items={OPERATORS}
        placeholder="Select field"
        readonly={false}
        selectedKey="not_equal"
        setField={jest.fn()}
      />
    );

    // the box shows the new selection, and the typed text stops narrowing
    expect(screen.getByTestId('combobox')).toHaveValue('!=');
    expect(optionLabels()).toEqual(['==', '!=', 'Is null']);
  });

  it('should show the chosen label and stop narrowing once an option is picked', () => {
    const setField = jest.fn();
    const { rerender } = renderSelect({ setField } as Partial<FieldProps>);

    fireEvent.change(screen.getByTestId('combobox'), {
      target: { value: 'nul' },
    });

    expect(optionLabels()).toEqual(['Is null']);

    fireEvent.click(screen.getByTestId('choose-is_null'));

    expect(setField).toHaveBeenCalledWith('is_null');

    // `selectedKey` is the caller's to own, so echo the choice back as RAQB
    // does — the box then reads as the selection, not as a filter.
    rerender(
      <OMFieldSelect
        {...({
          config: {} as Config,
          items: OPERATORS,
          readonly: false,
          selectedKey: 'is_null',
          setField,
        } as FieldProps)}
      />
    );

    expect(screen.getByTestId('combobox')).toHaveValue('Is null');
    expect(optionLabels()).toEqual(['==', '!=', 'Is null']);
  });

  it('should ignore a cleared selection rather than blanking the box', () => {
    renderSelect({ selectedKey: 'equal' } as Partial<FieldProps>);

    fireEvent.click(screen.getByTestId('clear'));

    expect(screen.getByTestId('combobox')).toHaveValue('==');
  });

  it('should fall back to the key when the chosen id carries no label', () => {
    const setField = jest.fn();
    render(
      <OMFieldSelect
        {...({
          config: {} as Config,
          items: [{ key: 'ghost', path: 'ghost', label: 'Ghost' }],
          readonly: false,
          setField,
        } as FieldProps)}
      />
    );

    fireEvent.click(screen.getByTestId('choose-ghost'));

    expect(setField).toHaveBeenCalledWith('ghost');
  });

  it('should show a selection whose label only arrives later', () => {
    // A control can mount holding a selection before its options are built —
    // the label is empty then. Tracking only the key (and in a ref, which
    // survives a discarded render while the state beside it does not) left
    // the box blank for a selection the rule already held.
    const { rerender } = render(
      <OMFieldSelect
        {...({
          config: {} as Config,
          items: [],
          readonly: true,
          selectedKey: 'is_null',
          setField: jest.fn(),
        } as FieldProps)}
      />
    );

    expect(screen.getByTestId('combobox')).toHaveValue('');

    rerender(
      <OMFieldSelect
        {...({
          config: {} as Config,
          items: OPERATORS,
          readonly: false,
          selectedKey: 'is_null',
          setField: jest.fn(),
        } as FieldProps)}
      />
    );

    expect(screen.getByTestId('combobox')).toHaveValue('Is null');
  });
});
