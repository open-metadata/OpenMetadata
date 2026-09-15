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
import QueryBuilderAddGroup from './QueryBuilderAddGroup';

// react-aria opens its menu through pointer events and a measured popover,
// neither of which jsdom provides — the browser covers that. Stubbing it keeps
// this test on the control's own logic: menu or plain button, and what it adds.
jest.mock('@openmetadata/ui-core-components', () => {
  const Button = ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  );

  const Dropdown = {
    Root: ({ children }: { children: ReactNode }) => <>{children}</>,
    Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
    Menu: ({
      items,
      children,
    }: {
      items: { id: string }[];
      children: (item: { id: string }) => ReactNode;
    }) => <>{items.map((item) => children(item))}</>,
    Item: ({
      label,
      onAction,
      ...rest
    }: {
      label: string;
      onAction: () => void;
    }) => (
      <button type="button" onClick={onAction} {...rest}>
        {label}
      </button>
    ),
  };

  return { Button, Dropdown };
});

const onAdd = jest.fn();

const renderAddGroup = (props = {}) =>
  render(
    <QueryBuilderAddGroup
      conjunctions={['AND', 'OR']}
      testId="advanced-search-add-group"
      onAdd={onAdd}
      {...props}
    />
  );

describe('QueryBuilderAddGroup', () => {
  it('should offer every conjunction the new group could join by', () => {
    renderAddGroup();

    expect(
      screen.getByTestId('advanced-search-add-group-and')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('advanced-search-add-group-or')
    ).toBeInTheDocument();
  });

  it('should add a group joined by the conjunction that was picked', () => {
    renderAddGroup();

    fireEvent.click(screen.getByTestId('advanced-search-add-group-or'));

    expect(onAdd).toHaveBeenCalledWith('OR');
  });

  it('should keep the trigger addressable by the preset testid', () => {
    renderAddGroup();

    expect(screen.getByTestId('advanced-search-add-group')).toBeInTheDocument();
  });

  it('should skip the menu when there is only one conjunction to join by', () => {
    renderAddGroup({ conjunctions: ['AND'] });

    expect(
      screen.queryByTestId('advanced-search-add-group-and')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('advanced-search-add-group'));

    expect(onAdd).toHaveBeenCalledWith('AND');
  });
});
