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

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import RichTextEditorPreviewer from './RichTextEditorPreviewer';

const mockProp = {
  markdown: '',
  className: '',
  blurClasses: 'see-more-blur',
  maxHtClass: 'tw-h-24',
  maxLen: 300,
  enableSeeMoreVariant: true,
};

jest.mock('react-markdown', () => {
  return jest.fn().mockImplementation(() => {
    return <p data-testid="markdown-parser">markdown parser</p>;
  });
});

jest.mock('rehype-raw', () => {
  return jest.fn();
});

jest.mock('remark-gfm', () => {
  return jest.fn();
});

describe('Test RichTextEditor Previewer Component', () => {
  it('Should render RichTextEditorViewer Component', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const viewerContainer = await findByTestId(container, 'viewer-container');

    expect(viewerContainer).toBeInTheDocument();

    const markdownParser = await findByTestId(container, 'markdown-parser');

    expect(markdownParser).toBeInTheDocument();
  });
});
