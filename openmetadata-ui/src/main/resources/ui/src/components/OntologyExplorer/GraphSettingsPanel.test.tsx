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
import React, { ReactElement, ReactNode } from 'react';
import GraphSettingsPanel from './GraphSettingsPanel';
import { LayoutType } from './OntologyExplorer.constants';
import { GraphSettings } from './OntologyExplorer.interface';

const UNKNOWN_LAYOUT_VALUE = '__unknown__';

interface MockButtonProps {
  'data-testid'?: string;
  onClick?: () => void;
}

interface MockButtonUtilityProps {
  'data-testid'?: string;
  onClick?: () => void;
  tooltip?: string;
}

interface MockDropdownRootProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

interface MockSelectProps {
  items?: { id: string; label: string }[];
  value?: string;
  onChange?: (key: string) => void;
  'data-testid'?: string;
}

interface MockToggleProps {
  isSelected?: boolean;
  onChange?: (checked: boolean) => void;
  'data-testid'?: string;
  label?: string;
}

interface MockTypographyProps {
  children?: ReactNode;
}

jest.mock('@untitledui/icons', () => ({
  Settings01: () => <span>Settings01</span>,
  X: () => <span>X</span>,
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const MockSelect = ({
    items = [],
    value,
    onChange,
    'data-testid': testId,
  }: MockSelectProps) => (
    <select
      data-testid={testId}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
      <option value={UNKNOWN_LAYOUT_VALUE}>unknown</option>
    </select>
  );

  MockSelect.Item = () => null;

  return {
    Button: ({ 'data-testid': testId, onClick }: MockButtonProps) => (
      <button data-testid={testId} type="button" onClick={onClick} />
    ),
    ButtonUtility: ({
      'data-testid': testId,
      onClick,
      tooltip,
    }: MockButtonUtilityProps) => (
      <button data-testid={testId} type="button" onClick={onClick}>
        {tooltip}
      </button>
    ),
    Dropdown: {
      Root: ({ isOpen, onOpenChange, children }: MockDropdownRootProps) => {
        const nodes = React.Children.toArray(children);
        const trigger = nodes[0] as ReactElement;
        const popover = nodes[1];

        return (
          <div data-open={String(Boolean(isOpen))} data-testid="dropdown-root">
            {React.cloneElement(trigger, {
              onClick: () => onOpenChange?.(!isOpen),
            })}
            {isOpen ? popover : null}
          </div>
        );
      },
      Popover: ({ children }: { children: ReactNode }) => (
        <div data-testid="dropdown-popover">{children}</div>
      ),
    },
    Select: MockSelect,
    Toggle: ({
      isSelected,
      onChange,
      'data-testid': testId,
      label,
    }: MockToggleProps) => (
      <label>
        <input
          checked={Boolean(isSelected)}
          data-testid={testId}
          type="checkbox"
          onChange={(event) => onChange?.(event.target.checked)}
        />
        {label}
      </label>
    ),
    Typography: ({ children }: MockTypographyProps) => <span>{children}</span>,
  };
});

const HIERARCHICAL_SETTINGS: GraphSettings = {
  layout: LayoutType.Hierarchical,
  showEdgeLabels: true,
};

const renderPanel = (settings: GraphSettings = HIERARCHICAL_SETTINGS) => {
  const onSettingsChange = jest.fn();

  render(
    <GraphSettingsPanel
      settings={settings}
      onSettingsChange={onSettingsChange}
    />
  );

  return { onSettingsChange };
};

const openPanel = () => {
  fireEvent.click(screen.getByTestId('ontology-graph-settings'));
};

describe('GraphSettingsPanel', () => {
  it('merges the selected layout into existing settings on change', () => {
    const { onSettingsChange } = renderPanel();
    openPanel();

    fireEvent.change(screen.getByTestId('graph-settings-layout-select'), {
      target: { value: LayoutType.Circular },
    });

    expect(onSettingsChange).toHaveBeenCalledWith({
      layout: LayoutType.Circular,
      showEdgeLabels: true,
    });
  });

  it('does not call onSettingsChange for an unknown layout key', () => {
    const { onSettingsChange } = renderPanel();
    openPanel();

    fireEvent.change(screen.getByTestId('graph-settings-layout-select'), {
      target: { value: UNKNOWN_LAYOUT_VALUE },
    });

    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('merges showEdgeLabels toggle without dropping other settings', () => {
    const { onSettingsChange } = renderPanel({
      layout: LayoutType.Circular,
      showEdgeLabels: true,
    });
    openPanel();

    fireEvent.click(screen.getByTestId('graph-settings-edge-labels-toggle'));

    expect(onSettingsChange).toHaveBeenCalledWith({
      layout: LayoutType.Circular,
      showEdgeLabels: false,
    });
  });

  it('reflects the current settings.layout in the Select value', () => {
    renderPanel({ layout: LayoutType.Circular, showEdgeLabels: false });
    openPanel();

    const select = screen.getByTestId(
      'graph-settings-layout-select'
    ) as HTMLSelectElement;

    expect(select.value).toBe(LayoutType.Circular);
  });

  it('reflects settings.showEdgeLabels in the Toggle checked state', () => {
    renderPanel({ layout: LayoutType.Hierarchical, showEdgeLabels: false });
    openPanel();

    expect(
      screen.getByTestId('graph-settings-edge-labels-toggle')
    ).not.toBeChecked();
  });

  it('shows the Toggle as checked when showEdgeLabels is true', () => {
    renderPanel(HIERARCHICAL_SETTINGS);
    openPanel();

    expect(
      screen.getByTestId('graph-settings-edge-labels-toggle')
    ).toBeChecked();
  });

  it('closes the popover when the close button is clicked', () => {
    renderPanel();
    openPanel();

    expect(
      screen.getByTestId('graph-settings-layout-select')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('graph-settings-close'));

    expect(
      screen.queryByTestId('graph-settings-layout-select')
    ).not.toBeInTheDocument();
  });
});
