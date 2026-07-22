/*
 *  Copyright 2025 Collate.
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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { ConditionBuilder } from './ConditionBuilder';
import type { ConditionFieldDefinition } from './ConditionBuilder.interface';

// Capture onSearchChange passed to Autocomplete so tests can invoke it
let capturedOnSearchChange: ((search: string) => void) | undefined;
let capturedFilterOption: (() => boolean) | undefined;

jest.mock('@openmetadata/ui-core-components', () => {
  const AutocompleteItem = ({
    label,
    id,
  }: {
    label?: string;
    id: string | number;
  }) => <div data-testid={`item-${id}`}>{label}</div>;

  const Autocomplete = (props: {
    items: Array<{ id: string | number; label?: string }>;
    selectedItems: { items: Array<{ id: string; label?: string }> };
    'data-testid'?: string;
    filterOption?: () => boolean;
    onSearchChange?: (search: string) => void;
    onItemInserted?: (key: string | number) => void;
    onItemCleared?: (key: string | number) => void;
    children?: React.ReactNode;
  }) => {
    capturedOnSearchChange = props.onSearchChange;
    capturedFilterOption = props.filterOption;

    return (
      <div data-testid={props['data-testid'] ?? 'autocomplete'}>
        {props.items.map((item) => (
          <button
            data-testid={`option-${item.id}`}
            key={item.id}
            onClick={() => props.onItemInserted?.(item.id)}>
            {item.label ?? item.id}
          </button>
        ))}
      </div>
    );
  };

  Autocomplete.Item = AutocompleteItem;

  const Card = ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <div {...rest}>{children}</div>;

  const Input = (props: {
    value?: string;
    isDisabled?: boolean;
    'data-testid'?: string;
    onChange?: (v: string) => void;
  }) => (
    <input
      data-testid={props['data-testid']}
      disabled={props.isDisabled}
      value={props.value ?? ''}
      onChange={(e) => props.onChange?.(e.target.value)}
    />
  );

  const Toggle = (props: {
    isSelected?: boolean;
    isDisabled?: boolean;
    'data-testid'?: string;
    onChange?: (checked: boolean) => void;
  }) => (
    <input
      checked={props.isSelected ?? false}
      data-testid={props['data-testid'] ?? 'toggle'}
      disabled={props.isDisabled}
      type="checkbox"
      onChange={(e) => props.onChange?.(e.target.checked)}
    />
  );

  const Button = (props: {
    children?: React.ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button
      data-testid={props['data-testid']}
      disabled={props.isDisabled}
      onClick={props.onPress}>
      {props.children}
    </button>
  );

  const Select = Object.assign(
    (props: {
      children?: React.ReactNode;
      value?: string;
      'data-testid'?: string;
      onChange?: (key: string) => void;
    }) => (
      <select
        data-testid={props['data-testid']}
        value={props.value}
        onChange={(e) => props.onChange?.(e.target.value)}>
        {props.children}
      </select>
    ),
    {
      Item: ({
        id,
        label,
      }: {
        id: string | number;
        label?: string;
        key?: string | number;
      }) => <option value={String(id)}>{label ?? id}</option>,
    }
  );

  return { Autocomplete, Button, Card, Input, Select, Toggle };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('contexts/WorkflowModeContext', () => ({
  useWorkflowModeContext: jest.fn(() => ({
    isFormDisabled: false,
    canSave: true,
    allowStructuralGraphEdits: true,
  })),
}));

// Stub useListData so selectedItems behaves predictably
jest.mock('react-stately', () => ({
  useListData: () => {
    const items: Array<{ id: string; label?: string }> = [];

    return {
      items,
      append: (item: { id: string; label?: string }) => items.push(item),
      remove: (id: string) => {
        const idx = items.findIndex((i) => i.id === id);
        if (idx !== -1) {
          items.splice(idx, 1);
        }
      },
    };
  },
}));

jest.useFakeTimers();

const onChange = jest.fn();

const makeTagFieldDef = (
  override: Partial<ConditionFieldDefinition> = {}
): ConditionFieldDefinition => ({
  value: 'tags',
  label: 'label.tag-plural',
  values: [],
  valueType: 'dropdown',
  fetchOptions: jest.fn().mockResolvedValue([
    { value: 'PII.Sensitive', label: 'PII.Sensitive' },
    { value: 'Tier.Tier1', label: 'Tier.Tier1' },
  ]),
  supportsSearch: true,
  ...override,
});

describe('ConditionBuilder — server-side tag search', () => {
  beforeEach(() => {
    capturedOnSearchChange = undefined;
    capturedFilterOption = undefined;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('calls fetchOptions with empty string on mount to load initial options', async () => {
    const tagFieldDef = makeTagFieldDef();

    await act(async () => {
      render(
        <ConditionBuilder
          fieldDefinitions={[tagFieldDef]}
          value={null}
          onChange={onChange}
        />
      );
    });

    // Select the tags field
    const select = screen.getByTestId('condition-builder-row-0-field');
    await act(async () => {
      select.dispatchEvent(
        Object.assign(new Event('change', { bubbles: true }), {
          target: { value: 'tags' },
        })
      );
    });

    expect(tagFieldDef.fetchOptions).toHaveBeenCalledWith('');
  });

  it('passes onSearchChange to Autocomplete for fields with supportsSearch=true', async () => {
    const tagFieldDef = makeTagFieldDef({ supportsSearch: true });

    await act(async () => {
      render(
        <ConditionBuilder
          fieldDefinitions={[tagFieldDef]}
          value={{
            config: {
              condition: 'AND',
              rules: { tags: ['PII.Sensitive'] },
            },
          }}
          onChange={onChange}
        />
      );
    });

    await act(async () => {
      jest.runAllTimers();
    });

    expect(capturedOnSearchChange).toBeDefined();
  });

  it('passes filterOption=()=>true to Autocomplete for fields with supportsSearch=true', async () => {
    const tagFieldDef = makeTagFieldDef({ supportsSearch: true });

    await act(async () => {
      render(
        <ConditionBuilder
          fieldDefinitions={[tagFieldDef]}
          value={{
            config: {
              condition: 'AND',
              rules: { tags: ['PII.Sensitive'] },
            },
          }}
          onChange={onChange}
        />
      );
    });

    await act(async () => {
      jest.runAllTimers();
    });

    expect(capturedFilterOption).toBeDefined();
    expect(capturedFilterOption?.()).toBe(true);
  });

  it('calls fetchOptions with search text when user types (debounced)', async () => {
    const tagFieldDef = makeTagFieldDef({ supportsSearch: true });

    await act(async () => {
      render(
        <ConditionBuilder
          fieldDefinitions={[tagFieldDef]}
          value={{
            config: {
              condition: 'AND',
              rules: { tags: [] },
            },
          }}
          onChange={onChange}
        />
      );
    });

    await act(async () => {
      jest.runAllTimers();
    });

    // Simulate user typing via onSearchChange
    expect(capturedOnSearchChange).toBeDefined();

    await act(async () => {
      capturedOnSearchChange?.('PII');
    });

    // Before debounce fires, fetchOptions should not have been called again
    const callCountBeforeDebounce = (
      tagFieldDef.fetchOptions as jest.Mock
    ).mock.calls.length;

    // Fire debounce
    await act(async () => {
      jest.runAllTimers();
    });

    const callCountAfterDebounce = (
      tagFieldDef.fetchOptions as jest.Mock
    ).mock.calls.length;

    expect(callCountAfterDebounce).toBeGreaterThan(callCountBeforeDebounce);

    const calls = (tagFieldDef.fetchOptions as jest.Mock).mock.calls;
    const lastCall = calls[calls.length - 1];

    expect(lastCall[0]).toBe('PII');
  });

  it('does NOT pass onSearchChange for fields with supportsSearch=false', async () => {
    const certFieldDef = makeTagFieldDef({
      value: 'certification',
      supportsSearch: false,
    });

    await act(async () => {
      render(
        <ConditionBuilder
          fieldDefinitions={[certFieldDef]}
          value={{
            config: {
              condition: 'AND',
              rules: { certification: [] },
            },
          }}
          onChange={onChange}
        />
      );
    });

    await act(async () => {
      jest.runAllTimers();
    });

    expect(capturedOnSearchChange).toBeUndefined();
  });

  it('does NOT pass filterOption for fields with supportsSearch=false', async () => {
    const certFieldDef = makeTagFieldDef({
      value: 'certification',
      supportsSearch: false,
    });

    await act(async () => {
      render(
        <ConditionBuilder
          fieldDefinitions={[certFieldDef]}
          value={{
            config: {
              condition: 'AND',
              rules: { certification: [] },
            },
          }}
          onChange={onChange}
        />
      );
    });

    await act(async () => {
      jest.runAllTimers();
    });

    expect(capturedFilterOption).toBeUndefined();
  });

  it('does NOT re-load full list when a search returns zero results', async () => {
    const tagFieldDef = makeTagFieldDef({
      fetchOptions: jest.fn().mockResolvedValue([]),
    });

    await act(async () => {
      render(
        <ConditionBuilder
          fieldDefinitions={[tagFieldDef]}
          value={{
            config: {
              condition: 'AND',
              rules: { tags: [] },
            },
          }}
          onChange={onChange}
        />
      );
    });

    // Wait for the initial mount load (empty string call)
    await act(async () => {
      jest.runAllTimers();
    });

    const callsAfterMount = (tagFieldDef.fetchOptions as jest.Mock).mock.calls
      .length;

    // Simulate typing a search that yields no results — already resolved to []
    await act(async () => {
      capturedOnSearchChange?.('nonexistent-tag-xyz');
    });

    await act(async () => {
      jest.runAllTimers();
    });

    const callsAfterSearch = (tagFieldDef.fetchOptions as jest.Mock).mock.calls
      .length;

    expect(callsAfterSearch).toBe(callsAfterMount + 1);

    await act(async () => {
      jest.runAllTimers();
    });

    expect(
      (tagFieldDef.fetchOptions as jest.Mock).mock.calls.length
    ).toBe(callsAfterSearch);
  });
});
