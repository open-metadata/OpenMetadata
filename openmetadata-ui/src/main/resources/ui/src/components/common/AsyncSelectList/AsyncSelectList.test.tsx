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

import {
  act,
  findByRole,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ASYNC_SELECT_MOCK } from '../../../mocks/AsyncSelect.mock';
import AsyncSelectList from './AsyncSelectList';

jest.mock('lodash', () => {
  const module = jest.requireActual('lodash');
  module.debounce = jest.fn((fn) => fn);

  return module;
});

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../Tag/TagsV1/TagsV1.component', () =>
  jest.fn().mockImplementation(() => <div>TagsV1</div>)
);

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/TagsUtils', () => ({
  getTagDisplay: jest.fn().mockReturnValue('tags'),
  tagRender: jest.fn().mockReturnValue(<p>Tags Render</p>),
}));

const mockOnChange = jest.fn();
const mockFetchOptions = jest.fn().mockReturnValue({
  data: [],
  paging: { total: 0 },
});

const mockProps = {
  fetchOptions: mockFetchOptions,
};

describe('Test AsyncSelect List Component', () => {
  it('Should render component', async () => {
    await act(async () => {
      render(<AsyncSelectList {...mockProps} />);
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
  });

  it('Should render value if passed', async () => {
    await act(async () => {
      render(<AsyncSelectList {...mockProps} value={['select-1']} />);
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();

    expect(screen.getByTitle('select-1')).toBeInTheDocument();
  });

  it('Should trigger fetchOptions when focus on select input', async () => {
    await act(async () => {
      render(<AsyncSelectList {...mockProps} />);
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();

    await act(async () => {
      fireEvent.focus(screen.getByTestId('tag-selector'));
    });

    expect(mockFetchOptions).toHaveBeenCalledWith('', 1);
  });

  it('Should call fetchOptions with multiple focus operation', async () => {
    await act(async () => {
      render(<AsyncSelectList {...mockProps} />);
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();

    await act(async () => {
      // first focus
      fireEvent.focus(screen.getByTestId('tag-selector'));

      expect(mockFetchOptions).toHaveBeenCalledWith('', 1);

      fireEvent.blur(screen.getByTestId('tag-selector'));

      // second focus
      fireEvent.focus(screen.getByTestId('tag-selector'));
    });

    expect(mockFetchOptions).toHaveBeenCalledWith('', 1);
  });

  it('Should call fetchOptions with search data when user type text', async () => {
    await act(async () => {
      render(<AsyncSelectList {...mockProps} />);
    });

    const searchInput = (await screen.findByRole(
      'combobox'
    )) as HTMLInputElement;

    expect(searchInput.value).toBe('');

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'entity-tags' } });
    });

    expect(searchInput.value).toBe('entity-tags');

    expect(mockFetchOptions).toHaveBeenCalledWith('entity-tags', 1);

    expect(mockFetchOptions).toHaveBeenCalledTimes(2);
  });

  //   it('Should render options if provided', async () => {
  //     mockFetchOptions.mockResolvedValueOnce(ASYNC_SELECT_MOCK);

  //     await act(async () => {
  //       render(<AsyncSelectList {...mockProps} />);
  //     });

  //     const selectInput = await findByRole(
  //       screen.getByTestId('tag-selector'),
  //       'combobox'
  //     );

  //     await act(async () => {
  //       fireEvent.click(selectInput);
  //     });

  //     // wait for list to render, checked with item having in the list
  //     await waitFor(() => screen.findByTestId('tag-tags-6'));

  //     const item = screen.queryByText('tags-6');

  //     expect(item).toBeInTheDocument();

  //     expect(mockFetchOptions).toHaveBeenCalledWith('', 1);

  //     expect(mockFetchOptions).toHaveBeenCalledTimes(1);
  //   });

  it('Should filter options based on provided filterOptions', async () => {
    mockFetchOptions.mockResolvedValueOnce(ASYNC_SELECT_MOCK);

    await act(async () => {
      render(<AsyncSelectList {...mockProps} filterOptions={['tags-1']} />);
    });

    const selectInput = await findByRole(
      screen.getByTestId('tag-selector'),
      'combobox'
    );

    await act(async () => {
      fireEvent.click(selectInput);
    });

    const filteredItem = screen.queryByText('tags-1');

    expect(filteredItem).not.toBeInTheDocument();

    expect(mockFetchOptions).toHaveBeenCalledWith('', 1);

    expect(mockFetchOptions).toHaveBeenCalledTimes(1);
  });

  it('Should not trigger onChange on item selection', async () => {
    mockFetchOptions.mockResolvedValueOnce(ASYNC_SELECT_MOCK);

    await act(async () => {
      render(<AsyncSelectList {...mockProps} mode="multiple" />);
    });

    const selectInput = await findByRole(
      screen.getByTestId('tag-selector'),
      'combobox'
    );

    await act(async () => {
      userEvent.click(selectInput);
    });

    await waitFor(() => screen.getByTestId('tag-tags-0'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('tag-tags-0'));
    });

    expect(mockOnChange).not.toHaveBeenCalled();

    expect(mockFetchOptions).toHaveBeenCalledTimes(1);
  });

  it('Should trigger onChange on item selection', async () => {
    mockFetchOptions.mockResolvedValueOnce(ASYNC_SELECT_MOCK);
    await act(async () => {
      render(
        <AsyncSelectList
          {...mockProps}
          mode="multiple"
          onChange={mockOnChange}
        />
      );
    });

    const selectInput = await findByRole(
      screen.getByTestId('tag-selector'),
      'combobox'
    );

    await act(async () => {
      userEvent.click(selectInput);
    });

    await waitFor(() => screen.getByTestId('tag-tags-0'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('tag-tags-0'));
    });

    expect(mockOnChange).toHaveBeenCalledTimes(1);

    expect(mockFetchOptions).toHaveBeenCalledTimes(1);
  });

  it('should pass optionClassName to options render by Select', async () => {
    mockFetchOptions.mockResolvedValueOnce(ASYNC_SELECT_MOCK);
    await act(async () => {
      render(
        <AsyncSelectList
          {...mockProps}
          mode="multiple"
          optionClassName="option-class"
          onChange={mockOnChange}
        />
      );
    });

    const selectInput = await findByRole(
      screen.getByTestId('tag-selector'),
      'combobox'
    );

    await act(async () => {
      userEvent.click(selectInput);
    });

    await waitFor(() => screen.getByTestId('tag-tags-0'));

    expect(screen.getByTestId('tag-tags-0')).toHaveClass('option-class');
  });
});
