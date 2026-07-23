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
import { ComponentType, lazy, Suspense } from 'react';
import type { DataGridProps, RenderEditCellProps } from 'react-data-grid';

const InternalDataGrid = lazy(async () => {
  const [module] = await Promise.all([
    import('react-data-grid'),
    import('react-data-grid/lib/styles.css'),
  ]);

  return module;
});

const InternalTextEditor = lazy(async () => {
  const module = await import('react-data-grid');

  return { default: module.textEditor as ComponentType<unknown> };
});

export function LazyDataGrid<R, SR = unknown>(props: DataGridProps<R, SR>) {
  const TypedDataGrid = InternalDataGrid as unknown as ComponentType<
    DataGridProps<R, SR>
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
