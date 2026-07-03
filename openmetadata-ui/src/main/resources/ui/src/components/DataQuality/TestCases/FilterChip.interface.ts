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
import { EntityReference } from '../../../generated/entity/type';

/** Render-agnostic control kinds a single filter can use. */
export type FilterControlType = 'select' | 'multiselect' | 'date' | 'user';

/** Value shape for a date-range control. */
export type FilterDateValue = { startTs?: number; endTs?: number };

/** Union of every filter value (string, string[], date range, …). */
export type FilterValue = string | string[] | FilterDateValue | undefined;

export interface FilterOptionData {
  label: string;
  value: string;
  subLabel?: string;
}

/**
 * Normalized, filter-agnostic description of a single active filter. Renderers
 * map over these: an antd form, an untitled-ui chip bar, etc. Adding a filter
 * here surfaces it in every renderer that consumes the descriptor.
 */
export interface FilterDescriptor {
  key: string;
  paramKey: string;
  label: string;
  controlType: FilterControlType;
  searchable: boolean;
  value?: FilterValue;
  options: FilterOptionData[];
  isLoading: boolean;
  onGetInitialOptions: () => void;
  onSearch?: (query: string) => void;
  onChange: (value?: FilterValue) => void;
  /** For `controlType: 'user'` — the selected user/team owner(s) and handler. */
  selectedOwners?: EntityReference[];
  onOwnerChange?: (owners?: EntityReference[]) => void;
}
