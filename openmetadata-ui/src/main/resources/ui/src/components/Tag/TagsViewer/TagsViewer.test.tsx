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

import { fireEvent, render, screen } from '@testing-library/react';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import TagsViewer from './TagsViewer';
import { DisplayType } from './TagsViewer.interface';

const tags = [
  { tagFQN: `tags.tag_1`, source: 'Classification' },
  { tagFQN: `tags.tag_2`, source: 'Classification' },
  { tagFQN: `tags.tag_3`, source: 'Classification' },
  { tagFQN: `test.tags.term_1`, source: 'Glossary' },
  { tagFQN: `test.tags.term_2`, source: 'Glossary' },
  { tagFQN: `test.tags.term_3`, source: 'Glossary' },
];

jest.mock('../TagsV1/TagsV1.component', () => {
  return jest.fn().mockReturnValue(<p>TagsV1</p>);
});

describe('Test TagsViewer Component', () => {
  it('Should render placeholder if tags is empty', () => {
    render(<TagsViewer sizeCap={-1} tags={[]} />);
    const placeholder = screen.getByText(NO_DATA_PLACEHOLDER);

    expect(placeholder).toBeInTheDocument();
  });

  it('Should render all tags', () => {
    render(<TagsViewer sizeCap={-1} tags={tags} />);
    const allTags = screen.getAllByText('TagsV1');

    expect(allTags).toHaveLength(6);
  });

  it('Should render tags as per sizeCap', () => {
    render(<TagsViewer sizeCap={2} tags={tags} />);
    const allTags = screen.getAllByText('TagsV1');

    expect(allTags).toHaveLength(2);
  });

  it('Should render tags on popover style', () => {
    render(<TagsViewer tags={tags} />);

    const sizeTags = screen.getAllByText('TagsV1');

    expect(sizeTags).toHaveLength(5);

    const popoverElement = screen.getByTestId('popover-element');

    expect(popoverElement).toBeInTheDocument();

    const plusButton = screen.getByTestId('plus-more-count');

    expect(plusButton).toHaveTextContent('+1 more');
  });

  it('Should render tags on read more style', () => {
    render(<TagsViewer displayType={DisplayType.READ_MORE} tags={tags} />);

    const sizeTags = screen.getAllByText('TagsV1');

    expect(sizeTags).toHaveLength(5);

    const readMoreElement = screen.getByTestId('read-more-element');

    expect(readMoreElement).toBeInTheDocument();

    const readButton = screen.getByTestId('read-button');

    expect(readButton).toHaveTextContent('label.plus-count-more');
  });

  it('Should render all tags on popover click', () => {
    render(<TagsViewer tags={tags} />);

    const plusButton = screen.getByTestId('plus-more-count');

    expect(plusButton).toHaveTextContent('+1 more');

    fireEvent.click(plusButton);

    const sizeTags = screen.getAllByText('TagsV1');

    expect(sizeTags).toHaveLength(6);
  });

  it('Should render all tags on read more click', () => {
    render(<TagsViewer displayType={DisplayType.READ_MORE} tags={tags} />);

    const readButton = screen.getByTestId('read-button');

    expect(readButton).toHaveTextContent('label.plus-count-more');

    fireEvent.click(readButton);

    const sizeTags = screen.getAllByText('TagsV1');

    expect(sizeTags).toHaveLength(6);
  });
});
