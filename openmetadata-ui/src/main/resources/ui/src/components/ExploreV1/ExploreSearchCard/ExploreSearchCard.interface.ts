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

import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';

export interface ExploreSearchCardProps {
  id: string;
  className?: string;
  source: SearchedDataProps['data'][number]['_source'];
  matches?: {
    key: string;
    value: number;
  }[];
  handleSummaryPanelDisplay?: (
    details: SearchedDataProps['data'][number]['_source'],
    entityType: string
  ) => void;
  showEntityIcon?: boolean;
  checked?: boolean;
  showCheckboxes?: boolean;
  showTags?: boolean;
  openEntityInNewPage?: boolean;
  hideBreadcrumbs?: boolean;
  actionPopoverContent?: React.ReactNode;
  onCheckboxChange?: (checked: boolean) => void;
  searchValue?: string;
  score?: number;
  classNameForBreadcrumb?: string;
}
