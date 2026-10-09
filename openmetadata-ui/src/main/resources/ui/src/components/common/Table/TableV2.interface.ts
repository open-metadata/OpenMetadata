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
import type { ReactNode } from 'react';

export interface FlatRow<T> {
  record: T;
  depth: number;
  actualIndex: number;
  hasChildren: boolean;
  rowKey: string;
}

/** Structural aliases to avoid a direct react-aria-components peer import. */
export type AriaKey = string | number;
export type AriaSelection = 'all' | Set<AriaKey>;
export interface AriaSortDescriptor {
  column?: AriaKey;
  direction?: 'ascending' | 'descending';
}

export interface TableV2ExtensionProps<T> {
  /** Accessible name of the grid; defaults to "data-table". */
  'aria-label'?: string;
  /**
   * Replaces the built-in search/filters row. Receives the "Customize columns"
   * control (null when column customization is off) so the call site decides
   * where it sits in its own toolbar.
   */
  renderToolbar?: (columnCustomize: ReactNode) => ReactNode;
  /**
   * Renders a record as a single cell spanning every column, selection column
   * included — section headers, "load more" rows. Return null/undefined to
   * render the record as a normal row.
   */
  fullWidthRowRender?: (record: T) => ReactNode;
}
