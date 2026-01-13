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
import { render } from '@testing-library/react';
import AsyncSelectList from '../../../components/common/AsyncSelectList/AsyncSelectList';
import { SelectOption } from '../../../components/common/AsyncSelectList/AsyncSelectList.interface';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import TagSuggestion from './TagSuggestion';

jest.mock('../../../components/common/AsyncSelectList/AsyncSelectList', () => {
  return jest.fn().mockImplementation(() => <div>AsyncSelectList</div>);
});

describe('TagSuggestion', () => {
  const onChange = jest.fn();
  const value: TagLabel[] = [];
  const placeholder = 'Select tags';
  const initialOptions: SelectOption[] = [];
  const tagType = TagSource.Classification;
  const selectProps = {};

  beforeEach(() => {
    render(
      <TagSuggestion
        initialOptions={initialOptions}
        placeholder={placeholder}
        selectProps={selectProps}
        tagType={tagType}
        value={value}
        onChange={onChange}
      />
    );
  });

  it('should render the component with the correct placeholder', () => {
    expect(AsyncSelectList).toHaveBeenCalledWith(
      expect.objectContaining({
        initialOptions: [],
        mode: 'multiple',
        placeholder: 'Select tags',
        value: [],
      }),
      {}
    );
  });

  it('should pass selectProps if passed', () => {
    render(
      <TagSuggestion
        initialOptions={initialOptions}
        placeholder={placeholder}
        selectProps={{
          open: true,
        }}
        tagType={tagType}
        value={value}
        onChange={onChange}
      />
    );

    expect(AsyncSelectList).toHaveBeenCalledWith(
      expect.objectContaining({
        initialOptions: [],
        mode: 'multiple',
        placeholder: 'Select tags',
        value: [],
        open: true,
      }),
      {}
    );
  });
});
