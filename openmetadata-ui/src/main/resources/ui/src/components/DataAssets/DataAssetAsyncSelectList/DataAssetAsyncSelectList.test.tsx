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
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import DataAssetAsyncSelectList from './DataAssetAsyncSelectList';
import { DataAssetOption } from './DataAssetAsyncSelectList.interface';

const mockOnItemInserted = jest.fn();
const mockOnItemCleared = jest.fn();
const mockOnSearchChange = jest.fn();

jest.mock('@openmetadata/ui-core-components', () => {
  const MockAutocompleteItem = jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    ));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AutocompleteMock: any = jest.fn().mockImplementation((props) => {
    mockOnItemInserted.mockImplementation(props.onItemInserted);
    mockOnItemCleared.mockImplementation(props.onItemCleared);
    mockOnSearchChange.mockImplementation(props.onSearchChange);

    return (
      <div data-testid="asset-select-list">
        <input
          placeholder={props.placeholder}
          role="searchbox"
          type="text"
          onChange={(e) => props.onSearchChange?.(e.target.value)}
        />
        <div>
          {props.selectedItems?.map((item: DataAssetOption) => (
            <div data-testid={`selected-${item.id}`} key={item.id}>
              {item.displayName}
            </div>
          ))}
        </div>
        <div>
          {props.items?.map((item: DataAssetOption) => {
            const child = props.children(item);

            return (
              <button
                data-testid={child.props['data-testid']}
                key={item.id}
                onClick={() => props.onItemInserted?.(item.id)}>
                {child.props.children || item.displayName}
              </button>
            );
          })}
        </div>
      </div>
    );
  });

  AutocompleteMock.Item = MockAutocompleteItem;

  return {
    Autocomplete: AutocompleteMock,
  };
});

jest.mock('../../../rest/searchAPI');
jest.mock('../../../utils/TableUtils');
jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIcon: jest.fn().mockReturnValue(null),
  },
}));
jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Test'),
  getEntityReferenceFromEntity: jest
    .fn()
    .mockImplementation((entity, type) => ({
      ...entity,
      entityType: undefined,
      type: type,
    })),
}));
jest.mock('../../common/ProfilePicture/ProfilePicture', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="profile-pic">ProfilePicture</p>);
});

const mockLocationPathname = '/mock-path';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
  })),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

const mockUserData = {
  data: {
    hits: {
      hits: [
        {
          _source: {
            id: '4d499590-89ef-438d-9c49-3f05c4041144',
            name: 'admin',
            fullyQualifiedName: 'admin',
            entityType: 'user',
            displayName: 'admin',
          },
        },
        {
          _source: {
            id: '93057069-3836-4fc0-b85e-a456e52b4424',
            name: 'user1',
            fullyQualifiedName: 'user1',
            entityType: 'user',
            displayName: 'user1',
          },
        },
      ],
      total: {
        value: 2,
      },
    },
  },
};

const mockSearchAPIResponse = {
  data: {
    hits: {
      hits: [
        {
          _source: {
            id: '1',
            name: 'test 1',
            fullyQualifiedName: 'test-1',
            entityType: 'table',
            href: '',
            description: '',
            deleted: false,
          },
        },
        {
          _source: {
            id: '2',
            name: 'test 2',
            fullyQualifiedName: 'test-2',
            entityType: 'table',
            href: '',
            description: '',
            deleted: false,
          },
        },
      ],
      total: {
        value: 2,
      },
    },
  },
};

describe('DataAssetAsyncSelectList', () => {
  it('should render without crashing', async () => {
    await act(async () => {
      render(<DataAssetAsyncSelectList />);
    });

    expect(screen.getByTestId('asset-select-list')).toBeInTheDocument();
  });

  it('should call searchQuery when focused', async () => {
    (searchQuery as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockSearchAPIResponse.data)
    );

    await act(async () => {
      render(<DataAssetAsyncSelectList />);
    });

    expect(searchQuery).toHaveBeenCalledTimes(1);
  });

  it('should render profile picture if search index is user', async () => {
    const mockSearchQuery = searchQuery as jest.Mock;
    mockSearchQuery.mockImplementationOnce((params) => {
      expect(params).toEqual(
        expect.objectContaining({ searchIndex: SearchIndex.USER })
      );

      return Promise.resolve(mockUserData.data);
    });

    await act(async () => {
      render(
        <DataAssetAsyncSelectList multiple searchIndex={SearchIndex.USER} />
      );
    });

    expect(searchQuery).toHaveBeenCalledTimes(1);
  });

  it('should call onChange when an option is selected', async () => {
    const mockOnChange = jest.fn();

    (searchQuery as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockSearchAPIResponse.data)
    );

    await act(async () => {
      render(
        <DataAssetAsyncSelectList
          multiple
          debounceTimeout={0}
          onChange={mockOnChange}
        />
      );
    });

    expect(searchQuery).toHaveBeenCalledTimes(1);

    const inputBox = screen.getByRole('searchbox');

    await act(async () => {
      fireEvent.input(inputBox, {
        target: { value: 'test 1' },
      });
    });

    const option = await screen.findByTestId('option-test-1');

    await act(async () => {
      fireEvent.click(option);
    });

    expect(mockOnChange).toHaveBeenCalled();

    const callArg = mockOnChange.mock.calls[0][0];

    expect(Array.isArray(callArg)).toBe(true);
    expect(callArg).toHaveLength(1);
    expect(callArg[0]).toMatchObject({
      id: 'test-1',
      displayName: 'Test',
      value: 'test-1',
    });
  });

  it("should render the placeholder when there's no value", async () => {
    const placeholder = 'test placeholder';

    await act(async () => {
      render(<DataAssetAsyncSelectList multiple placeholder={placeholder} />);
    });

    expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
  });

  it("should render the value when there's a value and initial option", async () => {
    const value = ['1'];
    const initialOptions: DataAssetOption[] = [
      {
        id: '1',
        displayName: 'Test',
        label: 'Test',
        reference: { id: '1', type: 'table' },
        value: '1',
      },
    ];

    (searchQuery as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockSearchAPIResponse.data)
    );

    await act(async () => {
      render(
        <DataAssetAsyncSelectList
          multiple
          initialOptions={initialOptions}
          value={value}
        />
      );
    });

    expect(screen.getByTestId('selected-1')).toBeInTheDocument();
    expect(screen.getByTestId('selected-1')).toHaveTextContent('Test');
  });

  it('should render multiple selected items', async () => {
    const value = ['test-1', 'test-2'];
    const initialOptions: DataAssetOption[] = [
      {
        id: 'test-1',
        displayName: 'Test 1',
        label: 'Test 1',
        reference: { id: '1', type: 'table', fullyQualifiedName: 'test-1' },
        value: 'test-1',
      },
      {
        id: 'test-2',
        displayName: 'Test 2',
        label: 'Test 2',
        reference: { id: '2', type: 'table', fullyQualifiedName: 'test-2' },
        value: 'test-2',
      },
    ];

    (searchQuery as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockSearchAPIResponse.data)
    );

    await act(async () => {
      render(
        <DataAssetAsyncSelectList
          multiple
          initialOptions={initialOptions}
          value={value}
        />
      );
    });

    expect(screen.getByText('Test 1')).toBeInTheDocument();
    expect(screen.getByText('Test 2')).toBeInTheDocument();
  });

  it('searchQuery should be called with queryFilter', async () => {
    const mockSearchQuery = searchQuery as jest.Mock;
    mockSearchQuery.mockImplementationOnce((params) => {
      expect(params).toEqual(
        expect.objectContaining({
          queryFilter: {
            query: { bool: { must_not: [{ match: { isBot: true } }] } },
          },
        })
      );

      return Promise.resolve(mockUserData.data);
    });

    await act(async () => {
      render(
        <DataAssetAsyncSelectList multiple searchIndex={SearchIndex.USER} />
      );
    });

    expect(searchQuery).toHaveBeenCalledTimes(1);
  });
});
