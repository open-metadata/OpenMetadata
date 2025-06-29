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
import { act, render, screen } from '@testing-library/react';
import { SelectableList } from './SelectableList.component';

const mockFetchOptions = jest
  .fn()
  .mockReturnValue({ data: [], paging: { total: 0 } });
const mockOnUpdate = jest.fn();
const mockOnCancel = jest.fn();
const mockCustomTagRenderer = jest
  .fn()
  .mockImplementation(() => <p>CustomRenderer</p>);

jest.mock('../UserTag/UserTag.component', () => ({
  UserTag: jest.fn().mockImplementation(({ name }) => <>{name}</>),
}));

jest.mock('../SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>Searchbar</div>)
);

describe('SelectableList Component Test', () => {
  it('should call fetchOptions on render', () => {
    render(
      <SelectableList
        multiSelect
        fetchOptions={mockFetchOptions}
        selectedItems={[]}
        onCancel={mockOnCancel}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      expect(mockFetchOptions).toHaveBeenCalledWith('');
    });
  });

  it('should render SearchBar', () => {
    render(
      <SelectableList
        multiSelect
        fetchOptions={mockFetchOptions}
        selectedItems={[]}
        onCancel={mockOnCancel}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      const searchBar = screen.getByText('Searchbar');

      expect(searchBar).toBeInTheDocument();
    });
  });

  it('should render SearchBar, Update, Cancel and count info', () => {
    mockFetchOptions.mockResolvedValueOnce({
      data: [],
      paging: { total: 5 },
    });

    render(
      <SelectableList
        multiSelect
        fetchOptions={mockFetchOptions}
        selectedItems={[]}
        onCancel={mockOnCancel}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      const searchBar = screen.getByText('Searchbar');
      const updateBtn = screen.getByText('label.update');
      const cancelBtn = screen.getByText('label.cancel');

      expect(searchBar).toBeInTheDocument();
      expect(updateBtn).toBeInTheDocument();
      expect(cancelBtn).toBeInTheDocument();
    });
  });

  it('should not render Update and Cancel if multiple prop is false', () => {
    mockFetchOptions.mockResolvedValueOnce({
      data: [],
      paging: { total: 5 },
    });

    render(
      <SelectableList
        fetchOptions={mockFetchOptions}
        selectedItems={[]}
        onCancel={mockOnCancel}
        onUpdate={mockOnUpdate}
      />
    );

    const updateBtn = screen.queryByText('label.update');
    const cancelBtn = screen.queryByText('label.cancel');

    expect(updateBtn).not.toBeInTheDocument();
    expect(cancelBtn).not.toBeInTheDocument();
  });

  it('should customRenderer if provided in props for rendering', async () => {
    mockFetchOptions.mockResolvedValueOnce({
      data: [
        {
          displayName: 'test',
          id: '1',
          fullyQualifiedName: 'test',
        },
      ],
      paging: { total: 5 },
    });

    render(
      <SelectableList
        customTagRenderer={mockCustomTagRenderer}
        fetchOptions={mockFetchOptions}
        selectedItems={[]}
        onCancel={mockOnCancel}
        onUpdate={mockOnUpdate}
      />
    );

    const testItem = await screen.findByText(
      'CustomRenderer',
      {},
      { timeout: 3000 }
    );

    expect(testItem).toBeInTheDocument();
    expect(mockCustomTagRenderer).toHaveBeenCalledWith({
      displayName: 'test',
      id: '1',
      fullyQualifiedName: 'test',
    });
  });

  it('should render RemoveIcon for selectedItemID', async () => {
    mockFetchOptions.mockResolvedValueOnce({
      data: [
        {
          displayName: 'test',
          id: '1',
          fullyQualifiedName: 'test',
        },
      ],
      paging: { total: 5 },
    });

    render(
      <SelectableList
        fetchOptions={mockFetchOptions}
        selectedItems={[
          {
            displayName: 'test',
            id: '1',
            fullyQualifiedName: 'test',
            type: 'user',
          },
        ]}
        onCancel={mockOnCancel}
        onUpdate={mockOnUpdate}
      />
    );

    await act(async () => {
      const removeIcon = await screen.findByTestId('remove-owner');

      expect(removeIcon).toBeInTheDocument();
    });
  });

  it('should not render RemoveIcon for other options', async () => {
    mockFetchOptions.mockResolvedValueOnce({
      data: [
        {
          displayName: 'test',
          id: '1',
          fullyQualifiedName: 'test',
          name: 'test',
        },
        {
          displayName: 'test2',
          id: '2',
          fullyQualifiedName: 'test2',
          name: 'test2',
        },
      ],
      paging: { total: 5 },
    });

    render(
      <SelectableList
        fetchOptions={mockFetchOptions}
        selectedItems={[
          {
            displayName: 'test',
            id: '1',
            fullyQualifiedName: 'test',
            type: 'user',
          },
        ]}
        onCancel={mockOnCancel}
        onUpdate={mockOnUpdate}
      />
    );

    const userTag = await screen.findByText('test2');

    expect(userTag).toBeInTheDocument();

    const removeIcon = screen.queryAllByTestId('remove-owner');

    expect(removeIcon).toHaveLength(1);
  });
});
