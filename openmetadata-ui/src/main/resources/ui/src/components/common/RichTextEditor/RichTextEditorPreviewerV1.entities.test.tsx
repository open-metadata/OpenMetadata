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

/**
 * Regression guard for the formatted-description truncation bug.
 *
 * `RichTextEditorPreviewerV1` collapses long descriptions by truncating to
 * `maxLength` characters. The collapse guard measured the raw markdown while
 * the slice was applied to the markdown-converted HTML, so the cut landed
 * mid-tag (`<a`, `<strong`) and DOMPurify silently dropped it (or the rarer
 * double-conversion path rendered garbled entities). The fix applies the cut
 * to the raw markdown BEFORE the markdown -> HTML conversion. These tests
 * exercise that pipeline through the real `BlockEditor` so the last-mile
 * sanitisation and tiptap rendering are part of the regression surface.
 */
describe('RichTextEditorPreviewerV1: formatted-description truncation', () => {
  // A long single-paragraph description with bold spans. Its raw markdown
  // is longer than the configured preview limit so the collapse path runs.
  const LONG_BOLD_PARAGRAPH =
    'This is a plain introduction paragraph with **bold words** in the middle, ' +
    'and the text keeps going for many words until it exceeds the configured ' +
    'preview length of two hundred characters, which is the budget we want to ' +
    'test here fully.';

  // Heading, bold, and a link whose URL straddles the 200-char cut when the
  // slice is (incorrectly) applied to the converted HTML.
  const HEADING_BOLD_LINK =
    '# Heading one\n\n' +
    'Some plain intro text that is fairly long and keeps going a bit. ' +
    '**Bold words** and then a link to ' +
    '[docs](https://example.com/documentation/very/long/path/that/attempts/to/reach/past/the/cut/point/in/html) ' +
    'plus trailing text that goes on for a while longer still.';

  it('truncated preview should not surface stray markup text such as "<a", "<strong"', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={HEADING_BOLD_LINK}
        maxLength={200}
      />
    );

    const parser = await screen.findByTestId(
      'markdown-parser',
      {},
      RENDER_TIMEOUT
    );

    await waitFor(() => {
      // The truncated prose must contain the heading text and the bold span
      // — a sign that the cut is operating on the raw markdown and not the
      // inflated HTML.
      expect(parser.textContent).toContain('Heading one');
      expect(parser.textContent).toContain('Bold words');
    }, RENDER_TIMEOUT);

    // No broken tag must leak through to the rendered DOM. DOMPurify drops
    // half-open tags, so a stray "<a" / "<strong" as visible text — or an
    // unbound `href=` fragment — is the signature of the bug.
    expect(parser.textContent).not.toContain('<a');
    expect(parser.textContent).not.toContain('<strong');
    expect(parser.textContent).not.toContain('href=');
    expect(parser.textContent).not.toContain('&gt;');
    expect(parser.textContent).not.toContain('&amp;gt;');
  });

  it('truncated preview should not render a half-opened anchor for a straddling link', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={HEADING_BOLD_LINK}
        maxLength={200}
      />
    );

    await screen.findByTestId('markdown-parser', {}, RENDER_TIMEOUT);

    // The link URL straddles the cut, so the broken-word guard drops the
    // whole "[docs](url)" token. No link should be rendered in the truncated
    // preview — neither a half-opened `<a` nor a fully-rendered anchor whose
    // href/text was sliced mid-token.
    await waitFor(() => {
      expect(screen.queryByRole('link')).toBeNull();
    }, RENDER_TIMEOUT);
  });

  it('should show the read-more button for a formatted description longer than maxLength', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={HEADING_BOLD_LINK}
        maxLength={200}
      />
    );

    expect(
      await screen.findByTestId('read-more-button', {}, RENDER_TIMEOUT)
    ).toBeInTheDocument();
  });

  it('expanding the preview should render the full link intact', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={HEADING_BOLD_LINK}
        maxLength={200}
      />
    );

    await screen.findByTestId('markdown-parser', {}, RENDER_TIMEOUT);

    const moreButton = await screen.findByTestId(
      'read-more-button',
      {},
      RENDER_TIMEOUT
    );

    act(() => {
      fireEvent.click(moreButton);
    });

    // Once expanded, the full content is rendered — the link is a real,
    // clickable anchor pointing at the original href, proving the
    // description (including the link) was not lost in the pipeline.
    const link = await screen.findByRole(
      'link',
      { name: 'docs' },
      RENDER_TIMEOUT
    );

    expect(link).toHaveAttribute(
      'href',
      'https://example.com/documentation/very/long/path/that/attempts/to/reach/past/the/cut/point/in/html'
    );
  });

  it('collapsing back should drop the link cleanly (no half-rendered anchor)', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={HEADING_BOLD_LINK}
        maxLength={200}
      />
    );

    await screen.findByTestId('markdown-parser', {}, RENDER_TIMEOUT);

    act(() => {
      fireEvent.click(screen.getByTestId('read-more-button'));
    });

    // The expanded view shows the link.
    await screen.findByRole('link', { name: 'docs' }, RENDER_TIMEOUT);

    act(() => {
      fireEvent.click(screen.getByTestId('read-less-button'));
    });

    // After collapsing, no anchor (full or broken) is rendered in the preview.
    await waitFor(() => {
      expect(screen.queryByRole('link')).toBeNull();
    }, RENDER_TIMEOUT);
  });

  it('truncated bold-paragraph preview should render substantial visible text', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={LONG_BOLD_PARAGRAPH}
        maxLength={200}
      />
    );

    const parser = await screen.findByTestId(
      'markdown-parser',
      {},
      RENDER_TIMEOUT
    );

    await waitFor(() => {
      // With the cut on raw markdown, the bold span renders and the visible
      // content stays close to the configured maxLength (the bug ate the
      // budget with `<strong>` markup and ended at ~174 visible chars).
      expect(parser.textContent).toContain('bold words');
      expect(parser.textContent?.length ?? 0).toBeGreaterThan(180);
    }, RENDER_TIMEOUT);

    // The collapsed visible text must not contain raw markup characters.
    expect(parser.textContent).not.toContain('<');
  });
});
