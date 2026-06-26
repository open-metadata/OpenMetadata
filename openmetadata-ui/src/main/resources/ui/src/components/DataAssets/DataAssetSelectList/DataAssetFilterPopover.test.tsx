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
import DataAssetFilterPopover from './DataAssetFilterPopover';
import { DataAssetPickerOption } from './DataAssetPicker.interface';

jest.mock('../../../utils/Assets/AssetsUtils', () => ({
  getEntityIconWithBg: jest.fn().mockReturnValue(<span>icon</span>),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.entity) {
        return `${key}:${opts.entity}`;
      }

      return key;
    },
  }),
}));

const OPTIONS: DataAssetPickerOption[] = [
  {
    id: 'db.schema.orders',
    label: 'Orders',
    displayName: 'Orders',
    type: 'table',
  },
  {
    id: 'db.schema.products',
    label: 'Products',
    displayName: 'Products',
    type: 'table',
  },
  {
    id: 'db.schema.users',
    label: 'Users',
    displayName: 'Users',
    type: 'table',
  },
];

const TRIGGER_TEST_ID = 'filter-trigger';

const openPopover = () => fireEvent.click(screen.getByTestId(TRIGGER_TEST_ID));

describe('DataAssetFilterPopover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the default trigger button with "All Assets" label when nothing is selected', () => {
    render(
      <DataAssetFilterPopover
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            label.all-entity:label.asset-plural
          </button>
        )}
        selectedId=""
        onChange={jest.fn()}
      />
    );

    expect(
      screen.getByText('label.all-entity:label.asset-plural')
    ).toBeInTheDocument();
  });

  it('shows the selected option label in the trigger when an option is selected', () => {
    render(
      <DataAssetFilterPopover
        options={OPTIONS}
        selectedId="db.schema.orders"
        onChange={jest.fn()}
      />
    );

    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('renders a custom trigger when renderTrigger is provided', () => {
    render(
      <DataAssetFilterPopover
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Custom
          </button>
        )}
        selectedId=""
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId(TRIGGER_TEST_ID)).toBeInTheDocument();
  });

  it('opens the popover and shows all options on trigger click', () => {
    render(
      <DataAssetFilterPopover
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        selectedId=""
        onChange={jest.fn()}
      />
    );
    openPopover();

    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('calls onChange with option id when an option is clicked', () => {
    const onChange = jest.fn();
    render(
      <DataAssetFilterPopover
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        selectedId=""
        onChange={onChange}
      />
    );
    openPopover();

    fireEvent.click(screen.getAllByText('Orders')[0].closest('button')!);

    expect(onChange).toHaveBeenCalledWith('db.schema.orders');
  });

  it('calls onChange with empty string when the same option is clicked again (deselect)', () => {
    const onChange = jest.fn();
    render(
      <DataAssetFilterPopover
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        selectedId="db.schema.orders"
        onChange={onChange}
      />
    );
    openPopover();

    fireEvent.click(screen.getAllByText('Orders')[0].closest('button')!);

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('calls onChange with empty string when "All Assets" option is clicked', () => {
    const onChange = jest.fn();
    render(
      <DataAssetFilterPopover
        allowAllOption
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        selectedId="db.schema.orders"
        onChange={onChange}
      />
    );
    openPopover();

    fireEvent.click(
      screen.getByText('label.all-entity:label.asset-plural').closest('button')!
    );

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('filters options by search text', () => {
    render(
      <DataAssetFilterPopover
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        selectedId=""
        onChange={jest.fn()}
      />
    );
    openPopover();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'ord' } });

    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.queryByText('Products')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('shows no results when search matches nothing', () => {
    render(
      <DataAssetFilterPopover
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        selectedId=""
        onChange={jest.fn()}
      />
    );
    openPopover();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'zzznomatch' } });

    expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
  });

  it('uses allOptionLabel when provided', () => {
    render(
      <DataAssetFilterPopover
        allowAllOption
        allOptionLabel="All Tables"
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        selectedId=""
        onChange={jest.fn()}
      />
    );
    openPopover();

    expect(screen.getByText('All Tables')).toBeInTheDocument();
  });

  it('closes the popover after selecting an option in single mode', () => {
    const onChange = jest.fn();
    render(
      <DataAssetFilterPopover
        options={OPTIONS}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        selectedId=""
        onChange={onChange}
      />
    );
    openPopover();

    expect(screen.getByText('Orders')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Orders')[0].closest('button')!);

    expect(screen.queryByText('Products')).not.toBeInTheDocument();
  });
});
