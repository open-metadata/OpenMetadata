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
import { LINK_EXTENSION_OPTIONS } from '../../../constants/BlockEditor.constants';
import { LinkExtension } from './link';

describe('LinkExtension with the block editor options', () => {
  let editor: Editor;
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    editor = new Editor({
      extensions: [
        Document,
        Paragraph,
        Text,
        LinkExtension.configure(LINK_EXTENSION_OPTIONS),
      ],
      content: '<p><a href="https://example.com">entity</a></p>',
    });
  });

  afterEach(() => {
    editor.destroy();
    openSpy.mockRestore();
  });

  it('does not open a clicked link while editing', () => {
    const anchor = editor.view.dom.querySelector('a') as HTMLAnchorElement;
    const click = new MouseEvent('click', { button: 0 });
    // Dispatching sets click.target, which the link click handler reads.
    anchor.dispatchEvent(click);

    editor.view.someProp('handleClick', (handleClick) =>
      handleClick(editor.view, editor.view.posAtDOM(anchor, 0), click)
    );

    expect(editor.isEditable).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
