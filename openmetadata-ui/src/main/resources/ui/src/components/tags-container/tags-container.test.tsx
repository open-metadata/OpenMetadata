/*
 *  Copyright 2021 Collate
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
  fireEvent,
  getAllByTestId,
  getByTestId,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import TagsContainer from './tags-container';

const tagList = [
  { fqn: 'tag 1', source: 'Tag' },
  { fqn: 'tag 2', source: 'Tag' },
  { fqn: 'tag 3', source: 'Glossary' },
];

const tagListWithTier = [
  { fqn: 'Tier:Tier1', source: 'Tag' },
  { fqn: 'Data:Tier1Data', source: 'Tag' },
  { fqn: 'Tier:Tier2', source: 'Glossary' },
  { fqn: 'Count:Tier2Count', source: 'Glossary' },
];
const onCancel = jest.fn();
const onSelectionChange = jest.fn();

jest.mock('../tags/tags', () => {
  return jest.fn().mockReturnValue(<p>tags</p>);
});

describe('Test TagsContainer Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <TagsContainer
        editable
        selectedTags={[]}
        tagList={tagList}
        onCancel={onCancel}
        onSelectionChange={onSelectionChange}
      />
    );
    const TagContainer = getByTestId(container, 'tag-container');

    expect(TagContainer).toBeInTheDocument();
  });

  it('Should have one input', () => {
    const { container } = render(
      <TagsContainer
        editable
        selectedTags={[]}
        tagList={tagList}
        onCancel={onCancel}
        onSelectionChange={onSelectionChange}
      />
    );

    const input = getByTestId(container, 'associatedTagName');

    expect(input).toBeInTheDocument();
  });

  it('Should have two buttons', () => {
    const { container } = render(
      <TagsContainer
        editable
        selectedTags={[]}
        tagList={tagList}
        onCancel={onCancel}
        onSelectionChange={onSelectionChange}
      />
    );
    const buttons = getByTestId(container, 'buttons');

    expect(buttons.childElementCount).toBe(2);
  });

  it('Should suggest tags on typing', () => {
    const { container } = render(
      <TagsContainer
        editable
        selectedTags={[]}
        tagList={tagList}
        onCancel={onCancel}
        onSelectionChange={onSelectionChange}
      />
    );

    const input = getByTestId(container, 'associatedTagName');

    fireEvent.change(input, { target: { value: 'tag' } });

    const tagSuggestions = getByTestId(container, 'dropdown-list');

    expect(tagSuggestions).toBeInTheDocument();

    const tagItems = getAllByTestId(tagSuggestions, 'list-item');

    expect(tagItems).toHaveLength(3);
  });

  it('Should only exclude Tier tags from suggestions', () => {
    const { container } = render(
      <TagsContainer
        editable
        selectedTags={[]}
        tagList={tagListWithTier}
        onCancel={onCancel}
        onSelectionChange={onSelectionChange}
      />
    );

    const input = getByTestId(container, 'associatedTagName');

    fireEvent.change(input, { target: { value: 'tier' } });

    const tagSuggestions = getByTestId(container, 'dropdown-list');

    expect(tagSuggestions).toBeInTheDocument();

    const tagItems = getAllByTestId(tagSuggestions, 'list-item');

    expect(tagItems).toHaveLength(2);
  });

  it('Should not suggest tags on typing unmatched tag name', () => {
    const { container } = render(
      <TagsContainer
        editable
        selectedTags={[]}
        tagList={tagList}
        onCancel={onCancel}
        onSelectionChange={onSelectionChange}
      />
    );

    const input = getByTestId(container, 'associatedTagName');

    fireEvent.change(input, { target: { value: 'qwerty' } });

    const tagSuggestions = queryByTestId(container, 'dropdown-list');

    expect(tagSuggestions).not.toBeInTheDocument();
  });
});
