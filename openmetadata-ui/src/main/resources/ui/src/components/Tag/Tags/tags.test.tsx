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
import { TAG_CONSTANT, TAG_START_WITH } from 'constants/Tag.constants';
import { LabelType, State, TagSource } from 'generated/type/tagLabel';
import React from 'react';
import Tags from './tags';

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
      <Tags editable tag={{ ...TAG_CONSTANT, tagFQN: 'test' }} />
    );
    const tags = getByTestId(container, 'tags');

    expect(tags).toBeInTheDocument();
  });

  it('Component should render properly for add tag button', () => {
    const { container } = render(
      <Tags
        startWith={TAG_START_WITH.PLUS}
        tag={{ ...TAG_CONSTANT, tagFQN: 'add tag' }}
      />
    );
    const tags = getByTestId(container, 'tags');
    const remove = queryByTestId(container, 'remove-test-tag');

    expect(tags).toBeInTheDocument();
    expect(remove).toBeNull();
  });

  it('Clicking on tag with source Classification should redirect to the proper Classification page', () => {
    const { container } = render(
      <Tags
        editable
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
