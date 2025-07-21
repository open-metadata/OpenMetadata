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
import { act, renderHook } from '@testing-library/react-hooks';
import { useGridEditController } from './useGridEditController';

// Mock clipboard
const writeTextMock = jest.fn();
Object.assign(navigator, {
  clipboard: { writeText: writeTextMock },
});

type Row = { id: number; value: string };

describe('useGridEditController', () => {
  let rows: Row[];
  let setRows: jest.Mock;

  beforeEach(() => {
    rows = [
      { id: 1, value: 'A' },
      { id: 2, value: 'B' },
    ];
    setRows = jest.fn();
    writeTextMock.mockClear();
  });

  it('should handle copy', async () => {
    const { result } = renderHook(() =>
      useGridEditController<Row>(rows, setRows)
    );
    await act(async () => {
      result.current.handleCopy({
        sourceRow: rows[0],
        sourceColumnKey: 'value',
      } as any);
    });

    expect(writeTextMock).toHaveBeenCalledWith('A');
  });

  it('should handle paste and push to undo stack', () => {
    const { result } = renderHook(() =>
      useGridEditController<Row>(rows, setRows)
    );
    act(() => {
      result.current.handlePaste({
        sourceRow: rows[0],
        sourceColumnKey: 'value',
        targetRow: rows[1],
        targetColumnKey: 'value',
      } as any);
    });

    expect(setRows).toHaveBeenCalledWith([
      { id: 1, value: 'A' },
      { id: 2, value: 'A' },
    ]);
  });

  it('should push to undo stack only if rows are different', () => {
    const { result } = renderHook(() =>
      useGridEditController<Row>(rows, setRows)
    );
    // First push
    act(() => {
      result.current.pushToUndoStack();
    });
    // Second push with same rows (should not push)
    act(() => {
      result.current.pushToUndoStack();
    });
    // Third push with different rows
    const newRows = [
      { id: 1, value: 'A' },
      { id: 2, value: 'C' },
    ];
    act(() => {
      result.current.pushToUndoStack(newRows);
    });
    // Undo stack should have 2 entries
    // (We can't access the stack directly, but we can test undo behavior)
    act(() => {
      result.current.undo();
    });

    expect(setRows).toHaveBeenCalledWith([
      { id: 1, value: 'A' },
      { id: 2, value: 'C' },
    ]);
  });

  it('should undo and redo changes', () => {
    let testRows = [...rows];
    const setRowsImpl = jest.fn((r) => {
      testRows = r;
    });
    const { result, rerender } = renderHook(() =>
      useGridEditController<Row>(testRows, setRowsImpl)
    );
    // Simulate an edit
    const editedRows = [
      { id: 1, value: 'A' },
      { id: 2, value: 'C' },
    ];
    act(() => {
      result.current.pushToUndoStack();
      setRowsImpl(editedRows);
    });
    rerender();
    // Undo
    act(() => {
      result.current.undo();
    });

    expect(testRows).toEqual(rows);

    // Redo
    act(() => {
      result.current.redo();
    });

    expect(testRows).toEqual(editedRows);
  });

  it('should handle keyboard shortcuts for undo/redo', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const ref = { current: container };
    renderHook(() => useGridEditController<Row>(rows, setRows, ref));
    // Simulate Ctrl+Z (undo)
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
      container.dispatchEvent(event);
    });
    // Simulate Ctrl+Y (redo)
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true });
      container.dispatchEvent(event);
    });
    // Simulate Ctrl+Shift+Z (redo)
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
      });
      container.dispatchEvent(event);
    });

    // No errors, handlers called (setRows not called because stack is empty)
    expect(setRows).not.toHaveBeenCalled();

    document.body.removeChild(container);
  });
});
