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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import { TAG_CONSTANT, TAG_START_WITH } from '../../../constants/Tag.constants';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import TagsV1 from './TagsV1.component';

const mockLinkButton = jest.fn();

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, ...rest }) => (
    <a {...rest} onClick={mockLinkButton}>
      {children}
    </a>
  )),
}));

jest.mock('../../../utils/TagsUtils', () => ({
  getTagDisplay: jest.fn().mockReturnValue('tags'),
  getTagTooltip: jest.fn().mockReturnValue(<p>ToolTip Data</p>),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  reduceColorOpacity: jest.fn().mockReturnValue('#00000'),
}));

describe('Test tags Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <TagsV1
        startWith={TAG_START_WITH.SOURCE_ICON}
        tag={{ ...TAG_CONSTANT, tagFQN: 'test' }}
      />
    );
    const tags = getByTestId(container, 'tags');

    expect(tags).toBeInTheDocument();
  });

  it('Component should render add tag button', () => {
    const { container } = render(
      <TagsV1
        startWith={TAG_START_WITH.PLUS}
        tag={{ ...TAG_CONSTANT, tagFQN: 'add tag' }}
      />
    );
    const addTags = getByTestId(container, 'add-tag');

    expect(addTags).toBeInTheDocument();
  });

  it('Clicking on tag with source Classification should redirect to the proper Classification page', () => {
    const { container } = render(
      <TagsV1
        startWith={TAG_START_WITH.SOURCE_ICON}
        tag={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'testTag.Test1',
        }}
      />
    );
    const tag = getByTestId(container, 'tag-redirect-link');

    fireEvent.click(tag);

    expect(mockLinkButton).toHaveBeenCalledTimes(1);
  });

  it('Clicking on tag with source Glossary should redirect to the proper glossary term page', () => {
    const { container } = render(
      <TagsV1
        startWith={TAG_START_WITH.SOURCE_ICON}
        tag={{
          description: 'TestDescription',
          labelType: LabelType.Manual,
          source: TagSource.Glossary,
          state: State.Confirmed,
          tagFQN: 'glossaryTag.Test1',
        }}
      />
    );
    const tag = getByTestId(container, 'tag-redirect-link');

    fireEvent.click(tag);

    expect(mockLinkButton).toHaveBeenCalledTimes(1);
  });

  it('should render size based tags, for small class should contain small', () => {
    const { container } = render(
      <TagsV1
        size="small"
        startWith={TAG_START_WITH.SOURCE_ICON}
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

    expect(tag).toHaveClass('small');
  });
});
