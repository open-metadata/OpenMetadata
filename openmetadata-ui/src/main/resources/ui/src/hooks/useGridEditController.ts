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

import { isEmpty } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Column } from 'react-data-grid';

const ARIA_ROWINDEX_ATTR = 'aria-rowindex';
const ARIA_COLINDEX_ATTR = 'aria-colindex';

export type Range = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

// --- Undo/Redo Stack Hook ---
function useUndoRedo(
  dataSource: Record<string, string>[],
  setDataSource: React.Dispatch<React.SetStateAction<Record<string, string>[]>>
) {
  const undoStack = useRef<Record<string, string>[][]>([]);
  const redoStack = useRef<Record<string, string>[][]>([]);

  const pushToUndoStack = useCallback(
    (rowsToPush?: Record<string, string>[]) => {
      const prevRows =
        undoStack.current.length > 0
          ? undoStack.current[undoStack.current.length - 1]
          : undefined;
      const nextRows = rowsToPush ?? dataSource;
      if (!prevRows || JSON.stringify(prevRows) !== JSON.stringify(nextRows)) {
        undoStack.current.push(nextRows.map((r) => ({ ...r })));
        redoStack.current = [];
      }
    },
    [dataSource]
  );

  const undo = useCallback(() => {
    if (undoStack.current.length > 0) {
      const previous = undoStack?.current?.pop?.();
      if (previous) {
        redoStack.current.push(dataSource.map((r) => ({ ...r })));
        setDataSource(previous.map((r) => ({ ...r })));
      }
    }
  }, [dataSource, setDataSource]);

  const redo = useCallback(() => {
    if (redoStack.current.length > 0) {
      const next = redoStack?.current?.pop?.();
      if (next) {
        undoStack.current.push(dataSource.map((r) => ({ ...r })));
        setDataSource(next.map((r) => ({ ...r })));
      }
    }
  }, [dataSource, setDataSource]);

  return { pushToUndoStack, undo, redo };
}

// --- Selection State Hook ---
function useSelectionState(dataSource: Record<string, string>[]) {
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);
  const getFinalSelectedRange = useCallback(() => {
    if (!selectedRange) {
      return null;
    }
    if (selectedRange.startRow === -1) {
      return {
        startRow: 0,
        endRow: dataSource.length - 1,
        startCol: selectedRange.startCol,
        endCol: selectedRange.endCol,
      };
    } else {
      return selectedRange;
    }
  }, [selectedRange, dataSource]);

  return { selectedRange, setSelectedRange, getFinalSelectedRange };
}

// --- Clipboard Handlers Hook ---
function useClipboardHandlers(
  selectedRange: Range | null,
  getFinalSelectedRange: () => Range | null,
  dataSource: Record<string, string>[],
  setDataSource: React.Dispatch<React.SetStateAction<Record<string, string>[]>>,
  columns: Column<Record<string, string>>[],
  pushToUndoStack: (rowsToPush?: Record<string, string>[]) => void
) {
  const handleCopy = useCallback(() => {
    const range = getFinalSelectedRange();
    if (range && dataSource.length > 0) {
      const { startRow, endRow, startCol, endCol } = range;
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);

      const tsv: string[] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const row = dataSource[r];
        const rowValues: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          const key = columns[c].key;
          let value = row[key];
          if (value === undefined || value === null) {
            value = '';
          }
          rowValues.push(value || '');
        }
        tsv.push(rowValues.join(','));
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(tsv.join('\n'));

        return undefined;
      } else {
        // Selecting the textarea moves focus off the grid cell. Restore it afterwards,
        // otherwise every subsequent key (arrow navigation, Ctrl+V) is delivered to <body>
        // and the grid stops responding until the user clicks a cell again.
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const textarea = document.createElement('textarea');
        textarea.value = tsv.join('\n');
        document.body.appendChild(textarea);
        textarea.select();
        let success = false;
        try {
          success = document.execCommand('copy');
        } finally {
          // execCommand can throw in some browsers rather than returning false; clean up and
          // hand focus back either way, so a failed copy cannot leave the grid unusable.
          document.body.removeChild(textarea);
          previouslyFocused?.focus();
        }

        return success;
      }
    }

    return undefined;
  }, [selectedRange, dataSource, columns, getFinalSelectedRange]);

  const handlePaste = useCallback(() => {
    const range = getFinalSelectedRange();
    const newRows = dataSource.map((row) => ({ ...row }));

    if (range && dataSource.length > 0) {
      return navigator.clipboard.readText().then((clipText) => {
        const { startRow, endRow, startCol, endCol } = range;
        const minRow = Math.min(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const lines = clipText.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const rowIdx = minRow + i;
          if (rowIdx >= dataSource.length) {
            break;
          }
          const cells = lines[i].split(',');
          for (let j = 0; j < cells.length; j++) {
            const colIdx = minCol + j;
            if (colIdx >= columns.length) {
              break;
            }
            const column = columns[colIdx];
            if (column.editable) {
              (newRows[rowIdx] as Record<string, string>)[column.key] =
                cells[j];
            }
          }
        }
        setDataSource(newRows);
        pushToUndoStack(dataSource);

        return newRows;
      });
    }

    return dataSource;
  }, [
    selectedRange,
    dataSource,
    setDataSource,
    pushToUndoStack,
    columns,
    getFinalSelectedRange,
  ]);

  return { handleCopy, handlePaste };
}

// --- Main Hook ---
export function useGridEditController({
  dataSource,
  setDataSource,
  columns,
  rowIdKey = 'id',
}: {
  dataSource: Record<string, string>[];
  setDataSource: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  columns: Column<Record<string, string>>[];
  rowIdKey?: string | null;
}) {
  const [gridContainer, setGridContainer] = useState<HTMLElement | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Undo/redo
  const { pushToUndoStack, undo, redo } = useUndoRedo(
    dataSource,
    setDataSource
  );
  // Selection state
  const { selectedRange, setSelectedRange, getFinalSelectedRange } =
    useSelectionState(dataSource);
  // Clipboard
  const { handleCopy, handlePaste } = useClipboardHandlers(
    selectedRange,
    getFinalSelectedRange,
    dataSource,
    setDataSource,
    columns,
    pushToUndoStack
  );

  const isShiftArrow = useRef(false);
  const selectionStart = useRef<{ row: number; col: number } | null>(null);
  const selectionAnchor = useRef<{ row: number; col: number } | null>(null);
  const selectionFocus = useRef<{ row: number; col: number } | null>(null);

  const getCellsInRange = useCallback(() => {
    const finalSelectedRange = getFinalSelectedRange();
    if (!finalSelectedRange) {
      return [];
    }
    const cells: HTMLElement[] = [];
    const { startRow, endRow, startCol, endCol } = finalSelectedRange;
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cell = gridContainer
          ?.querySelector<HTMLElement>(`[aria-rowindex="${row + 2}"]`) // +2 because of a header row
          ?.querySelector<HTMLElement>(`[aria-colindex="${col + 1}"]`);
        if (cell) {
          cells.push(cell);
        }
      }
    }

    return cells;
  }, [getFinalSelectedRange]);

  /* 
    Focus cell used,
    because when a range is selected and the user extends the range using Shift+click on another cell, 
    the clicked cell automatically receives focus. which is not desired behavior.
  */
  const focusCell = useCallback((cell: HTMLElement) => {
    setTimeout(() => {
      cell.click();
    }, 1);
  }, []);

  const highlightSelectedRange = useCallback(() => {
    const finalSelectedRange = getFinalSelectedRange();
    if (finalSelectedRange && gridContainer) {
      // First, reset all cell backgrounds to inherit
      gridContainer
        .querySelectorAll<HTMLElement>('[aria-rowindex]')
        .forEach((rowElem) => {
          rowElem
            .querySelectorAll<HTMLElement>('[aria-colindex]')
            .forEach((cellElem) => {
              cellElem.classList.remove('rdg-cell-range-selections');
            });
        });

      const cells = getCellsInRange();
      if (cells.length > 1) {
        cells.forEach((cell) => {
          cell.classList.add('rdg-cell-range-selections');
        });
      }
    }
  }, [getFinalSelectedRange]);

  // Highlight selected range on selectedRange change and on grid scroll
  useEffect(() => {
    highlightSelectedRange();

    if (gridContainer) {
      gridContainer
        .querySelector('.rdg')
        ?.addEventListener('scroll', highlightSelectedRange, { passive: true });

      return () => {
        gridContainer
          .querySelector('.rdg')
          ?.removeEventListener('scroll', highlightSelectedRange);
      };
    }
  }, [highlightSelectedRange]);

  // Helper to get cell indices from event target
  const getCellIndices = useCallback(
    (target: EventTarget | null): { row: number; col: number } | null => {
      if (!(target instanceof HTMLElement)) {
        return null;
      }
      const rowAttr = target.parentElement?.getAttribute(ARIA_ROWINDEX_ATTR);
      const colAttr = target.getAttribute(ARIA_COLINDEX_ATTR);
      if (rowAttr !== null && colAttr !== null) {
        // Convert ARIA indices to zero-based: row = aria-rowindex - 2, col = aria-colindex - 1
        return {
          row: parseInt(rowAttr ?? '0', 10) - 2,
          col: parseInt(colAttr ?? '0', 10) - 1,
        };
      }
      const closestCell = target.closest('.rdg-cell');
      if (closestCell) {
        return getCellIndices(closestCell);
      }

      return null;
    },
    []
  );

  // Mouse event handlers for range selection
  useEffect(() => {
    if (!gridContainer) {
      return;
    }

    function onMouseDown(e: MouseEvent) {
      const indices = getCellIndices(e.target);
      if (indices) {
        if (isShiftArrow.current) {
          const activeCell = document.activeElement as HTMLElement;
          const indicesOfFocusedCell = getCellIndices(activeCell);
          const indicesOfMouseDownCell = getCellIndices(
            e.target as HTMLElement
          );
          if (indicesOfFocusedCell && indicesOfMouseDownCell) {
            setSelectedRange({
              startRow: Math.min(
                indicesOfFocusedCell.row,
                indicesOfMouseDownCell.row
              ),
              endRow: Math.max(
                indicesOfFocusedCell.row,
                indicesOfMouseDownCell.row
              ),
              startCol: Math.min(
                indicesOfFocusedCell.col,
                indicesOfMouseDownCell.col
              ),
              endCol: Math.max(
                indicesOfFocusedCell.col,
                indicesOfMouseDownCell.col
              ),
            });
            focusCell(activeCell);
          }
        } else {
          setIsSelecting(true);
          selectionStart.current = indices;
          setSelectedRange({
            startRow: indices.row,
            startCol: indices.col,
            endRow: indices.row,
            endCol: indices.col,
          });
          focusCell(e.target as HTMLElement);
        }
      }
    }

    function onMouseOver(e: MouseEvent) {
      if (!isSelecting || !selectionStart.current) {
        return;
      }
      const indices = getCellIndices(e.target);
      if (indices) {
        const start = selectionStart.current;
        setSelectedRange(() => {
          return {
            startRow: Math.min(start.row, indices.row),
            startCol: Math.min(start.col, indices.col),
            endRow: Math.max(start.row, indices.row),
            endCol: Math.max(start.col, indices.col),
          };
        });
      }
    }

    function onMouseUp() {
      setIsSelecting(false);
      selectionStart.current = null;
    }

    gridContainer.addEventListener('mousedown', onMouseDown);
    gridContainer.addEventListener('mouseover', onMouseOver);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      gridContainer.removeEventListener('mousedown', onMouseDown);
      gridContainer.removeEventListener('mouseover', onMouseOver);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [gridContainer, isSelecting]);

  // Keyboard event handlers for range selection, undo/redo, and select all
  useEffect(() => {
    if (!gridContainer) {
      return;
    }

    // handleCopy & handlePaste on header cell focused as react-data-grid only
    // triggers copy/paste shortcuts on body cells.
    function handleHeaderCopyPaste(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.getAttribute('role') === 'columnheader' &&
        (e.ctrlKey || e.metaKey)
      ) {
        if (e.key.toLowerCase() === 'c') {
          handleCopy();
        } else if (e.key.toLowerCase() === 'v') {
          handlePaste();
        }
      }
    }

    // Returns true when the key combination was an undo/redo shortcut (and
    // therefore already handled) so the caller can stop further processing.
    function handleUndoRedo(e: KeyboardEvent): boolean {
      const isUndo =
        (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
      const isRedo =
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' ||
          (e.shiftKey && e.key.toLowerCase() === 'z'));

      if (isUndo) {
        e.stopPropagation();
        e.preventDefault();
        undo();

        return true;
      }
      if (isRedo) {
        e.stopPropagation();
        e.preventDefault();
        redo();

        return true;
      }

      return false;
    }

    // Returns true when Ctrl/Cmd+A was pressed (and therefore already
    // handled) so the caller can stop further processing.
    function handleSelectAll(e: KeyboardEvent): boolean {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (dataSource.length > 0) {
          setSelectedRange({
            startRow: 0,
            startCol: 0,
            endRow: dataSource.length - 1,
            endCol: columns.length - 1,
          });
        }

        return true;
      }

      return false;
    }

    function clearColumnCells(colIndex: number) {
      const column = columns[colIndex];
      if (column && column.editable) {
        const newRows = [...dataSource];
        for (let row = 0; row < newRows.length; row++) {
          newRows[row] = { ...newRows[row], [column.key]: '' };
        }
        setDataSource(newRows);
        pushToUndoStack(dataSource);
      }
    }

    function clearRowCells(rowIndex: number) {
      if (rowIndex >= 0 && rowIndex < dataSource.length) {
        const newRows = [...dataSource];
        const row = newRows[rowIndex];
        columns.forEach((column) => {
          if (column.editable) {
            row[column.key] = '';
          }
        });
        setDataSource(newRows);
        pushToUndoStack(dataSource);
      }
    }

    function clearRangeCells(range: Range) {
      const { startRow, endRow, startCol, endCol } = range;
      const newRows = [...dataSource];

      for (let row = startRow; row <= endRow; row++) {
        if (row < newRows.length) {
          for (let col = startCol; col <= endCol; col++) {
            const column = columns[col];
            if (column && column.editable) {
              newRows[row] = { ...newRows[row], [column.key]: '' };
            }
          }
        }
      }

      setDataSource(newRows);
      pushToUndoStack(dataSource);
    }

    function clearSingleCell(target: Element) {
      const cellIndices = getCellIndices(target);
      if (cellIndices) {
        const { row, col } = cellIndices;
        const column = columns[col];

        if (column && column.editable && row < dataSource.length) {
          const newRows = [...dataSource];
          newRows[row] = { ...newRows[row], [column.key]: '' };
          setDataSource(newRows);
          pushToUndoStack(dataSource);
        }
      }
    }

    function isInInputElement(target: HTMLElement): boolean {
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      );
    }

    // Custom editors like a tag selector or dropdown (e.g. tag selector,
    // dropdown) render outside the plain input/textarea case above.
    function isInCustomEditorElement(target: HTMLElement): boolean {
      return Boolean(
        target.closest('.async-select-list') ||
          target.closest('.react-grid-select-dropdown') ||
          target.closest('.ant-select') ||
          target.closest('.ant-select-dropdown')
      );
    }

    // Clears whole column, whole row, the active range selection, or a
    // single cell, whichever the delete target resolves to (in that
    // priority order).
    function dispatchDeleteTarget(target: HTMLElement) {
      const isInColumnHeader =
        target.closest('.rdg-header-row') ||
        target.getAttribute('role') === 'columnheader';
      const isInRowHeader =
        target.closest('.rdg-row-header') ||
        target.getAttribute('role') === 'rowheader';

      if (isInColumnHeader) {
        const colAttr = target.getAttribute(ARIA_COLINDEX_ATTR);
        if (colAttr) {
          clearColumnCells(parseInt(colAttr, 10) - 1);
        }
      } else if (isInRowHeader) {
        const rowAttr = target.getAttribute(ARIA_ROWINDEX_ATTR);
        if (rowAttr) {
          // -2 for header row offset
          clearRowCells(parseInt(rowAttr, 10) - 2);
        }
      } else if (selectedRange) {
        clearRangeCells(selectedRange);
      } else {
        clearSingleCell(target);
      }
    }

    // Handles Delete/Backspace to clear cell content. No-op for any other
    // key.
    function handleDeleteKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') {
        return;
      }

      // Only handle if we're in a cell and not in a text input
      const target = e.target as HTMLElement;
      const isInInput = isInInputElement(target);
      const isInCustomEditor = isInCustomEditorElement(target);

      if (!isInInput && !isInCustomEditor) {
        e.preventDefault();
        e.stopPropagation();
        dispatchDeleteTarget(target);

        return;
      }

      // For custom editors, we need to handle the case where the event is
      // stopped but we still want to clear the cell content.
      if (isInCustomEditor) {
        const cellElement = target.closest('.rdg-cell');
        if (cellElement) {
          clearSingleCell(cellElement);
        }
      }
    }

    // Seeds selectionAnchor/selectionFocus (in place) from the currently
    // focused cell, or the start of the active range as a fallback, when
    // Shift+Arrow starts a new extension.
    function ensureSelectionAnchor(range: Range) {
      if (selectionAnchor.current && selectionFocus.current) {
        return;
      }

      const anchorIndices = getCellIndices(document.activeElement);
      if (anchorIndices) {
        selectionAnchor.current = anchorIndices;
        selectionFocus.current = anchorIndices;
      } else {
        // fallback: use start of current selection
        selectionAnchor.current = { row: range.startRow, col: range.startCol };
        selectionFocus.current = { row: range.startRow, col: range.startCol };
      }
    }

    // Pure: returns the focus point moved one step in the arrow-key
    // direction, clamped to the grid bounds.
    function moveFocusForKey(
      key: string,
      focus: { row: number; col: number },
      lastRowIndex: number,
      lastColIndex: number
    ): { row: number; col: number } {
      const clamp = (val: number, min: number, max: number) =>
        Math.max(min, Math.min(max, val));

      const rowDelta = (
        { ArrowUp: -1, ArrowDown: 1 } as Record<string, number>
      )[key];
      const colDelta = (
        { ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>
      )[key];

      if (rowDelta !== undefined) {
        return { ...focus, row: clamp(focus.row + rowDelta, 0, lastRowIndex) };
      }
      if (colDelta !== undefined) {
        return { ...focus, col: clamp(focus.col + colDelta, 0, lastColIndex) };
      }

      return focus;
    }

    // Shift+Arrow extends the range selection (Excel-like); a plain arrow key
    // press (no Shift) clears the active selection and lets the grid navigate.
    function handleShiftArrowSelection(e: KeyboardEvent) {
      const isArrowKey = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(e.key);

      if (selectedRange && e.shiftKey && isArrowKey) {
        ensureSelectionAnchor(selectedRange);

        // Get anchor (fixed)
        const anchor = selectionAnchor.current as { row: number; col: number };
        const focus = moveFocusForKey(
          e.key,
          selectionFocus.current as { row: number; col: number },
          dataSource.length - 1,
          columns.length - 1
        );
        selectionFocus.current = focus;

        // Update selection from anchor to new focus
        setSelectedRange({
          startRow: Math.min(anchor.row, focus.row),
          endRow: Math.max(anchor.row, focus.row),
          startCol: Math.min(anchor.col, focus.col),
          endCol: Math.max(anchor.col, focus.col),
        });

        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (!e.shiftKey && isArrowKey) {
        setSelectedRange(null);
        selectionAnchor.current = null;
        selectionFocus.current = null;
      }
    }

    function keyHandler(e: KeyboardEvent) {
      if (e.shiftKey) {
        isShiftArrow.current = true;
      }

      // Only handle undo/redo, select all, etc.
      // Do NOT handle Arrow keys or Tab for cell movement!
      // Let the grid handle navigation and focus.

      // Only respond if the event target is a cell
      if (
        !(
          e.target instanceof HTMLElement &&
          (e.target.classList.contains('rdg-cell') ||
            e.target.closest('.rdg-cell'))
        )
      ) {
        return;
      }

      handleHeaderCopyPaste(e);

      if (handleUndoRedo(e)) {
        return;
      }

      if (handleSelectAll(e)) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteKey(e);

        return;
      }

      handleShiftArrowSelection(e);
    }

    function keyUpHandler(e: KeyboardEvent) {
      if (e.key === 'Shift') {
        isShiftArrow.current = false;
      }
    }

    gridContainer.addEventListener('keydown', keyHandler as EventListener);
    gridContainer.addEventListener('keyup', keyUpHandler as EventListener);

    return () => {
      if (gridContainer) {
        gridContainer.removeEventListener(
          'keydown',
          keyHandler as EventListener
        );
        gridContainer.removeEventListener(
          'keyup',
          keyUpHandler as EventListener
        );
      }
    };
  }, [
    undo,
    redo,
    gridContainer,
    dataSource,
    selectedRange,
    columns,
    setDataSource,
    pushToUndoStack,
  ]);

  useEffect(() => {
    if (!gridContainer) {
      return;
    }

    function onCellFocus(e: FocusEvent) {
      // Only update selectedRange if Shift is NOT pressed, because shift + cell click should extend the selection
      if (isShiftArrow.current || selectedRange) {
        return;
      }
      const target =
        (e.target as HTMLElement)?.closest?.('.rdg-cell') ||
        (e.target as HTMLElement);
      if (
        target.classList.contains('rdg-cell') &&
        target.parentElement?.getAttribute('role') === 'row'
      ) {
        const rowAttr = target.parentElement?.getAttribute(ARIA_ROWINDEX_ATTR);
        const colAttr = target.getAttribute(ARIA_COLINDEX_ATTR);
        if (rowAttr && colAttr) {
          const row = parseInt(rowAttr, 10) - 2;
          const col = parseInt(colAttr, 10) - 1;
          setSelectedRange({
            startRow: row,
            endRow: row,
            startCol: col,
            endCol: col,
          });
        }
      }
    }

    gridContainer.addEventListener('focusin', onCellFocus);

    return () => {
      gridContainer.removeEventListener('focusin', onCellFocus);
    };
  }, [gridContainer, setSelectedRange, selectedRange]);

  // Column/row header selection
  const handleColumnSelect = useCallback(
    (colIdx: number) => {
      if (dataSource.length === 0) {
        return;
      }
      setSelectedRange({
        startRow: 0,
        endRow: dataSource.length - 1,
        startCol: colIdx,
        endCol: colIdx,
      });
    },
    [dataSource]
  );

  const handleRowSelect = useCallback(
    (rowIdx: number) => {
      const colCount = columns.length;
      setSelectedRange({
        startRow: rowIdx,
        endRow: rowIdx,
        startCol: 0,
        endCol: colCount - 1,
      });
    },
    [columns]
  );

  const handleOnRowsChange = useCallback(
    (updatedRows: Record<string, string>[]) => {
      const hasPromises = updatedRows.some(
        (updatedRow) => updatedRow instanceof Promise
      );
      if (hasPromises) {
        updatedRows.forEach((updatedRow) => {
          if (updatedRow instanceof Promise) {
            updatedRow.then((newRows) => {
              setDataSource(newRows);
              pushToUndoStack(dataSource);
            });
          }
        });
      } else {
        setDataSource(updatedRows);
        pushToUndoStack(dataSource);
      }
    },
    [dataSource, setDataSource, pushToUndoStack]
  );

  const handleAddRow = useCallback(() => {
    setDataSource(
      (data: Record<string, string>[]): Record<string, string>[] => {
        setTimeout(() => {
          // Select first cell of last newly added row
          const rows = gridContainer?.querySelectorAll('.rdg-row');
          const lastRow = rows?.[rows.length - 1];
          const firstCell = lastRow?.querySelector('.rdg-cell');
          if (firstCell) {
            (firstCell as HTMLElement).click();
          }
        }, 1);

        return [
          ...data,
          rowIdKey === null ? {} : { [rowIdKey]: data.length + '' },
        ];
      }
    );
  }, [gridContainer, rowIdKey, setDataSource]);

  const focusFirstCell = useCallback(() => {
    const firstCell = gridContainer?.querySelector(
      '.rdg-cell[role="gridcell"]'
    );
    if (firstCell) {
      (firstCell as HTMLElement).click();
      const indices = getCellIndices(firstCell);
      if (indices) {
        selectionStart.current = indices;
        setSelectedRange({
          startRow: indices.row,
          startCol: indices.col,
          endRow: indices.row,
          endCol: indices.col,
        });
      }
    }
  }, [gridContainer, getCellIndices]);

  useEffect(() => {
    if (isEmpty(dataSource) || !gridContainer) {
      return;
    }

    // The grid is lazy-loaded via <LazyDataGrid> (React.lazy/Suspense), so when this effect
    // first fires the {@code gridContainer} ref points at the wrapper div but the
    // {@code .rdg-cell} children haven't been mounted yet — focusFirstCell would no-op.
    // Watch the container for the first cell to appear and fire focus then.
    const firstCellSelector = '.rdg-cell[role="gridcell"]';
    if (gridContainer.querySelector(firstCellSelector)) {
      focusFirstCell();

      return;
    }

    const observer = new MutationObserver(() => {
      if (gridContainer.querySelector(firstCellSelector)) {
        focusFirstCell();
        observer.disconnect();
      }
    });
    observer.observe(gridContainer, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [isEmpty(dataSource), focusFirstCell, gridContainer]);

  return {
    selectedRange,
    setSelectedRange,
    handleColumnSelect,
    handleRowSelect,
    handleCopy,
    handlePaste,
    undo,
    redo,
    pushToUndoStack,
    handleOnRowsChange,
    gridContainer,
    setGridContainer,
    handleAddRow,
    focusFirstCell,
  };
}
