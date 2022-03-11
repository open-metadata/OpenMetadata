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

import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import TagsContainer from './tags-container';

const tagList = [
  { fqn: 'tag 1', source: 'Tag' },
  { fqn: 'tag 2', source: 'Tag' },
  { fqn: 'tag 3', source: 'Glossary' },
];
const onCancel = jest.fn();
const onSelectionChange = jest.fn();

jest.mock('../dropdown/DropDownList', () => {
  return jest.fn().mockReturnValue(<p>DropDownList</p>);
});

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

  it('should have two buttons', () => {
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
});
