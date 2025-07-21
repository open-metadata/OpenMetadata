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
import { TagSource } from '../../../generated/type/tagLabel';
import AsyncSelectList from '../../common/AsyncSelectList/AsyncSelectList';
import { SelectOption } from '../../common/AsyncSelectList/AsyncSelectList.interface';
import TreeAsyncSelectList from '../../common/AsyncSelectList/TreeAsyncSelectList';
import TagSelectForm from './TagsSelectForm.component';

jest.mock('../../common/AsyncSelectList/AsyncSelectList', () => {
  return jest.fn().mockReturnValue(<div>AsyncSelectList</div>);
});
jest.mock('../../common/AsyncSelectList/TreeAsyncSelectList', () => {
  return jest.fn().mockReturnValue(<div>TreeAsyncSelectList</div>);
});

describe('TagSelectForm', () => {
  const fetchApi = jest.fn();
  const defaultValue: string[] = [];
  const placeholder = 'Select tags';
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  const tagData: SelectOption[] = [];
  let tagType = TagSource.Classification;

  beforeEach(() => {
    tagType = TagSource.Classification;
    render(
      <TagSelectForm
        defaultValue={defaultValue}
        fetchApi={fetchApi}
        placeholder={placeholder}
        tagData={tagData}
        tagType={tagType}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  });

  it('should render AsyncSelectList', async () => {
    expect(screen.getByText('AsyncSelectList')).toBeInTheDocument();
  });

  it('should render TreeAsyncSelectList', async () => {
    tagType = TagSource.Glossary;

    render(
      <TagSelectForm
        defaultValue={defaultValue}
        fetchApi={fetchApi}
        placeholder={placeholder}
        tagData={tagData}
        tagType={tagType}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('TreeAsyncSelectList')).toBeInTheDocument();
  });

  it('should pass isSubmitLoading for saving form for tagType Glossary', async () => {
    tagType = TagSource.Glossary;
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
        tagType={tagType}
        onCancel={onCancel}
        onSubmit={mockSubmit}
      />
    );

    const form = (await screen.findAllByTestId('tag-form'))[1];

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(TreeAsyncSelectList).toHaveBeenCalledWith(
      expect.objectContaining({ isSubmitLoading: true }),
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
        tagType={tagType}
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
