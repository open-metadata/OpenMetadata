/*
 *  Copyright 2024 Collate.
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
import { renderHook } from '@testing-library/react-hooks';
import { EditorOptions } from '@tiptap/core';
import { Editor } from '@tiptap/react';
import { useCustomEditor } from './useCustomEditor';

class MockEditor {
  options: Partial<EditorOptions> = {};
  constructor(options?: Partial<EditorOptions>) {
    if (options) {
      this.setOptions(options);
    }
  }

  setOptions(options?: Partial<EditorOptions>): void {
    this.options = options || {};
  }
  on(_name: string, callback: (props: { editor: Editor }) => void) {
    callback({ editor: new Editor() });
  }
  off(_name: string, callback: (props: { editor: Editor | null }) => void) {
    callback({ editor: null });
  }
}

const mockOnUpdate = jest.fn();

jest.mock('@tiptap/react', () => {
  return {
    ...jest.requireActual('@tiptap/react'),
    Editor: jest.fn().mockImplementation((options) => new MockEditor(options)),
  };
});

describe('useCustomEditor hook', () => {
  it('Should return the correct value', () => {
    const { result } = renderHook(() => useCustomEditor({}));

    expect(result.current).toBeInstanceOf(MockEditor);
  });

  it('Should return the correct value with options', () => {
    const { result } = renderHook(() => useCustomEditor({ editable: false }));

    expect(result.current?.options).toEqual({ editable: false });
  });

  it("Should update the editor's options", () => {
    const { result } = renderHook(() => useCustomEditor({}));

    result.current?.setOptions({ editable: false });

    expect(result.current?.options).toEqual({ editable: false });
  });

  it('Should update the editor event handlers', () => {
    renderHook(() =>
      useCustomEditor({
        onUpdate: mockOnUpdate,
      })
    );

    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it('Should update the editor event handlers on rerender', () => {
    const { rerender } = renderHook(() =>
      useCustomEditor({
        onUpdate: mockOnUpdate,
      })
    );

    rerender();

    expect(mockOnUpdate).toHaveBeenCalledTimes(2);
  });

  it('Should update the editor event handlers on options change', () => {
    const { rerender } = renderHook((props) => useCustomEditor(props), {
      initialProps: {
        onUpdate: mockOnUpdate,
      },
    });

    rerender({
      onUpdate: mockOnUpdate,
    });

    expect(mockOnUpdate).toHaveBeenCalledTimes(2);
  });

  it('Should not update the editor event handlers if editor is not defined', () => {
    (Editor as jest.Mock).mockImplementationOnce(() => null);
    renderHook(() => useCustomEditor({}));

    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
});
