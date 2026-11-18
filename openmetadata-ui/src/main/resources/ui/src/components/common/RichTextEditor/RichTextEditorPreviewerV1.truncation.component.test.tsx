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
import { render, screen } from '@testing-library/react';
import RichTextEditorPreviewerV1 from './RichTextEditorPreviewerV1';

/**
 * Captures the `content` prop the component passes to `BlockEditor`, so the
 * truncation pipeline can be inspected BEFORE the real `BlockEditor`/tiptap
 * sanitisation silently drops any half-opened tag (the bug). `formatClientContent`
 * and `getTrimmedContent` are NOT mocked — both run for real, mirroring prod.
 *
 * The bug: `RichTextEditorPreviewerV1` measured `hasReadMore` against the raw
 * markdown but sliced the converted HTML, so the 200-char cut could land mid-tag
 * (`<a`, `<strong`) and produce `...to <a...` as the `content` prop. Downstream
 * sanitisation dropped the broken tag, silently losing the link and shortening
 * the visible preview. The fix truncates the raw markdown first, then converts,
 * so the `content` prop is always well-formed HTML.
 */
jest.mock('../../BlockEditor/BlockEditor', () => {
  return jest
    .fn()
    .mockImplementation(({ content }: { content: string }) => (
      <div data-testid="block-editor">{content}</div>
    ));
});

const HEADING_BOLD_LINK =
  '# Heading one\n\n' +
  'Some plain intro text that is fairly long and keeps going a bit. ' +
  '**Bold words** and then a link to ' +
  '[docs](https://example.com/documentation/very/long/path/that/attempts/to/reach/past/the/cut/point/in/html) ' +
  'plus trailing text that goes on for a while longer still.';

const LONG_BOLD_PARAGRAPH =
  'This is a plain introduction paragraph with **bold words** in the middle, ' +
  'and the text keeps going for many words until it exceeds the configured ' +
  'preview length of two hundred characters, which is the budget we want to ' +
  'test here fully.';

// The truncated content prop must end with a complete tag (or no tag at all)
// before the caller-appended "...". A `<tag...` at the very end (an unclosed
// opening tag with the ellipsis appended) is the signature of the bug.
const HALF_OPENED_OPEN_TAG = /<[a-zA-Z][a-zA-Z0-9]*\.{3}$/;
const HALF_OPENED_CLOSE_TAG = /<\/[a-zA-Z][a-zA-Z0-9]*\.{3}$/;
const DANGLING_OPEN_TAG = /<[a-zA-Z][a-zA-Z0-9]*$/;
const DANGLING_CLOSE_TAG = /<\/[a-zA-Z][a-zA-Z0-9]*$/;

describe('RichTextEditorPreviewerV1: content prop is well-formed HTML (regression)', () => {
  it('does not pass a half-opened anchor to BlockEditor for a link straddling the cut', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={HEADING_BOLD_LINK}
        maxLength={200}
        showReadMoreBtn={false}
      />
    );

    const editor = await screen.findByTestId('block-editor');
    const content = editor.textContent ?? '';

    // The bug produced content ending with "...to <a..." (an unclosed <a with
    // the caller's "..." appended). Assert that this can never happen again.
    expect(content).not.toMatch(HALF_OPENED_OPEN_TAG);
    expect(content).not.toMatch(HALF_OPENED_CLOSE_TAG);
    expect(content).not.toMatch(DANGLING_OPEN_TAG);
    expect(content).not.toMatch(DANGLING_CLOSE_TAG);
    expect(content).not.toMatch(/<a$/);
    expect(content).not.toMatch(/<a\.{3}$/);

    // The truncated content must not leave raw markdown link syntax leaking
    // through as text (the bug could drop the link silently while leaving
    // "[docs](" behind, or render the partial href).
    expect(content).not.toMatch(/\[docs\]\(/);
    expect(content).not.toMatch(/\[docs\]/);
  });

  it('passes a parseable, well-balanced HTML string to BlockEditor', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={HEADING_BOLD_LINK}
        maxLength={200}
        showReadMoreBtn={false}
      />
    );

    const editor = await screen.findByTestId('block-editor');
    const content = editor.textContent ?? '';

    // Parse the content prop and check no orphan "<" leaks as visible text —
    // DOMPurify auto-closes half-opened tags, so this is a backstop check.
    // The foreground guarantee is the regex match above.
    const doc = new DOMParser().parseFromString(content, 'text/html');

    expect(doc.body.textContent).not.toContain('<');
    expect(doc.body.textContent).not.toContain('</');
  });

  it('preserves the full link in the expanded content', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        isDescriptionExpanded
        markdown={HEADING_BOLD_LINK}
        maxLength={200}
        showReadMoreBtn={false}
      />
    );

    const editor = await screen.findByTestId('block-editor');
    const content = editor.textContent ?? '';

    // Expanded path renders the full markdown including the link, untouched.
    expect(content).toContain('<a');
    expect(content).toContain(
      'href="https://example.com/documentation/very/long/path/that/attempts/to/reach/past/the/cut/point/in/html"'
    );
    expect(content).toContain('>docs</a>');
  });

  it('does not let markup consume the visible-character budget (single paragraph bold)', async () => {
    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant
        markdown={LONG_BOLD_PARAGRAPH}
        maxLength={200}
        showReadMoreBtn={false}
      />
    );

    const editor = await screen.findByTestId('block-editor');
    const content = editor.textContent ?? '';

    // The bug fed `getTrimmedContent` the converted HTML so `<strong>` markup
    // ate the budget and the visible text ended at ~174 chars; the fix slices
    // the raw markdown and the visible text stays close to maxLength.
    const doc = new DOMParser().parseFromString(content, 'text/html');
    const visible = (doc.body.textContent ?? '').length;

    expect(visible).toBeGreaterThan(180);
    // The bold span survives the truncation as a real element.
    expect(doc.body.querySelector('strong')).not.toBeNull();
    expect(doc.body.textContent).toContain('bold words');
  });
});
