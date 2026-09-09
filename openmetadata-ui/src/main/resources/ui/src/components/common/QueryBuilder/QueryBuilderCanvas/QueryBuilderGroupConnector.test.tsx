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
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import QueryBuilderGroupConnector from './QueryBuilderGroupConnector';

interface StubSelectProps {
  items?: { id: string; label?: string }[];
  selectedKey?: string;
  isDisabled?: boolean;
  children: (item: { id: string; label?: string }) => ReactNode;
  onSelectionChange: (key: string | null) => void;
}

// react-aria opens its listbox through pointer events and a measured popover,
// neither of which jsdom provides — the browser covers that. Stubbing it keeps
// this test on the connector's own wiring: which key it shows, what it reports.
jest.mock('@openmetadata/ui-core-components', () => {
  const Select = ({
    items = [],
    selectedKey,
    isDisabled,
    children,
    onSelectionChange,
    ...rest
  }: StubSelectProps) => (
    <div {...rest}>
      <span data-testid="stub-selected">{selectedKey}</span>
      <span data-testid="stub-disabled">{String(Boolean(isDisabled))}</span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelectionChange(item.id)}>
          {children(item)}
        </button>
      ))}
      <button
        data-testid="stub-clear"
        type="button"
        onClick={() => onSelectionChange(null)}>
        clear
      </button>
    </div>
  );
  Select.Item = ({ children }: { children: ReactNode }) => <>{children}</>;

  const Divider = (props: { className?: string }) => (
    <div data-testid="stub-divider" {...props} />
  );

  return { Divider, Select };
});

const onChange = jest.fn();

const renderConnector = (props = {}) =>
  render(
    <QueryBuilderGroupConnector
      conjunction="AND"
      conjunctions={['AND', 'OR']}
      readonly={false}
      onChange={onChange}
      {...props}
    />
  );

describe('QueryBuilderGroupConnector', () => {
  it('should show the conjunction that combines the cards', () => {
    renderConnector();

    expect(screen.getByTestId('stub-selected')).toHaveTextContent('AND');
    // a line above and below, so the pill reads as joining the two cards
    expect(screen.getAllByTestId('stub-divider')).toHaveLength(2);
    expect(
      screen.getByTestId('advanced-search-group-conjunction')
    ).toBeInTheDocument();
  });

  it('should offer every conjunction the config allows', () => {
    renderConnector();

    expect(screen.getByRole('button', { name: 'AND' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OR' })).toBeInTheDocument();
  });

  it('should report the conjunction that was picked', () => {
    renderConnector();

    fireEvent.click(screen.getByRole('button', { name: 'OR' }));

    expect(onChange).toHaveBeenCalledWith('OR');
  });

  it('should ignore a cleared selection rather than report an empty one', () => {
    renderConnector();

    fireEvent.click(screen.getByTestId('stub-clear'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('should lock when the caller fixed the conjunction to one option', () => {
    renderConnector({ conjunctions: ['AND'] });

    expect(screen.getByTestId('stub-disabled')).toHaveTextContent('true');
  });

  it('should lock when readonly', () => {
    renderConnector({ readonly: true });

    expect(screen.getByTestId('stub-disabled')).toHaveTextContent('true');
  });
});
