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
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Hashtag } from './hashtag';
import { Mention } from './mention';

const UNSAFE_HREFS = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  // The URL parser strips tabs/newlines, so this still runs as javascript:
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
];

const SAFE_HREFS = [
  'https://example.com/table/svc.db.schema.t',
  'http://localhost:8585/users/admin',
  '/glossary/term',
  '#section',
];

describe.each([
  ['mention', Mention],
  ['hashtag', Hashtag],
])('%s href allowlist', (name, extension) => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [Document, Paragraph, Text, extension],
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  const setAnchor = (href: string) => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', href);
    anchor.setAttribute('data-type', name);
    anchor.textContent = 'entity';
    editor.commands.setContent(`<p>${anchor.outerHTML}</p>`);
  };

  it.each(UNSAFE_HREFS)('does not parse an anchor with href %j', (href) => {
    setAnchor(href);

    expect(editor.getHTML()).not.toContain('href');
    expect(editor.getHTML()).not.toContain(`data-type="${name}"`);
  });

  it.each(UNSAFE_HREFS)(
    'does not render href %j set through node attrs',
    (href) => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: name, attrs: { id: '1', label: 'x', href } }],
          },
        ],
      });

      expect(editor.getHTML()).toContain(`data-type="${name}"`);
      expect(editor.getHTML()).not.toContain('href');
    }
  );

  it.each(SAFE_HREFS)('keeps href %j', (href) => {
    setAnchor(href);

    expect(editor.getHTML()).toContain(`data-type="${name}"`);
    expect(editor.getHTML()).toContain(`href="${href}"`);
  });
});
