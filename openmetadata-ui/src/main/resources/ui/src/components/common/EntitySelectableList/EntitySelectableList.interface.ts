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
import { PopoverProps } from 'antd';
import { EntityReference } from '../../../generated/entity/data/table';

export interface EntitySelectableListConfig<T> {
  toEntityReference: (items: T[]) => EntityReference[];
  fromEntityReference: (refs: EntityReference[]) => T[];
  fetchOptions: (
    searchText: string,
    after?: string
  ) => Promise<{
    data: EntityReference[];
    paging: { total: number; after?: string };
  }>;
  customTagRenderer: (item: EntityReference) => JSX.Element;
  searchPlaceholder: string;
  searchBarDataTestId: string;
  overlayClassName: string;
}

export interface EntitySelectableListProps<T> {
  selectedItems: T[];
  onUpdate: (items: T[]) => Promise<void>;
  onCancel: () => void;
  children: React.ReactNode;
  popoverProps?: Partial<PopoverProps>;
  listHeight?: number;
  config: EntitySelectableListConfig<T>;
}
