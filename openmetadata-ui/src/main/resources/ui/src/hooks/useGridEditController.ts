/*
 *  Copyright 2023 Collate.
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

import { useCallback, useEffect, useRef } from 'react';
import { CopyEvent, PasteEvent } from 'react-data-grid';

export function useGridEditController<RowType extends { [key: string]: any }>(
  rows: RowType[],
  setRows: (rows: RowType[]) => void,
  containerRef?: React.RefObject<HTMLElement>
) {
  const undoStack = useRef<RowType[][]>([]);
  const redoStack = useRef<RowType[][]>([]);

  const pushToUndoStack = useCallback(
    (rowsToPush?: RowType[]) => {
      const prevRows =
        undoStack.current.length > 0
          ? undoStack.current[undoStack.current.length - 1]
          : undefined;
      const nextRows = rowsToPush ?? rows;

      // Only push if different
      if (!prevRows || JSON.stringify(prevRows) !== JSON.stringify(nextRows)) {
        undoStack.current.push(nextRows.map((r) => ({ ...r })));
        redoStack.current = [];
      }
    },
    [rows]
  );

  const handleCopy = useCallback((event: CopyEvent<RowType>) => {
    const { sourceRow, sourceColumnKey } = event;
    const value = sourceRow[sourceColumnKey];
    navigator.clipboard.writeText(String(value ?? ''));
  }, []);

  const handlePaste = useCallback(
    (event: PasteEvent<RowType>) => {
      const { sourceColumnKey, targetColumnKey, targetRow } = event;
      const pastedValue = event.sourceRow[sourceColumnKey];

      const updatedRow = {
        ...targetRow,
        [targetColumnKey]: pastedValue,
      };

      const newRows = rows.map((row) => (row === targetRow ? updatedRow : row));
      setRows(newRows);

      pushToUndoStack(rows);

      return updatedRow;
    },
    [rows, setRows, pushToUndoStack]
  );

  const undo = useCallback(() => {
    if (undoStack.current.length > 0) {
      const previous = undoStack.current.pop()!;
      if (previous) {
        redoStack.current.push(rows.map((r) => ({ ...r })));
        setRows(previous.map((r) => ({ ...r })));
      }
    }
  }, [rows, setRows, undoStack.current, redoStack.current]);

  const redo = useCallback(() => {
    if (redoStack.current.length > 0) {
      const next = redoStack.current.pop()!;
      if (next) {
        undoStack.current.push(rows.map((r) => ({ ...r })));
        setRows(next.map((r) => ({ ...r })));
      }
    }
  }, [rows, setRows, undoStack.current, redoStack.current]);

  useEffect(() => {
    const container = containerRef?.current ?? document;
    const keyHandler = (e: KeyboardEvent) => {
      const isUndo =
        (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey; // Only Ctrl+Z (no Shift)

      const isRedo =
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' ||
          (e.shiftKey && e.key.toLowerCase() === 'z'));

      if (isUndo) {
        e.stopPropagation();
        e.preventDefault();
        undo();
      }
      if (isRedo) {
        e.stopPropagation();
        e.preventDefault();
        redo();
      }
    };

    container.addEventListener('keydown', keyHandler as EventListener);

    return () =>
      container.removeEventListener('keydown', keyHandler as EventListener);
  }, [undo, redo, containerRef]);

  return {
    handleCopy,
    handlePaste,
    undo,
    redo,
    pushToUndoStack,
  };
}
