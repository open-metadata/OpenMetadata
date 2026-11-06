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
import { mergeGridRows } from '../utils/CSV/GridRowsUtils';

const ARIA_ROWINDEX_ATTR = 'aria-rowindex';
const ARIA_COLINDEX_ATTR = 'aria-colindex';

type SetRows = (rows: Record<string, string>[]) => void;

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
  setDataSource: SetRows,
  columns: Column<Record<string, string>>[],
  pushToUndoStack: (rowsToPush?: Record<string, string>[]) => void,
  onClipboardError?: () => void
) {
  // The cells of the last grid copy, pasted as-is. Other text is split into
  // rows and tab-separated columns (what spreadsheets copy) — except into a
  // single selected cell, where a description with commas or newlines from
  // another page must stay one value instead of overwriting its neighbours.
  const copiedCells = useRef<{ text: string; cells: string[][] } | null>(null);

  const handleCopy = useCallback(() => {
    const range = getFinalSelectedRange();
    if (range && dataSource.length > 0) {
      const { startRow, endRow, startCol, endCol } = range;
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);

      const cells: string[][] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const row = dataSource[r];
        const rowValues: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          rowValues.push(row[columns[c].key] || '');
        }
        cells.push(rowValues);
      }
      // Tab-separated, like spreadsheets, so it parses back the same way.
      const text = cells.map((rowValues) => rowValues.join('\t')).join('\n');
      // Stored with the line endings paste normalises, so a cell holding a
      // CRLF still matches and pastes back cell for cell.
      copiedCells.current = { text: text.replaceAll('\r\n', '\n'), cells };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => onClipboardError?.());

        return undefined;
      } else {
        // Selecting the textarea moves focus off the grid cell. Restore it afterwards,
        // otherwise every subsequent key (arrow navigation, Ctrl+V) is delivered to <body>
        // and the grid stops responding until the user clicks a cell again.
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const textarea = document.createElement('textarea');
        textarea.value = text;
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
  }, [
    selectedRange,
    dataSource,
    columns,
    getFinalSelectedRange,
    onClipboardError,
  ]);

  const handlePaste = useCallback(() => {
    const range = getFinalSelectedRange();
    const newRows = dataSource.map((row) => ({ ...row }));

    if (range && dataSource.length > 0) {
      return navigator.clipboard.readText().then(
        (clipText) => {
          const { startRow, endRow, startCol, endCol } = range;
          const minRow = Math.min(startRow, endRow);
          const minCol = Math.min(startCol, endCol);
          // A header selection (startRow -1) spans the column even when one
          // row is visible, so it is never a single cell.
          const isSingleCell =
            selectedRange?.startRow !== -1 &&
            startRow === endRow &&
            startCol === endCol;
          const normalizedText = clipText.replaceAll('\r\n', '\n');
          let pastedCells = normalizedText
            .split('\n')
            .map((line) => line.split('\t'));
          if (normalizedText === copiedCells.current?.text) {
            pastedCells = copiedCells.current.cells;
          } else if (isSingleCell) {
            pastedCells = [[clipText]];
          }
          for (let i = 0; i < pastedCells.length; i++) {
            const rowIdx = minRow + i;
            if (rowIdx >= dataSource.length) {
              break;
            }
            const cells = pastedCells[i];
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
        },
        () => {
          // Clipboard read was denied; the keystroke was already consumed.
          onClipboardError?.();

          return dataSource;
        }
      );
    }

    return dataSource;
  }, [
    selectedRange,
    dataSource,
    setDataSource,
    pushToUndoStack,
    columns,
    getFinalSelectedRange,
    onClipboardError,
  ]);

  return { handleCopy, handlePaste };
}

// --- Keyboard Handler Helpers ---
const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const DELETE_KEYS = ['Delete', 'Backspace'];

function isEventTargetGridCell(
  target: EventTarget | null
): target is HTMLElement {
  return (
    target instanceof HTMLElement &&
    (target.classList.contains('rdg-cell') || !!target.closest('.rdg-cell'))
  );
}

// Keys and mouse gestures inside an open cell editor belong to the editor
// (text selection, select-all, undo), not to grid range selection.
function isEventInsideCellEditor(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      'input, textarea, [contenteditable="true"], .rdg-editor-container'
    )
  );
}

// Delete/Backspace keep their own editor handling in handleDeleteOrBackspace.
function getGridKeyTarget(e: KeyboardEvent): HTMLElement | null {
  if (!isEventTargetGridCell(e.target)) {
    return null;
  }
  if (isEventInsideCellEditor(e.target) && !DELETE_KEYS.includes(e.key)) {
    return null;
  }

  return e.target;
}

// react-data-grid copies only body cells, and pastes only a cell it copied
// itself — a copy it forgets on any Escape, which closing a picker editor
// sends. So copy header cells here, and paste from the system clipboard for
// every cell.
function handleClipboardShortcuts(
  e: KeyboardEvent,
  target: HTMLElement,
  handleCopy: () => void,
  handlePaste: () => void
): boolean {
  if (!(e.ctrlKey || e.metaKey)) {
    return false;
  }
  const key = e.key.toLowerCase();

  if (key === 'v' && window.isSecureContext) {
    e.preventDefault();
    e.stopPropagation();
    handlePaste();

    return true;
  }
  if (key === 'c' && target.getAttribute('role') === 'columnheader') {
    handleCopy();

    return true;
  }

  return false;
}

function resolveUndoRedoAction(e: KeyboardEvent): 'undo' | 'redo' | null {
  const isCtrlOrMetaPressed = e.ctrlKey || e.metaKey;
  const isUndo =
    isCtrlOrMetaPressed && e.key.toLowerCase() === 'z' && !e.shiftKey;
  const isRedoKey =
    e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z');
  const isRedo = isCtrlOrMetaPressed && isRedoKey;

  if (isUndo) {
    return 'undo';
  }
  if (isRedo) {
    return 'redo';
  }

  return null;
}

function handleSelectAllShortcut(
  e: KeyboardEvent,
  dataSource: Record<string, string>[],
  columns: Column<Record<string, string>>[],
  setSelectedRange: React.Dispatch<React.SetStateAction<Range | null>>
): boolean {
  if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a')) {
    return false;
  }
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

function deleteColumn(
  target: HTMLElement,
  dataSource: Record<string, string>[],
  columns: Column<Record<string, string>>[],
  setDataSource: SetRows,
  pushToUndoStack: (rowsToPush?: Record<string, string>[]) => void
): void {
  const colAttr = target.getAttribute(ARIA_COLINDEX_ATTR);
  if (!colAttr) {
    return;
  }
  const colIndex = parseInt(colAttr, 10) - 1;
  const column = columns[colIndex];
  if (!column || !column.editable) {
    return;
  }

  const newRows = [...dataSource];
  for (let row = 0; row < newRows.length; row++) {
    newRows[row] = { ...newRows[row], [column.key]: '' };
  }
  setDataSource(newRows);
  pushToUndoStack(dataSource);
}

function deleteRow(
  target: HTMLElement,
  dataSource: Record<string, string>[],
  columns: Column<Record<string, string>>[],
  setDataSource: SetRows,
  pushToUndoStack: (rowsToPush?: Record<string, string>[]) => void
): void {
  const rowAttr = target.getAttribute(ARIA_ROWINDEX_ATTR);
  if (!rowAttr) {
    return;
  }
  const rowIndex = parseInt(rowAttr, 10) - 2; // -2 for header row offset
  if (rowIndex < 0 || rowIndex >= dataSource.length) {
    return;
  }

  const newRows = [...dataSource];
  const row = { ...newRows[rowIndex] };
  columns.forEach((column) => {
    if (column.editable) {
      row[column.key] = '';
    }
  });
  newRows[rowIndex] = row;

  setDataSource(newRows);
  pushToUndoStack(dataSource);
}

function deleteRangeSelection(
  selectedRange: Range,
  dataSource: Record<string, string>[],
  columns: Column<Record<string, string>>[],
  setDataSource: SetRows,
  pushToUndoStack: (rowsToPush?: Record<string, string>[]) => void
): void {
  const { startRow, endRow, startCol, endCol } = selectedRange;
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

function deleteSingleCellFromElement(
  element: Element | null,
  dataSource: Record<string, string>[],
  columns: Column<Record<string, string>>[],
  setDataSource: SetRows,
  pushToUndoStack: (rowsToPush?: Record<string, string>[]) => void,
  getCellIndices: (
    target: EventTarget | null
  ) => { row: number; col: number } | null
): void {
  const cellIndices = getCellIndices(element);
  if (!cellIndices) {
    return;
  }
  const { row, col } = cellIndices;
  const column = columns[col];

  if (column && column.editable && row < dataSource.length) {
    const newRows = [...dataSource];
    newRows[row] = { ...newRows[row], [column.key]: '' };
    setDataSource(newRows);
    pushToUndoStack(dataSource);
  }
}

function applyDeleteAction(
  target: HTMLElement,
  dataSource: Record<string, string>[],
  columns: Column<Record<string, string>>[],
  setDataSource: SetRows,
  pushToUndoStack: (rowsToPush?: Record<string, string>[]) => void,
  getCellIndices: (
    target: EventTarget | null
  ) => { row: number; col: number } | null,
  selectedRange: Range | null
): void {
  // Check if we're in a column header (whole column selection)
  const isInColumnHeader = !!(
    target.closest('.rdg-header-row') ||
    target.getAttribute('role') === 'columnheader'
  );

  // Check if we're in a row header (whole row selection)
  const isInRowHeader = !!(
    target.closest('.rdg-row-header') ||
    target.getAttribute('role') === 'rowheader'
  );

  if (isInColumnHeader) {
    deleteColumn(target, dataSource, columns, setDataSource, pushToUndoStack);
  } else if (isInRowHeader) {
    deleteRow(target, dataSource, columns, setDataSource, pushToUndoStack);
  } else if (selectedRange) {
    deleteRangeSelection(
      selectedRange,
      dataSource,
      columns,
      setDataSource,
      pushToUndoStack
    );
  } else {
    deleteSingleCellFromElement(
      target,
      dataSource,
      columns,
      setDataSource,
      pushToUndoStack,
      getCellIndices
    );
  }
}

function handleDeleteOrBackspace(
  e: KeyboardEvent,
  target: HTMLElement,
  dataSource: Record<string, string>[],
  columns: Column<Record<string, string>>[],
  setDataSource: SetRows,
  pushToUndoStack: (rowsToPush?: Record<string, string>[]) => void,
  getCellIndices: (
    target: EventTarget | null
  ) => { row: number; col: number } | null,
  selectedRange: Range | null
): boolean {
  // Only handle if we're in a cell and not in a text input
  const isInInput =
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.contentEditable === 'true';

  // Check if we're in a custom editor (like tag selector, dropdown, etc.)
  const isInCustomEditor = !!(
    target.closest('.async-select-list') ||
    target.closest('.react-grid-select-dropdown')
  );

  if (!isInInput && !isInCustomEditor) {
    e.preventDefault();
    e.stopPropagation();
    applyDeleteAction(
      target,
      dataSource,
      columns,
      setDataSource,
      pushToUndoStack,
      getCellIndices,
      selectedRange
    );

    return true;
  }

  // For custom editors, we need to handle the case where the event is stopped
  // but we still want to clear the cell content
  if (isInCustomEditor) {
    deleteSingleCellFromElement(
      target.closest('.rdg-cell'),
      dataSource,
      columns,
      setDataSource,
      pushToUndoStack,
      getCellIndices
    );
  }

  return false;
}

function extendSelectionWithShiftArrow(
  e: KeyboardEvent,
  selectedRange: Range,
  dataSource: Record<string, string>[],
  columns: Column<Record<string, string>>[],
  selectionAnchor: React.MutableRefObject<{ row: number; col: number } | null>,
  selectionFocus: React.MutableRefObject<{ row: number; col: number } | null>,
  setSelectedRange: React.Dispatch<React.SetStateAction<Range | null>>,
  getCellIndices: (
    target: EventTarget | null
  ) => { row: number; col: number } | null
): void {
  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  // Use getCellIndices(document.activeElement) as the anchor if not set
  if (!selectionAnchor.current || !selectionFocus.current) {
    const anchorIndices = getCellIndices(document.activeElement);
    if (anchorIndices) {
      selectionAnchor.current = anchorIndices;
      selectionFocus.current = anchorIndices;
    } else {
      // fallback: use start of current selection
      selectionAnchor.current = {
        row: selectedRange.startRow,
        col: selectedRange.startCol,
      };
      selectionFocus.current = {
        row: selectedRange.startRow,
        col: selectedRange.startCol,
      };
    }
  }
  // Get anchor (fixed)
  const anchor = selectionAnchor.current;
  const focus = { ...selectionFocus.current };

  // Move focus in the arrow direction
  if (e.key === 'ArrowUp') {
    focus.row = clamp(focus.row - 1, 0, dataSource.length - 1);
  } else if (e.key === 'ArrowDown') {
    focus.row = clamp(focus.row + 1, 0, dataSource.length - 1);
  } else if (e.key === 'ArrowLeft') {
    focus.col = clamp(focus.col - 1, 0, columns.length - 1);
  } else if (e.key === 'ArrowRight') {
    focus.col = clamp(focus.col + 1, 0, columns.length - 1);
  }
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
}

function handleArrowKeyNavigation(
  e: KeyboardEvent,
  selectedRange: Range | null,
  dataSource: Record<string, string>[],
  columns: Column<Record<string, string>>[],
  selectionAnchor: React.MutableRefObject<{ row: number; col: number } | null>,
  selectionFocus: React.MutableRefObject<{ row: number; col: number } | null>,
  setSelectedRange: React.Dispatch<React.SetStateAction<Range | null>>,
  getCellIndices: (
    target: EventTarget | null
  ) => { row: number; col: number } | null
): void {
  if (!ARROW_KEYS.includes(e.key)) {
    return;
  }

  if (selectedRange && e.shiftKey) {
    extendSelectionWithShiftArrow(
      e,
      selectedRange,
      dataSource,
      columns,
      selectionAnchor,
      selectionFocus,
      setSelectedRange,
      getCellIndices
    );
  } else if (!e.shiftKey) {
    setSelectedRange(null);
    selectionAnchor.current = null;
    selectionFocus.current = null;
  }
}

// --- Main Hook ---
export function useGridEditController({
  dataSource,
  setDataSource,
  columns,
  rows,
  rowIdKey = 'id',
  onClipboardError,
}: {
  dataSource: Record<string, string>[];
  setDataSource: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  columns: Column<Record<string, string>>[];
  /** Rows the grid renders, when it shows a filtered subset of dataSource. */
  rows?: Record<string, string>[];
  rowIdKey?: string | null;
  /**
   * Called when the clipboard cannot be read or written. Passed in, not
   * imported here, so this hook stays free of app modules (toast, i18n):
   * playwright/browser-tests/gridEditors.spec.ts bundles it on its own.
   */
  onClipboardError?: () => void;
}) {
  const [gridContainer, setGridContainer] = useState<HTMLElement | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Cell positions index into the rendered rows; writes go to the full data.
  const gridRows = rows ?? dataSource;
  const setGridRows = useCallback(
    (updatedGridRows: Record<string, string>[]) =>
      setDataSource(mergeGridRows(dataSource, gridRows, updatedGridRows)),
    [dataSource, gridRows, setDataSource]
  );

  // Undo/redo
  const { pushToUndoStack, undo, redo } = useUndoRedo(
    dataSource,
    setDataSource
  );
  // Snapshots the full data, never the filtered rows the edit helpers see.
  const pushFullUndo = useCallback(() => pushToUndoStack(), [pushToUndoStack]);
  // Selection state
  const { selectedRange, setSelectedRange, getFinalSelectedRange } =
    useSelectionState(gridRows);
  // A selected range indexes the rendered rows. Once a search or an edit
  // changes which rows those are, it would point at different rows.
  const gridRowIds = rows
    ?.map((row, index) => (rowIdKey ? row[rowIdKey] : index))
    .join(',');
  useEffect(() => {
    if (gridRowIds !== undefined) {
      setSelectedRange(null);
    }
  }, [gridRowIds, setSelectedRange]);
  // Clipboard
  const { handleCopy, handlePaste } = useClipboardHandlers(
    selectedRange,
    getFinalSelectedRange,
    gridRows,
    setGridRows,
    columns,
    pushFullUndo,
    onClipboardError
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

    return undefined;
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
      if (isEventInsideCellEditor(e.target)) {
        return;
      }
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
        }
      }
    }

    function onMouseOver(e: MouseEvent) {
      if (
        !isSelecting ||
        !selectionStart.current ||
        isEventInsideCellEditor(e.target)
      ) {
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

    function keyHandler(e: KeyboardEvent) {
      if (e.shiftKey) {
        isShiftArrow.current = true;
      }

      // Only handle undo/redo, select all, etc.
      // Do NOT handle Arrow keys or Tab for cell movement!
      // Let the grid handle navigation and focus.

      const target = getGridKeyTarget(e);
      if (!target) {
        return;
      }

      if (handleClipboardShortcuts(e, target, handleCopy, handlePaste)) {
        return;
      }

      // Undo/Redo
      const undoRedoAction = resolveUndoRedoAction(e);
      if (undoRedoAction) {
        e.stopPropagation();
        e.preventDefault();
        if (undoRedoAction === 'undo') {
          undo();
        } else {
          redo();
        }

        return;
      }

      // Select all (Ctrl+A)
      if (handleSelectAllShortcut(e, gridRows, columns, setSelectedRange)) {
        return;
      }

      // Handle Delete and Backspace keys to clear cell content
      if (DELETE_KEYS.includes(e.key)) {
        const shouldReturn = handleDeleteOrBackspace(
          e,
          target,
          gridRows,
          columns,
          setGridRows,
          pushFullUndo,
          getCellIndices,
          selectedRange
        );
        if (shouldReturn) {
          return;
        }
      }

      // Shift+Arrow for range selection (Excel-like), or clear selection on
      // plain arrow keys
      handleArrowKeyNavigation(
        e,
        selectedRange,
        gridRows,
        columns,
        selectionAnchor,
        selectionFocus,
        setSelectedRange,
        getCellIndices
      );
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
    gridRows,
    selectedRange,
    columns,
    setGridRows,
    pushFullUndo,
    handleCopy,
    handlePaste,
  ]);

  useEffect(() => {
    if (!gridContainer) {
      return;
    }

    function onCellFocus(e: FocusEvent) {
      // Only update selectedRange if Shift is NOT pressed, because shift + cell click should extend the selection
      if (
        isShiftArrow.current ||
        selectedRange ||
        isEventInsideCellEditor(e.target)
      ) {
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
      if (gridRows.length === 0) {
        return;
      }
      setSelectedRange({
        startRow: 0,
        endRow: gridRows.length - 1,
        startCol: colIdx,
        endCol: colIdx,
      });
    },
    [gridRows, setSelectedRange]
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
      // A react-data-grid paste hands back handlePaste's pending result;
      // handlePaste applies that update itself.
      if (updatedRows.some((updatedRow) => updatedRow instanceof Promise)) {
        return;
      }
      setDataSource(updatedRows);
      pushToUndoStack(dataSource);
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
