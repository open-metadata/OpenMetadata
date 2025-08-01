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
import userEvent from '@testing-library/user-event';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import DataAssetAsyncSelectList from './DataAssetAsyncSelectList';
import { DataAssetOption } from './DataAssetAsyncSelectList.interface';

jest.mock('../../../rest/searchAPI');
jest.mock('../../../utils/TableUtils');
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

    const { container } = render(<DataAssetAsyncSelectList />);

    await act(async () => {
      const inputBox = container.querySelector('.ant-select-selector');
      inputBox && userEvent.click(inputBox);
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

    const { container } = render(
      <DataAssetAsyncSelectList
        mode="multiple"
        searchIndex={SearchIndex.USER}
      />
    );

    await act(async () => {
      const inputBox = container.querySelector('.ant-select-selector');
      inputBox && fireEvent.click(inputBox);
    });

    expect(searchQuery).toHaveBeenCalledTimes(1);
  });

  it('should call onChange when an option is selected', async () => {
    const mockOnChange = jest.fn();

    const mockOptions: DataAssetOption[] = [
      {
        displayName: 'Test',
        label: 'Test',
        reference: {
          id: '1',
          type: 'table',
          name: 'test 1',
          deleted: false,
          description: '',
          fullyQualifiedName: 'test-1',
          href: '',
        },
        value: 'test-1',
      },
    ];

    (searchQuery as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockSearchAPIResponse.data)
    );

    const { container } = render(
      <DataAssetAsyncSelectList mode="multiple" onChange={mockOnChange} />
    );

    await act(async () => {
      const inputBox = container.querySelector('.ant-select-selector');
      inputBox && userEvent.click(inputBox);
    });

    expect(searchQuery).toHaveBeenCalledTimes(1);

    const inputBox = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(inputBox, {
        target: { value: 'test 1' },
      });
    });

    const option = screen.getByTestId('option-test-1');

    fireEvent.click(option);

    expect(mockOnChange).toHaveBeenCalledWith(mockOptions);
  });

  it("should render the placeholder when there's no value", async () => {
    const placeholder = 'test placeholder';

    await act(async () => {
      render(
        <DataAssetAsyncSelectList mode="multiple" placeholder={placeholder} />
      );
    });

    expect(screen.getByText(placeholder)).toBeInTheDocument();
  });

  it("should render the default value when there's a default value and initial option", async () => {
    const defaultValue = ['1'];
    const initialOptions: DataAssetOption[] = [
      {
        displayName: 'Test',
        label: 'Test',
        reference: { id: '1', type: 'table' },
        value: '1',
      },
    ];

    await act(async () => {
      render(
        <DataAssetAsyncSelectList
          defaultValue={defaultValue}
          initialOptions={initialOptions}
          mode="multiple"
        />
      );
    });

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it("should render the default value when there's a value and initial option", async () => {
    const defaultValue = ['1'];
    const initialOptions: DataAssetOption[] = [
      {
        displayName: 'Test',
        label: 'Test',
        reference: { id: '1', type: 'table' },
        value: '1',
      },
    ];

    await act(async () => {
      render(
        <DataAssetAsyncSelectList
          defaultValue={defaultValue}
          initialOptions={initialOptions}
          mode="multiple"
        />
      );
    });

    expect(screen.getByText('Test')).toBeInTheDocument();
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

    const { container } = render(
      <DataAssetAsyncSelectList
        mode="multiple"
        searchIndex={SearchIndex.USER}
      />
    );

    await act(async () => {
      const inputBox = container.querySelector('.ant-select-selector');
      inputBox && userEvent.click(inputBox);
    });

    expect(searchQuery).toHaveBeenCalledTimes(1);
  });
});
