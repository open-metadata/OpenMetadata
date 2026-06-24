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
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { createRef } from 'react';
import tippy from 'tippy.js';
import { EditorSlotsRef } from './BlockEditor.interface';
import EditorSlots from './EditorSlots';
import { LinkExtension } from './Extensions/link';

jest.mock('./BlockMenu/BlockMenu', () => () => null);
jest.mock('./BubbleMenu/BubbleMenu', () => () => null);
jest.mock('./TableMenu/TableMenu', () => () => null);
jest.mock('./LinkPopup/LinkPopup', () => () => null);
jest.mock('tippy.js', () => ({
  __esModule: true,
  default: jest.fn(() => []),
}));

const createTestEditor = (content: string) =>
  new Editor({
    extensions: [StarterKit, LinkExtension],
    content,
  });

const fillLinkAndSave = async (href: string) => {
  await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: href } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
};

describe('EditorSlots link handling', () => {
  const HREF = 'https://example.com/view';

  it('inserts the href as the link text when no text is selected', async () => {
    const editor = createTestEditor('<p></p>');
    const ref = createRef<EditorSlotsRef>();

    render(<EditorSlots editor={editor} menuType="bar" ref={ref} />);

    act(() => {
      ref.current?.onLinkToggle();
    });

    await fillLinkAndSave(HREF);

    await waitFor(() => {
      const html = editor.getHTML();

      expect(html).toContain(`href="${HREF}"`);
      expect(html).toMatch(/<a[^>]*>https:\/\/example\.com\/view<\/a>/);
    });

    editor.destroy();
  });

  it('wraps the selected text in a link when text is selected', async () => {
    const editor = createTestEditor('<p>Hello</p>');
    const ref = createRef<EditorSlotsRef>();

    editor.commands.setTextSelection({ from: 1, to: 6 });

    render(<EditorSlots editor={editor} menuType="bar" ref={ref} />);

    act(() => {
      ref.current?.onLinkToggle();
    });

    await fillLinkAndSave(HREF);

    await waitFor(() => {
      const html = editor.getHTML();

      expect(html).toContain(`href="${HREF}"`);
      expect(html).toMatch(/<a[^>]*>Hello<\/a>/);
    });

    editor.destroy();
  });

  it('mounts the link popup inside the editor dialog with an elevated z-index', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    const editorElement = document.createElement('div');
    dialog.appendChild(editorElement);

    const editor = new Editor({
      element: editorElement,
      extensions: [StarterKit, LinkExtension],
      content: '<p><a href="https://example.com">link</a></p>',
    });
    const ref = createRef<EditorSlotsRef>();

    render(<EditorSlots editor={editor} menuType="bar" ref={ref} />);

    const anchor = editorElement.querySelector('a') as HTMLElement;
    act(() => {
      ref.current?.onMouseDown({
        target: anchor,
      } as unknown as Parameters<EditorSlotsRef['onMouseDown']>[0]);
    });

    expect(tippy).toHaveBeenCalled();

    const options = (tippy as jest.Mock).mock.calls[0][1];

    // The popup must mount inside the dialog (not document.body) and paint above
    // the React Aria overlay so its actions remain clickable.
    expect(options.appendTo()).toBe(dialog);
    expect(options.zIndex).toBe(100001);

    editor.destroy();
    document.body.removeChild(dialog);
  });
});
