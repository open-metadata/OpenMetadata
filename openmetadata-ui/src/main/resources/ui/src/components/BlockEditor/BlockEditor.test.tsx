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
import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import BlockEditor from './BlockEditor';
import { BlockEditorRef } from './BlockEditor.interface';

jest.mock('./EditorSlots', () => () => null);

describe('BlockEditor', () => {
  // An editor that starts editable and is made read-only a tick later lets a
  // trailing "@name" in its content open the mention popup, which then stays
  // pinned to the page's top-left.
  it('is read-only from its first render when not editable', () => {
    // Fake timers hold back the deferred setEditable(false), so only an editor
    // created read-only passes.
    jest.useFakeTimers();
    const ref = createRef<BlockEditorRef>();

    try {
      act(() => {
        render(
          <BlockEditor
            content="<p>uireview comment @admin</p>"
            editable={false}
            ref={ref}
          />
        );
      });

      expect(ref.current?.editor).toBeTruthy();
      expect(ref.current?.editor?.isEditable).toBe(false);
      expect(
        document.querySelector('.ProseMirror[contenteditable="true"]')
      ).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('is editable by default', async () => {
    const ref = createRef<BlockEditorRef>();

    await act(async () => {
      render(<BlockEditor ref={ref} />);
    });

    expect(ref.current?.editor?.isEditable).toBe(true);
  });
});
