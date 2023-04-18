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
import { AssetsUnion } from 'components/Assets/AssetsSelectionModal/AssetSelectionModal.interface';
import { EntityType } from 'enums/entity.enum';
import { SearchIndex } from 'enums/search.enum';

export const mapAssetsSearchIndex = {
  [EntityType.TABLE]: SearchIndex.TABLE,
  [EntityType.PIPELINE]: SearchIndex.PIPELINE,
  [EntityType.DASHBOARD]: SearchIndex.DASHBOARD,
  [EntityType.MLMODEL]: SearchIndex.MLMODEL,
  [EntityType.TOPIC]: SearchIndex.TOPIC,
  [EntityType.CONTAINER]: SearchIndex.CONTAINER,
};

export const AssetsFilterOptions: Array<{
  label: AssetsUnion;
  value: SearchIndex;
}> = [
  {
    label: EntityType.TABLE,
    value: SearchIndex.TABLE,
  },
  {
    label: EntityType.TOPIC,
    value: SearchIndex.TOPIC,
  },
  {
    label: EntityType.DASHBOARD,
    value: SearchIndex.DASHBOARD,
  },
  {
    label: EntityType.PIPELINE,
    value: SearchIndex.PIPELINE,
  },
  {
    label: EntityType.MLMODEL,
    value: SearchIndex.MLMODEL,
  },
  {
    label: EntityType.CONTAINER,
    value: SearchIndex.CONTAINER,
  },
];
