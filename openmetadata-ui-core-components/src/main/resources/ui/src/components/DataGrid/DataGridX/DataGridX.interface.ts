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
import { AutocompleteProps, PaginationProps } from "@mui/material";
import { DataGridProps, GridColDef } from "@mui/x-data-grid";

export interface MUITableProps extends Omit<DataGridProps, "columns" | "rows"> {
  columns: GridColDef[];
  rows: Record<string, unknown>[];
  containerClassName?: string;
  resizableColumns?: boolean;
  extraTableFilters?: React.ReactNode;
  extraTableFiltersClassName?: string;
  defaultVisibleColumns?: string[];
  staticVisibleColumns?: string[];
  searchProps?: AutocompleteProps<unknown, false, false, false>;
  customPaginationProps?: PaginationProps;
  entityType?: string;
}
