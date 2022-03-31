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
  getAllByTestId,
  getByText,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import TagsViewer from './tags-viewer';

const tags = [
  { tagFQN: `tags:tag 1`, source: 'Tag' },
  { tagFQN: `tags:tag 2`, source: 'Tag' },
];

const tagsWithTerm = [
  { tagFQN: `tags:tag 1`, source: 'Tag' },
  { tagFQN: `tags:tag 2`, source: 'Tag' },
  { tagFQN: `tags:term`, source: 'Glossary' },
];

describe('Test TagsViewer Component', () => {
  it('Component should render', () => {
    const { container } = render(<TagsViewer sizeCap={-1} tags={tags} />);
    const TagViewer = getAllByTestId(container, 'tags');

    expect(TagViewer).toHaveLength(2);
  });

  it('Should render tags', () => {
    const { container } = render(<TagsViewer sizeCap={-1} tags={tags} />);
    const TagViewer = getAllByTestId(container, 'tags');

    expect(TagViewer).toHaveLength(2);

    const tag1 = getByText(container, /tags:tag 1/);
    const tag2 = getByText(container, /tags:tag 2/);

    expect(tag1).toBeInTheDocument();
    expect(tag2).toBeInTheDocument();
  });

  it('Should render tags and terms', () => {
    const { container } = render(
      <TagsViewer sizeCap={-1} tags={tagsWithTerm} />
    );
    const TagViewer = getAllByTestId(container, 'tags');

    expect(TagViewer).toHaveLength(3);

    const term = getByText(container, /term/);
    const termFqn = queryByText(container, /tags:term/);

    expect(term).toBeInTheDocument();
    expect(termFqn).not.toBeInTheDocument();
  });
});
