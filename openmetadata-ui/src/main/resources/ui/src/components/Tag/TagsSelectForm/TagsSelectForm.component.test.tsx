/*
 *  Copyright 2024 Collate.
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
import AsyncSelectList from '../../common/AsyncSelectList/AsyncSelectList';
import { SelectOption } from '../../common/AsyncSelectList/AsyncSelectList.interface';
import TagSelectForm from './TagsSelectForm.component';

jest.mock('../../common/AsyncSelectList/AsyncSelectList', () => {
  return jest.fn().mockReturnValue(<div>AsyncSelectList</div>);
});

describe('TagSelectForm', () => {
  const fetchApi = jest.fn();
  const defaultValue: string[] = [];
  const placeholder = 'Select tags';
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  const tagData: SelectOption[] = [];

  beforeEach(() => {
    render(
      <TagSelectForm
        defaultValue={defaultValue}
        fetchApi={fetchApi}
        placeholder={placeholder}
        tagData={tagData}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  });

  it('should render AsyncSelectList', async () => {
    expect(screen.getByText('AsyncSelectList')).toBeInTheDocument();
  });

  it('should pass the default value through to the list', () => {
    expect(AsyncSelectList).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialOptions: tagData }),
      {}
    );
  });

  it('should pass isSubmitLoading for saving form', async () => {
    const mockSubmit = jest
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 0))
      );

    render(
      <TagSelectForm
        defaultValue={defaultValue}
        fetchApi={fetchApi}
        placeholder={placeholder}
        tagData={tagData}
        onCancel={onCancel}
        onSubmit={mockSubmit}
      />
    );

    const form = (await screen.findAllByTestId('tag-form'))[1];

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(AsyncSelectList).toHaveBeenLastCalledWith(
      expect.objectContaining({ isSubmitLoading: true }),
      {}
    );
  });
});
