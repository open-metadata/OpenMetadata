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
import { Column } from 'react-data-grid';

export type Range = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

/**
 * useGridEditController
 * Provides Excel-like range selection, copy-paste, and undo-redo for react-data-grid.
 * All mouse/keyboard event binding is handled internally.
 */
export function useGridEditController<RowType extends { [key: string]: any }>({
  dataSource,
  setDataSource,
  columns,
}: {
  dataSource: RowType[];
  setDataSource: React.Dispatch<React.SetStateAction<RowType[]>>;
  columns: Column<RowType>[];
}) {
  const [gridContainer, setGridContainer] = useState<HTMLElement | null>(null);
  const isShiftArrow = useRef(false);

  // Undo/redo stacks
  const undoStack = useRef<RowType[][]>([]);
  const redoStack = useRef<RowType[][]>([]);

  // Range selection state
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);

  const getCellsInRange = useCallback(() => {
    if (!selectedRange) {
      return [];
    }
    const cells: HTMLElement[] = [];
    const { startRow, endRow, startCol, endCol } = selectedRange;
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cell = gridContainer
          ?.querySelector<HTMLElement>(`[aria-rowindex="${row + 2}"]`)
          ?.querySelector<HTMLElement>(`[aria-colindex="${col + 1}"]`);
        if (cell) {
          cells.push(cell);
        }
      }
    }

    return cells;
  }, [selectedRange]);

  const focusFirstSelectedCell = useCallback(() => {
    const cells = getCellsInRange();
    if (cells.length > 0) {
      setTimeout(() => {
        cells[0].click();
      }, 1);
    }
  }, [getCellsInRange]);

  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    focusFirstSelectedCell();
  }, [isSelecting, focusFirstSelectedCell]);

  const highlightSelectedRange = useCallback(() => {
    if (selectedRange && gridContainer) {
      // First, reset all cell backgrounds to inherit
      gridContainer
        .querySelectorAll<HTMLElement>('[aria-rowindex]')
        .forEach((rowElem) => {
          rowElem
            .querySelectorAll<HTMLElement>('[aria-colindex]')
            .forEach((cellElem) => {
              cellElem.style.backgroundColor = 'inherit';
            });
        });

      const cells = getCellsInRange();
      if (cells.length > 1) {
        cells.forEach((cell) => {
          cell.style.backgroundColor = 'lightblue';
        });
      }
    }
  }, [selectedRange]);

  useEffect(() => {
    highlightSelectedRange();
  }, [highlightSelectedRange]);

  // highlightSelectedRange on grid scroll
  useEffect(() => {
    if (gridContainer) {
      gridContainer
        .querySelector('.rdg')
        ?.addEventListener('scroll', highlightSelectedRange);

      return () => {
        gridContainer
          .querySelector('.rdg')
          ?.removeEventListener('scroll', highlightSelectedRange);
      };
    }

    return;
  }, [highlightSelectedRange]);

  // Helper: clamp value between min and max
  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  // Range selection logic
  const selectionStart = useRef<{ row: number; col: number } | null>(null);

  // Undo/redo logic
  const pushToUndoStack = useCallback(
    (rowsToPush?: RowType[]) => {
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

  // Helper to get cell indices from event target
  const getCellIndices = useCallback(
    (target: EventTarget | null): { row: number; col: number } | null => {
      if (!(target instanceof HTMLElement)) {
        return null;
      }
      const rowAttr = target.parentElement?.getAttribute('aria-rowindex');
      const colAttr = target.getAttribute('aria-colindex');
      if (rowAttr !== null && colAttr !== null) {
        // Convert ARIA indices to zero-based: row = aria-rowindex - 2, col = aria-colindex - 1
        return {
          row: parseInt(rowAttr ?? '0', 10) - 2,
          col: parseInt(colAttr ?? '0', 10) - 1,
        };
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
        setIsSelecting(true);
        selectionStart.current = indices;
        if (indices.row === -1) {
          // select all cells in the column
          setSelectedRange({
            startRow: 0,
            endRow: dataSource.length - 1,
            startCol: indices.col,
            endCol: indices.col,
          });
        } else {
          setSelectedRange({
            startRow: indices.row,
            startCol: indices.col,
            endRow: indices.row,
            endCol: indices.col,
          });
        }
        if (gridContainer) {
          e.preventDefault();
        }
      }
    }

    function onMouseOver(e: MouseEvent) {
      if (!isSelecting || !selectionStart.current) {
        return;
      }
      const indices = getCellIndices(e.target);
      if (indices) {
        const start = selectionStart.current!;
        if (start.row === -1) {
          setSelectedRange(() => {
            return {
              startRow: 0,
              startCol: Math.min(start.col, indices.col),
              endRow: dataSource.length - 1,
              endCol: Math.max(start.col, indices.col),
            };
          });
        } else if (indices.row === -1) {
          return;
        } else {
          setSelectedRange(() => {
            const start = selectionStart.current!;

            return {
              startRow: Math.min(start.row, indices.row),
              startCol: Math.min(start.col, indices.col),
              endRow: Math.max(start.row, indices.row),
              endCol: Math.max(start.col, indices.col),
            };
          });
        }
      }
    }

    function onMouseUp(e: MouseEvent) {
      setIsSelecting(false);
      selectionStart.current = null;
      const indices = getCellIndices(e.target);
      if (!indices) {
        setSelectedRange(null);
      }
    }

    gridContainer.addEventListener('mousedown', onMouseDown);
    gridContainer.addEventListener('mouseover', onMouseOver);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      gridContainer.removeEventListener('mousedown', onMouseDown);
      gridContainer.removeEventListener('mouseover', onMouseOver);
      window.removeEventListener('mouseup', onMouseUp);
      if (gridContainer) {
        gridContainer.style.userSelect = '';
      }
    };
    // eslint-disable-next-line
  }, [gridContainer, isSelecting]);

  // Keyboard event handlers for range selection, undo/redo, and select all
  useEffect(() => {
    if (!gridContainer) {
      return;
    }

    function keyHandler(e: KeyboardEvent) {
      // Only handle undo/redo, select all, etc.
      // Do NOT handle Arrow keys or Tab for cell movement!
      // Let the grid/browser handle navigation and focus.

      // Only respond if the event target is a cell
      if (
        !(
          e.target instanceof HTMLElement &&
          e.target.classList.contains('rdg-cell')
        )
      ) {
        return;
      }
      // Undo/Redo
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

        return;
      }
      if (isRedo) {
        e.stopPropagation();
        e.preventDefault();
        redo();

        return;
      }

      // Select all (Ctrl+A)
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

        return;
      }
      // Shift+Arrow for range selection
      if (
        selectedRange &&
        e.shiftKey &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        isShiftArrow.current = true;
        const { startRow, startCol, endRow, endCol } = selectedRange;
        let newEndRow = endRow;
        let newEndCol = endCol;
        if (e.key === 'ArrowUp') {
          newEndRow = clamp(endRow - 1, 0, dataSource.length - 1);
        } else if (e.key === 'ArrowDown') {
          newEndRow = clamp(endRow + 1, 0, dataSource.length - 1);
        } else if (e.key === 'ArrowLeft') {
          newEndCol = clamp(endCol - 1, 0, columns.length - 1);
        } else if (e.key === 'ArrowRight') {
          newEndCol = clamp(endCol + 1, 0, columns.length - 1);
        }
        setSelectedRange({
          startRow,
          startCol,
          endRow: newEndRow,
          endCol: newEndCol,
        });
        e.preventDefault();

        return;
      } else if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        isShiftArrow.current = false;
      }
    }

    gridContainer.addEventListener('keydown', keyHandler as EventListener);

    return () =>
      gridContainer.removeEventListener('keydown', keyHandler as EventListener);
  }, [undo, redo, gridContainer, dataSource, selectedRange, columns]);

  useEffect(() => {
    if (!gridContainer) {
      return;
    }

    function onCellFocus(e: FocusEvent) {
      // Only update selectedRange if Shift is NOT pressed
      if (isShiftArrow.current) {
        return;
      }
      const target = e.target as HTMLElement;
      if (
        target.classList.contains('rdg-cell') &&
        target.parentElement?.getAttribute('role') === 'row'
      ) {
        const rowAttr = target.parentElement?.getAttribute('aria-rowindex');
        const colAttr = target.getAttribute('aria-colindex');
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
  }, [gridContainer, setSelectedRange]);

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

  // Copy selected range as TSV
  const handleCopy = useCallback(() => {
    if (selectedRange && dataSource.length > 0) {
      const { startRow, endRow, startCol, endCol } = selectedRange;
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
      // Use the Clipboard API if available, otherwise fallback
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(tsv.join('\n')); // react-data-grid only gives first line so join with different character
      } else {
        // fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = tsv.join('\n');
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    }
  }, [selectedRange, dataSource, columns]);

  // Paste clipboard data into selected range
  const handlePaste = useCallback(() => {
    // Try to get clipboard data as TSV
    const newRows = dataSource.map((row) => ({ ...row }));
    if (selectedRange && dataSource.length > 0) {
      return navigator.clipboard.readText().then((clipText) => {
        const { startRow, endRow, startCol, endCol } = selectedRange;
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
            (newRows[rowIdx] as any)[columns[colIdx].key] = cells[j];
          }
        }
        setDataSource(newRows);
        pushToUndoStack(dataSource);

        return newRows;
      });
    }

    return dataSource;
  }, [selectedRange, dataSource, setDataSource, pushToUndoStack, columns]);

  const handleOnRowsChange = useCallback(
    (updatedRows: RowType[]) => {
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
    setDataSource((data: RowType[]): RowType[] => {
      setTimeout(() => {
        // Select first cell of last newly added row
        const rows = gridContainer?.querySelectorAll('.rdg-row');
        const lastRow = rows?.[rows.length - 1];
        const firstCell = lastRow?.querySelector('.rdg-cell');
        if (firstCell) {
          (firstCell as HTMLElement).click();
        }
      }, 1);

      return [...data, { id: data.length + '' } as unknown as RowType];
    });
  }, [gridContainer, setDataSource]);

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
    if (isEmpty(dataSource)) {
      return;
    }
    focusFirstCell();
  }, [isEmpty(dataSource), focusFirstCell]);

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
