/*
 *  Copyright 2022 Collate.
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
  getByTestId,
  queryByTestId,
  render,
} from '@testing-library/react';
import { LabelType, State, TagSource } from 'generated/type/tagLabel';
import React from 'react';
import Tags from './tags';

const mockCallback = jest.fn();
const mockPush = jest.fn();

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
}));

describe('Test tags Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <Tags editable removeTag={mockCallback} startWith="#" tag="test" />
    );
    const tags = getByTestId(container, 'tags');
    const remove = getByTestId(container, 'remove-test-tag');

    expect(tags).toBeInTheDocument();
    expect(remove).toBeInTheDocument();
  });

  it('Component should render properly for add tag button', () => {
    const { container } = render(
      <Tags removeTag={mockCallback} startWith="+ " tag="add tag" />
    );
    const tags = getByTestId(container, 'tags');
    const remove = queryByTestId(container, 'remove-test-tag');

    expect(tags).toBeInTheDocument();
    expect(remove).toBeNull();
  });

  it('onClick of X callback function should call', () => {
    const { container } = render(
      <Tags
        editable
        isRemovable
        removeTag={mockCallback}
        startWith="#"
        tag="test"
      />
    );
    const remove = getByTestId(container, 'remove-test-tag');
    fireEvent.click(
      remove,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('Clicking on tag with source Classification should redirect to the proper Classification page', () => {
    const { container } = render(
      <Tags
        editable
        removeTag={mockCallback}
        startWith="#"
        tag={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'testTag.Test1',
        }}
      />
    );
    const tag = getByTestId(container, 'tags');

    fireEvent.click(tag);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/tags/testTag');
  });

  it('Clicking on tag with source Glossary should redirect to the proper glossary term page', () => {
    const { container } = render(
      <Tags
        editable
        removeTag={mockCallback}
        startWith="#"
        tag={{
          description: 'TestDescription',
          labelType: LabelType.Manual,
          source: TagSource.Glossary,
          state: State.Confirmed,
          tagFQN: 'glossaryTag.Test1',
        }}
      />
    );
    const tag = getByTestId(container, 'tags');

    fireEvent.click(tag);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/glossary/glossaryTag.Test1');
  });
});
