/*
 *  Copyright 2022 Collate.
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

import { HTMLAttributes } from 'react';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/TableQueries/TableQueries.interface';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Mlmodel } from '../../generated/entity/data/mlmodel';

export interface MlModelDetailProp extends HTMLAttributes<HTMLDivElement> {
  updateMlModelDetailsState?: (data: DataAssetWithDomains) => void;
  mlModelDetail: Mlmodel;
  fetchMlModel: () => void;
  followMlModelHandler: () => Promise<void>;
  unFollowMlModelHandler: () => Promise<void>;
  descriptionUpdateHandler: (updatedMlModel: Mlmodel) => Promise<void>;
  tagUpdateHandler: (updatedMlModel: Mlmodel) => void;
  updateMlModelFeatures: (updatedMlModel: Mlmodel) => Promise<void>;
  settingsUpdateHandler: (updatedMlModel: Mlmodel) => Promise<void>;
  versionHandler: () => void;
  onExtensionUpdate: (updatedMlModel: Mlmodel) => Promise<void>;
  createThread: (data: CreateThread) => void;
  handleToggleDelete: () => void;
  onUpdateVote: (data: QueryVote, id: string) => Promise<void>;
}
