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
import { AssetsDataType, LoadingState } from 'Models';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { ModifiedGlossaryData } from '../../pages/GlossaryPage/GlossaryPageV1.component';

export type GlossaryV1Props = {
  assetData: AssetsDataType;
  deleteStatus: LoadingState;
  isSearchResultEmpty: boolean;
  glossaryList: ModifiedGlossaryData[];
  selectedKey: string;
  expandedKey: string[];
  loadingKey: string[];
  handleExpandedKey: (key: string[]) => void;
  handleSelectedKey?: (key: string) => void;
  searchText: string;
  selectedData: Glossary | GlossaryTerm;
  isGlossaryActive: boolean;
  currentPage: number;
  handleAddGlossaryClick: () => void;
  handleAddGlossaryTermClick: () => void;
  updateGlossary: (value: Glossary) => Promise<void>;
  handleGlossaryTermUpdate: (value: GlossaryTerm) => Promise<void>;
  handleSelectedData: (key: string) => void;
  handleChildLoading: (status: boolean) => void;
  handleSearchText: (text: string) => void;
  onGlossaryDelete: (id: string) => void;
  onGlossaryTermDelete: (id: string) => void;
  onAssetPaginate: (num: string | number, activePage?: number) => void;
  onRelatedTermClick?: (fqn: string) => void;
  handleUserRedirection?: (name: string) => void;
  isChildLoading: boolean;
};
