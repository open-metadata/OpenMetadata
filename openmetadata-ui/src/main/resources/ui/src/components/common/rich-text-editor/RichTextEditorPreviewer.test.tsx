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

const mockDescription =
  // eslint-disable-next-line max-len
  '**Headings**\n\n# H1\n## H2\n### H3\n\n***\n**Bold**\n\n**bold text**\n\n\n***\n**Italic**\n\n*italic*\n\n***\n**BlockQuote**\n\n> blockquote\n\n***\n**Ordered List**\n\n1. First item\n2. Second item\n3. Third item\n\n\n***\n**Unordered List**\n\n- First item\n- Second item\n- Third item\n\n\n***\n**Code**\n\n`code`\n\n\n***\n**Horizontal Rule**\n\n---\n\n\n***\n**Link**\n[title](https://www.example.com)\n\n\n***\n**Image**\n\n![alt text](https://github.com/open-metadata/OpenMetadata/blob/main/docs/.gitbook/assets/openmetadata-banner.png?raw=true)\n\n\n***\n**Table**\n\n| Syntax | Description |\n| ----------- | ----------- |\n| Header | Title |\n| Paragraph | Text |\n***\n\n**Fenced Code Block**\n\n```\n{\n  "firstName": "John",\n  "lastName": "Smith",\n  "age": 25\n}\n```\n\n\n***\n**Strikethrough**\n~~The world is flat.~~\n';

const mockProp = {
  markdown: mockDescription,
  className: '',
  blurClasses: 'see-more-blur',
  maxHtClass: 'tw-h-24',
  maxLen: 300,
  enableSeeMoreVariant: true,
};

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

  it('Should render bold markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const boldMarkdown = markdownParser.querySelectorAll('strong');

    expect(boldMarkdown).toHaveLength(boldMarkdown.length);

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render strikethrough markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const strikeThroughMarkdown = markdownParser.querySelector('del');

    expect(strikeThroughMarkdown).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render headings markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const heading1 = markdownParser.querySelector('h1');
    const heading2 = markdownParser.querySelector('h2');
    const heading3 = markdownParser.querySelector('h3');

    expect(heading1).toBeInTheDocument();
    expect(heading2).toBeInTheDocument();
    expect(heading3).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render italic markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const italicMarkdown = markdownParser.querySelector('em');

    expect(italicMarkdown).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render blockquote markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const blockquoteMarkdown = markdownParser.querySelector('blockquote');

    expect(blockquoteMarkdown).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render ordered list markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const orderedList = markdownParser.querySelector('ol');

    expect(orderedList).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render unordered list markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const unorderedList = markdownParser.querySelector('ul');

    expect(unorderedList).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render code markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const code = markdownParser.querySelector('code');

    expect(code).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render code block markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const codeBlock = markdownParser.querySelector('pre');

    expect(codeBlock).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render horizontal rule markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const horizontalRule = markdownParser.querySelector('hr');

    expect(horizontalRule).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render link markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const link = markdownParser.querySelector('a');

    expect(link).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render image markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const image = markdownParser.querySelector('img');

    expect(image).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });

  it('Should render table markdown content', async () => {
    const { container } = render(<RichTextEditorPreviewer {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const markdownParser = await findByTestId(container, 'markdown-parser');

    const table = markdownParser.querySelector('table');

    expect(table).toBeInTheDocument();

    expect(markdownParser).toBeInTheDocument();
  });
});
