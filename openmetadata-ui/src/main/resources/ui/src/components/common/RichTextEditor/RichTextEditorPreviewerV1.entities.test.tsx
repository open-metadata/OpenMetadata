/*
 *  Copyright 2026 Collate.
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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import RichTextEditorPreviewerV1 from './RichTextEditorPreviewerV1';

/**
 * End-to-end guard for the HTML-entity rendering bug.
 *
 * Deliberately does NOT mock formatClientContent or BlockEditor: the bug only
 * appears when markdown travels through the real pipeline
 * (formatClientContent -> BlockEditor -> showdown -> tiptap), so mocking either
 * end hides it.
 */
// The BlockEditor is lazy-loaded and tiptap initialises asynchronously, which
// can take well over the 1s default when the suite runs alongside others.
const RENDER_TIMEOUT = { timeout: 15000 };

describe('RichTextEditorPreviewerV1: markdown entity rendering', () => {
  it('should render > and < from code spans as real characters', async () => {
    const markdown =
      '- **Operator** (STRING, Optional) - `==` (equals), `>` (greater than), `>=` (greater or equal), `<` (less than)';

    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant={false}
        markdown={markdown}
      />
    );

    const container = await screen.findByTestId(
      'markdown-parser',
      {},
      RENDER_TIMEOUT
    );

    await waitFor(() => {
      expect(container.textContent).toContain('>');
    }, RENDER_TIMEOUT);

    // The user must never see the literal entity text.
    expect(container.textContent).not.toContain('&gt;');
    expect(container.textContent).not.toContain('&lt;');
    expect(container.textContent).toContain('>=');
    expect(container.textContent).toContain('<');
  });

  it('should render > and < inside a SQL code block', async () => {
    const markdown = [
      '```sql',
      'SELECT * FROM products WHERE price <= 0 OR price > 10000',
      '```',
    ].join('\n');

    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant={false}
        markdown={markdown}
      />
    );

    const container = await screen.findByTestId(
      'markdown-parser',
      {},
      RENDER_TIMEOUT
    );

    await waitFor(() => {
      expect(container.textContent).toContain('price');
    }, RENDER_TIMEOUT);

    expect(container.textContent).not.toContain('&gt;');
    expect(container.textContent).not.toContain('&lt;');
    expect(container.textContent).toContain('price <= 0 OR price > 10000');
  });

  it('should not render script tags injected via markdown', async () => {
    const markdown = '# Title\n\n<script>alert(1)</script>';

    const { container } = render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant={false}
        markdown={markdown}
      />
    );

    await screen.findByTestId('markdown-parser', {}, RENDER_TIMEOUT);

    expect(container.querySelector('script')).toBeNull();
  });
});

describe('RichTextEditorPreviewerV1: markdown link rendering', () => {
  it('should render a legacy bare URL as a clickable link', async () => {
    const url = 'https://example.com/docs';

    render(
      <RichTextEditorPreviewerV1 enableSeeMoreVariant={false} markdown={url} />
    );

    const link = await screen.findByRole('link', { name: url }, RENDER_TIMEOUT);

    expect(link).toHaveAttribute('href', url);
  });
});

describe('RichTextEditorPreviewerV1: formatted-description truncation', () => {
  const LINK_URL = 'https://example.com/documentation/guide';

  const FORMATTED_DESCRIPTION =
    '# Heading one\n\n' +
    'Some plain intro text. **Bold words** and then a link to the ' +
    `[product documentation guide](${LINK_URL}) ` +
    'plus trailing text that goes on for a while longer still.';

  const LONG_BOLD_PARAGRAPH =
    'This is a plain introduction paragraph with **bold words** in the middle, ' +
    'and the text keeps going for many words until it exceeds the configured ' +
    'preview length of two hundred characters, which is the budget we want to ' +
    'test here fully.';

  const renderCollapsed = (markdown: string, maxLength: number) =>
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={markdown}
        maxLength={maxLength}
      />
    );

  it('should keep a link whose label crosses the cut as a real anchor', async () => {
    renderCollapsed(FORMATTED_DESCRIPTION, 80);

    const link = await screen.findByRole(
      'link',
      { name: 'product...' },
      RENDER_TIMEOUT
    );

    expect(link).toHaveAttribute('href', LINK_URL);

    const parser = screen.getByTestId('markdown-parser');

    expect(parser.textContent).toContain('Heading one');
    expect(parser.textContent).not.toContain('plus trailing text');
    expect(parser.textContent).not.toMatch(/[[\]*<]|href=/);
  });

  it('should render a bold span crossing the cut as bold, not literal asterisks', async () => {
    renderCollapsed(FORMATTED_DESCRIPTION, 40);

    const bold = await screen.findByText(/^Bold\.\.\.$/, {}, RENDER_TIMEOUT);

    expect(bold.closest('strong')).not.toBeNull();
    expect(screen.getByTestId('markdown-parser').textContent).not.toContain(
      '**'
    );
  });

  it('should expand to the full link and collapse back to the trimmed preview', async () => {
    renderCollapsed(FORMATTED_DESCRIPTION, 50);

    await screen.findByText(/Some plain intro/, {}, RENDER_TIMEOUT);

    expect(screen.queryByRole('link')).toBeNull();

    act(() => {
      fireEvent.click(screen.getByTestId('read-more-button'));
    });

    expect(
      await screen.findByRole(
        'link',
        { name: 'product documentation guide' },
        RENDER_TIMEOUT
      )
    ).toHaveAttribute('href', LINK_URL);

    act(() => {
      fireEvent.click(screen.getByTestId('read-less-button'));
    });

    await waitFor(() => {
      expect(screen.queryByRole('link')).toBeNull();
    }, RENDER_TIMEOUT);

    expect(screen.getByText(/Some plain intro/)).toBeInTheDocument();
  });

  it('should keep a mention crossing the cut whole with the ellipsis after it', async () => {
    renderCollapsed(
      'Intro [@Infrastructure](http://localhost:3000/settings/members/teams/Infrastructure) tail text that keeps going',
      10
    );

    await screen.findByText('@Infrastructure', {}, RENDER_TIMEOUT);

    expect(screen.getByTestId('markdown-parser').textContent).toBe(
      'Intro @Infrastructure...'
    );
  });

  it('should spend the preview budget on visible text, not markup', async () => {
    renderCollapsed(LONG_BOLD_PARAGRAPH, 200);

    await screen.findByText('bold words', {}, RENDER_TIMEOUT);

    const visibleText = screen.getByTestId('markdown-parser').textContent ?? '';

    expect(visibleText.length).toBeGreaterThan(180);
    expect(visibleText.length).toBeLessThanOrEqual(203);
    expect(visibleText).toMatch(/\.\.\.$/);
  });
});
