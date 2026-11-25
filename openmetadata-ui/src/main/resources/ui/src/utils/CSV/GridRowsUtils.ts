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
/**
 * Writes edits made to the rows a grid renders back into the full data
 * source, so rows a filter (e.g. a search) hides are kept. Rows map by
 * position: the grid only replaces rows, it never reorders them.
 *
 * Kept free of app imports: useGridEditController is bundled on its own by
 * playwright/browser-tests/gridEditors.spec.ts.
 */
export function mergeGridRows<T>(
  dataSource: T[],
  gridRows: T[],
  updatedGridRows: T[]
): T[] {
  if (gridRows === dataSource) {
    return updatedGridRows;
  }
  const updatedByRow = new Map(
    gridRows.map((row, index) => [row, updatedGridRows[index]])
  );

  return dataSource.map((row) => updatedByRow.get(row) ?? row);
}
