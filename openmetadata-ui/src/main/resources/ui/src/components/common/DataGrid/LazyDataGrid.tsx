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
import { ComponentType, Key, lazy, Suspense } from 'react';
import type {
  DataGridProps,
  RenderEditCellProps,
  RenderRowProps,
} from 'react-data-grid';

/**
 * Maps a row to the `data-testid` its element should carry, so a row can be
 * addressed by what it is rather than by where it sits. Return undefined to
 * leave a row unmarked.
 */
export type DataGridWithTestIdProps<R, SR = unknown> = DataGridProps<R, SR> & {
  rowTestId?: (row: R) => string | undefined;
};

/**
 * Rows are rendered by react-data-grid itself, so `renderers.renderRow` is the
 * only place an application can reach them. Wiring it here means every grid
 * gets the hook instead of each screen re-deriving one, and a grid that does
 * not pass `rowTestId` renders exactly the markup it did before.
 */
const InternalDataGrid = lazy(async () => {
  const [module] = await Promise.all([
    import('react-data-grid'),
    import('react-data-grid/lib/styles.css'),
  ]);

  const { default: DataGrid, Row } = module;

  const DataGridWithRowTestIds = <R, SR>({
    rowTestId,
    renderers,
    ...rest
  }: DataGridWithTestIdProps<R, SR>) => (
    <DataGrid
      {...(rest as DataGridProps<R, SR>)}
      renderers={{
        ...(rowTestId
          ? {
              renderRow: (key: Key, rowProps: RenderRowProps<R, SR>) => {
                const testId = rowTestId(rowProps.row);

                return (
                  <Row
                    {...rowProps}
                    key={key}
                    {...(testId ? { 'data-testid': testId } : {})}
                  />
                );
              },
            }
          : {}),
        ...renderers,
      }}
    />
  );

  return { default: DataGridWithRowTestIds as ComponentType<unknown> };
});

const InternalTextEditor = lazy(async () => {
  const module = await import('react-data-grid');

  return { default: module.textEditor as ComponentType<unknown> };
});

export function LazyDataGrid<R, SR = unknown>(
  props: DataGridWithTestIdProps<R, SR>
) {
  const TypedDataGrid = InternalDataGrid as unknown as ComponentType<
    DataGridWithTestIdProps<R, SR>
  >;

  return (
    <Suspense fallback={null}>
      <TypedDataGrid {...props} />
    </Suspense>
  );
}

export function lazyTextEditor<TRow, TSummaryRow = unknown>(
  props: RenderEditCellProps<TRow, TSummaryRow>
) {
  const TypedTextEditor = InternalTextEditor as unknown as ComponentType<
    RenderEditCellProps<TRow, TSummaryRow>
  >;

  return (
    <Suspense fallback={null}>
      <TypedTextEditor {...props} />
    </Suspense>
  );
}
