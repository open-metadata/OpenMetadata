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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import DataAssetSelectList from './DataAssetSelectList';

jest.mock('../../../rest/searchAPI');
jest.mock('../../../utils/Assets/AssetsUtils', () => ({
  getEntityIconWithBg: jest.fn().mockReturnValue(<span>icon</span>),
}));
jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((src) => src.displayName ?? src.name),
}));
jest.mock('../../../utils/EntityReferenceUtils', () => ({
  getEntityReferenceFromEntity: jest
    .fn()
    .mockImplementation((entity, type) => ({ ...entity, type })),
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

const TRIGGER_TEST_ID = 'multi-trigger';

const mockSearchResponse = {
  hits: {
    hits: [
      {
        _source: {
          id: '1',
          name: 'orders',
          fullyQualifiedName: 'db.schema.orders',
          entityType: 'table',
          displayName: 'Orders',
        },
      },
      {
        _source: {
          id: '2',
          name: 'products',
          fullyQualifiedName: 'db.schema.products',
          entityType: 'table',
          displayName: 'Products',
        },
      },
    ],
    total: { value: 2 },
  },
};

const openPopover = () => fireEvent.click(screen.getByTestId(TRIGGER_TEST_ID));

describe('DataAssetSelectList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse);
  });

  it('renders the trigger provided by the caller', () => {
    render(
      <DataAssetSelectList
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Pick asset
          </button>
        )}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId(TRIGGER_TEST_ID)).toBeInTheDocument();
  });

  it('opens the popover and loads options on trigger click', async () => {
    render(
      <DataAssetSelectList
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        onChange={jest.fn()}
      />
    );

    await act(async () => {
      openPopover();
    });

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('calls onChange with selected option when an asset is clicked', async () => {
    const onChange = jest.fn();
    render(
      <DataAssetSelectList
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        onChange={onChange}
      />
    );

    await act(async () => {
      openPopover();
    });

    await waitFor(() => {
      expect(screen.getByText('Orders')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Orders').closest('button')!);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ value: 'db.schema.orders' }),
      ])
    );
  });

  it('deselects an already-selected option when clicked again', async () => {
    const onChange = jest.fn();
    const initialOptions = [
      {
        label: 'Orders',
        displayName: 'Orders',
        name: 'orders',
        value: 'db.schema.orders',
        reference: {
          id: '1',
          type: 'table',
          fullyQualifiedName: 'db.schema.orders',
        },
      },
    ];

    render(
      <DataAssetSelectList
        initialOptions={initialOptions}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        onChange={onChange}
      />
    );

    await act(async () => {
      openPopover();
    });

    await waitFor(() => {
      expect(screen.getByText('Orders')).toBeInTheDocument();
    });

    // Click to deselect
    fireEvent.click(screen.getByText('Orders').closest('button')!);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('filters out assets whose fqn is in filterFqns', async () => {
    render(
      <DataAssetSelectList
        filterFqns={['db.schema.orders']}
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        onChange={jest.fn()}
      />
    );

    await act(async () => {
      openPopover();
    });

    await waitFor(() => {
      expect(screen.getByText('Products')).toBeInTheDocument();
    });

    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });

  it('passes searchIndex to the search API', async () => {
    render(
      <DataAssetSelectList
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        searchIndex={SearchIndex.TABLE}
        onChange={jest.fn()}
      />
    );

    await act(async () => {
      openPopover();
    });

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchIndex: SearchIndex.TABLE })
      );
    });
  });

  it('shows loading state while options are being fetched', async () => {
    let resolveSearch!: (value: unknown) => void;
    (searchQuery as jest.Mock).mockImplementation(
      () => new Promise((res) => (resolveSearch = res))
    );

    render(
      <DataAssetSelectList
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        onChange={jest.fn()}
      />
    );

    await act(async () => {
      openPopover();
    });

    expect(screen.getByText('label.loading...')).toBeInTheDocument();

    await act(async () => {
      resolveSearch(mockSearchResponse);
    });
  });

  it('stays open in multiple selection mode after selecting an option', async () => {
    render(
      <DataAssetSelectList
        renderTrigger={({ open }) => (
          <button data-testid={TRIGGER_TEST_ID} onClick={open}>
            Open
          </button>
        )}
        onChange={jest.fn()}
      />
    );

    await act(async () => {
      openPopover();
    });

    await waitFor(() => {
      expect(screen.getByText('Orders')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Orders').closest('button')!);

    // Popover should still be open after selection in multi mode
    expect(screen.getByText('Products')).toBeInTheDocument();
  });
});
