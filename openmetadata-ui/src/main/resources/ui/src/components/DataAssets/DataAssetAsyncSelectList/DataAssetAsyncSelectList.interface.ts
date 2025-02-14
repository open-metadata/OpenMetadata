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
import { DefaultOptionType } from 'antd/lib/select';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { Paging } from '../../../generated/type/paging';

export interface DataAssetOption extends DefaultOptionType {
  reference: EntityReference;
  displayName: string;
}

export interface FetchOptionsResponse {
  data: DataAssetOption[];
  paging: Paging;
}

export interface DataAssetAsyncSelectListProps {
  mode?: 'multiple';
  autoFocus?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
  value?: DataAssetOption | DataAssetOption[] | string | string[];
  debounceTimeout?: number;
  defaultValue?: string[];
  initialOptions?: DataAssetOption[];
  searchIndex?: SearchIndex;
  onChange?: (option: DataAssetOption | DataAssetOption[]) => void;
  filterFqns?: string[];
}
