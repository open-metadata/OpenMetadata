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
import { render, screen } from '@testing-library/react';
import { TagSource } from '../../../generated/type/tagLabel';
import { SelectOption } from './AsyncSelectList.interface';
import TreeAsyncSelectList from './TreeAsyncSelectList';

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossariesList: jest.fn().mockResolvedValue({
    data: [{ id: 1, name: 'glossary-1', fullyQualifiedName: 'value1' }],
  }),
  getGlossaryTerms: jest.fn(),
  searchGlossaryTerms: jest.fn(),
}));

jest.mock('../../../utils/GlossaryUtils', () => ({
  buildTree: jest
    .fn()
    .mockReturnValue([
      { id: 1, name: 'glossary-1', fullyQualifiedName: 'value1' },
    ]),
  convertGlossaryTermsToTreeOptions: jest.fn(),
  findGlossaryTermByFqn: jest.fn(),
  filterTreeNodeOptions: jest.fn().mockReturnValue([]),
}));

describe('TreeAsyncSelectList', () => {
  const onChange = jest.fn();
  const initialOptions: SelectOption[] = [];
  const tagType = TagSource.Glossary;
  const isSubmitLoading = false;
  const onCancel = jest.fn();

  beforeEach(() => {
    render(
      <TreeAsyncSelectList
        initialOptions={initialOptions}
        isSubmitLoading={isSubmitLoading}
        tagType={tagType}
        onCancel={onCancel}
        onChange={onChange}
      />
    );
  });

  it('should render the component', () => {
    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
  });
});
