/*
 *  Copyright 2021 Collate
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

import { DropDownListItem } from '../dropdown/types';

export interface NavBarProps {
  settingDropdown: DropDownListItem[];
  supportDropdown: DropDownListItem[];
  profileDropdown: DropDownListItem[];
  searchValue: string;
  isTourRoute?: boolean;
  isFeatureModalOpen: boolean;
  pathname: string;
  isSearchBoxOpen: boolean;
  username: string;
  handleSearchBoxOpen: (value: boolean) => void;
  handleFeatureModal: (value: boolean) => void;
  handleSearchChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}
