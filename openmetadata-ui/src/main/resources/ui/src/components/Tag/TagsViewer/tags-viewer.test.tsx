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

import { getAllByTestId, getByText, render } from '@testing-library/react';
import React from 'react';
import TagsViewer from './tags-viewer';

const tags = [
  { tagFQN: `tags.tag 1`, source: 'Classification' },
  { tagFQN: `tags.tag 2`, source: 'Classification' },
  { tagFQN: `test.tags.term`, source: 'Glossary' },
];

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

describe('Test TagsViewer Component', () => {
  it('Component should render', () => {
    const { container } = render(<TagsViewer sizeCap={-1} tags={tags} />);
    const TagViewer = getAllByTestId(container, 'tags');

    expect(TagViewer).toHaveLength(3);
  });

  it('Should render tags', () => {
    const { container } = render(<TagsViewer sizeCap={-1} tags={tags} />);
    const TagViewer = getAllByTestId(container, 'tags');

    expect(TagViewer).toHaveLength(3);

    const tag1 = getByText(container, /tags.tag 1/);
    const tag2 = getByText(container, /tags.tag 2/);
    const tag3 = getByText(container, /tags.term/);

    expect(tag1).toBeInTheDocument();
    expect(tag2).toBeInTheDocument();
    expect(tag3).toBeInTheDocument();
  });

  it('Should render tags and glossary with their respective symbol', () => {
    const { container } = render(<TagsViewer sizeCap={-1} tags={tags} />);
    const TagViewer = getAllByTestId(container, 'tags');
    const tagIcons = getAllByTestId(container, 'tags-icon');
    const glossaryIcons = getAllByTestId(container, 'glossary-icon');

    expect(TagViewer).toHaveLength(3);
    expect(tagIcons).toHaveLength(2);
    expect(glossaryIcons).toHaveLength(1);
  });
});
