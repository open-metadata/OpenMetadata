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
import { DataAssetPickerOption } from './DataAssetPicker.interface';
import DataAssetPickerShell from './DataAssetPickerShell';

jest.mock('../../../utils/Assets/AssetsUtils', () => ({
  getEntityIconWithBg: jest.fn().mockReturnValue(<span>icon</span>),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string | number>) => {
      if (opts?.entity) {
        return `${key}:${opts.entity}`;
      }
      if (opts?.count !== undefined && opts?.total !== undefined) {
        return `${opts.count} of ${opts.total}`;
      }

      return key;
    },
  }),
}));

const OPTIONS: DataAssetPickerOption[] = [
  { id: 'table-1', label: 'Orders', displayName: 'Orders', type: 'table' },
  { id: 'table-2', label: 'Products', displayName: 'Products', type: 'table' },
  { id: 'table-3', label: 'Users', displayName: 'Users', type: 'table' },
];

const TRIGGER_TEST_ID = 'picker-trigger';

const defaultProps = {
  options: OPTIONS,
  selectionMode: 'single' as const,
  selectedIds: new Set<string>(),
  onToggle: jest.fn(),
  renderTrigger: ({ open }: { open: () => void }) => (
    <button data-testid={TRIGGER_TEST_ID} onClick={open}>
      Open
    </button>
  ),
  showFooterHints: false,
  showCountBar: false,
  searchable: false,
};

const openPicker = () => fireEvent.click(screen.getByTestId(TRIGGER_TEST_ID));

const pressKey = (key: string) =>
  fireEvent.keyDown(screen.getByTestId('picker-popover'), { key });

describe('DataAssetPickerShell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it('renders the trigger and no popover by default', () => {
    render(<DataAssetPickerShell {...defaultProps} />);

    expect(screen.getByTestId(TRIGGER_TEST_ID)).toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });

  it('opens the popover when the trigger is clicked', () => {
    render(<DataAssetPickerShell {...defaultProps} />);
    openPicker();

    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('calls onToggle and closes on row click in single mode', () => {
    const onToggle = jest.fn();
    render(<DataAssetPickerShell {...defaultProps} onToggle={onToggle} />);
    openPicker();

    fireEvent.click(screen.getByText('Orders'));

    expect(onToggle).toHaveBeenCalledWith(OPTIONS[0]);
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });

  it('calls onToggle but stays open in multiple mode', () => {
    const onToggle = jest.fn();
    render(
      <DataAssetPickerShell
        {...defaultProps}
        selectionMode="multiple"
        onToggle={onToggle}
      />
    );
    openPicker();

    fireEvent.click(screen.getByText('Products'));

    expect(onToggle).toHaveBeenCalledWith(OPTIONS[1]);
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    render(<DataAssetPickerShell {...defaultProps} />);
    openPicker();

    expect(screen.getByText('Orders')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });

  it('closes on click outside via overlay', () => {
    render(<DataAssetPickerShell {...defaultProps} />);
    openPicker();

    expect(screen.getByText('Orders')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('picker-overlay'));

    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });

  it('shows no-data-found when options is empty', () => {
    render(<DataAssetPickerShell {...defaultProps} options={[]} />);
    openPicker();

    expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
  });

  it('shows loading indicator when isLoading is true', () => {
    render(<DataAssetPickerShell {...defaultProps} isLoading />);
    openPicker();

    expect(screen.getByText('label.loading...')).toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });

  it('renders the search input when searchable', () => {
    render(
      <DataAssetPickerShell
        {...defaultProps}
        searchable
        searchText=""
        onSearchChange={jest.fn()}
      />
    );
    openPicker();

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onSearchChange when search input changes', () => {
    const onSearchChange = jest.fn();
    render(
      <DataAssetPickerShell
        {...defaultProps}
        searchable
        searchText=""
        onSearchChange={onSearchChange}
      />
    );
    openPicker();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'ord' },
    });

    expect(onSearchChange).toHaveBeenCalled();
  });

  it('renders the All option and calls onSelectAll on click', () => {
    const onSelectAll = jest.fn();
    render(
      <DataAssetPickerShell
        {...defaultProps}
        allowAllOption
        onSelectAll={onSelectAll}
      />
    );
    openPicker();

    const allText = screen.getByText('label.all-entity:label.asset-plural');
    // walk up to the nearest button (the "All Assets" row)
    let el: HTMLElement | null = allText;
    while (el && el.tagName !== 'BUTTON') {
      el = el.parentElement;
    }
    fireEvent.click(el as HTMLElement);

    expect(onSelectAll).toHaveBeenCalled();
  });

  describe('keyboard navigation', () => {
    it('ArrowDown highlights the first option', () => {
      render(<DataAssetPickerShell {...defaultProps} />);
      openPicker();

      pressKey('ArrowDown');

      const firstOption = screen.getByRole('option', { name: /Orders/i });

      expect(firstOption.className).toContain('tw:bg-utility-gray-blue-50');
    });

    it('ArrowDown stays on last option when already at the end', () => {
      render(<DataAssetPickerShell {...defaultProps} />);
      openPicker();

      // 3 options: ArrowDown x3 lands on last; x1 more stays on last (clamped)
      pressKey('ArrowDown');
      pressKey('ArrowDown');
      pressKey('ArrowDown');
      pressKey('ArrowDown');

      const lastOption = screen.getByRole('option', { name: /Users/i });

      expect(lastOption.className).toContain('tw:bg-utility-gray-blue-50');
    });

    it('ArrowUp from unfocused state leaves no option highlighted', () => {
      render(<DataAssetPickerShell {...defaultProps} />);
      openPicker();

      pressKey('ArrowUp');

      const firstOption = screen.getByRole('option', { name: /Orders/i });

      expect(firstOption.className).not.toContain('tw:bg-utility-gray-blue-50');
    });

    it('Enter selects the focused option and closes in single mode', () => {
      const onToggle = jest.fn();
      render(<DataAssetPickerShell {...defaultProps} onToggle={onToggle} />);
      openPicker();

      pressKey('ArrowDown');
      pressKey('Enter');

      expect(onToggle).toHaveBeenCalledWith(OPTIONS[0]);
      expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    });

    it('Enter on All option calls onSelectAll', () => {
      const onSelectAll = jest.fn();
      render(
        <DataAssetPickerShell
          {...defaultProps}
          allowAllOption
          onSelectAll={onSelectAll}
        />
      );
      openPicker();

      // index 0 is the All option when allowAllOption=true
      pressKey('ArrowDown');
      pressKey('Enter');

      expect(onSelectAll).toHaveBeenCalled();
    });

    it('ArrowDown moves past All option to first real option', () => {
      render(
        <DataAssetPickerShell
          {...defaultProps}
          allowAllOption
          onSelectAll={jest.fn()}
        />
      );
      openPicker();

      // First ArrowDown → All option (index 0), second → Orders (index 1)
      pressKey('ArrowDown');
      pressKey('ArrowDown');

      const ordersOption = screen.getByRole('option', { name: /Orders/i });

      expect(ordersOption.className).toContain('tw:bg-utility-gray-blue-50');
    });
  });
});
