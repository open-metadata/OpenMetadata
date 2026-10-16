/*
 *  Copyright 2023 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode, UIEvent } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import DataAssetAsyncSelectList from './DataAssetAsyncSelectList';
import { DataAssetOption } from './DataAssetAsyncSelectList.interface';

type MockItem = { id: string; label?: string };

jest.mock('@openmetadata/ui-core-components', () => ({
  Autocomplete: Object.assign(
    ({
      items,
      selectedItems,
      placeholder,
      children,
      onItemInserted,
      onItemCleared,
      onOpenChange,
      onPopoverScroll,
      onSearchChange,
      popoverHeader,
      popoverFooter,
      emptyState,
    }: {
      items: MockItem[];
      selectedItems: MockItem[];
      placeholder?: string;
      children: (item: MockItem) => ReactNode;
      onItemInserted: (key: string) => void;
      onItemCleared: (key: string) => void;
      onOpenChange: (isOpen: boolean) => void;
      onPopoverScroll: (e: UIEvent<HTMLElement>) => void;
      onSearchChange: (value: string) => void;
      popoverHeader?: ReactNode;
      popoverFooter?: ReactNode;
      emptyState?: ReactNode;
    }) => (
      <div data-testid="asset-select-list">
        <span data-testid="placeholder">{placeholder}</span>
        <button
          aria-label="open"
          data-testid="open"
          onClick={() => onOpenChange(true)}
        />
        {selectedItems.map((item) => (
          <button
            data-testid={`chip-${item.id}`}
            key={item.id}
            onClick={() => onItemCleared(item.id)}>
            {item.label}
          </button>
        ))}
        <input
          aria-label="search"
          data-testid="search"
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {popoverHeader}
        <div data-testid="listbox" onScroll={onPopoverScroll}>
          {items.length === 0 && emptyState}
          {items.map((item) => (
            <button key={item.id} onClick={() => onItemInserted(item.id)}>
              {children(item)}
            </button>
          ))}
        </div>
        {popoverFooter}
      </div>
    ),
    {
      Item: ({
        label,
        children,
        'data-testid': testId,
      }: {
        label?: string;
        children?: ReactNode;
        'data-testid'?: string;
      }) => <div data-testid={testId}>{children ?? label}</div>,
    }
  ),
}));

jest.mock('../DataAssetSelectList/DataAssetPickerRow', () =>
  jest.fn(({ option }: { option: { id: string; displayName?: string } }) => (
    <div data-testid={`option-${option.id}`}>{option.displayName}</div>
  ))
);
jest.mock('../DataAssetSelectList/DataAssetPickerCountBar', () =>
  jest.fn(({ count, total }: { count: number; total: number }) => (
    <div data-testid="count-bar">{`${count} of ${total}`}</div>
  ))
);
jest.mock('../DataAssetSelectList/DataAssetPickerLoading', () =>
  jest.fn(() => <div data-testid="picker-loading" />)
);
jest.mock('../DataAssetSelectList/DataAssetPickerFooter', () =>
  jest.fn(() => <div data-testid="picker-footer" />)
);
jest.mock('../../../rest/searchAPI');
jest.mock('../../../utils/SearchClassBase', () => ({
  getEntityIconWithBg: jest.fn().mockReturnValue(null),
}));
jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<p data-testid="profile-pic">ProfilePicture</p>)
);

const mockSearchQuery = searchQuery as jest.Mock;

const searchResponse = (
  sources: { fqn: string; name: string; entityType: string }[],
  total = sources.length
) => ({
  hits: {
    hits: sources.map(({ fqn, name, entityType }) => ({
      _source: {
        id: `id-${fqn}`,
        name,
        displayName: name,
        fullyQualifiedName: fqn,
        entityType,
      },
    })),
    total: { value: total },
  },
});

const TABLES = [
  { fqn: 'svc.db.orders', name: 'orders', entityType: 'table' },
  { fqn: 'svc.db.users', name: 'users', entityType: 'table' },
];

const open = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('open'));
  });
};

describe('DataAssetAsyncSelectList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchQuery.mockResolvedValue(searchResponse(TABLES));
  });

  it('searches the given index, excluding bots, only once opened', async () => {
    render(<DataAssetAsyncSelectList searchIndex={SearchIndex.TABLE} />);

    expect(mockSearchQuery).not.toHaveBeenCalled();

    await open();

    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '*',
        pageNumber: 1,
        searchIndex: SearchIndex.TABLE,
        queryFilter: {
          query: { bool: { must_not: [{ match: { isBot: true } }] } },
        },
      })
    );
    expect(screen.getByTestId('option-svc.db.orders')).toHaveTextContent(
      'orders'
    );
  });

  it('hides options whose FQN is in filterFqns', async () => {
    render(<DataAssetAsyncSelectList filterFqns={['svc.db.orders']} />);
    await open();

    expect(
      screen.queryByTestId('option-svc.db.orders')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('option-svc.db.users')).toBeInTheDocument();
  });

  it('frames the list with the picker count bar and keyboard hints', async () => {
    mockSearchQuery.mockResolvedValue(searchResponse(TABLES, 20));
    render(<DataAssetAsyncSelectList />);
    await open();

    expect(screen.getByTestId('count-bar')).toHaveTextContent('2 of 20');
    expect(screen.getByTestId('picker-footer')).toBeInTheDocument();
  });

  it('shows a loading state instead of an empty list while the first search runs', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    mockSearchQuery.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );
    render(<DataAssetAsyncSelectList />);
    await open();

    expect(screen.getByTestId('picker-loading')).toBeInTheDocument();

    await act(async () => {
      resolvers[0](searchResponse(TABLES));
    });

    expect(screen.queryByTestId('picker-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('option-svc.db.orders')).toBeInTheDocument();
  });

  it('replaces the previous results with the loading state while a new search runs', async () => {
    jest.useFakeTimers();
    render(<DataAssetAsyncSelectList debounceTimeout={100} />);
    await open();

    expect(screen.getByTestId('option-svc.db.orders')).toBeInTheDocument();

    const resolvers: Array<(value: unknown) => void> = [];
    mockSearchQuery.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );
    fireEvent.change(screen.getByTestId('search'), {
      target: { value: 'users' },
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.getByTestId('picker-loading')).toBeInTheDocument();
    expect(
      screen.queryByTestId('option-svc.db.orders')
    ).not.toBeInTheDocument();

    await act(async () => {
      resolvers[0](searchResponse([TABLES[1]]));
    });

    expect(screen.queryByTestId('picker-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('option-svc.db.users')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('renders a profile picture for user options', async () => {
    mockSearchQuery.mockResolvedValue(
      searchResponse([{ fqn: 'admin', name: 'admin', entityType: 'user' }])
    );
    render(<DataAssetAsyncSelectList searchIndex={SearchIndex.USER} />);
    await open();

    expect(screen.getByTestId('profile-pic')).toBeInTheDocument();
    expect(screen.getByTestId('admin')).toBeInTheDocument();
  });

  it('reports a single pick as one option and a cleared pick as undefined', async () => {
    const onChange = jest.fn();
    render(<DataAssetAsyncSelectList onChange={onChange} />);
    await open();

    fireEvent.click(screen.getByTestId('option-svc.db.orders'));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: 'svc.db.orders',
        displayName: 'orders',
        reference: expect.objectContaining({
          fullyQualifiedName: 'svc.db.orders',
          type: 'table',
        }),
      })
    );

    fireEvent.click(screen.getByTestId('chip-svc.db.orders'));

    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('accumulates picks in multiple mode and removes a cleared one', async () => {
    const onChange = jest.fn();
    render(<DataAssetAsyncSelectList multiple onChange={onChange} />);
    await open();

    fireEvent.click(screen.getByTestId('option-svc.db.orders'));
    fireEvent.click(screen.getByTestId('option-svc.db.users'));

    const option = (fqn: string) => expect.objectContaining({ value: fqn });

    expect(onChange).toHaveBeenLastCalledWith([
      option('svc.db.orders'),
      option('svc.db.users'),
    ]);

    fireEvent.click(screen.getByTestId('chip-svc.db.orders'));

    expect(onChange).toHaveBeenLastCalledWith([option('svc.db.users')]);
  });

  it('resolves FQN values against initialOptions, falling back to the FQN', () => {
    const initialOptions: DataAssetOption[] = [
      {
        displayName: 'Orders',
        label: 'Orders',
        value: 'svc.db.orders',
        reference: {
          id: '1',
          type: 'table',
          fullyQualifiedName: 'svc.db.orders',
        },
      },
    ];

    render(
      <DataAssetAsyncSelectList
        multiple
        initialOptions={initialOptions}
        value={['svc.db.orders', 'svc.db.unknown']}
      />
    );

    expect(screen.getByTestId('chip-svc.db.orders')).toHaveTextContent(
      'Orders'
    );
    expect(screen.getByTestId('chip-svc.db.unknown')).toHaveTextContent(
      'svc.db.unknown'
    );
  });

  it('loads the next page when the list is scrolled to the bottom', async () => {
    mockSearchQuery.mockResolvedValue(searchResponse(TABLES, 20));
    render(<DataAssetAsyncSelectList />);
    await open();

    const listbox = screen.getByTestId('listbox');
    Object.defineProperties(listbox, {
      scrollTop: { value: 400 },
      offsetHeight: { value: 100 },
      scrollHeight: { value: 500 },
    });

    await act(async () => {
      fireEvent.scroll(listbox);
    });

    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 2 })
    );
  });

  it('passes the placeholder through', () => {
    render(<DataAssetAsyncSelectList placeholder="Pick an asset" />);

    expect(screen.getByTestId('placeholder')).toHaveTextContent(
      'Pick an asset'
    );
  });
});
