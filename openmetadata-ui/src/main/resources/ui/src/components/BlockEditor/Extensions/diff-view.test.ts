/*
 *  Copyright 2025 Collate.
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
import { Editor, Node } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import Italic from '@tiptap/extension-italic';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import DiffView from './diff-view';

describe('DiffView Extension', () => {
  it('should be a Tiptap Node', () => {
    expect(DiffView).toBeInstanceOf(Node);
  });

  it('should have correct configuration', () => {
    expect(DiffView.config.name).toBe('diffView');
    expect(DiffView.config.content).toBe('inline*');
    expect(DiffView.config.group).toBe('inline');
    expect(DiffView.config.inline).toBe(true);
  });

  it('should have renderHTML and parseHTML methods', () => {
    expect(DiffView.config.renderHTML).toBeInstanceOf(Function);
    expect(DiffView.config.parseHTML).toBeInstanceOf(Function);
    expect(DiffView.config.addAttributes).toBeInstanceOf(Function);
  });
});

describe('DiffView renderHTML — textContent vs innerHTML behaviour', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [Document, Text, Paragraph, Bold, Italic, DiffView],
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('renders plain text content inside the diff span', () => {
    const html = `<p><span data-diff="true">plain text</span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('data-diff="true"');
    expect(output).toContain('plain text');
  });

  it('preserves Tiptap bold mark — tuple form renders child nodes including marks', () => {
    const html = `<p><span data-diff="true"><strong>bold text</strong></span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('bold text');
    expect(output).toContain('<strong>');
  });

  it('preserves Tiptap italic mark — tuple form renders child nodes including marks', () => {
    const html = `<p><span data-diff="true"><em>italic text</em></span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('italic text');
    expect(output).toContain('<em>');
  });

  it('preserves nested marks — bold and italic both kept', () => {
    const html = `<p><span data-diff="true"><strong><em>rich text</em></strong></span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('rich text');
    expect(output).toContain('<strong>');
    expect(output).toContain('<em>');
  });

  it('preserves data-diff attribute on the rendered span', () => {
    const html = `<p><span data-diff="true">some text</span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('data-diff="true"');
  });

  it('preserves data-testid attribute when present', () => {
    const html = `<p><span data-diff="true" data-testid="diff-added">added</span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('data-testid="diff-added"');
    expect(output).toContain('added');
  });

  it('preserves class attribute on the diff span', () => {
    const html = `<p><span data-diff="true" class="diff-added">text</span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('class="diff-added"');
  });

  it('handles multiple diff spans in the same paragraph', () => {
    const html = `<p><span data-diff="true" class="diff-removed">old</span><span data-diff="true" class="diff-added">new</span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('diff-removed');
    expect(output).toContain('diff-added');
    expect(output).toContain('old');
    expect(output).toContain('new');
  });

  it('drops unknown attributes — only class, data-diff, data-testid are rendered', () => {
    // data-unknown is not in the allowlist and should not appear in output
    const html = `<p><span data-diff="true" data-unknown="injected">text</span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('data-diff="true"');
    expect(output).not.toContain('data-unknown');
  });

  it('is XSS safe — script tag entities are not decoded into real tags', () => {
    const html = `<p><span data-diff="true">&lt;script&gt;alert(1)&lt;/script&gt;</span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).not.toContain('<script>');
  });

  it('is XSS safe — img onerror payload typed as plain text is escaped', () => {
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'diffView',
              attrs: {
                class: 'diff-added',
                'data-diff': 'true',
                'data-testid': '',
              },
              content: [
                {
                  type: 'text',
                  text: '<img src=1 onerror=alert(document.cookie)>',
                },
              ],
            },
          ],
        },
      ],
    });

    const output = editor.getHTML();

    // The img tag must never appear as a real element — angle brackets are escaped.
    // The word "onerror" may appear as harmless escaped text, but no real <img element.
    expect(output).not.toContain('<img');
    expect(output).toContain('&lt;img');
  });

  it('is XSS safe — img onerror injected via HTML parse is stripped by Tiptap schema', () => {
    // When fed as HTML string, Tiptap parses it into its schema.
    // The <img> element is not a valid inline node in this schema so it is dropped entirely.
    const html = `<p><span data-diff="true"><img src="1" onerror="alert(document.cookie)">text</span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).not.toContain('<img');
    expect(output).not.toContain('onerror');
  });

  it('is XSS safe — onerror attribute on a span is not forwarded through safeAttrs allowlist', () => {
    // Even if someone crafts a span with an event handler attribute,
    // the allowlist in renderHTML only passes class, data-diff, data-testid.
    const html = `<p><span data-diff="true" onerror="alert(1)">text</span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).not.toContain('onerror');
  });
});

describe('DiffView — Tiptap marks vs hardcoded HTML string as content', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [Document, Text, Paragraph, Bold, Italic, DiffView],
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('Tiptap bold mark is preserved — tuple form renders child nodes so <strong> appears in output', () => {
    const html = `<p><span data-diff="true"><strong>bold via mark</strong></span></p>`;
    editor.commands.setContent(html);

    const output = editor.getHTML();

    expect(output).toContain('bold via mark');
    expect(output).toContain('<strong>');
  });

  it('literal <strong> typed as plain text — escaped in output, NOT rendered as a real tag', () => {
    // When a user literally types "<strong>bold</strong>" as text (not via Tiptap bold mark),
    // Tiptap stores it as a plain text node. The tuple form [0] renders the text node safely —
    // angle brackets are HTML-escaped in the serialised output.
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'diffView',
              attrs: {
                class: 'diff-added',
                'data-diff': 'true',
                'data-testid': '',
              },
              content: [{ type: 'text', text: '<strong>bold</strong>' }],
            },
          ],
        },
      ],
    });

    const output = editor.getHTML();

    expect(output).not.toContain('<strong>bold</strong>');
    expect(output).toContain('&lt;strong&gt;bold&lt;/strong&gt;');
  });

  it('literal <em> typed as plain text — escaped in output, NOT rendered as a real tag', () => {
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'diffView',
              attrs: { class: '', 'data-diff': 'true', 'data-testid': '' },
              content: [{ type: 'text', text: '<em>italic</em>' }],
            },
          ],
        },
      ],
    });

    const output = editor.getHTML();

    expect(output).not.toContain('<em>italic</em>');
    expect(output).toContain('&lt;em&gt;italic&lt;/em&gt;');
  });
});
