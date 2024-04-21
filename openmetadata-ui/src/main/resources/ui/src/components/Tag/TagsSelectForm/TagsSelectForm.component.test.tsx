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
import React from 'react';
import { TagSource } from '../../../generated/type/tagLabel';
import { SelectOption } from '../../common/AsyncSelectList/AsyncSelectList.interface';
import TagSelectForm from './TagsSelectForm.component';

describe.skip('TagSelectForm', () => {
  const fetchApi = jest.fn();
  const defaultValue: string[] = [];
  const placeholder = 'Select tags';
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  const tagData: SelectOption[] = [];
  const tagType = TagSource.Classification;

  beforeEach(() => {
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

  it('should render the form with cancel and save buttons', () => {
    expect(screen.getByTestId('cancelAssociatedTag')).toBeInTheDocument();
    expect(screen.getByTestId('saveAssociatedTag')).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const cancelButton = screen.getByTestId('cancelAssociatedTag');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should disable save button when isSubmitLoading is true', async () => {
    const saveButton = screen.getByTestId('saveAssociatedTag');

    expect(saveButton).not.toBeDisabled();

    act(() => {
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
    act(() => {
      fireEvent.click(saveButton);
    });

    const elements = await screen.findAllByTestId('saveAssociatedTag');

    const lastElement = elements.pop();

    jest.runAllTimers();

    expect(lastElement).not.toBeDisabled();
  });
});
