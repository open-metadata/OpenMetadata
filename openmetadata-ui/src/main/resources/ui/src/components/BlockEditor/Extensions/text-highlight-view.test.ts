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
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import TextHighlightView from './text-highlight-view';

describe('TextHighlightView Extension', () => {
  it('should be a Tiptap Node', () => {
    expect(TextHighlightView).toBeInstanceOf(Node);
  });

  it('should have correct configuration', () => {
    expect(TextHighlightView.config.name).toBe('textHighLightView');
    expect(TextHighlightView.config.content).toBe('inline*');
    expect(TextHighlightView.config.group).toBe('inline');
    expect(TextHighlightView.config.inline).toBe(true);
  });

  it('should have renderHTML and parseHTML methods', () => {
    expect(TextHighlightView.config.renderHTML).toBeInstanceOf(Function);
    expect(TextHighlightView.config.parseHTML).toBeInstanceOf(Function);
    expect(TextHighlightView.config.addAttributes).toBeInstanceOf(Function);
  });
});

describe('TextHighlightView renderHTML — XSS regression (GHSA-j8rv-757p-j32v)', () => {
  let editor: Editor;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor({
      element: container,
      extensions: [Document, Text, Paragraph, TextHighlightView],
    });
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  it('renders plain text content inside the highlight span', () => {
    const html = `<p><span data-highlight="true">plain text</span></p>`;
    editor.commands.setContent(html);

    expect(editor.getHTML()).toContain('plain text');
    expect(container.querySelector('span[data-highlight]')?.textContent).toBe(
      'plain text'
    );
  });

  it('does NOT decode encoded HTML entities into live DOM (GHSA-j8rv-757p-j32v)', () => {
    // Reproduces the advisory payload: attacker stores encoded HTML inside a
    // span[data-highlight]. If the renderer assigns node.textContent to
    // innerHTML the browser reparses it into a real <img> with an onerror
    // handler. With textContent the encoded string stays as text.
    const payload = '&lt;img src=x onerror="window.__xssFired = true"&gt;';
    const html = `<p><span data-highlight="true">${payload}</span></p>`;

    editor.commands.setContent(html);

    // No attacker-controlled <img> must exist. (ProseMirror inserts its own
    // separator <img class="ProseMirror-separator">, which is not attacker-controlled.)
    const injectedImg = container.querySelector(
      'span[data-highlight] img:not(.ProseMirror-separator), img[onerror]'
    );

    expect(injectedImg).toBeNull();
    // The onerror handler must not have fired.
    expect(
      (window as unknown as { __xssFired?: boolean }).__xssFired
    ).toBeUndefined();
  });

  it('does NOT execute script payloads typed as plain text into a highlight node', () => {
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'textHighLightView',
              attrs: {
                class: '',
                'data-highlight': 'true',
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

    // The <img> tag must never appear as a real attacker-controlled element in
    // the live DOM. (ProseMirror inserts its own .ProseMirror-separator img.)
    const injectedImg = container.querySelector(
      'span[data-highlight] img:not(.ProseMirror-separator), img[onerror]'
    );

    expect(injectedImg).toBeNull();

    const output = editor.getHTML();

    expect(output).not.toContain('<img');
    expect(output).toContain('&lt;img');
  });
});
