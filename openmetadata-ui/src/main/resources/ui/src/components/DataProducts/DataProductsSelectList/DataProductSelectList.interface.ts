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
import { ReactNode } from 'react';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { Paging } from '../../../generated/type/paging';

export type DataProductSelectOption = {
  label: string;
  value: DataProduct;
};

export interface DataProductsSelectListProps {
  /** The asset's data products; checked when the picker opens. */
  selectedDataProducts: EntityReference[];
  fetchOptions: (
    search: string,
    page: number
  ) => Promise<{
    data: DataProductSelectOption[];
    paging: Paging;
  }>;
  multiple?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called on Apply with the full selection. */
  onSubmit: (dataProducts: DataProduct[]) => Promise<void> | void;
  /** The button the picker opens from. */
  children: ReactNode;
  debounceTimeout?: number;
}
